import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationSummary } from "@/core/use-cases/operations/OperationRepository";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type {
  CanonicalMediaWorkflowSnapshot,
  MediaWorkflowReadModel,
} from "@/lib/media/workflows/media-workflow-read-model";
import type { ReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import type {
  ActivityReceiptPatch,
  ActivityReceiptRecord,
  ActivityReceiptRepository,
  ActivitySourceRef,
} from "@/lib/activity/activity-types";
import { ActivityReadModel } from "./activity-read-model";

function job(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "generate_audio",
    label: "Generate Audio",
    title: "Generate narration",
    subtitle: "MP3 audio",
    status: "running",
    sequence: 1,
    progressPercent: 25,
    progressLabel: "Rendering",
    summary: "Audio is rendering.",
    error: undefined,
    createdAt: "2026-05-04T10:00:00.000Z",
    startedAt: "2026-05-04T10:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-05-04T10:00:02.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultPayload: null,
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: "usr_1", visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

function workflow(
  overrides: Partial<CanonicalMediaWorkflowSnapshot> = {},
): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Create promo short",
    requestedDeliverable: "video",
    status: "blocked",
    stage: { key: "blocked", label: "Workflow needs attention", progressPercent: null },
    steps: [],
    finalArtifact: null,
    failure: { code: "missing_asset", message: "Image asset is missing." },
    linkedJobIds: ["job_1"],
    linkedJobs: [job()],
    operation: null,
    originMessageId: null,
    originTurnId: null,
    createdAt: "2026-05-04T10:01:00.000Z",
    updatedAt: "2026-05-04T10:01:02.000Z",
    completedAt: null,
    ...overrides,
  };
}

function operation(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: "op_1",
    kind: "media_workflow",
    title: "Approve media workflow",
    status: "awaiting_confirmation",
    riskLevel: "medium",
    revision: 1,
    conversationId: "conv_1",
    currentStepId: null,
    summary: "Confirm before rendering.",
    createdByUserId: "usr_1",
    createdByRole: "AUTHENTICATED",
    visibility: "user",
    createdAt: "2026-05-04T10:02:00.000Z",
    updatedAt: "2026-05-04T10:02:02.000Z",
    completedAt: null,
    stepCount: 1,
    actionCount: 1,
    artifactCount: 0,
    eventCount: 1,
    latestEventType: "action_exposed",
    latestEventAt: "2026-05-04T10:02:02.000Z",
    progress: {
      totalSteps: 1,
      pendingSteps: 0,
      readySteps: 1,
      runningSteps: 0,
      blockedSteps: 0,
      succeededSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percentComplete: 0,
    },
    ...overrides,
  };
}

class MemoryActivityReceiptRepository implements ActivityReceiptRepository {
  readonly records = new Map<string, ActivityReceiptRecord>();

  async findByUserAndSource(
    userId: string,
    source: ActivitySourceRef,
  ): Promise<ActivityReceiptRecord | null> {
    return this.records.get(this.key(userId, source)) ?? null;
  }

  async listByUserAndSources(
    userId: string,
    sources: readonly ActivitySourceRef[],
  ): Promise<ActivityReceiptRecord[]> {
    return sources.flatMap((source) => {
      const receipt = this.records.get(this.key(userId, source));
      return receipt ? [receipt] : [];
    });
  }

  async upsert(
    userId: string,
    source: ActivitySourceRef,
    patch: ActivityReceiptPatch,
    now = new Date().toISOString(),
  ): Promise<ActivityReceiptRecord> {
    const existing = this.records.get(this.key(userId, source));
    const next: ActivityReceiptRecord = {
      id: existing?.id ?? `actrec_${userId}_${source.sourceKind}_${source.sourceId}`,
      userId,
      sourceKind: source.sourceKind,
      sourceId: source.sourceId,
      readAt: Object.prototype.hasOwnProperty.call(patch, "readAt")
        ? patch.readAt ?? null
        : existing?.readAt ?? null,
      acknowledgedAt: Object.prototype.hasOwnProperty.call(patch, "acknowledgedAt")
        ? patch.acknowledgedAt ?? null
        : existing?.acknowledgedAt ?? null,
      dismissedAt: Object.prototype.hasOwnProperty.call(patch, "dismissedAt")
        ? patch.dismissedAt ?? null
        : existing?.dismissedAt ?? null,
      pinnedAt: Object.prototype.hasOwnProperty.call(patch, "pinnedAt")
        ? patch.pinnedAt ?? null
        : existing?.pinnedAt ?? null,
      updatedAt: now,
    };
    this.records.set(this.key(userId, source), next);
    return next;
  }

