import { describe, expect, it, vi } from "vitest";

import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { createRevisionReader } from "@/core/platform/revision/RevisionReader";

function createJobRepositoryMock(): JobQueueRepository {
  return {
    createJob: vi.fn(),
    findJobById: vi.fn(),
    findLatestEventForJob: vi.fn(),
    findLatestRenderableEventForJob: vi.fn(),
    findActiveJobByDedupeKey: vi.fn(),
    listJobsByConversation: vi.fn(),
    listJobsByUser: vi.fn(),
    appendEvent: vi.fn(),
    requeueExpiredRunningJobs: vi.fn(),
    listConversationEvents: vi.fn(),
    listUserEvents: vi.fn(),
    listEventsForUserJob: vi.fn(),
    claimNextQueuedJob: vi.fn(),
    transferJobsToUser: vi.fn(),
    updateJobStatus: vi.fn(),
    cancelJob: vi.fn(),
  };
}

function createFactoryRepositoryMock(): FactoryRepository {
  return {
    createWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    findWorkOrderById: vi.fn(),
    listWorkOrdersByUser: vi.fn(),
    saveProductionDAG: vi.fn(),
    findProductionDAGById: vi.fn(),
    findCurrentProductionDAGForWorkOrder: vi.fn(),
    replaceWorkOrderParents: vi.fn(),
    listParentWorkOrderIds: vi.fn(),
    upsertStageRun: vi.fn(),
    listStageRunsForWorkOrder: vi.fn(),
    appendOutput: vi.fn(),
    findOutputById: vi.fn(),
    listOutputsForWorkOrder: vi.fn(),
    createCheckpoint: vi.fn(),
    findLatestActiveCheckpoint: vi.fn(),
    markCheckpointConsumed: vi.fn(),
    appendEvent: vi.fn(),
    listEventsForWorkOrder: vi.fn(),
  };
}

describe("RevisionReader", () => {
  it("reads job revision through the canonical reader", async () => {
    const jobRepository = createJobRepositoryMock();
    const reader = createRevisionReader(jobRepository);

    vi.mocked(jobRepository.findJobById).mockResolvedValue({
      id: "job_1",
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "publish_content",
      status: "running",
      priority: 100,
      dedupeKey: null,
      initiatorType: "user",
      requestPayload: { postId: "post_1" },
      resultPayload: null,
      errorMessage: null,
      progressPercent: 50,
      progressLabel: "Publishing",
      attemptCount: 1,
      leaseExpiresAt: null,
      claimedBy: "worker_1",
      failureClass: null,
      nextRetryAt: null,
      recoveryMode: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      startedAt: "2026-04-01T00:00:01.000Z",
      completedAt: null,
      updatedAt: "2026-04-01T00:00:02.000Z",
    });
    vi.mocked(jobRepository.findLatestRenderableEventForJob).mockResolvedValue({
      id: "evt_1",
      jobId: "job_1",
      conversationId: "conv_1",
      sequence: 1,
      eventType: "progress",
      payload: { progressPercent: 50, progressLabel: "Publishing" },
      createdAt: "2026-04-01T00:00:02.000Z",
    });

    const result = await reader.getJobRevision("job_1");

    expect(result?.revision).toEqual(expect.objectContaining({
      executionId: "job_1",
      executionKind: "job",
      supportLevel: "reduced",
      state: "active",
    }));
    expect(result?.revision.actions).toEqual([
      expect.objectContaining({ operation: "cancel" }),
    ]);
  });

  it("reads advanced revision support for paused work orders", async () => {
    const factoryRepository = createFactoryRepositoryMock();
    const reader = createRevisionReader(createJobRepositoryMock(), factoryRepository);

    vi.mocked(factoryRepository.findWorkOrderById).mockResolvedValue({
      id: "wo_1",
      schemaVersion: 1,
      briefId: "brief_1",
      status: "paused",
      currentDag: {
        id: "dag_1",
        briefId: "brief_1",
        schemaVersion: 1,
        stages: [{ key: "draft", label: "Draft", kind: "draft", dependsOn: [] }],
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      stageRuns: [],
      executionLog: [],
      revision: 1,
      previousWorkOrderIds: [],
      pausedState: {
        pausedAt: "2026-04-01T00:00:05.000Z",
        reason: "Manual pause",
        resumeFromStageKey: "draft",
      },
      createdAt: "2026-04-01T00:00:00.000Z",
      startedAt: "2026-04-01T00:00:01.000Z",
      completedAt: null,
      userId: "usr_1",
      conversationId: "conv_1",
      initiatedBy: "batch_automation",
    });
    vi.mocked(factoryRepository.findLatestActiveCheckpoint).mockResolvedValue({
      checkpointId: "checkpoint_1",
      workOrderId: "wo_1",
      stageRunId: null,
      pauseState: {
        pausedAt: "2026-04-01T00:00:05.000Z",
        reason: "Manual pause",
        resumeFromStageKey: "draft",
      },
      resumeFromStageKey: "draft",
      createdAt: "2026-04-01T00:00:05.000Z",
      consumedAt: null,
    });
    vi.mocked(factoryRepository.listStageRunsForWorkOrder).mockResolvedValue([]);
    vi.mocked(factoryRepository.listOutputsForWorkOrder).mockResolvedValue([]);
    vi.mocked(factoryRepository.listEventsForWorkOrder).mockResolvedValue([]);

    const result = await reader.getWorkOrderRevision("wo_1");

    expect(result?.revision).toEqual(expect.objectContaining({
      executionId: "wo_1",
      executionKind: "work_order",
      supportLevel: "advanced",
      state: "paused",
    }));
    expect(result?.revision.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "refine" }),
      expect.objectContaining({ operation: "resume" }),
    ]));
  });

  it("returns explicit unsupported revision inspection for unsupported execution kinds", async () => {
    const reader = createRevisionReader(createJobRepositoryMock());

    const revision = await reader.readRevision({
      executionKind: "chat_turn",
      executionId: "chat_turn_1",
      conversationId: "conv_1",
    });

    expect(revision).toEqual(expect.objectContaining({
      executionKind: "chat_turn",
      supportLevel: "unsupported",
      state: "unsupported",
      conversationId: "conv_1",
    }));
  });
});