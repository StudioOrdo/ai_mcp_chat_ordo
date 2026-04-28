import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/chat/jobs/[jobId]/route";

const {
  findJobByIdMock,
  findLatestRenderableEventForJobMock,
  cancelJobMock,
  appendEventMock,
  createJobMock,
  findActiveJobByDedupeKeyMock,
  updateJobStatusMock,
  getJobSnapshotMock,
  getMock,
  resolveUserIdMock,
  getDescriptorMock,
  projectMock,
} = vi.hoisted(() => ({
  findJobByIdMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
  cancelJobMock: vi.fn(),
  appendEventMock: vi.fn(),
  createJobMock: vi.fn(),
  findActiveJobByDedupeKeyMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  getJobSnapshotMock: vi.fn(),
  getMock: vi.fn(),
  resolveUserIdMock: vi.fn(),
  getDescriptorMock: vi.fn(),
  projectMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: () => ({
    findJobById: findJobByIdMock,
    findLatestRenderableEventForJob: findLatestRenderableEventForJobMock,
    cancelJob: cancelJobMock,
    appendEvent: appendEventMock,
    createJob: createJobMock,
    findActiveJobByDedupeKey: findActiveJobByDedupeKeyMock,
    updateJobStatus: updateJobStatusMock,
  }),
  getJobStatusQuery: () => ({
    getJobSnapshot: getJobSnapshotMock,
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: { get: getMock },
  }),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: () => ({
    registry: { getDescriptor: getDescriptorMock },
    executor: vi.fn(),
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/adapters/ConversationDataMapper", () => ({
  ConversationDataMapper: class ConversationDataMapper {},
}));

vi.mock("@/adapters/MessageDataMapper", () => ({
  MessageDataMapper: class MessageDataMapper {},
}));

vi.mock("@/lib/jobs/deferred-job-projector-root", () => ({
  createDeferredJobConversationProjector: () => ({
    project: projectMock,
  }),
}));

describe("POST /api/chat/jobs/[jobId]", () => {
  beforeEach(() => {
    resolveUserIdMock.mockResolvedValue({ userId: "usr_test" });
    getMock.mockResolvedValue({ conversation: { id: "conv_jobs" }, messages: [] });
    appendEventMock.mockResolvedValue({ sequence: 4 });
    projectMock.mockResolvedValue(undefined);
    findLatestRenderableEventForJobMock.mockResolvedValue(null);
    findActiveJobByDedupeKeyMock.mockResolvedValue(null);
    updateJobStatusMock.mockResolvedValue({ id: "job_2" });
    getDescriptorMock.mockReturnValue({
      executionMode: "deferred",
      deferred: { dedupeStrategy: "per-conversation-payload" },
    });
  });

  it("cancels queued jobs and projects a canceled event", async () => {
    findLatestRenderableEventForJobMock.mockResolvedValue({
      id: "evt_3",
      jobId: "job_1",
      conversationId: "conv_jobs",
      sequence: 3,
      eventType: "progress",
      payload: {
        progressPercent: 42,
        progressLabel: "Reviewing article",
        phases: [
          { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
          { key: "qa_blog_article", label: "Reviewing article", status: "active", percent: 60 },
        ],
        activePhaseKey: "qa_blog_article",
      },
      createdAt: "2026-03-25T03:00:02.000Z",
    });
    findJobByIdMock.mockResolvedValue({
      id: "job_1",
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "draft_content",
      status: "queued",
      priority: 100,
      initiatorType: "user",
      requestPayload: { title: "Launch Plan" },
    });
    cancelJobMock.mockResolvedValue({ id: "job_1", conversationId: "conv_jobs", status: "canceled" });

    const response = await POST(
      new NextRequest("http://localhost/api/chat/jobs/job_1", {
        method: "POST",
        body: JSON.stringify({ action: "cancel" }),
      }),
      { params: Promise.resolve({ jobId: "job_1" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(cancelJobMock).toHaveBeenCalled();
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "canceled",
      payload: expect.objectContaining({
        activePhaseKey: "qa_blog_article",
        progressLabel: "Reviewing article",
      }),
    }));
    expect(projectMock).toHaveBeenCalled();
    expect(body.action).toBe("cancel");
  });

  it("retries failed jobs by creating a fresh queued job", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_2",
      conversationId: "conv_jobs",
      userId: null,
      toolName: "publish_content",
      status: "failed",
      priority: 100,
      dedupeKey: null,
      initiatorType: "anonymous_session",
      requestPayload: { post_id: "post_1" },
    });
    createJobMock.mockResolvedValue({
      id: "job_retry",
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      status: "queued",
      recoveryMode: "rerun",
      replayedFromJobId: "job_2",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/chat/jobs/job_2", {
        method: "POST",
        body: JSON.stringify({ action: "retry" }),
      }),
      { params: Promise.resolve({ jobId: "job_2" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(createJobMock).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "publish_content",
      userId: "usr_test",
      recoveryMode: "rerun",
      replayedFromJobId: "job_2",
    }));
    expect(updateJobStatusMock).toHaveBeenCalledWith("job_2", {
      status: "failed",
      supersededByJobId: "job_retry",
    });
    expect(appendEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: "queued" }));
    expect(body.replay).toEqual({
      outcome: "queued",
      sourceJobId: "job_2",
      targetJobId: "job_retry",
      dedupeKey: expect.any(String),
    });
    expect(body.job.id).toBe("job_retry");
  });

  it("returns an explicit dedupe outcome when equivalent active work already exists", async () => {
    findJobByIdMock.mockResolvedValue({
      id: "job_2",
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      status: "failed",
      priority: 100,
      dedupeKey: null,
      initiatorType: "user",
      requestPayload: { post_id: "post_1" },
    });
    findActiveJobByDedupeKeyMock.mockResolvedValue({
      id: "job_running",
      conversationId: "conv_jobs",
      userId: "usr_test",
      toolName: "publish_content",
      status: "running",
    });

    const response = await POST(
      new NextRequest("http://localhost/api/chat/jobs/job_2", {
        method: "POST",
        body: JSON.stringify({ action: "retry" }),
      }),
      { params: Promise.resolve({ jobId: "job_2" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(createJobMock).not.toHaveBeenCalled();
    expect(updateJobStatusMock).toHaveBeenCalledWith("job_2", {
      status: "failed",
      supersededByJobId: "job_running",
    });
    expect(body.deduped).toBe(true);
    expect(body.replay).toEqual({
      outcome: "deduped",
      sourceJobId: "job_2",
      targetJobId: "job_running",
      dedupeKey: expect.any(String),
    });
  });

  it("returns a normalized snapshot for GET job status", async () => {
    getJobSnapshotMock.mockResolvedValue({
      messageId: "jobmsg_job_3",
      conversationId: "conv_jobs",
      part: {
        type: "job_status",
        jobId: "job_3",
        toolName: "draft_content",
        label: "Draft Content",
        status: "queued",
        updatedAt: "2026-03-25T03:00:00.000Z",
      },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/chat/jobs/job_3"),
      { params: Promise.resolve({ jobId: "job_3" }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.job.part).toMatchObject({ jobId: "job_3", status: "queued" });
  });
});