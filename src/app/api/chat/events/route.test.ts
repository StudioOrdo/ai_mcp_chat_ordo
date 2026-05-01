import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/chat/events/route";
import type { JobRequest } from "@/core/entities/job";

const {
  resolveUserIdMock,
  getConversationMock,
  getActiveForUserMock,
  listConversationEventsMock,
  findJobByIdMock,
  findLatestRenderableEventForJobMock,
} = vi.hoisted(() => ({
  resolveUserIdMock: vi.fn(),
  getConversationMock: vi.fn(),
  getActiveForUserMock: vi.fn(),
  listConversationEventsMock: vi.fn(),
  findJobByIdMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: {
      get: getConversationMock,
      getActiveForUser: getActiveForUserMock,
    },
  }),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: () => ({
    listConversationEvents: listConversationEventsMock,
    findJobById: findJobByIdMock,
    findLatestRenderableEventForJob: findLatestRenderableEventForJobMock,
  }),
}));

function buildJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_1",
    conversationId: "conv_jobs",
    userId: "usr_owner",
    toolName: "admin_web_search",
    status: "running",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: { query: "current market evidence" },
    resultPayload: null,
    errorMessage: null,
    progressPercent: 42,
    progressLabel: "Reviewing article",
    attemptCount: 1,
    leaseExpiresAt: null,
    claimedBy: "worker_1",
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-03-25T03:00:00.000Z",
    startedAt: "2026-03-25T03:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-03-25T03:00:07.000Z",
    ...overrides,
  };
}

describe("GET /api/chat/events", () => {
  beforeEach(() => {
    vi.stubEnv("JOB_EVENT_STREAM_MAX_DURATION_MS", "5");
    vi.stubEnv("JOB_EVENT_STREAM_POLL_INTERVAL_MS", "1");
    vi.clearAllMocks();
    resolveUserIdMock.mockResolvedValue({ userId: "usr_owner" });
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_jobs" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("streams normalized job parts alongside the legacy event fields", async () => {
    listConversationEventsMock
      .mockResolvedValueOnce([
        {
          id: "evt_9",
          jobId: "job_1",
          conversationId: "conv_jobs",
          sequence: 9,
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
          createdAt: "2026-03-25T03:00:07.000Z",
        },
      ])
      .mockResolvedValue([]);
    findJobByIdMock.mockResolvedValue(buildJob({
      toolName: "produce_blog_article",
      requestPayload: { brief: "Launch Plan" },
    }));
    findLatestRenderableEventForJobMock.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/chat/events?conversationId=conv_jobs"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(listConversationEventsMock).toHaveBeenCalledWith("conv_jobs", {
      afterSequence: 0,
      limit: 100,
    });
    expect(body).toContain('"type":"job_progress"');
    expect(body).toContain('"part":');
    expect(body).toContain('"activePhaseKey":"qa_blog_article"');
  });

  it("replays chat events after the requested conversation sequence cursor", async () => {
    listConversationEventsMock
      .mockResolvedValueOnce([
        {
          id: "evt_2",
          jobId: "job_1",
          conversationId: "conv_jobs",
          sequence: 2,
          eventType: "started",
          payload: { status: "running", progressPercent: 40 },
          createdAt: "2026-04-30T15:01:00.000Z",
        },
        {
          id: "evt_3",
          jobId: "job_1",
          conversationId: "conv_jobs",
          sequence: 3,
          eventType: "result",
          payload: { result: { answer: "Sourced research summary." } },
          createdAt: "2026-04-30T15:04:00.000Z",
        },
      ])
      .mockResolvedValue([]);
    findJobByIdMock.mockResolvedValue(buildJob({
      status: "succeeded",
      progressPercent: 100,
      progressLabel: "Complete",
      completedAt: "2026-04-30T15:04:00.000Z",
      resultPayload: { answer: "Sourced research summary." },
    }));
    findLatestRenderableEventForJobMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/chat/events?conversationId=conv_jobs&afterSequence=1"),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(listConversationEventsMock).toHaveBeenCalledWith("conv_jobs", {
      afterSequence: 1,
      limit: 100,
    });
    expect(body).toContain("id: 2");
    expect(body).toContain("id: 3");
    expect(body).toContain('"type":"job_completed"');
  });

  it("uses Last-Event-ID as the chat conversation sequence cursor when no query cursor is present", async () => {
    listConversationEventsMock.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/chat/events?conversationId=conv_jobs", {
      headers: { "Last-Event-ID": "2" },
    });

    const response = await GET(request);
    await response.text();

    expect(response.status).toBe(200);
    expect(listConversationEventsMock).toHaveBeenCalledWith("conv_jobs", {
      afterSequence: 2,
      limit: 100,
    });
  });

  it("falls back to conversation sequence zero when the chat cursor is invalid", async () => {
    listConversationEventsMock.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://localhost/api/chat/events?conversationId=conv_jobs&afterSequence=not-a-number"),
    );
    await response.text();

    expect(response.status).toBe(200);
    expect(listConversationEventsMock).toHaveBeenCalledWith("conv_jobs", {
      afterSequence: 0,
      limit: 100,
    });
  });
});