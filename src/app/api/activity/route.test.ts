import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/activity/route";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../tests/helpers/workflow-route-fixture";

const { getSessionUserMock, listUserActivityMock, listUserInboxActivityMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listUserActivityMock: vi.fn(),
  listUserInboxActivityMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getActivityReadModel: () => ({
    listUserActivity: listUserActivityMock,
    listUserInboxActivity: listUserInboxActivityMock,
  }),
}));

describe("GET /api/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUserActivityMock.mockResolvedValue({
      items: [],
      pageInfo: {
        page: 1,
        limit: 25,
        total: 0,
        hasNextPage: false,
        nextPage: null,
      },
    });
    listUserInboxActivityMock.mockResolvedValue({
      items: [],
      unreadCount: 0,
      pageInfo: {
        page: 1,
        limit: 25,
        total: 0,
        hasNextPage: false,
        nextPage: null,
      },
    });
  });

  it("returns 401 for anonymous callers", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await GET(createRouteRequest("/api/activity"));

    expect(response.status).toBe(401);
    expect(listUserActivityMock).not.toHaveBeenCalled();
  });

  it("passes authenticated filters to the activity read model", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    listUserActivityMock.mockResolvedValue({
      items: [{ id: "job:job_1", title: "Generate audio" }],
      pageInfo: {
        page: 2,
        limit: 10,
        total: 11,
        hasNextPage: true,
        nextPage: 3,
      },
    });

    const response = await GET(createRouteRequest(
      "/api/activity?bucket=running&sourceKind=job&sourceId=job_1&status=running&q=audio&limit=10&page=2&includeDismissed=true",
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUserActivityMock).toHaveBeenCalledWith("usr_owner", {
      bucket: "running",
      sourceKind: "job",
      sourceId: "job_1",
      status: "running",
      q: "audio",
      limit: 10,
      page: 2,
      includeDismissed: true,
      unreadOnly: false,
    });
    expect(payload).toMatchObject({
      ok: true,
      activity: [{ id: "job:job_1", title: "Generate audio" }],
      pageInfo: { page: 2, limit: 10, total: 11, hasNextPage: true, nextPage: 3 },
    });
  });

  it("routes inbox queries to the durable attention inbox projection", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    listUserInboxActivityMock.mockResolvedValue({
      items: [{ id: "job:failed", title: "Fix failed render" }],
      unreadCount: 1,
      pageInfo: {
        page: 1,
        limit: 5,
        total: 1,
        hasNextPage: false,
        nextPage: null,
      },
    });

    const response = await GET(createRouteRequest("/api/activity?inbox=true&limit=5&unreadOnly=true"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUserInboxActivityMock).toHaveBeenCalledWith("usr_owner", {
      bucket: undefined,
      sourceKind: undefined,
      sourceId: undefined,
      status: undefined,
      q: undefined,
      limit: 5,
      page: 1,
      includeDismissed: false,
      unreadOnly: true,
    });
    expect(listUserActivityMock).not.toHaveBeenCalled();
    expect(payload).toMatchObject({
      ok: true,
      inbox: true,
      activity: [{ id: "job:failed", title: "Fix failed render" }],
      unreadCount: 1,
    });
  });

  it("rejects unknown source kind and bucket filters", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser());

    const badSource = await GET(createRouteRequest("/api/activity?sourceKind=blog"));
    const badBucket = await GET(createRouteRequest("/api/activity?bucket=waiting"));

    expect(badSource.status).toBe(400);
    expect(badBucket.status).toBe(400);
    expect(listUserActivityMock).not.toHaveBeenCalled();
  });
});
