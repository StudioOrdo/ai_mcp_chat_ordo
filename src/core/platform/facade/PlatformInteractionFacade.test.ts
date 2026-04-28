import { describe, expect, it, vi } from "vitest";

import { PlatformInteractionFacade } from "@/core/platform/facade/PlatformInteractionFacade";
import type { ExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";

function createExecutionTimelineReaderMock(): ExecutionTimelineReader {
  return {
    readExecutionTimeline: vi.fn(),
    getJobTimeline: vi.fn(),
    getUserJobTimeline: vi.fn(),
    listConversationJobTimelines: vi.fn(),
    listUserJobTimelines: vi.fn(),
    getUserJobHistory: vi.fn(),
    getWorkOrderTimeline: vi.fn(),
    getJobSnapshot: vi.fn(),
    getUserJobSnapshot: vi.fn(),
    listConversationJobSnapshots: vi.fn(),
    listUserJobSnapshots: vi.fn(),
  } as unknown as ExecutionTimelineReader;
}

describe("PlatformInteractionFacade", () => {
  it("projects revision alongside user job interactions", async () => {
    const reader = createExecutionTimelineReaderMock();
    vi.mocked(reader.listUserJobTimelines).mockResolvedValue([
      {
        job: {
          id: "job_1",
          conversationId: "conv_1",
          userId: "usr_1",
          toolName: "publish_content",
          status: "failed",
          priority: 100,
          dedupeKey: null,
          initiatorType: "user",
          requestPayload: {},
          resultPayload: null,
          errorMessage: null,
          progressPercent: null,
          progressLabel: null,
          attemptCount: 1,
          leaseExpiresAt: null,
          claimedBy: null,
          failureClass: null,
          nextRetryAt: null,
          recoveryMode: "rerun",
          lastCheckpointId: null,
          replayedFromJobId: null,
          supersededByJobId: null,
          createdAt: "2026-04-27T00:00:00.000Z",
          startedAt: "2026-04-27T00:00:01.000Z",
          completedAt: "2026-04-27T00:00:02.000Z",
          updatedAt: "2026-04-27T00:00:02.000Z",
        },
        snapshot: { part: { status: "failed" } },
        timeline: {
          executionId: "job_1",
          executionKind: "job",
          supportLevel: "full",
          state: "failed",
          title: "Publish Content",
          events: [],
          artifacts: [],
          checkpoints: [],
          nextActions: [],
          updatedAt: "2026-04-27T00:00:02.000Z",
        },
        history: [],
      },
    ] as never);

    const facade = new PlatformInteractionFacade({ executionTimelineReader: reader });
    const result = await facade.listUserJobInteractions("usr_1", { limit: 5 });

    expect(reader.listUserJobTimelines).toHaveBeenCalledWith("usr_1", { limit: 5 });
    expect(result[0]?.revision).toEqual(expect.objectContaining({
      executionId: "job_1",
      supportLevel: "reduced",
      state: "recoverable",
    }));
  });

  it("projects advanced revision alongside work-order interactions", async () => {
    const reader = createExecutionTimelineReaderMock();
    vi.mocked(reader.getWorkOrderTimeline).mockResolvedValue({
      workOrder: {
        id: "wo_1",
        schemaVersion: 1,
        briefId: "brief_1",
        status: "paused",
        currentDag: { id: "dag_1", briefId: "brief_1", schemaVersion: 1, stages: [], createdAt: "2026-04-27T00:00:00.000Z" },
        stageRuns: [],
        executionLog: [],
        revision: 2,
        previousWorkOrderIds: ["wo_0"],
        pausedState: {
          pausedAt: "2026-04-27T00:00:03.000Z",
          reason: "Manual pause",
          resumeFromStageKey: "draft",
        },
        createdAt: "2026-04-27T00:00:00.000Z",
        startedAt: "2026-04-27T00:00:01.000Z",
        completedAt: null,
        userId: "usr_1",
        conversationId: "conv_1",
        initiatedBy: "batch_automation",
      },
      activeCheckpoint: {
        checkpointId: "checkpoint_1",
        workOrderId: "wo_1",
        stageRunId: null,
        pauseState: {
          pausedAt: "2026-04-27T00:00:03.000Z",
          reason: "Manual pause",
          resumeFromStageKey: "draft",
        },
        resumeFromStageKey: "draft",
        createdAt: "2026-04-27T00:00:03.000Z",
        consumedAt: null,
      },
      stageRuns: [],
      outputs: [],
      events: [],
      timeline: {
        executionId: "wo_1",
        executionKind: "work_order",
        supportLevel: "full",
        state: "paused",
        title: "Work order wo_1",
        summary: "Manual pause",
        events: [],
        artifacts: [],
        checkpoints: [],
        nextActions: [],
      },
    } as never);

    const facade = new PlatformInteractionFacade({ executionTimelineReader: reader });
    const result = await facade.getWorkOrderInteraction("wo_1");

    expect(result?.revision).toEqual(expect.objectContaining({
      executionId: "wo_1",
      supportLevel: "advanced",
      state: "paused",
    }));
  });
});