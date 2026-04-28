import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, queueMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  queueMock: vi.fn(),
}));



vi.mock("@/lib/auth", () => ({ getSessionUser: getSessionUserMock }));

vi.mock("@/lib/referrals/campaign-queue", () => ({
  queuePendingCampaignCoach: queueMock,
}));

import { selectCampaignPresetAction } from "./actions";

describe("selectCampaignPresetAction (Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueMock.mockResolvedValue(undefined);
  });

  it("rejects anonymous users without queueing", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_anonymous",
      roles: ["ANONYMOUS"],
    });
    const result = await selectCampaignPresetAction("friends_and_family");
    expect(result).toEqual({ ok: false, error: "anonymous" });
    expect(queueMock).not.toHaveBeenCalled();
  });

  it("rejects unknown preset keys without queueing", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_42",
      roles: ["AUTHENTICATED"],
    });
    const result = await selectCampaignPresetAction("not_a_preset");
    expect(result).toEqual({ ok: false, error: "unknown_preset" });
    expect(queueMock).not.toHaveBeenCalled();
  });

  it("queues a campaign_picked coach payload for a valid preset", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_42",
      roles: ["AUTHENTICATED"],
    });
    const result = await selectCampaignPresetAction("friends_and_family");
    expect(result).toEqual({ ok: true });
    expect(queueMock).toHaveBeenCalledTimes(1);
    const [userId, payload] = queueMock.mock.calls[0];
    expect(userId).toBe("usr_42");
    expect(payload.variant).toBe("campaign_picked");
  });

  it("reports unavailable when the queue throws", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_42",
      roles: ["AUTHENTICATED"],
    });
    queueMock.mockRejectedValue(new Error("store down"));
    const result = await selectCampaignPresetAction("local_flyers");
    expect(result).toEqual({ ok: false, error: "unavailable" });
  });
});
