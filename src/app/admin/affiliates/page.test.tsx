import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  loadAdminAffiliatesWorkspaceMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  loadAdminAffiliatesWorkspaceMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/admin/affiliates/admin-affiliates", () => ({
  loadAdminAffiliatesWorkspace: loadAdminAffiliatesWorkspaceMock,
}));

vi.mock("@/lib/admin/affiliates/admin-affiliates-actions", () => ({
  updateReferralCreditStateAction: vi.fn(),
}));

vi.mock("@/components/admin/AdminSection", () => ({
  AdminSection: ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

vi.mock("@/components/admin/AdminCard", () => ({
  AdminCard: ({ title, description, children }: { title: string; description?: string; children: ReactNode }) => (
    <article>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </article>
  ),
}));

vi.mock("@/components/admin/AdminEmptyState", () => ({
  AdminEmptyState: ({ heading }: { heading: string }) => <div>{heading}</div>,
}));

vi.mock("@/components/admin/AdminStatusCounts", () => ({
  AdminStatusCounts: ({ items }: { items: Array<{ label: string; count: number }> }) => (
    <div>{items.map((item) => `${item.label}:${item.count}`).join("|")}</div>
  ),
}));

import AdminAffiliatesPage from "./page";

function workspace() {
  return {
    filters: { view: "overview", kind: "all" },
    overview: {
      affiliatesEnabled: 2,
      qualifiedOpportunities: 1,
      approvedCredits: 0,
      exceptions: 0,
      activeAffiliates: 2,
      introductions: 4,
      startedChats: 3,
      registered: 2,
      creditPendingReview: 1,
      paidCredits: 0,
      narrative: "Affiliate program is ready for review.",
    },
    leaderboard: { items: [] },
    pipeline: { stages: [], outcomes: [] },
    exceptions: {
      total: 0,
      counts: {
        invalid_referral_source: 0,
        missing_referral_join: 0,
        disabled_referral_code: 0,
        credit_review_backlog: 0,
      },
      items: [],
    },
  };
}

describe("/admin/affiliates page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin_1", roles: ["ADMIN"] });
    loadAdminAffiliatesWorkspaceMock.mockResolvedValue(workspace());
  });

  it("stays behind the admin page gate before loading global affiliate data", async () => {
    requireAdminPageAccessMock.mockRejectedValueOnce(new Error("not-found"));

    await expect(AdminAffiliatesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("not-found");
    expect(loadAdminAffiliatesWorkspaceMock).not.toHaveBeenCalled();
  });

  it("renders the global affiliate dashboard for admins", async () => {
    render(await AdminAffiliatesPage({ searchParams: Promise.resolve({}) }));

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(loadAdminAffiliatesWorkspaceMock).toHaveBeenCalledWith({});
    expect(screen.getByRole("heading", { name: "Affiliate program" })).toBeInTheDocument();
    expect(screen.getByText("Enabled affiliates:2|Qualified:1|Approved:0|Exceptions:0")).toBeInTheDocument();
    expect(screen.getByText("Affiliate program is ready for review.")).toBeInTheDocument();
  });
});
