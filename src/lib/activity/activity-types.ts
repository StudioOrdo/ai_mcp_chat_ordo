import type { RoleName } from "@/core/entities/user";
import type {
  ActivityBucket,
  ActivitySeverity,
  ActivitySourceKind,
} from "@/lib/activity/activity-taxonomy";
import { isActivitySourceKind } from "@/lib/activity/activity-taxonomy";

export type ActivityActionTone = "primary" | "secondary" | "destructive";

export interface ActivityAction {
  id: string;
  label: string;
  href?: string;
  actionType?: string;
  tone?: ActivityActionTone;
  disabled?: boolean;
  disabledReason?: string | null;
}

export interface ActivityReceiptState {
  readAt: string | null;
  acknowledgedAt: string | null;
  dismissedAt: string | null;
  pinnedAt: string | null;
  updatedAt: string | null;
}

export interface ActivityItem {
  id: string;
  sourceKind: ActivitySourceKind;
  sourceId: string;
  userId: string;
  roleVisibility: readonly RoleName[];
  bucket: ActivityBucket;
  severity: ActivitySeverity;
  title: string;
  summary: string;
  statusLabel: string;
  sourceStatus: string;
  href: string;
  primaryAction: ActivityAction | null;
  secondaryActions: ActivityAction[];
  createdAt: string;
  updatedAt: string;
  dedupeKey: string;
  receipt: ActivityReceiptState;
}

export interface ActivitySourceRef {
  sourceKind: ActivitySourceKind;
  sourceId: string;
}

export interface ActivityReceiptRecord extends ActivitySourceRef, ActivityReceiptState {
  id: string;
  userId: string;
  updatedAt: string;
}

export type ActivityReceiptPatch = Partial<
  Pick<ActivityReceiptState, "readAt" | "acknowledgedAt" | "dismissedAt" | "pinnedAt">
>;

export type ActivityReceiptAction =
  | "mark_read"
  | "acknowledge"
  | "dismiss"
  | "pin"
  | "unpin";

export interface ActivityReceiptRepository {
  findByUserAndSource(
    userId: string,
    source: ActivitySourceRef,
  ): Promise<ActivityReceiptRecord | null>;
  listByUserAndSources(
    userId: string,
    sources: readonly ActivitySourceRef[],
  ): Promise<ActivityReceiptRecord[]>;
  upsert(
    userId: string,
    source: ActivitySourceRef,
    patch: ActivityReceiptPatch,
    now?: string,
  ): Promise<ActivityReceiptRecord>;
}

export interface ActivityQuery {
  bucket?: ActivityBucket;
  sourceKind?: ActivitySourceKind;
  sourceId?: string;
  status?: string;
  q?: string;
  limit?: number;
  page?: number;
  includeDismissed?: boolean;
  unreadOnly?: boolean;
}

export interface ActivityPageInfo {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  nextPage: number | null;
}

export interface ActivityReadResult {
  items: ActivityItem[];
  pageInfo: ActivityPageInfo;
}

export interface ActivityInboxReadResult extends ActivityReadResult {
  unreadCount: number;
}

export const EMPTY_ACTIVITY_RECEIPT: ActivityReceiptState = {
  readAt: null,
  acknowledgedAt: null,
  dismissedAt: null,
  pinnedAt: null,
  updatedAt: null,
};

export function buildActivityId(source: ActivitySourceRef): string {
  return `${source.sourceKind}:${source.sourceId}`;
}

export function parseActivityId(activityId: string): ActivitySourceRef | null {
  const separatorIndex = activityId.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === activityId.length - 1) {
    return null;
  }
  const sourceKind = activityId.slice(0, separatorIndex);
  if (!isActivitySourceKind(sourceKind)) {
    return null;
  }

  return {
    sourceKind,
    sourceId: activityId.slice(separatorIndex + 1),
  };
}
