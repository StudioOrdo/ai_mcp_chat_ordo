import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, consumeMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  consumeMock: vi.fn(),
}));



vi.mock("@/lib/auth", () => ({ getSessionUser: getSessionUserMock }));

vi.mock("@/lib/referrals/campaign-queue", () => ({
  consumePendingCampaignCoach: consumeMock,
}));

import { GET } from "@/app/api/campaign/context/route";
import { buildCampaignPresetCoachPayload, CAMPAIGN_PRESETS } from "@/lib/referrals/campaign-presets";
import { createAuthenticatedUser, createAnonymousUser } from "@/__test-utils__";


describe("/api/campaign/context (Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list for anonymous users without draining the queue", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousUser({ id: "usr_anonymous" }));

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ items: [] });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("returns an empty list when there is no session user", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ items: [] });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("wraps each drained coach payload in a system coach envelope", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedUser({ id: "usr_42" }));
    const payload = buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[0]);
    consumeMock.mockResolvedValue([payload]);

    const response = await GET();
    const body = await response.json();

    expect(consumeMock).toHaveBeenCalledWith("usr_42");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].coach.family).toBe("system");
    expect(body.items[0].coach.cardKind).toBe("lifecycle");
    expect(body.items[0].coach.payload.variant).toBe("campaign_picked");
  });

  it("returns an empty list when the queue has no pending coach payloads", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedUser({ id: "usr_42" }));
    consumeMock.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(body.items).toEqual([]);
  });
});
