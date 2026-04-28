import { describe, expect, it } from "vitest";

import { createUnsupportedRevision, projectJobRevision, projectWorkOrderRevision } from "@/core/platform/revision/RevisionProjector";

describe("RevisionProjector", () => {
  it("projects reduced-support retry actions for failed deferred jobs", () => {
    const revision = projectJobRevision({
      job: {
        id: "job_failed",
        conversationId: "conv_1",
        userId: "usr_1",
        toolName: "publish_content",
        status: "failed",
        recoveryMode: "rerun",
        lastCheckpointId: null,
        replayedFromJobId: null,
        supersededByJobId: null,
        startedAt: "2026-04-27T00:00:00.000Z",
        completedAt: "2026-04-27T00:01:00.000Z",
        updatedAt: "2026-04-27T00:01:00.000Z",
      },
      timeline: {
        title: "Publish Content",
        summary: "Job failed while publishing.",
        supportLevel: "full",
        updatedAt: "2026-04-27T00:01:00.000Z",
      },
    });

    expect(revision).toEqual(expect.objectContaining({
      executionId: "job_failed",
      executionKind: "job",
      supportLevel: "reduced",
      state: "recoverable",
    }));
    expect(revision.actions).toEqual([
      expect.objectContaining({
        operation: "retry",
        label: "Retry",
        transportKind: "job",
        params: { operation: "retry" },
      }),
    ]);
  });

  it("projects advanced pause, refine, and resume ownership for paused work orders", () => {
    const revision = projectWorkOrderRevision({
      workOrder: {
        id: "wo_1",
        status: "paused",
        conversationId: "conv_1",
        userId: "usr_1",
        revision: 2,
        previousWorkOrderIds: ["wo_0"],
        pausedState: {
          pausedAt: "2026-04-27T00:02:00.000Z",
          reason: "Inspect release artifact",
          resumeFromStageKey: "release",
        },
        startedAt: "2026-04-27T00:00:00.000Z",
        completedAt: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      activeCheckpoint: {
        checkpointId: "checkpoint_1",
        workOrderId: "wo_1",
        stageRunId: "stage_1",
        pauseState: {
          pausedAt: "2026-04-27T00:02:00.000Z",
          reason: "Inspect release artifact",
          resumeFromStageKey: "release",
        },
        resumeFromStageKey: "release",
        createdAt: "2026-04-27T00:02:00.000Z",
        consumedAt: null,
      },
      timeline: {
        title: "Work order wo_1",
        summary: "Inspect release artifact",
        supportLevel: "full",
      },
    });

    expect(revision).toEqual(expect.objectContaining({
      executionId: "wo_1",
      executionKind: "work_order",
      supportLevel: "advanced",
      state: "paused",
    }));
    expect(revision.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: "refine", transportKind: "factory" }),
      expect.objectContaining({ operation: "resume", transportKind: "factory" }),
    ]));
    expect(revision.checkpoints).toEqual([
      expect.objectContaining({ checkpointId: "checkpoint_1", stageKey: "release" }),
    ]);
  });

  it("creates explicit unsupported revision records for unsupported execution kinds", () => {
    expect(createUnsupportedRevision({
      executionId: "chat_turn_1",
      executionKind: "chat_turn",
      title: "Chat turn",
      summary: "Not supported.",
      conversationId: "conv_1",
    })).toEqual(expect.objectContaining({
      executionKind: "chat_turn",
      supportLevel: "unsupported",
      state: "unsupported",
      conversationId: "conv_1",
      actions: [],
    }));
  });
});