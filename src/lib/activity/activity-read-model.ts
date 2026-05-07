import type { OperationRepository } from "@/core/use-cases/operations/OperationRepository";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { ReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import type { MediaWorkflowReadModel } from "@/lib/media/workflows/media-workflow-read-model";
import { filterPrimaryJobSnapshotsForWorkflows } from "@/lib/media/workflows/media-workflow-read-model";
import {
  isActivitySourceKind,
  type ActivityBucket,
  type ActivitySourceKind,
} from "@/lib/activity/activity-taxonomy";
import {
  projectJobActivity,
  projectMediaWorkflowActivity,
  projectOperationActivity,
  projectReferralActivity,
} from "@/lib/activity/activity-projectors";
import {
  buildActivityId,
  EMPTY_ACTIVITY_RECEIPT,
  parseActivityId,
  type ActivityItem,
  type ActivityInboxReadResult,
  type ActivityQuery,
  type ActivityReadResult,
  type ActivityReceiptAction,
  type ActivityReceiptPatch,
  type ActivityReceiptRecord,
  type ActivityReceiptRepository,
  type ActivitySourceRef,
} from "@/lib/activity/activity-types";

const DEFAULT_ACTIVITY_LIMIT = 25;
const MAX_ACTIVITY_LIMIT = 100;
const SOURCE_QUERY_LIMIT = 150;

const BUCKET_PRIORITY: Record<ActivityBucket, number> = {
  needs_attention: 0,
  running: 1,
  completed: 2,
  history: 3,
  diagnostic: 4,
};

export interface ActivityReadModelOptions {
  jobStatusQuery: JobStatusQuery;
  mediaWorkflowReadModel: MediaWorkflowReadModel;
  referralAnalytics: ReferralAnalyticsService;
  operationRepository: OperationRepository;
  receiptRepository: ActivityReceiptRepository;
}

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_ACTIVITY_LIMIT;
  }

  return Math.min(Math.floor(limit), MAX_ACTIVITY_LIMIT);
}

