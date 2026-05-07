import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadReferralsWorkspaceMock,
  redirectMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadReferralsWorkspaceMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/referrals/load-referrals-workspace", () => ({
  loadReferralsWorkspace: loadReferralsWorkspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import ReferralsPage from "@/app/referrals/page";

describe("/referrals page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_anon",
      email: "anon@example.com",
      name: "Anon",
      roles: ["ANONYMOUS"],
    });

    await expect(ReferralsPage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders the affiliate workspace for enabled accounts", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "morgan@example.com",
      name: "Morgan",
      roles: ["AUTHENTICATED"],
    });
    loadReferralsWorkspaceMock.mockResolvedValue({
      profile: {
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
      },
      overview: {
        introductions: 4,
        startedChats: 3,
        registered: 2,
        qualifiedOpportunities: 1,
        creditStatusLabel: "1 pending review",
        creditStatusCounts: { tracked: 1, pending_review: 1, approved: 0, paid: 0, void: 0 },
        narrative: "A referred opportunity is waiting for review.",
      },
      timeseries: [],
      pipeline: {
        stages: [
          { stage: "introductions", label: "Introductions", count: 4, conversionRate: 100 },
          { stage: "started_chats", label: "Started chats", count: 3, conversionRate: 75 },
        ],
        outcomes: [],
      },
      recentActivity: [],
    });

    render(await ReferralsPage());

    expect(loadReferralsWorkspaceMock).toHaveBeenCalledWith("usr_1");
    expect(screen.getByText("Affiliate dashboard")).toBeInTheDocument();
    expect(screen.getAllByText("Introductions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 pending review").length).toBeGreaterThan(0);
  });

  it("renders a truthful empty state for non-affiliate users", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_2",
      email: "member@example.com",
      name: "Member",
      roles: ["AUTHENTICATED"],
    });
    loadReferralsWorkspaceMock.mockResolvedValue({
      profile: {
        id: "usr_2",
        name: "Member",
        email: "member@example.com",
        credential: "",
        pushNotificationsEnabled: true,
        affiliateEnabled: false,
        referralCode: null,
        referralUrl: null,
        qrCodeUrl: null,
        roles: ["AUTHENTICATED"],
      },
      overview: null,
      timeseries: [],
      pipeline: null,
      recentActivity: [],
    });

    render(await ReferralsPage());

    expect(screen.getByText("Referral and QR access are not enabled yet")).toBeInTheDocument();
  });
});
