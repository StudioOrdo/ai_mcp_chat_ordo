import { describe, expect, it, vi } from "vitest";

import type { JobEvent, JobRequest } from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";

const { recordPromptBindingFromSourceMock } = vi.hoisted(() => ({
  recordPromptBindingFromSourceMock: vi.fn(async () => null),
}));

vi.mock("@/lib/prompts/prompt-binding-service", () => ({
  recordPromptBindingFromSource: recordPromptBindingFromSourceMock,
}));

import { enqueueDeferredToolJob } from "./enqueue-deferred-tool-job";

function createJobRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_deferred_1",
    conversationId: "conv_blog_1",
    userId: "user_1",
    toolName: "draft_content",
    status: "queued",
    priority: 0,
    dedupeKey: "conv_blog_1:draft_content:seed",
    initiatorType: "user",
    requestPayload: {
      title: "Launch Plan",
      content: "# Launch Plan\n\n- Step 1",
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
    id: "evt_deferred_1",
    jobId: "job_deferred_1",
    conversationId: "conv_blog_1",
    sequence: 1,
    eventType: "queued",
    payload: {},
    createdAt: "2026-04-13T12:00:00.000Z",
    ...overrides,
  };
}

function createRepositoryMock(overrides: Partial<JobQueueRepository> = {}): JobQueueRepository {
  return {
    createJob: vi.fn(async (seed) => createJobRequest({
      conversationId: seed.conversationId,
      userId: seed.userId ?? null,
      toolName: seed.toolName,
      priority: seed.priority ?? 0,
      dedupeKey: seed.dedupeKey ?? null,
      initiatorType: seed.initiatorType ?? "user",
      requestPayload: seed.requestPayload,
    })),
    findJobById: vi.fn(async () => null),
    findLatestEventForJob: vi.fn(async () => null),
    findLatestRenderableEventForJob: vi.fn(async () => null),
    findActiveJobByDedupeKey: vi.fn(async () => null),
    listJobsByConversation: vi.fn(async () => []),
    listJobsByUser: vi.fn(async () => []),
    appendEvent: vi.fn(async ({ jobId, conversationId, payload }) => createJobEvent({
      jobId,
      conversationId,
      payload,
    })),
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

describe("enqueue-deferred-tool-job", () => {
  it("creates a queued deferred payload using the shared dedupe strategy", async () => {
    const repository = createRepositoryMock();

    const result = await enqueueDeferredToolJob({
      repository,
      conversationId: "conv_blog_1",
      userId: "user_1",
      toolName: "draft_content",
      requestPayload: {
        title: "Launch Plan",
        content: "# Launch Plan\n\n- Step 1",
      },
      deferred: {
        dedupeStrategy: "per-conversation-payload",
      },
    });

    expect(repository.findActiveJobByDedupeKey).toHaveBeenCalledWith(
      "conv_blog_1",
      expect.stringMatching(/^conv_blog_1:draft_content:/),
    );
    expect(repository.createJob).toHaveBeenCalledTimes(1);
    expect(result.deduplicated).toBe(false);
    expect(result.payload).toMatchObject({
      deferred_job: {
        jobId: "job_deferred_1",
        toolName: "draft_content",
        status: "queued",
      },
    });
    expect(recordPromptBindingFromSourceMock).not.toHaveBeenCalled();
  });

  it("reuses an existing active job and synthesizes a renderable event when needed", async () => {
    const repository = createRepositoryMock({
      findActiveJobByDedupeKey: vi.fn(async () => createJobRequest({
        id: "job_deferred_existing",
        status: "running",
        dedupeKey: "conv_blog_1:draft_content:existing",
        progressPercent: 48,
        progressLabel: "Preparing editorial brief",
        attemptCount: 1,
        startedAt: "2026-04-13T12:00:05.000Z",
        updatedAt: "2026-04-13T12:00:10.000Z",
      })),
    });

    const result = await enqueueDeferredToolJob({
      repository,
      conversationId: "conv_blog_1",
      userId: "user_1",
      toolName: "draft_content",
      requestPayload: {
        title: "Launch Plan",
        content: "# Launch Plan\n\n- Step 1",
      },
      deferred: {
        dedupeStrategy: "per-conversation-payload",
      },
    });

    expect(repository.createJob).not.toHaveBeenCalled();
    expect(repository.appendEvent).not.toHaveBeenCalled();
    expect(result.deduplicated).toBe(true);
    expect(result.event).toMatchObject({
      eventType: "progress",
      payload: {
        progressPercent: 48,
        progressLabel: "Preparing editorial brief",
      },
    });
    expect(result.payload).toMatchObject({
      deferred_job: {
        jobId: "job_deferred_existing",
        toolName: "draft_content",
        status: "running",
        deduped: true,
      },
    });
  });

  it("records a job_execution prompt binding when a fresh deferred job is created", async () => {
    const repository = createRepositoryMock();

    await enqueueDeferredToolJob({
      repository,
      conversationId: "conv_blog_1",
      userId: "user_1",
      toolName: "draft_content",
      requestPayload: {
        title: "Launch Plan",
      },
      promptBindingId: "pb_root_1",
    });

    expect(recordPromptBindingFromSourceMock).toHaveBeenCalledWith(expect.objectContaining({
      sourcePromptBindingId: "pb_root_1",
      surface: "job_execution",
      target: {
        targetKind: "job",
        targetId: "job_deferred_1",
      },
    }));
  });
});