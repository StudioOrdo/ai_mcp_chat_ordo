import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReferralsWorkspaceData } from "@/lib/referrals/load-referrals-workspace";

const { downloadFileFromUrlMock } = vi.hoisted(() => ({
  downloadFileFromUrlMock: vi.fn(),
}));

vi.mock("@/lib/download-browser", () => ({
  downloadFileFromUrl: downloadFileFromUrlMock,
}));

import { ReferralsWorkspace } from "./ReferralsWorkspace";

function workspace(overrides: Partial<ReferralsWorkspaceData> = {}): ReferralsWorkspaceData {
  return {
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
      creditStatusCounts: { tracked: 0, pending_review: 1, approved: 0, paid: 0, void: 0 },
      narrative: "A referred opportunity is waiting for review.",
    },
    timeseries: [
      { date: "2026-05-01", introductions: 4, startedChats: 3, registered: 2, qualifiedOpportunities: 1 },
    ],
    pipeline: {
      stages: [
        { stage: "introductions", label: "Introductions", count: 4, conversionRate: 100 },
        { stage: "started_chats", label: "Started chats", count: 3, conversionRate: 75 },
      ],
      outcomes: [
        { outcome: "lead_submitted", label: "Lead submitted", count: 1 },
      ],
    },
    recentActivity: [
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
    ],
    ...overrides,
  };
}

describe("ReferralsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders the owner affiliate dashboard with QR and referral controls only in /referrals", () => {
    render(<ReferralsWorkspace workspace={workspace()} />);

    expect(document.querySelector('[data-referrals-workspace-state="enabled"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Affiliate dashboard", level: 1 })).toBeInTheDocument();
    expect(screen.getByAltText("Referral QR code for Morgan Lee")).toHaveAttribute("src", "/api/qr/mentor-42");
    expect(screen.getByDisplayValue("https://studioordo.com/r/mentor-42")).toBeInTheDocument();
    expect(screen.getByText("Introduction validated")).toBeInTheDocument();
    expect(screen.getAllByText("Introductions").length).toBeGreaterThan(0);
    expect(screen.queryByText("My Referrals")).toBeNull();
    expect(screen.queryByText("/profile?section=referrals")).toBeNull();
    expect(screen.queryByText("/admin/affiliates")).toBeNull();
  });

  it("copies and downloads owner referral assets without exposing admin affiliate tooling", async () => {
    render(<ReferralsWorkspace workspace={workspace()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://studioordo.com/r/mentor-42");
    await waitFor(() => {
      expect(screen.getByText("Referral link copied.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Download QR" }));
    expect(downloadFileFromUrlMock).toHaveBeenCalledWith("/api/qr/mentor-42", "referral-mentor-42.png");
    expect(screen.getByText("Referral QR download started.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("renders an honest disabled state without QR or referral controls", () => {
    render(<ReferralsWorkspace workspace={workspace({
      profile: {
        id: "usr_2",
        name: "Member",
        email: "member@example.com",
        credential: "",
        pushNotificationsEnabled: false,
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
    })} />);

    expect(document.querySelector('[data-referrals-workspace-state="disabled"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Affiliate dashboard", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Referral and QR access are not enabled yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download QR" })).toBeNull();
    expect(screen.queryByText("Referral code")).toBeNull();
    expect(screen.queryByText("Referral link")).toBeNull();
  });
});