  seed(record: ActivityReceiptRecord): void {
    this.records.set(this.key(record.userId, record), record);
  }

  private key(userId: string, source: ActivitySourceRef): string {
    return `${userId}:${source.sourceKind}:${source.sourceId}`;
  }
}

describe("ActivityReadModel", () => {
  let jobsByUser: Record<string, CanonicalJobSnapshot[]>;
  let workflowsByUser: Record<string, CanonicalMediaWorkflowSnapshot[]>;
  let operationsByUser: Record<string, OperationSummary[]>;
  let receipts: MemoryActivityReceiptRepository;
  let listAvailableActionsMock: ReturnType<typeof vi.fn>;
  let model: ActivityReadModel;

  beforeEach(() => {
    jobsByUser = {
      usr_1: [
        job({ jobId: "job_1", status: "running", updatedAt: "2026-05-04T10:00:02.000Z" }),
        job({
          jobId: "job_failed",
          title: "Fix rendering",
          status: "failed",
          error: "Provider failed.",
          updatedAt: "2026-05-04T09:59:02.000Z",
        }),
        job({
          jobId: "job_done",
          title: "Published audio",
          status: "succeeded",
          updatedAt: "2026-05-04T10:05:02.000Z",
        }),
      ],
      usr_2: [
        job({
          jobId: "job_other",
          userId: "usr_2",
          title: "Other user job",
          status: "failed",
          updatedAt: "2026-05-04T11:00:02.000Z",
        }),
      ],
    };
    workflowsByUser = {
      usr_1: [
        workflow({
          workflowId: "mwf_1",
          linkedJobIds: ["job_1"],
          status: "blocked",
          updatedAt: "2026-05-04T10:01:02.000Z",
        }),
      ],
      usr_2: [],
    };
    operationsByUser = {
      usr_1: [
        operation({
          id: "op_1",
          title: "Confirm restore",
          updatedAt: "2026-05-04T10:02:02.000Z",
        }),
      ],
      usr_2: [],
    };
    receipts = new MemoryActivityReceiptRepository();
    listAvailableActionsMock = vi.fn(async () => []);
    model = new ActivityReadModel({
      jobStatusQuery: {
        getJobSnapshot: vi.fn(),
        getUserJobSnapshot: vi.fn(),
        listConversationJobSnapshots: vi.fn(),
        listUserJobSnapshots: vi.fn(async (userId: string) => jobsByUser[userId] ?? []),
      } satisfies JobStatusQuery,
      mediaWorkflowReadModel: {
        listUserWorkflows: vi.fn(async (userId: string) => workflowsByUser[userId] ?? []),
      } as unknown as MediaWorkflowReadModel,
      referralAnalytics: {
        getRecentActivity: vi.fn(async (userId: string) => userId === "usr_1"
          ? [{
              id: "ref_evt_1",
              referralId: "ref_1",
              referralCode: "qr-1",
              milestone: "credit_pending_review",
              title: "Credit pending review",
              description: "A referred lead is waiting for review.",
              occurredAt: "2026-05-04T10:03:02.000Z",
              href: "/referrals",
            }]
          : []),
      } as unknown as ReferralAnalyticsService,
      operationRepository: {
        listOperationsForUser: vi.fn(async (userId: string) => operationsByUser[userId] ?? []),
        listAvailableActions: listAvailableActionsMock,
      } as never,
      receiptRepository: receipts,
    });
  });

  it("projects jobs, workflows, referrals, and operations into a sorted user list", async () => {
    const result = await model.listUserActivity("usr_1");

    expect(result.items.map((item) => item.id)).toEqual([
      "referral_milestone:ref_evt_1",
      "operation:op_1",
      "media_workflow:mwf_1",
      "job:job_failed",
      "job:job_done",
    ]);
    expect(result.items).not.toContainEqual(expect.objectContaining({ id: "job:job_1" }));
    expect(result.pageInfo.total).toBe(5);
  });

  it("applies read, acknowledge, dismiss, and pin receipt state without changing source state", async () => {
    const now = "2026-05-04T12:00:00.000Z";
    const updated = await model.applyReceiptAction("usr_1", "job:job_failed", "acknowledge", now);

    expect(updated?.receipt).toMatchObject({
      readAt: now,
      acknowledgedAt: now,
      dismissedAt: null,
      pinnedAt: null,
    });
    expect(jobsByUser.usr_1.find((item) => item.jobId === "job_failed")?.status).toBe("failed");
  });

  it("hides dismissed activity by default and can include it explicitly", async () => {
    receipts.seed({
      id: "actrec_1",
      userId: "usr_1",
      sourceKind: "job",
      sourceId: "job_failed",
      readAt: "2026-05-04T12:00:00.000Z",
      acknowledgedAt: null,
      dismissedAt: "2026-05-04T12:01:00.000Z",
      pinnedAt: null,
      updatedAt: "2026-05-04T12:01:00.000Z",
    });

    const defaultResult = await model.listUserActivity("usr_1");
    const withDismissed = await model.listUserActivity("usr_1", { includeDismissed: true });

    expect(defaultResult.items.map((item) => item.id)).not.toContain("job:job_failed");
    expect(withDismissed.items.map((item) => item.id)).toContain("job:job_failed");
  });

  it("keeps pinned activity above bucket priority", async () => {
    receipts.seed({
      id: "actrec_1",
      userId: "usr_1",
      sourceKind: "job",
      sourceId: "job_done",
      readAt: null,
      acknowledgedAt: null,
      dismissedAt: null,
      pinnedAt: "2026-05-04T12:01:00.000Z",
      updatedAt: "2026-05-04T12:01:00.000Z",
    });

    const result = await model.listUserActivity("usr_1");

    expect(result.items[0]?.id).toBe("job:job_done");
  });

  it("filters by source kind, bucket, status, source id, and search text", async () => {
    await expect(model.listUserActivity("usr_1", { sourceKind: "media_workflow" }))
      .resolves.toMatchObject({ items: [expect.objectContaining({ id: "media_workflow:mwf_1" })] });
    await expect(model.listUserActivity("usr_1", { bucket: "completed" }))
      .resolves.toMatchObject({ items: [expect.objectContaining({ id: "job:job_done" })] });
    await expect(model.listUserActivity("usr_1", { status: "failed" }))
      .resolves.toMatchObject({ items: [expect.objectContaining({ id: "job:job_failed" })] });
    await expect(model.listUserActivity("usr_1", { sourceId: "op_1" }))
      .resolves.toMatchObject({ items: [expect.objectContaining({ id: "operation:op_1" })] });
    await expect(model.listUserActivity("usr_1", { q: "provider" }))
      .resolves.toMatchObject({ items: [expect.objectContaining({ id: "job:job_failed" })] });
  });

  it("paginates with stable page metadata", async () => {
    const result = await model.listUserActivity("usr_1", { limit: 2, page: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.pageInfo).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      hasNextPage: true,
      nextPage: 3,
    });
  });

  it("projects a durable inbox from unread attention, output, and business activity", async () => {
    const result = await model.listUserInboxActivity("usr_1");

    expect(result.items.map((item) => item.id)).toEqual([
      "referral_milestone:ref_evt_1",
      "operation:op_1",
      "media_workflow:mwf_1",
      "job:job_failed",
      "job:job_done",
    ]);
    expect(result.unreadCount).toBe(5);
  });

  it("keeps acknowledged attention out of the default inbox without deleting ledger history", async () => {
    const now = "2026-05-04T12:00:00.000Z";
    await model.applyReceiptAction("usr_1", "job:job_failed", "acknowledge", now);

    const inbox = await model.listUserInboxActivity("usr_1");
    const ledger = await model.listUserActivity("usr_1", { includeDismissed: true });

    expect(inbox.items.map((item) => item.id)).not.toContain("job:job_failed");
    expect(ledger.items).toContainEqual(expect.objectContaining({
      id: "job:job_failed",
      receipt: expect.objectContaining({ acknowledgedAt: now }),
    }));
  });

  it("marks unread inbox items read without deleting the activity", async () => {
    const now = "2026-05-04T12:00:00.000Z";
    const result = await model.applyReceiptActionToInbox("usr_1", "mark_read", now);
    const ledger = await model.listUserActivity("usr_1", { includeDismissed: true, unreadOnly: true });

    expect(result.updatedCount).toBe(5);
    expect(result.inbox.unreadCount).toBe(0);
    expect(result.inbox.items.map((item) => item.id)).toEqual([
      "referral_milestone:ref_evt_1",
      "operation:op_1",
      "media_workflow:mwf_1",
      "job:job_failed",
    ]);
    expect(ledger.items).toEqual([]);
  });

  it("does not expose another user's activity or receipts", async () => {
    receipts.seed({
      id: "actrec_1",
      userId: "usr_2",
      sourceKind: "job",
      sourceId: "job_other",
      readAt: "2026-05-04T12:00:00.000Z",
      acknowledgedAt: null,
      dismissedAt: null,
      pinnedAt: null,
      updatedAt: "2026-05-04T12:00:00.000Z",
    });

    const ownerResult = await model.listUserActivity("usr_1", { q: "Other user" });
    const otherResult = await model.listUserActivity("usr_2");

    expect(ownerResult.items).toEqual([]);
    expect(otherResult.items).toEqual([
      expect.objectContaining({
        id: "job:job_other",
        receipt: expect.objectContaining({ readAt: "2026-05-04T12:00:00.000Z" }),
      }),
    ]);
  });

  it("does not let a user mark another user's source receipt", async () => {
    const updated = await model.applyReceiptAction(
      "usr_1",
      "job:job_other",
      "mark_read",
      "2026-05-04T12:00:00.000Z",
    );

    expect(updated).toBeNull();
    await expect(receipts.findByUserAndSource("usr_1", {
      sourceKind: "job",
      sourceId: "job_other",
    })).resolves.toBeNull();
  });

  it("does not create receipts for hidden or deleted sources", async () => {
    await expect(model.applyReceiptAction("usr_1", "job:missing", "mark_read"))
      .resolves.toBeNull();
    await expect(model.findUserActivityById("usr_1", "job:missing"))
      .resolves.toBeNull();
  });

  it("dedupes repeated donor records by source dedupe key", async () => {
    model = new ActivityReadModel({
      jobStatusQuery: {
        getJobSnapshot: vi.fn(),
        getUserJobSnapshot: vi.fn(),
        listConversationJobSnapshots: vi.fn(),
        listUserJobSnapshots: vi.fn(async () => []),
      } satisfies JobStatusQuery,
      mediaWorkflowReadModel: {
        listUserWorkflows: vi.fn(async () => []),
      } as unknown as MediaWorkflowReadModel,
      referralAnalytics: {
        getRecentActivity: vi.fn(async () => [
          {
            id: "ref_evt_1",
            referralId: "ref_1",
            referralCode: "qr-1",
            milestone: "registered",
            title: "Referred user registered",
            description: "A referred user created an account.",
            occurredAt: "2026-05-04T10:03:02.000Z",
            href: "/referrals",
          },
          {
            id: "ref_evt_2",
            referralId: "ref_1",
            referralCode: "qr-1",
            milestone: "registered",
            title: "Referred user registered",
            description: "Duplicate donor event for the same milestone.",
            occurredAt: "2026-05-04T10:04:02.000Z",
            href: "/referrals",
          },
        ]),
      } as unknown as ReferralAnalyticsService,
      operationRepository: {
        listOperationsForUser: vi.fn(async () => []),
        listAvailableActions: vi.fn(async () => []),
      } as never,
      receiptRepository: receipts,
    });

    const result = await model.listUserActivity("usr_1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "referral_milestone:ref_evt_1",
      dedupeKey: "referral_milestone:ref_1:registered",
    });
  });

  it("suppresses workflow-linked job rows even when linked job snapshots are missing", async () => {
    workflowsByUser.usr_1 = [
      workflow({ linkedJobIds: ["job_1"], linkedJobs: [] }),
    ];

    const result = await model.listUserActivity("usr_1");

    expect(result.items.map((item) => item.id)).toContain("media_workflow:mwf_1");
    expect(result.items.map((item) => item.id)).not.toContain("job:job_1");
  });

  it("keeps operation activity if available actions expire while projecting", async () => {
    listAvailableActionsMock.mockRejectedValueOnce(new Error("Action expired"));

    const result = await model.listUserActivity("usr_1", { sourceKind: "operation" });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "operation:op_1",
        primaryAction: expect.objectContaining({ id: "open_operation" }),
      }),
    ]);
  });
});
