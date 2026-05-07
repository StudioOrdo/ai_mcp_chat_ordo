import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/activity/[activityId]/receipt/route";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../../../tests/helpers/workflow-route-fixture";

const { applyReceiptActionMock, getSessionUserMock } = vi.hoisted(() => ({
  applyReceiptActionMock: vi.fn(),
  getSessionUserMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getActivityReadModel: () => ({
    applyReceiptAction: applyReceiptActionMock,
  }),
}));

function receiptRouteParams(activityId: string) {
  return { params: Promise.resolve({ activityId: encodeURIComponent(activityId) }) };
}

describe("PATCH /api/activity/[activityId]/receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyReceiptActionMock.mockResolvedValue({
      id: "job:job_1",
      receipt: { readAt: "2026-05-04T10:00:00.000Z" },
    });
  });

  it("returns 401 for anonymous callers", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await PATCH(
      createRouteRequest("/api/activity/job%3Ajob_1/receipt", "PATCH", { action: "mark_read" }),
      receiptRouteParams("job:job_1"),
    );

    expect(response.status).toBe(401);
    expect(applyReceiptActionMock).not.toHaveBeenCalled();
  });

  it("applies a valid receipt action for the authenticated user", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));

    const response = await PATCH(
      createRouteRequest("/api/activity/job%3Ajob_1/receipt", "PATCH", { action: "mark_read" }),
      receiptRouteParams("job:job_1"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(applyReceiptActionMock).toHaveBeenCalledWith("usr_owner", "job:job_1", "mark_read");
    expect(payload).toMatchObject({
      ok: true,
      activity: {
        id: "job:job_1",
        receipt: { readAt: "2026-05-04T10:00:00.000Z" },
      },
    });
  });

  it("rejects malformed activity ids and unknown receipt actions", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser());

    const badId = await PATCH(
      createRouteRequest("/api/activity/not-a-source/receipt", "PATCH", { action: "mark_read" }),
      receiptRouteParams("not-a-source"),
    );
    const badAction = await PATCH(
      createRouteRequest("/api/activity/job%3Ajob_1/receipt", "PATCH", { action: "delete" }),
      receiptRouteParams("job:job_1"),
    );

    expect(badId.status).toBe(400);
    expect(badAction.status).toBe(400);
    expect(applyReceiptActionMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the source does not belong to the user or no longer exists", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    applyReceiptActionMock.mockResolvedValue(null);

    const response = await PATCH(
      createRouteRequest("/api/activity/job%3Amissing/receipt", "PATCH", { action: "dismiss" }),
      receiptRouteParams("job:missing"),
    );

    expect(response.status).toBe(404);
    expect(applyReceiptActionMock).toHaveBeenCalledWith("usr_owner", "job:missing", "dismiss");
  });
});
