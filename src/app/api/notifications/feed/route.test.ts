import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  listUserInboxActivityMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listUserInboxActivityMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getActivityReadModel: () => ({
    listUserInboxActivity: listUserInboxActivityMock,
  }),
}));

import { GET } from "@/app/api/notifications/feed/route";

describe("/api/notifications/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUserInboxActivityMock.mockResolvedValue({
      items: [],
      unreadCount: 0,
      pageInfo: {
        page: 1,
        limit: 20,
        total: 0,
        hasNextPage: false,
        nextPage: null,
      },
    });
  });

  it("returns 401 for anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "anon_1",
      email: "anon@example.com",
      name: "Anon",
      roles: ["ANONYMOUS"],
    });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listUserInboxActivityMock).not.toHaveBeenCalled();
  });

  it("returns activity-backed attention notifications for signed-in users", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "morgan@example.com",
      name: "Morgan",
      roles: ["AUTHENTICATED"],
    });
    listUserInboxActivityMock.mockResolvedValue({
      unreadCount: 1,
      pageInfo: {
        page: 1,
        limit: 20,
        total: 1,
        hasNextPage: false,
        nextPage: null,
      },
      items: [
        {
          id: "job:job_failed",
          title: "Fix failed render",
          summary: "Provider failed.",
          href: "/jobs?jobId=job_failed",
          roleVisibility: ["AUTHENTICATED"],
          receipt: { readAt: null },
          updatedAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listUserInboxActivityMock).toHaveBeenCalledWith("usr_1", { limit: 20 });
    expect(payload).toMatchObject({
      unreadCount: 1,
      notifications: [
        {
          id: "job:job_failed",
          title: "Fix failed render",
          body: "Provider failed.",
          href: "/jobs?jobId=job_failed",
          scope: "user",
          unread: true,
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });
  });

  it("does not require referral self-service for the compatibility feed", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_disabled",
      email: "disabled@example.com",
      name: "Disabled",
      roles: ["AUTHENTICATED"],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ notifications: [], unreadCount: 0 });
  });
});
