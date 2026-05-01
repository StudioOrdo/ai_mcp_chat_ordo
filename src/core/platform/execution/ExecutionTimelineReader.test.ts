import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";

import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import { createExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";

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

describe("ExecutionTimelineReader", () => {
  it("implements the legacy job snapshot query through the canonical reader", async () => {
    const jobRepository = createJobRepositoryMock();
    const reader = createExecutionTimelineReader(jobRepository);

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

    const result = await reader.getJobTimeline("job_1");
    const snapshot = await reader.getJobSnapshot("job_1");

    expect(result?.timeline.executionKind).toBe("job");
    expect(result?.snapshot.status).toBe("running");
    expect(snapshot?.progressLabel).toBe("Publishing");
  });

  it("joins materialization records into canonical job snapshots", async () => {
    const jobRepository = createJobRepositoryMock();
    const materializationRepository = {
      findByProducedJobId: vi.fn().mockResolvedValue({
        id: "mat_job_1",
        userId: "usr_1",
        conversationId: "conv_1",
        materializationKey: "publish_content:post_1",
        toolName: "publish_content",
        pipelineVersion: "publish_content:v1",
        status: "ready",
        reusePolicy: "same_user",
        inputSourceRefs: [],
        outputRefs: [{ kind: "asset", id: "asset_1", userId: "usr_1", conversationId: "conv_1" }],
        evidenceRefs: [],
        producedByJobId: "job_1",
        supersededByRecordId: null,
        createdAt: "2026-04-01T00:00:03.000Z",
        updatedAt: "2026-04-01T00:00:03.000Z",
      }),
    } as unknown as MaterializationRepository;
    const reader = createExecutionTimelineReader(jobRepository, undefined, {}, materializationRepository);

    vi.mocked(jobRepository.findJobById).mockResolvedValue({
      id: "job_1",
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "publish_content",
      status: "succeeded",
      priority: 100,
      dedupeKey: null,
      initiatorType: "user",
      requestPayload: { postId: "post_1" },
      resultPayload: { assetId: "asset_1" },
      errorMessage: null,
      progressPercent: 100,
      progressLabel: "Published",
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
      completedAt: "2026-04-01T00:00:03.000Z",
      updatedAt: "2026-04-01T00:00:03.000Z",
    });
    vi.mocked(jobRepository.findLatestRenderableEventForJob).mockResolvedValue({
      id: "evt_1",
      jobId: "job_1",
      conversationId: "conv_1",
      sequence: 2,
      eventType: "result",
      payload: { result: { assetId: "asset_1" }, progressPercent: 100, progressLabel: "Published" },
      createdAt: "2026-04-01T00:00:03.000Z",
    });

    const snapshot = await reader.getJobSnapshot("job_1");

    expect(materializationRepository.findByProducedJobId).toHaveBeenCalledWith("job_1");
    expect(snapshot?.materializationRefs).toEqual(["mat_job_1"]);
  });

  it("returns explicit reduced-support timelines for chat_turn requests", async () => {
    const reader = createExecutionTimelineReader(createJobRepositoryMock());

    const timeline = await reader.readExecutionTimeline({
      executionKind: "chat_turn",
      executionId: "chat_turn_1",
      conversationId: "conv_1",
    });

    expect(timeline).toEqual(expect.objectContaining({
      executionKind: "chat_turn",
      supportLevel: "unsupported",
      conversationId: "conv_1",
    }));
  });

  it("projects a limited persisted chat-turn timeline when prompt provenance and messages are available", async () => {
    const jobRepository = createJobRepositoryMock();
    const promptTurnReader = {
      findByConversationAndTurnId: vi.fn().mockResolvedValue({
        id: "pprov_1",
        conversationId: "conv_1",
        userMessageId: "msg_user_1",
        assistantMessageId: "msg_assistant_1",
        surface: "direct_turn",
        effectiveHash: "hash_1",
        slotRefs: [],
        sections: [],
        warnings: [],
        replayContext: { surface: "direct_turn" },
        recordedAt: "2026-04-01T00:00:02.000Z",
      }),
    };
    const messageRepository = {
      findById: vi.fn(async (id: string) => id === "msg_user_1"
        ? {
            id,
            conversationId: "conv_1",
            role: "user",
            content: "Help me with this draft.",
            parts: [{ type: "text", text: "Help me with this draft." }],
            createdAt: "2026-04-01T00:00:01.000Z",
            tokenEstimate: 6,
          }
        : {
            id,
            conversationId: "conv_1",
            role: "assistant",
            content: "Here is the revised draft.",
            parts: [{ type: "text", text: "Here is the revised draft." }],
            createdAt: "2026-04-01T00:00:03.000Z",
            tokenEstimate: 6,
          }),
    };

    const reader = createExecutionTimelineReader(jobRepository, undefined, {
      promptTurnReader,
      messageRepository: messageRepository as never,
    });

    const timeline = await reader.readExecutionTimeline({
      executionKind: "chat_turn",
      executionId: "msg_user_1",
      conversationId: "conv_1",
    });

    expect(promptTurnReader.findByConversationAndTurnId).toHaveBeenCalledWith("conv_1", "msg_user_1");
    expect(timeline).toEqual(expect.objectContaining({
      executionKind: "chat_turn",
      supportLevel: "limited",
      state: "succeeded",
      conversationId: "conv_1",
    }));
    expect(timeline?.events).toHaveLength(3);
  });

  it("projects a limited persisted streamed chat-turn timeline when stream provenance and messages are available", async () => {
    const jobRepository = createJobRepositoryMock();
    const promptTurnReader = {
      findByConversationAndTurnId: vi.fn().mockResolvedValue({
        id: "pprov_stream_1",
        conversationId: "conv_stream_1",
        userMessageId: "msg_user_stream_1",
        assistantMessageId: "msg_assistant_stream_1",
        surface: "stream",
        effectiveHash: "hash_stream_1",
        slotRefs: [{ key: "persona.core", source: "prompt_runtime" }],
        sections: [{ key: "system", hash: "section_hash_1" }],
        warnings: [],
        replayContext: { surface: "stream" },
        recordedAt: "2026-04-01T00:00:05.000Z",
      }),
    };
    const messageRepository = {
      findById: vi.fn(async (id: string) => id === "msg_user_stream_1"
        ? {
            id,
            conversationId: "conv_stream_1",
            role: "user",
            content: "Stream this answer with tool support.",
            parts: [{ type: "text", text: "Stream this answer with tool support." }],
            createdAt: "2026-04-01T00:00:04.000Z",
            tokenEstimate: 7,
          }
        : {
            id,
            conversationId: "conv_stream_1",
            role: "assistant",
            content: "Here is the streamed reply.",
            parts: [{ type: "text", text: "Here is the streamed reply." }],
            createdAt: "2026-04-01T00:00:06.000Z",
            tokenEstimate: 6,
          }),
    };

    const reader = createExecutionTimelineReader(jobRepository, undefined, {
      promptTurnReader,
      messageRepository: messageRepository as never,
    });

    const timeline = await reader.readExecutionTimeline({
      executionKind: "chat_turn",
      executionId: "msg_user_stream_1",
      conversationId: "conv_stream_1",
    });

    expect(promptTurnReader.findByConversationAndTurnId).toHaveBeenCalledWith("conv_stream_1", "msg_user_stream_1");
    expect(timeline).toEqual(expect.objectContaining({
      executionKind: "chat_turn",
      supportLevel: "limited",
      state: "succeeded",
      conversationId: "conv_stream_1",
      metadata: expect.objectContaining({
        surface: "stream",
        slotRefCount: 1,
        sectionCount: 1,
      }),
    }));
    expect(timeline?.events.map((event) => event.eventType)).toEqual([
      "user_message",
      "prompt_provenance_recorded",
      "assistant_message",
    ]);
  });

  it("returns explicit reduced-support timelines for observability requests", async () => {
    const reader = createExecutionTimelineReader(createJobRepositoryMock());

    const timeline = await reader.readExecutionTimeline({
      executionKind: "observability",
      executionId: "metric.route:/api/jobs",
    });

    expect(timeline).toEqual(expect.objectContaining({
      executionKind: "observability",
      supportLevel: "unsupported",
    }));
  });

  it("projects a limited observability timeline from persisted runtime audit logs", async () => {
    const logDir = mkdtempSync(path.join(os.tmpdir(), "ordo-o11y-"));
    const previousLogDir = process.env.ORDO_RUNTIME_AUDIT_LOG_DIR;
    process.env.ORDO_RUNTIME_AUDIT_LOG_DIR = logDir;

    try {
      writeFileSync(
        path.join(logDir, "deferred_job.jsonl"),
        `${JSON.stringify({ timestamp: "2026-04-01T00:00:00.000Z", category: "deferred_job", event: "started", context: { jobId: "job_1", conversationId: "conv_1", userId: "usr_1" } })}\n`
        + `${JSON.stringify({ timestamp: "2026-04-01T00:00:02.000Z", category: "deferred_job", event: "succeeded", context: { jobId: "job_1", conversationId: "conv_1", userId: "usr_1" } })}\n`,
        "utf8",
      );

      const reader = createExecutionTimelineReader(createJobRepositoryMock());
      const timeline = await reader.readExecutionTimeline({
        executionKind: "observability",
        executionId: "deferred_job:job_1",
      });

      expect(timeline).toEqual(expect.objectContaining({
        executionKind: "observability",
        supportLevel: "limited",
        state: "succeeded",
        conversationId: "conv_1",
        userId: "usr_1",
      }));
      expect(timeline?.events).toHaveLength(2);
    } finally {
      if (previousLogDir === undefined) {
        delete process.env.ORDO_RUNTIME_AUDIT_LOG_DIR;
      } else {
        process.env.ORDO_RUNTIME_AUDIT_LOG_DIR = previousLogDir;
      }
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("projects a failed native-process observability timeline from persisted runtime audit logs", async () => {
    const logDir = mkdtempSync(path.join(os.tmpdir(), "ordo-o11y-native-"));
    const previousLogDir = process.env.ORDO_RUNTIME_AUDIT_LOG_DIR;
    process.env.ORDO_RUNTIME_AUDIT_LOG_DIR = logDir;

    try {
      writeFileSync(
        path.join(logDir, "native_process.jsonl"),
        `${JSON.stringify({ timestamp: "2026-04-01T00:00:00.000Z", category: "native_process", event: "invoke_started", context: { processId: "proc_1", conversationId: "conv_1", userId: "usr_1", command: "node" } })}\n`
        + `${JSON.stringify({ timestamp: "2026-04-01T00:00:02.000Z", category: "native_process", event: "invoke_failed", context: { processId: "proc_1", conversationId: "conv_1", userId: "usr_1", command: "node", errorMessage: "boom" } })}\n`,
        "utf8",
      );

      const reader = createExecutionTimelineReader(createJobRepositoryMock());
      const timeline = await reader.readExecutionTimeline({
        executionKind: "observability",
        executionId: "native_process:proc_1",
      });

      expect(timeline).toEqual(expect.objectContaining({
        executionKind: "observability",
        supportLevel: "limited",
        state: "failed",
        conversationId: "conv_1",
        userId: "usr_1",
        metadata: expect.objectContaining({
          category: "native_process",
          identifierKey: "processId",
          targetId: "proc_1",
        }),
      }));
      expect(timeline?.events.map((event) => event.state)).toEqual(["running", "failed"]);
    } finally {
      if (previousLogDir === undefined) {
        delete process.env.ORDO_RUNTIME_AUDIT_LOG_DIR;
      } else {
        process.env.ORDO_RUNTIME_AUDIT_LOG_DIR = previousLogDir;
      }
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("projects an mcp-process lifecycle timeline from persisted runtime audit logs", async () => {
    const logDir = mkdtempSync(path.join(os.tmpdir(), "ordo-o11y-mcp-"));
    const previousLogDir = process.env.ORDO_RUNTIME_AUDIT_LOG_DIR;
    process.env.ORDO_RUNTIME_AUDIT_LOG_DIR = logDir;

    try {
      writeFileSync(
        path.join(logDir, "mcp_process.jsonl"),
        `${JSON.stringify({ timestamp: "2026-04-01T00:00:00.000Z", category: "mcp_process", event: "session_initialize_started", context: { targetId: "mcp_target_1" } })}\n`
        + `${JSON.stringify({ timestamp: "2026-04-01T00:00:01.000Z", category: "mcp_process", event: "session_initialize_succeeded", context: { targetId: "mcp_target_1" } })}\n`
        + `${JSON.stringify({ timestamp: "2026-04-01T00:00:02.000Z", category: "mcp_process", event: "tool_call_started", context: { targetId: "mcp_target_1" } })}\n`
        + `${JSON.stringify({ timestamp: "2026-04-01T00:00:03.000Z", category: "mcp_process", event: "tool_call_succeeded", context: { targetId: "mcp_target_1" } })}\n`
        + `${JSON.stringify({ timestamp: "2026-04-01T00:00:04.000Z", category: "mcp_process", event: "session_close_completed", context: { targetId: "mcp_target_1" } })}\n`,
        "utf8",
      );

      const reader = createExecutionTimelineReader(createJobRepositoryMock());
      const timeline = await reader.readExecutionTimeline({
        executionKind: "observability",
        executionId: "mcp_process:mcp_target_1",
      });

      expect(timeline).toEqual(expect.objectContaining({
        executionKind: "observability",
        supportLevel: "limited",
        state: "succeeded",
        metadata: expect.objectContaining({
          category: "mcp_process",
          identifierKey: "targetId",
          targetId: "mcp_target_1",
        }),
      }));
      expect(timeline?.events.map((event) => event.eventType)).toEqual([
        "session_initialize_started",
        "session_initialize_succeeded",
        "tool_call_started",
        "tool_call_succeeded",
        "session_close_completed",
      ]);
      expect(timeline?.artifacts).toEqual([]);
    } finally {
      if (previousLogDir === undefined) {
        delete process.env.ORDO_RUNTIME_AUDIT_LOG_DIR;
      } else {
        process.env.ORDO_RUNTIME_AUDIT_LOG_DIR = previousLogDir;
      }
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("reads work-order inspection through the canonical reader", async () => {
    const factoryRepository = createFactoryRepositoryMock();
    const reader = createExecutionTimelineReader(createJobRepositoryMock(), factoryRepository);

    vi.mocked(factoryRepository.findWorkOrderById).mockResolvedValue({
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
      completedAt: undefined,
      userId: "usr_1",
      conversationId: "conv_1",
      initiatedBy: "batch_automation",
    });
    vi.mocked(factoryRepository.findLatestActiveCheckpoint).mockResolvedValue(null);
    vi.mocked(factoryRepository.listStageRunsForWorkOrder).mockResolvedValue([]);
    vi.mocked(factoryRepository.listOutputsForWorkOrder).mockResolvedValue([]);
    vi.mocked(factoryRepository.listEventsForWorkOrder).mockResolvedValue([]);

    const result = await reader.getWorkOrderTimeline("wo_1");

    expect(result?.timeline.executionKind).toBe("work_order");
    expect(result?.timeline.supportLevel).toBe("full");
    expect(result?.workOrder.id).toBe("wo_1");
  });
});
