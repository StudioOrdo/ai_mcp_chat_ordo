import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/jobs/route";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../tests/helpers/workflow-route-fixture";

const { getSessionUserMock, listUserJobInteractionsMock, listUserWorkflowsMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listUserJobInteractionsMock: vi.fn(),
  listUserWorkflowsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getMediaWorkflowReadModel: () => ({
    listUserWorkflows: listUserWorkflowsMock,
  }),
  getPlatformInteractionFacade: () => ({
    listUserJobInteractions: listUserJobInteractionsMock,
  }),
}));

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUserWorkflowsMock.mockResolvedValue([]);
  });

  it("returns 401 for anonymous callers", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await GET(createRouteRequest("/api/jobs"));

    expect(response.status).toBe(401);
  });

  it("lists signed-in jobs from the user-scoped read model", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    listUserJobInteractionsMock.mockResolvedValue([
      {
        snapshot: {
          messageId: "jobmsg_job_1",
          part: {
            type: "job_status",
            jobId: "job_1",
            toolName: "publish_content",
            label: "Publish Content",
            title: "Publish journal draft post_1",
            status: "running",
            progressPercent: 80,
            progressLabel: "Publishing",
            updatedAt: "2026-03-25T03:00:02.000Z",
          },
        },
      },
    ]);

    const response = await GET(createRouteRequest("/api/jobs?activeOnly=true&limit=5"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUserJobInteractionsMock).toHaveBeenCalledWith("usr_owner", {
      statuses: ["queued", "running"],
      limit: 5,
    });
    expect(payload.workflows).toEqual([]);
    expect(payload.jobs[0].part).toMatchObject({
      jobId: "job_1",
      status: "running",
      progressLabel: "Publishing",
    });
  });
});
