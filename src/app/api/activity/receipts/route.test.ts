import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/activity/receipts/route";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../../tests/helpers/workflow-route-fixture";

const { getSessionUserMock, applyReceiptActionToInboxMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  applyReceiptActionToInboxMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getActivityReadModel: () => ({
    applyReceiptActionToInbox: applyReceiptActionToInboxMock,
  }),
}));

describe("POST /api/activity/receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyReceiptActionToInboxMock.mockResolvedValue({
      updatedCount: 2,
      inbox: {
        items: [],
        unreadCount: 0,
        pageInfo: {
          page: 1,
          limit: 25,
          total: 0,
          hasNextPage: false,
          nextPage: null,
        },
      },
    });
  });

  it("returns 401 for anonymous callers", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await POST(createRouteRequest("/api/activity/receipts", "POST", {
      action: "mark_read",
      inbox: true,
    }));

    expect(response.status).toBe(401);
    expect(applyReceiptActionToInboxMock).not.toHaveBeenCalled();
  });

  it("marks the authenticated user's inbox read", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));

    const response = await POST(createRouteRequest("/api/activity/receipts", "POST", {
      action: "mark_read",
      inbox: true,
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(applyReceiptActionToInboxMock).toHaveBeenCalledWith("usr_owner", "mark_read");
    expect(payload).toMatchObject({
      ok: true,
      updatedCount: 2,
      activity: [],
      unreadCount: 0,
    });
  });

  it("rejects non-inbox and unsupported bulk receipt actions", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser());

    const missingInbox = await POST(createRouteRequest("/api/activity/receipts", "POST", {
      action: "mark_read",
    }));
    const badAction = await POST(createRouteRequest("/api/activity/receipts", "POST", {
      action: "dismiss",
      inbox: true,
    }));

    expect(missingInbox.status).toBe(400);
    expect(badAction.status).toBe(400);
    expect(applyReceiptActionToInboxMock).not.toHaveBeenCalled();
  });
});