function normalizePage(page: number | undefined): number {
  if (page == null || !Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function normalizeQueryText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function searchableText(item: ActivityItem): string {
  return [
    item.id,
    item.sourceKind,
    item.sourceId,
    item.title,
    item.summary,
    item.statusLabel,
    item.sourceStatus,
    item.dedupeKey,
    item.primaryAction?.label,
    ...item.secondaryActions.map((action) => action.label),
  ].filter(Boolean).join(" ").toLowerCase();
}

function compareActivityItems(left: ActivityItem, right: ActivityItem): number {
  const pinnedDelta = Number(Boolean(right.receipt.pinnedAt)) - Number(Boolean(left.receipt.pinnedAt));
  if (pinnedDelta !== 0) {
    return pinnedDelta;
  }

  const bucketDelta = BUCKET_PRIORITY[left.bucket] - BUCKET_PRIORITY[right.bucket];
  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  const updatedDelta = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return right.id.localeCompare(left.id);
}

function applyReceipt(
  item: ActivityItem,
  receipt: ActivityReceiptRecord | null | undefined,
): ActivityItem {
  if (!receipt) {
    return {
      ...item,
      receipt: { ...EMPTY_ACTIVITY_RECEIPT },
    };
  }

  return {
    ...item,
    receipt: {
      readAt: receipt.readAt,
      acknowledgedAt: receipt.acknowledgedAt,
      dismissedAt: receipt.dismissedAt,
      pinnedAt: receipt.pinnedAt,
      updatedAt: receipt.updatedAt,
    },
  };
}

const COMPLETED_OUTPUT_SOURCE_KINDS = new Set<ActivitySourceKind>([
  "job",
  "media_workflow",
  "operation",
]);

function isDefaultUnreadActivity(item: ActivityItem): boolean {
  if (item.bucket === "needs_attention") {
    return true;
  }

  if (item.sourceKind === "referral_milestone" && item.bucket === "completed") {
    return true;
  }

  if (item.bucket === "completed" && COMPLETED_OUTPUT_SOURCE_KINDS.has(item.sourceKind)) {
    return true;
  }

  return item.severity === "warning" || item.severity === "critical";
}

export function isActivityUnread(item: ActivityItem): boolean {
  return isDefaultUnreadActivity(item)
    && !item.receipt.readAt
    && !item.receipt.dismissedAt;
}

export function isActivityInboxItem(item: ActivityItem): boolean {
  if (item.receipt.dismissedAt) {
    return false;
  }

  if (item.receipt.pinnedAt) {
    return true;
  }

  if (item.bucket === "needs_attention" && !item.receipt.acknowledgedAt) {
    return true;
  }

  return isActivityUnread(item);
}

function filterActivityItems(items: ActivityItem[], query: ActivityQuery): ActivityItem[] {
  const text = normalizeQueryText(query.q);
  return items.filter((item) => {
    if (!query.includeDismissed && item.receipt.dismissedAt) {
      return false;
    }
    if (query.bucket && item.bucket !== query.bucket) {
      return false;
    }
    if (query.sourceKind && item.sourceKind !== query.sourceKind) {
      return false;
    }
    if (query.sourceId && item.sourceId !== query.sourceId) {
      return false;
    }
    if (query.status && item.sourceStatus !== query.status) {
      return false;
    }
    if (text && !searchableText(item).includes(text)) {
      return false;
    }
    if (query.unreadOnly && !isActivityUnread(item)) {
      return false;
    }

    return true;
  });
}

function dedupeActivityItems(items: ActivityItem[]): ActivityItem[] {
  const seen = new Set<string>();
  const deduped: ActivityItem[] = [];

  for (const item of items) {
    if (seen.has(item.dedupeKey)) {
      continue;
    }

    seen.add(item.dedupeKey);
    deduped.push(item);
  }

  return deduped;
}

function receiptPatchForAction(action: ActivityReceiptAction, now: string): ActivityReceiptPatch {
  switch (action) {
    case "mark_read":
      return { readAt: now };
    case "acknowledge":
      return { readAt: now, acknowledgedAt: now };
    case "dismiss":
      return { readAt: now, dismissedAt: now };
    case "pin":
      return { pinnedAt: now };
    case "unpin":
      return { pinnedAt: null };
  }
}

export class ActivityReadModel {
  constructor(private readonly options: ActivityReadModelOptions) {}

  private async loadUserActivityItems(userId: string): Promise<ActivityItem[]> {
    const [jobs, workflows, referralItems, operationSummaries] = await Promise.all([
      this.options.jobStatusQuery.listUserJobSnapshots(userId, { limit: SOURCE_QUERY_LIMIT }),
      this.options.mediaWorkflowReadModel.listUserWorkflows(userId, { limit: SOURCE_QUERY_LIMIT }),
      this.options.referralAnalytics.getRecentActivity(userId, SOURCE_QUERY_LIMIT),
      this.options.operationRepository.listOperationsForUser(userId, { limit: SOURCE_QUERY_LIMIT }),
    ]);

    const primaryJobs = filterPrimaryJobSnapshotsForWorkflows(jobs, workflows);
    const operationActivities = await Promise.all(operationSummaries.map(async (summary) => {
      const availableActions = await this.options.operationRepository.listAvailableActions(summary.id)
        .catch(() => []);
      return projectOperationActivity(summary, availableActions);
    }));

    const projected = dedupeActivityItems([
      ...primaryJobs.map(projectJobActivity).filter((item): item is ActivityItem => Boolean(item)),
      ...workflows.map(projectMediaWorkflowActivity),
      ...referralItems.map((item) => projectReferralActivity(item, userId)),
      ...operationActivities.filter((item): item is ActivityItem => Boolean(item)),
    ]);

    const receipts = await this.options.receiptRepository.listByUserAndSources(
      userId,
      projected.map((item) => ({ sourceKind: item.sourceKind, sourceId: item.sourceId })),
    );
    const receiptByKey = new Map(receipts.map((receipt) => [
      buildActivityId(receipt),
      receipt,
    ]));
    const withReceipts = projected.map((item) =>
      applyReceipt(item, receiptByKey.get(item.id)),
    );

    return withReceipts;
  }

  private pageActivityItems(sourceItems: ActivityItem[], query: ActivityQuery): ActivityReadResult {
    const filtered = filterActivityItems(sourceItems, query).sort(compareActivityItems);
    const limit = clampLimit(query.limit);
    const page = normalizePage(query.page);
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      pageInfo: {
        page,
        limit,
        total: filtered.length,
        hasNextPage: start + limit < filtered.length,
        nextPage: start + limit < filtered.length ? page + 1 : null,
      },
    };
  }

  async listUserActivity(userId: string, query: ActivityQuery = {}): Promise<ActivityReadResult> {
    const withReceipts = await this.loadUserActivityItems(userId);
    return this.pageActivityItems(withReceipts, query);
  }

  async listUserInboxActivity(userId: string, query: ActivityQuery = {}): Promise<ActivityInboxReadResult> {
    const withReceipts = await this.loadUserActivityItems(userId);
    const inboxItems = filterActivityItems(withReceipts, {
      ...query,
      includeDismissed: false,
    }).filter(isActivityInboxItem);
    const unreadCount = inboxItems.filter(isActivityUnread).length;
    const paged = this.pageActivityItems(inboxItems, {
      ...query,
      includeDismissed: false,
    });

    return {
      ...paged,
      unreadCount,
    };
  }

  async findUserActivityById(
    userId: string,
    activityId: string,
    options: { includeDismissed?: boolean } = {},
  ): Promise<ActivityItem | null> {
    const source = parseActivityId(activityId);
    if (!source) {
      return null;
    }

    const result = await this.listUserActivity(userId, {
      sourceKind: source.sourceKind,
      sourceId: source.sourceId,
      includeDismissed: options.includeDismissed ?? true,
      limit: 1,
    });

    return result.items[0] ?? null;
  }

  async applyReceiptAction(
    userId: string,
    activityId: string,
    action: ActivityReceiptAction,
    now = new Date().toISOString(),
  ): Promise<ActivityItem | null> {
    const source = parseActivityId(activityId);
    if (!source) {
      return null;
    }

    const existing = await this.findUserActivityById(userId, activityId, {
      includeDismissed: true,
    });
    if (!existing) {
      return null;
    }

    await this.options.receiptRepository.upsert(userId, source, receiptPatchForAction(action, now), now);
    return this.findUserActivityById(userId, activityId, { includeDismissed: true });
  }

  async applyReceiptActionToInbox(
    userId: string,
    action: ActivityReceiptAction,
    now = new Date().toISOString(),
  ): Promise<{ updatedCount: number; inbox: ActivityInboxReadResult }> {
    const withReceipts = await this.loadUserActivityItems(userId);
    const unreadInboxItems = withReceipts
      .filter(isActivityInboxItem)
      .filter(isActivityUnread);

    await Promise.all(unreadInboxItems.map((item) =>
      this.options.receiptRepository.upsert(
        userId,
        { sourceKind: item.sourceKind, sourceId: item.sourceId },
        receiptPatchForAction(action, now),
        now,
      ),
    ));

    return {
      updatedCount: unreadInboxItems.length,
      inbox: await this.listUserInboxActivity(userId, { limit: DEFAULT_ACTIVITY_LIMIT }),
    };
  }
}

export function parseActivitySourceKind(value: string | null | undefined): ActivitySourceKind | undefined {
  if (!value) {
    return undefined;
  }

  return isActivitySourceKind(value) ? value : undefined;
}

export function isActivityReceiptAction(value: string): value is ActivityReceiptAction {
  return value === "mark_read"
    || value === "acknowledge"
    || value === "dismiss"
    || value === "pin"
    || value === "unpin";
}

export function isActivitySourceRef(value: unknown): value is ActivitySourceRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ActivitySourceRef>;
  return typeof candidate.sourceId === "string"
    && typeof candidate.sourceKind === "string"
    && isActivitySourceKind(candidate.sourceKind);
}
