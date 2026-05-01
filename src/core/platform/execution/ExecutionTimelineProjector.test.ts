import { describe, expect, it } from "vitest";

import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobEvent, JobRequest } from "@/core/entities/job";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import type { WorkOrder } from "@/core/entities/work-order";
import type {
  FactoryCheckpointRecord,
  FactoryEventRecord,
  FactoryOutputRecord,
} from "@/core/use-cases/FactoryRepository";
import {
  createUnsupportedExecutionTimeline,
  projectJobExecutionTimeline,
  projectToolExecutionTimeline,
  projectWorkOrderExecutionTimeline,
} from "@/core/platform/execution/ExecutionTimelineProjector";

function createJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
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
    progressPercent: 80,
    progressLabel: "Publishing",
    attemptCount: 1,
    leaseExpiresAt: null,
    claimedBy: "worker_1",
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: null,
    lastCheckpointId: "checkpoint_job_1",
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    startedAt: "2026-04-01T00:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-04-01T00:00:02.000Z",
    ...overrides,
  };
}

function createJobEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "evt_1",
    jobId: "job_1",
    conversationId: "conv_1",
    sequence: 1,
    eventType: "progress",
    payload: {
      progressPercent: 80,
      progressLabel: "Publishing",
    },
    createdAt: "2026-04-01T00:00:02.000Z",
    ...overrides,
  };
}

function createWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo_1",
    schemaVersion: 1,
    briefId: "brief_1",
    status: "paused",
    currentDag: {
      id: "dag_1",
      briefId: "brief_1",
      schemaVersion: 1,
      stages: [{ key: "draft", label: "Draft", kind: "draft", dependencyKeys: [], parallelizable: false }],
      version: 1,
      autoParallelize: false,
      generatedAt: "2026-04-01T00:00:00.000Z",
      generatedBy: "test",
      generationReason: "batch_automation",
    },
    stageRuns: [],
    executionLog: [
      {
        timestamp: "2026-04-01T00:00:05.000Z",
        stageKey: "draft",
        eventType: "paused",
        details: { reason: "Manual pause" },
      },
      {
        timestamp: "2026-04-01T00:00:02.000Z",
        stageKey: "draft",
        eventType: "started",
        details: { attemptCount: 1 },
      },
    ],
    revision: 2,
    previousWorkOrderIds: ["wo_prev"],
    pausedState: {
      pausedAt: "2026-04-01T00:00:05.000Z",
      reason: "Manual pause",
      resumeFromStageKey: "draft",
    },
    createdAt: "2026-04-01T00:00:00.000Z",
    startedAt: "2026-04-01T00:00:01.000Z",
    completedAt: undefined,
    userId: "usr_1",
    conversationId: "conv_1",
    initiatedBy: "batch_automation",
    ...overrides,
  };
}

function createStageRun(overrides: Partial<StageRunRecord> = {}): StageRunRecord {
  return {
    id: "sr_1",
    stageKey: "draft",
    status: "running",
    startedAt: "2026-04-01T00:00:01.000Z",
    attemptCount: 1,
    ...overrides,
  };
}

function createOutput(overrides: Partial<FactoryOutputRecord> = {}): FactoryOutputRecord {
  return {
    entityId: "asset_1",
    entityKind: "asset",
    workOrderId: "wo_1",
    stageRunId: "sr_1",
    supersedesEntityId: null,
    createdAt: "2026-04-01T00:00:03.000Z",
    payload: {
      id: "asset_1",
      label: "Hero chart",
      mimeType: "image/png",
      uri: "/api/user-files/asset_1",
    } as never,
    ...overrides,
  };
}

function createFactoryEvent(overrides: Partial<FactoryEventRecord> = {}): FactoryEventRecord {
  return {
    id: "factory_evt_1",
    workOrderId: "wo_1",
    stageRunId: "sr_1",
    sequence: 1,
    eventType: "stage_started",
    payload: { stageKey: "draft", attemptCount: 1 },
    createdAt: "2026-04-01T00:00:02.000Z",
    ...overrides,
  };
}

function createCheckpoint(overrides: Partial<FactoryCheckpointRecord> = {}): FactoryCheckpointRecord {
  return {
    checkpointId: "checkpoint_1",
    workOrderId: "wo_1",
    stageRunId: "sr_1",
    pauseState: {
      pausedAt: "2026-04-01T00:00:05.000Z",
      reason: "Manual pause",
      resumeFromStageKey: "draft",
    },
    resumeFromStageKey: "draft",
    createdAt: "2026-04-01T00:00:05.000Z",
    consumedAt: null,
    ...overrides,
  };
}

