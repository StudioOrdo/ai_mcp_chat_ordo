import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/chat/jobs/[jobId]/route";
import { createRouteParams, createRouteRequest } from "@/__test-utils__";

const {
  findJobByIdMock,
  findLatestRenderableEventForJobMock,
  cancelJobMock,
  appendEventMock,
  createJobMock,
  findActiveJobByDedupeKeyMock,
  updateJobStatusMock,
  getJobInteractionMock,
  getConversationMock,
  resolveUserIdMock,
  reviseExecutionMock,
} = vi.hoisted(() => ({
  findJobByIdMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
  cancelJobMock: vi.fn(),
  appendEventMock: vi.fn(),
  createJobMock: vi.fn(),
  findActiveJobByDedupeKeyMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  getJobInteractionMock: vi.fn(),

  getConversationMock: vi.fn(),
  resolveUserIdMock: vi.fn(),
  reviseExecutionMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getJobQueueRepository: () => ({
        findJobById: findJobByIdMock,
        findLatestRenderableEventForJob: findLatestRenderableEventForJobMock,
        cancelJob: cancelJobMock,
        appendEvent: appendEventMock,
        createJob: createJobMock,
        findActiveJobByDedupeKey: findActiveJobByDedupeKeyMock,
        updateJobStatus: updateJobStatusMock,
      }),
      getPlatformInteractionFacade: () => ({
        getJobInteraction: getJobInteractionMock,
      }),
    })
  };
});

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: () => ({
    reviseExecution: reviseExecutionMock,
  }),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));



vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: { get: getConversationMock },
  }),
}));

describe("/api/chat/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserIdMock.mockResolvedValue({ userId: "usr_owner" });
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_jobs" }, messages: [] });
  });

  it("returns the job snapshot when the conversation is accessible", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_1",
        conversationId: "conv_jobs",
      },
      snapshot: {
        jobId: "job_1",
        conversationId: "conv_jobs",
        toolName: "publish_content",
        status: "running",
        part: {
          jobId: "job_1",
          status: "running",
        },
      },
      timeline: { executionId: "job_1" },
      revision: {
        executionId: "job_1",
        executionKind: "job",
        supportLevel: "reduced",
        state: "active",
        title: "Publish Content",
        actions: [{ key: "cancel", label: "Cancel", operation: "cancel", transportKind: "job", value: "job_1", available: true }],
        checkpoints: [],
      },
    });

    const response = await GET(createRouteRequest("/api/chat/jobs/job_1"), createRouteParams({ jobId: "job_1" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getConversationMock).toHaveBeenCalledWith("conv_jobs", "usr_owner");
    expect(body.job).toMatchObject({ jobId: "job_1", status: "running" });
    expect(body.revision).toMatchObject({ executionId: "job_1", supportLevel: "reduced", state: "active" });
  });

  it("cancels a running chat job using the canonical canceled payload shape", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_running",
        conversationId: "conv_jobs",
      },
    });
    reviseExecutionMock.mockResolvedValue({
      payload: {
        job: { id: "job_running", status: "canceled" },
        eventSequence: 12,
      },
    });

    const response = await POST(createRouteRequest("/api/chat/jobs/job_running", "POST", { action: "cancel" }), createRouteParams({ jobId: "job_running" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getConversationMock).toHaveBeenCalledWith("conv_jobs", "usr_owner");
    expect(reviseExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      executionKind: "job",
      executionId: "job_running",
      action: "cancel",
      userId: "usr_owner",
    }));
    expect(body).toMatchObject({
      ok: true,
      action: "cancel",
      eventSequence: 12,
    });
  });

  it("replays a failed chat job through the shared executor", async () => {
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_failed",
        conversationId: "conv_jobs",
      },
    });
    reviseExecutionMock.mockResolvedValue({
      payload: {
        deduped: false,
        replay: {
          outcome: "queued",
          sourceJobId: "job_failed",
          targetJobId: "job_retry",
          dedupeKey: "conv_jobs:publish_content",
        },
        job: {
          id: "job_retry",
          conversationId: "conv_jobs",
          userId: "usr_owner",
          toolName: "publish_content",
          status: "queued",
          recoveryMode: "rerun",
          replayedFromJobId: "job_failed",
        },
        eventSequence: 12,
      },
    });

    const response = await POST(createRouteRequest("/api/chat/jobs/job_failed", "POST", { action: "retry" }), createRouteParams({ jobId: "job_failed" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reviseExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      executionKind: "job",
      executionId: "job_failed",
      action: "retry",
      userId: "usr_owner",
    }));
    expect(body).toMatchObject({
      ok: true,
      action: "retry",
      deduped: false,
      replay: {
        outcome: "queued",
        sourceJobId: "job_failed",
        targetJobId: "job_retry",
      },
      eventSequence: 12,
    });
  });
});