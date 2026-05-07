import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getOverview: vi.fn(),
  getTimeseries: vi.fn(),
  getPipeline: vi.fn(),
  getRecentActivity: vi.fn(),
}));

vi.mock("@/lib/profile/profile-service", () => ({
  createProfileService: () => ({
    getProfile: mocks.getProfile,
  }),
}));

vi.mock("@/lib/referrals/referral-analytics", () => ({
  createReferralAnalyticsService: () => ({
    getOverview: mocks.getOverview,
    getTimeseries: mocks.getTimeseries,
    getPipeline: mocks.getPipeline,
    getRecentActivity: mocks.getRecentActivity,
  }),
}));

import { loadReferralsWorkspace } from "./load-referrals-workspace";

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_1",
    name: "Morgan Lee",
    email: "morgan@example.com",
    credential: "AI strategist",
    pushNotificationsEnabled: true,
    affiliateEnabled: true,
    referralCode: "mentor-42",
    referralUrl: "https://studioordo.com/r/mentor-42",
    qrCodeUrl: "/api/qr/mentor-42",
    roles: ["AUTHENTICATED"],
    ...overrides,
  };
}

describe("loadReferralsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue(profile());
    mocks.getOverview.mockResolvedValue({
      introductions: 2,
      startedChats: 1,
      registered: 1,
      qualifiedOpportunities: 0,
      creditStatusLabel: "1 tracked",
      creditStatusCounts: { tracked: 1, pending_review: 0, approved: 0, paid: 0, void: 0 },
      narrative: "One referred conversation is moving.",
    });
    mocks.getTimeseries.mockResolvedValue([{ date: "2026-05-01", introductions: 2, startedChats: 1, registered: 1, qualifiedOpportunities: 0 }]);
    mocks.getPipeline.mockResolvedValue({
      stages: [{ stage: "introductions", label: "Introductions", count: 2, conversionRate: 100 }],
      outcomes: [],
    });
    mocks.getRecentActivity.mockResolvedValue([
      {
        id: "evt_1",
        referralId: "ref_1",
        referralCode: "mentor-42",
        milestone: "validated_visit",
        title: "Introduction validated",
        description: "A new introduction used referral code mentor-42.",
        occurredAt: "2026-05-01T12:00:00.000Z",
        href: "/business/referrals/mentor-42",
      },
    ]);
  });

  it("loads owner affiliate analytics when referral identity is enabled", async () => {
    const workspace = await loadReferralsWorkspace("usr_1");

    expect(mocks.getProfile).toHaveBeenCalledWith("usr_1");
    expect(mocks.getOverview).toHaveBeenCalledWith("usr_1");
    expect(mocks.getTimeseries).toHaveBeenCalledWith("usr_1");
    expect(mocks.getPipeline).toHaveBeenCalledWith("usr_1");
    expect(mocks.getRecentActivity).toHaveBeenCalledWith("usr_1", 12);
    expect(workspace).toMatchObject({
      profile: expect.objectContaining({ referralCode: "mentor-42" }),
      overview: expect.objectContaining({ introductions: 2 }),
      timeseries: [expect.objectContaining({ date: "2026-05-01" })],
      pipeline: expect.objectContaining({ stages: [expect.objectContaining({ stage: "introductions" })] }),
      recentActivity: [expect.objectContaining({ href: "/business/referrals/mentor-42" })],
    });
  });

  it("renders a disabled deterministic read model when affiliate access is unavailable", async () => {
    mocks.getProfile.mockResolvedValue(profile({
      affiliateEnabled: false,
      referralCode: null,
      referralUrl: null,
      qrCodeUrl: null,
    }));

    const workspace = await loadReferralsWorkspace("usr_2");

    expect(workspace).toEqual({
      profile: expect.objectContaining({ affiliateEnabled: false, referralCode: null }),
      overview: null,
      timeseries: [],
      pipeline: null,
      recentActivity: [],
    });
    expect(mocks.getOverview).not.toHaveBeenCalled();
    expect(mocks.getTimeseries).not.toHaveBeenCalled();
    expect(mocks.getPipeline).not.toHaveBeenCalled();
    expect(mocks.getRecentActivity).not.toHaveBeenCalled();
  });
});
