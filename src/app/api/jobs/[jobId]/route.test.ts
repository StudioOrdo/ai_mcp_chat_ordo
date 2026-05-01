import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/jobs/[jobId]/route";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../../tests/helpers/workflow-route-fixture";

const {
  getSessionUserMock,
  getConversationMock,
  getJobInteractionMock,
  reviseExecutionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  findJobByIdMock: vi.fn(),
  findLatestRenderableEventForJobMock: vi.fn(),
  cancelJobMock: vi.fn(),
  appendEventMock: vi.fn(),
  createJobMock: vi.fn(),
  findActiveJobByDedupeKeyMock: vi.fn(),
  updateJobStatusMock: vi.fn(),
  getConversationMock: vi.fn(),
  getJobInteractionMock: vi.fn(),
  reviseExecutionMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getPlatformInteractionFacade: () => ({
    getJobInteraction: getJobInteractionMock,
  }),
}));

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: () => ({
    reviseExecution: reviseExecutionMock,
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: {
      get: getConversationMock,
    },
  }),
}));

describe("/api/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_jobs" }, messages: [] });
  });

  it("returns 401 for anonymous callers", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await GET(createRouteRequest("/api/jobs/job_1"), {
      params: Promise.resolve({ jobId: "job_1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns a migrated anonymous job for the signed-in owner", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    getJobInteractionMock.mockResolvedValue({
      job: {
        id: "job_1",
        conversationId: "conv_migrated",
      },
      snapshot: {
        jobId: "job_1",
        conversationId: "conv_migrated",
        toolName: "publish_content",
        status: "running",
        progressPercent: 80,
        progressLabel: "Publishing",
        part: {
          jobId: "job_1",
          status: "running",
          progressLabel: "Publishing",
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
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_migrated" }, messages: [] });

    const response = await GET(createRouteRequest("/api/jobs/job_1"), {
      params: Promise.resolve({ jobId: "job_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getConversationMock).toHaveBeenCalledWith("conv_migrated", "usr_owner");
    expect(payload.job).toMatchObject({
      jobId: "job_1",
      status: "running",
      progressLabel: "Publishing",
    });
    expect(payload.revision).toMatchObject({
      executionId: "job_1",
      supportLevel: "reduced",
      state: "active",
    });
  });

  it("replays failed jobs with explicit lineage metadata", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    getJobInteractionMock.mockResolvedValue({
      job: { id: "job_failed", conversationId: "conv_jobs" },
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

    const response = await POST(createRouteRequest("/api/jobs/job_failed", "POST", { action: "retry" }), {
      params: Promise.resolve({ jobId: "job_failed" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reviseExecutionMock).toHaveBeenCalledWith(expect.objectContaining({
      executionKind: "job",
      executionId: "job_failed",
      action: "retry",
      userId: "usr_owner",
    }));
    expect(body.replay).toEqual({
      outcome: "queued",
      sourceJobId: "job_failed",
      targetJobId: "job_retry",
      dedupeKey: expect.any(String),
    });
    expect(body.eventSequence).toBe(12);
  });

  it("returns an explicit dedupe replay outcome when equivalent active work already exists", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    getJobInteractionMock.mockResolvedValue({
      job: { id: "job_failed", conversationId: "conv_jobs" },
    });
    reviseExecutionMock.mockResolvedValue({
      payload: {
        deduped: true,
        replay: {
          outcome: "deduped",
          sourceJobId: "job_failed",
          targetJobId: "job_active",
          dedupeKey: "conv_jobs:publish_content",
        },
        job: { id: "job_active", conversationId: "conv_jobs" },
      },
    });

    const response = await POST(createRouteRequest("/api/jobs/job_failed", "POST", { action: "retry" }), {
      params: Promise.resolve({ jobId: "job_failed" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deduped).toBe(true);
    expect(body.replay).toEqual({
      outcome: "deduped",
      sourceJobId: "job_failed",
      targetJobId: "job_active",
      dedupeKey: expect.any(String),
    });
  });
});
