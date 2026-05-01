import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/jobs/events/route";
import type { JobRequest } from "@/core/entities/job";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
} from "../../../../../tests/helpers/workflow-route-fixture";

const { getSessionUserMock, listUserEventsMock, findJobByIdMock, findLatestRenderableEventForJobMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listUserEventsMock: vi.fn(),
  findJobByIdMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: () => ({
    listUserEvents: listUserEventsMock,
    findJobById: findJobByIdMock,
    findLatestRenderableEventForJob: findLatestRenderableEventForJobMock,
  }),
}));

function buildJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_1",
    conversationId: "conv_migrated",
    userId: null,
    toolName: "publish_content",
    status: "running",
    priority: 100,
    dedupeKey: null,
    initiatorType: "anonymous_session",
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
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-03-25T03:00:00.000Z",
    startedAt: "2026-03-25T03:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-03-25T03:00:02.000Z",
    ...overrides,
  };
}

describe("GET /api/jobs/events", () => {
  beforeEach(() => {
    vi.stubEnv("JOB_EVENT_STREAM_MAX_DURATION_MS", "5");
    vi.stubEnv("JOB_EVENT_STREAM_POLL_INTERVAL_MS", "1");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 for anonymous callers", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await GET(new NextRequest("http://localhost/api/jobs/events"));

    expect(response.status).toBe(401);
  });

  it("replays signed-in durable backlog using the user rowid cursor", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    listUserEventsMock
      .mockResolvedValueOnce([
        {
          id: "evt_11",
          jobId: "job_1",
          conversationId: "conv_migrated",
          sequence: 11,
          eventType: "progress",
          payload: { progressPercent: 80, progressLabel: "Publishing" },
          createdAt: "2026-03-25T03:00:02.000Z",
        },
      ])
      .mockResolvedValue([]);
    findJobByIdMock.mockResolvedValue(buildJob());
    findLatestRenderableEventForJobMock.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/api/jobs/events?afterSequence=10"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(listUserEventsMock).toHaveBeenCalledWith("usr_owner", {
      afterSequence: 10,
      limit: 100,
    });
    expect(body).toContain("id: 11");
    expect(body).toContain('"type":"job_progress"');
    expect(body).toContain('"conversationId":"conv_migrated"');
    expect(body).toContain('"part":');
  });

  it("uses Last-Event-ID as the signed-in user rowid cursor when no query cursor is present", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    listUserEventsMock.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/jobs/events", {
      headers: { "Last-Event-ID": "11" },
    });

    const response = await GET(request);
    await response.text();

    expect(response.status).toBe(200);
    expect(listUserEventsMock).toHaveBeenCalledWith("usr_owner", {
      afterSequence: 11,
      limit: 100,
    });
  });

  it("falls back to user rowid cursor zero when the jobs cursor is invalid", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    listUserEventsMock.mockResolvedValue([]);

    const response = await GET(new NextRequest("http://localhost/api/jobs/events?afterSequence=invalid"));
    await response.text();

    expect(response.status).toBe(200);
    expect(listUserEventsMock).toHaveBeenCalledWith("usr_owner", {
      afterSequence: 0,
      limit: 100,
    });
  });
});