describe("ExecutionTimelineProjector", () => {
  it("projects a canonical job timeline with actions, checkpoints, and artifacts", () => {
    const timeline = projectJobExecutionTimeline({
      job: createJob({
        resultPayload: { ok: true },
      }),
      latestRenderableEvent: createJobEvent({
        payload: {
          progressPercent: 80,
          progressLabel: "Publishing",
          resultEnvelope: {
            schemaVersion: 1,
            toolName: "publish_content",
            family: "media",
            cardKind: "media_render",
            executionMode: "deferred",
            inputSnapshot: {},
            summary: { title: "Publish post", message: "Publishing" },
            artifacts: [{ kind: "image", label: "Hero image", mimeType: "image/png", uri: "/hero.png" }],
            payload: { ok: true },
          },
        },
      }),
      history: [
        createJobEvent({ id: "evt_queued", eventType: "queued", sequence: 1, createdAt: "2026-04-01T00:00:00.000Z" }),
        createJobEvent({ id: "evt_progress", eventType: "progress", sequence: 2 }),
        createJobEvent({ id: "evt_audit", eventType: "notification_sent", sequence: 3 }),
      ],
    });

    expect(timeline.executionKind).toBe("job");
    expect(timeline.supportLevel).toBe("full");
    expect(timeline.checkpoints).toEqual([
      expect.objectContaining({ checkpointId: "checkpoint_job_1" }),
    ]);
    expect(timeline.events.map((event) => event.eventType)).toEqual(["queued", "progress"]);
    expect(timeline.nextActions).toEqual([
      expect.objectContaining({ label: "Cancel", kind: "job" }),
    ]);
  });

  it("projects a factory timeline and prefers durable events over matching execution log entries", () => {
    const timeline = projectWorkOrderExecutionTimeline({
      workOrder: createWorkOrder(),
      stageRuns: [createStageRun()],
      outputs: [createOutput()],
      events: [
        createFactoryEvent(),
        createFactoryEvent({
          id: "factory_evt_2",
          sequence: 2,
          eventType: "paused",
          stageRunId: null,
          payload: { stageKey: "draft", reason: "Manual pause" },
          createdAt: "2026-04-01T00:00:05.000Z",
        }),
      ],
      activeCheckpoint: createCheckpoint(),
    });

    expect(timeline.executionKind).toBe("work_order");
    expect(timeline.supportLevel).toBe("full");
    expect(timeline.events.filter((event) => event.timestamp === "2026-04-01T00:00:02.000Z")).toHaveLength(1);
    expect(timeline.artifacts).toEqual([
      expect.objectContaining({ id: "asset_1", source: "factory_output", stageKey: "draft" }),
    ]);
    expect(timeline.nextActions).toEqual([
      expect.objectContaining({ key: "resume", kind: "factory" }),
      expect.objectContaining({ key: "refine", kind: "factory" }),
    ]);
  });

  it("projects limited tool support when a result envelope exists", () => {
    const envelope: CapabilityResultEnvelope = {
      schemaVersion: 1,
      toolName: "compose_media",
      family: "media",
      cardKind: "media_render",
      executionMode: "hybrid",
      inputSnapshot: {},
      summary: { title: "Compose media", message: "Working" },
      progress: { percent: 60, label: "Rendering" },
      artifacts: [{ kind: "video", label: "Preview", mimeType: "video/mp4", uri: "/preview.mp4" }],
      replaySnapshot: { step: 1 },
      payload: null,
    };

    const timeline = projectToolExecutionTimeline({
      executionId: "tool_1",
      toolName: "compose_media",
      envelope,
    });

    expect(timeline.supportLevel).toBe("limited");
    expect(timeline.executionKind).toBe("tool");
    expect(timeline.artifacts).toEqual([
      expect.objectContaining({ label: "Preview", source: "job_result" }),
    ]);
  });

  it("creates explicit unsupported timelines for reduced-support execution kinds", () => {
    const timeline = createUnsupportedExecutionTimeline({
      executionId: "chat_turn_1",
      executionKind: "chat_turn",
      title: "Chat turn",
      summary: "Chat-turn timeline projection is not yet backed by a persisted reader.",
    });

    expect(timeline.supportLevel).toBe("unsupported");
    expect(timeline.executionKind).toBe("chat_turn");
    expect(timeline.events).toEqual([]);
  });
});
