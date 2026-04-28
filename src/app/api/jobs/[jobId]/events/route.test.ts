import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/jobs/[jobId]/events/route";
import {
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../../../tests/helpers/workflow-route-fixture";

const { getSessionUserMock, getUserJobHistoryInteractionMock, getConversationMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getUserJobHistoryInteractionMock: vi.fn(),
  getConversationMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getPlatformInteractionFacade: () => ({
    getUserJobHistoryInteraction: getUserJobHistoryInteractionMock,
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRouteServices: () => ({
    interactor: {
      get: getConversationMock,
    },
  }),
}));

describe("GET /api/jobs/[jobId]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns durable normalized history for the selected job", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    getUserJobHistoryInteractionMock.mockResolvedValue({
      job: {
        id: "job_1",
        conversationId: "conv_migrated",
      },
      history: [
        {
          id: "evt_1",
          jobId: "job_1",
          conversationId: "conv_migrated",
          sequence: 1,
          eventType: "queued",
          createdAt: "2026-03-25T03:00:00.000Z",
          part: { jobId: "job_1", status: "queued" },
        },
        {
          id: "evt_2",
          jobId: "job_1",
          conversationId: "conv_migrated",
          sequence: 2,
          eventType: "progress",
          createdAt: "2026-03-25T03:00:02.000Z",
          part: { jobId: "job_1", status: "running", progressLabel: "Publishing" },
        },
      ],
      timeline: { executionId: "job_1" },
      revision: { executionId: "job_1", supportLevel: "reduced" },
    });
    getConversationMock.mockResolvedValue({ conversation: { id: "conv_migrated" }, messages: [] });

    const response = await GET(createRouteRequest("/api/jobs/job_1/events?limit=5"), {
      params: Promise.resolve({ jobId: "job_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getUserJobHistoryInteractionMock).toHaveBeenCalledWith("usr_owner", "job_1", { limit: 5 });
    expect(payload.events).toHaveLength(2);
    expect(payload.events[1].part).toMatchObject({
      jobId: "job_1",
      status: "running",
      progressLabel: "Publishing",
    });
  });
});