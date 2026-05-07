import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JobEvent, JobRequest } from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";

const { appendRuntimeAuditLogMock, recordPromptBindingFromSourceMock } = vi.hoisted(() => ({
  appendRuntimeAuditLogMock: vi.fn(async () => undefined),
  recordPromptBindingFromSourceMock: vi.fn(async () => null),
}));

vi.mock("@/lib/observability/runtime-audit-log", () => ({
  appendRuntimeAuditLog: appendRuntimeAuditLogMock,
}));
vi.mock("@/lib/prompts/prompt-binding-service", () => ({
  recordPromptBindingFromSource: recordPromptBindingFromSourceMock,
}));

import {
  enqueueGenerateAudioDeferredJob,
  InvalidGenerateAudioDeferredJobError,
} from "./generate-audio-deferred-job";
import { buildGenerateAudioMaterializationKey } from "./materialization-key";

const audioInput = {
  title: "Founder memo",
  text: "This is the narration text for the weekly review.",
};
const materializationKey = buildGenerateAudioMaterializationKey(audioInput);

function createJobRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_audio_1",
    conversationId: "conv_media_1",
    userId: "user_1",
    toolName: "generate_audio",
    status: "queued",
    priority: 5,
    dedupeKey: materializationKey,
    initiatorType: "user",
    requestPayload: {
      ...audioInput,
      materializationKey,
      executionTarget: "deferred_remote",
    },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-13T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-13T12:00:00.000Z",
    ...overrides,
  };
}

function createJobEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "evt_audio_1",
    jobId: "job_audio_1",
    conversationId: "conv_media_1",
    sequence: 1,
    eventType: "queued",
    payload: { toolName: "generate_audio" },
    createdAt: "2026-04-13T12:00:00.000Z",
    ...overrides,
  };
}

function createRepositoryMock(overrides: Partial<JobQueueRepository> = {}): JobQueueRepository {
  return {
    createJob: vi.fn(async () => createJobRequest()),
    findJobById: vi.fn(async () => null),
    findLatestEventForJob: vi.fn(async () => null),
    findLatestRenderableEventForJob: vi.fn(async () => null),
    findActiveJobByDedupeKey: vi.fn(async () => null),
    listJobsByConversation: vi.fn(async () => []),
    listJobsByUser: vi.fn(async () => []),
    appendEvent: vi.fn(async () => createJobEvent()),
    requeueExpiredRunningJobs: vi.fn(async () => []),
    listConversationEvents: vi.fn(async () => []),
    listUserEvents: vi.fn(async () => []),
    listEventsForUserJob: vi.fn(async () => []),
    claimNextQueuedJob: vi.fn(async () => null),
    transferJobsToUser: vi.fn(async () => []),
    updateJobStatus: vi.fn(async () => { throw new Error("unused"); }),
    cancelJob: vi.fn(async () => { throw new Error("unused"); }),
    ...overrides,
  } as unknown as JobQueueRepository;
}

describe("generate-audio-deferred-job", () => {
  beforeEach(() => {
    appendRuntimeAuditLogMock.mockClear();
    recordPromptBindingFromSourceMock.mockClear();
  });

  it("creates a queued generate_audio job with operation metadata", async () => {
    const repository = createRepositoryMock();

    const result = await enqueueGenerateAudioDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      input: audioInput,
      operation: {
        operationId: "op_media_1",
        operationKind: "media_workflow",
        stepId: "op_media_1:media_step:mwfs_audio_1",
        workflowId: "mwf_1",
        workflowStepId: "mwfs_audio_1",
        actionId: "act_media_create_1",
      },
    });

    expect(repository.findActiveJobByDedupeKey).toHaveBeenCalledWith("conv_media_1", materializationKey);
    expect(repository.createJob).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "generate_audio",
      dedupeKey: materializationKey,
      requestPayload: expect.objectContaining({
        title: audioInput.title,
        text: audioInput.text,
        materializationKey,
        executionTarget: "deferred_remote",
        operation: {
          operationId: "op_media_1",
          operationKind: "media_workflow",
          stepId: "op_media_1:media_step:mwfs_audio_1",
          workflowId: "mwf_1",
          workflowStepId: "mwfs_audio_1",
          actionId: "act_media_create_1",
        },
      }),
    }));
    expect(result.outcome).toBe("queued");
    expect(result.payload).toMatchObject({
      deferred_job: {
        jobId: "job_audio_1",
        toolName: "generate_audio",
        lifecyclePhase: "pending_local_generation",
      },
    });
  });

  it("reuses an active equivalent audio job without creating another job", async () => {
    const active = createJobRequest({
      id: "job_audio_active",
      status: "running",
      progressPercent: 40,
    });
    const repository = createRepositoryMock({
      findActiveJobByDedupeKey: vi.fn(async () => active),
      findLatestRenderableEventForJob: vi.fn(async () => createJobEvent({
        id: "evt_audio_active",
        jobId: "job_audio_active",
        eventType: "progress",
      })),
    });

    const result = await enqueueGenerateAudioDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      input: audioInput,
    });

    expect(repository.createJob).not.toHaveBeenCalled();
    expect(repository.appendEvent).not.toHaveBeenCalled();
    expect(result.outcome).toBe("active_equivalent");
    expect(result.deduplicated).toBe(true);
    expect(result.payload).toMatchObject({
      deferred_job: {
        jobId: "job_audio_active",
        status: "running",
      },
    });
  });

  it("rejects empty title or text before enqueueing", async () => {
    const repository = createRepositoryMock();

    await expect(enqueueGenerateAudioDeferredJob({
      repository,
      conversationId: "conv_media_1",
      userId: "user_1",
      input: {
        title: "  ",
        text: "  ",
      },
    })).rejects.toThrow(InvalidGenerateAudioDeferredJobError);

    expect(repository.findActiveJobByDedupeKey).not.toHaveBeenCalled();
    expect(repository.createJob).not.toHaveBeenCalled();
  });
});
