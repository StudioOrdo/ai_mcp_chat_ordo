import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  usePathnameMock,
  requireAdminPageAccessMock,
  loadAdminJournalListMock,
  loadAdminJobListMock,
  loadSystemHealthBlockMock,
  loadLeadQueueBlockMock,
  loadConsultationRequestQueueBlockMock,
  loadTrainingPathQueueBlockMock,
  loadOverdueFollowUpsBlockMock,
  loadRoutingReviewBlockMock,
  loadAnonymousOpportunitiesBlockMock,
  loadRecurringPainThemesBlockMock,
  redirectMock,
  permanentRedirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  requireAdminPageAccessMock: vi.fn(),
  loadAdminJournalListMock: vi.fn(),
  loadAdminJobListMock: vi.fn(),
  loadSystemHealthBlockMock: vi.fn(),
  loadLeadQueueBlockMock: vi.fn(),
  loadConsultationRequestQueueBlockMock: vi.fn(),
  loadTrainingPathQueueBlockMock: vi.fn(),
  loadOverdueFollowUpsBlockMock: vi.fn(),
  loadRoutingReviewBlockMock: vi.fn(),
  loadAnonymousOpportunitiesBlockMock: vi.fn(),
  loadRecurringPainThemesBlockMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  permanentRedirectMock: vi.fn((path: string) => {
    throw new Error(`permanentRedirect:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  redirect: redirectMock,
  permanentRedirect: permanentRedirectMock,
  notFound: notFoundMock,
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
  loadAdminJournalList: loadAdminJournalListMock,
}));

vi.mock("@/lib/admin/jobs/admin-jobs", () => ({
  loadAdminJobList: loadAdminJobListMock,
}));

vi.mock("@/lib/admin/leads/admin-leads-attention", () => ({
  loadLeadQueueBlock: loadLeadQueueBlockMock,
  loadConsultationRequestQueueBlock: loadConsultationRequestQueueBlockMock,
  loadTrainingPathQueueBlock: loadTrainingPathQueueBlockMock,
}));

vi.mock("@/lib/admin/pipeline/admin-pipeline-attention", () => ({
  loadOverdueFollowUpsBlock: loadOverdueFollowUpsBlockMock,
}));

vi.mock("@/lib/operator/loaders/admin-loaders", () => ({
  loadSystemHealthBlock: loadSystemHealthBlockMock,
  loadRoutingReviewBlock: loadRoutingReviewBlockMock,
}));

vi.mock("@/lib/operator/loaders/analytics-loaders", () => ({
  loadAnonymousOpportunitiesBlock: loadAnonymousOpportunitiesBlockMock,
  loadRecurringPainThemesBlock: loadRecurringPainThemesBlockMock,
}));

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminDrawer } from "@/components/admin/AdminDrawer";
import AdminLayout from "@/app/admin/layout";
import AdminDashboardPage from "@/app/admin/page";
import {
  getAdminDashboardPath,
  getAdminJournalPath,
  getAdminLeadsPath,
  getAdminSystemPath,
  getAdminUserDetailPath,
  getAdminUsersPath,
} from "@/lib/admin/admin-routes";
import {
  resolveAdminNavigationItems,
  resolveAdminWorkspaceContext,
} from "@/lib/admin/admin-navigation";
import { resolveAccountMenuRoutes } from "@/lib/shell/shell-navigation";
import type { RoleName } from "@/core/entities/user";

describe("admin shell and concierge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/admin");
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin_1", roles: ["ADMIN"] });
    loadSystemHealthBlockMock.mockResolvedValue({
      blockId: "system_health",
      state: "ready",
      data: {
        summary: {
          overallStatus: "ok",
          readinessStatus: "ok",
          livenessStatus: "ok",
          environmentStatus: "ok",
        },
        warnings: [],
      },
    });
    loadLeadQueueBlockMock.mockResolvedValue({
      blockId: "lead_queue",
      state: "empty",
      data: {
        summary: {
          submittedLeadCount: 0,
          newLeadCount: 0,
          contactedLeadCount: 0,
          qualifiedLeadCount: 0,
          deferredLeadCount: 0,
        },
      },
    });
    loadConsultationRequestQueueBlockMock.mockResolvedValue({ blockId: "consultation_requests", state: "empty", data: { summary: { pendingCount: 0 } } });
    loadTrainingPathQueueBlockMock.mockResolvedValue({ blockId: "training_path_queue", state: "empty", data: { summary: { draftCount: 0, recommendedCount: 0, followUpNowCount: 0 } } });
    loadOverdueFollowUpsBlockMock.mockResolvedValue({ blockId: "overdue_follow_ups", state: "empty", data: { summary: { overdueLeadCount: 0, overdueDealCount: 0, totalOverdueCount: 0 } } });
    loadRoutingReviewBlockMock.mockResolvedValue({ blockId: "routing_review", state: "empty", data: { summary: { uncertainCount: 0 } } });
    loadAnonymousOpportunitiesBlockMock.mockResolvedValue({ blockId: "anonymous_opportunities", state: "empty", data: { opportunities: [] } });
    loadRecurringPainThemesBlockMock.mockResolvedValue({ blockId: "recurring_pain_themes", state: "empty", data: { themes: [] } });
    loadAdminJournalListMock.mockResolvedValue({
      filters: { search: "", status: "all", section: "all", invalid: [] },
      counts: { all: 0, draft: 0, review: 0, approved: 0, published: 0 },
      posts: [],
    });
    loadAdminJobListMock.mockResolvedValue({
      filters: { status: "all", family: "all", toolName: "" },
      statusCounts: {},
      familyCounts: {},
      toolNameCounts: {},
      familyOptions: [],
      toolOptions: [],
      total: 0,
      jobs: [],
    });
  });

  it("renders all expected sidebar links", () => {
    render(<AdminSidebar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: "System" })).toHaveAttribute("href", "/admin/system");
    expect(screen.getByRole("link", { name: "Journal" })).toHaveAttribute("href", "/admin/journal");
    expect(screen.getByRole("link", { name: "Leads" })).toHaveAttribute("href", "/admin/leads");
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("data-admin-nav-status", "live");
  });

  it("renders the admin drawer with full navigation items on open", () => {
    render(<AdminDrawer />);

    const trigger = screen.getByRole("button", { name: "Open admin menu" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Admin navigation" });
    expect(dialog).toBeInTheDocument();

    const navItems = resolveAdminNavigationItems();
    for (const item of navItems) {
      expect(screen.getByRole("link", { name: new RegExp(item.label) })).toBeInTheDocument();
    }
  });

  it("derives desktop and drawer navigation from the same route model", () => {
    render(
      <>
        <AdminSidebar />
        <AdminDrawer />
      </>,
    );

    // Open the drawer
    fireEvent.click(screen.getByRole("button", { name: "Open admin menu" }));

    const expectedRoutes = resolveAdminNavigationItems().map((route) => route.href);
    const sidebarRoutes = screen
      .getByLabelText("Admin")
      .querySelectorAll("a");
    const drawerRoutes = screen
      .getByLabelText("Admin navigation")
      .querySelectorAll("a");

    expect(Array.from(sidebarRoutes, (route) => route.getAttribute("href"))).toEqual(expectedRoutes);
    expect(Array.from(drawerRoutes, (route) => route.getAttribute("href"))).toEqual(expectedRoutes);
  });

  it("resolves route-aware workspace context for admin sub-workspaces", () => {
    expect(resolveAdminWorkspaceContext("/admin/leads", new URLSearchParams("view=attention&tab=deals"))).toEqual(
      expect.objectContaining({
        currentItemId: "attention",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "pipeline", href: "/admin/leads?tab=deals" }),
          expect.objectContaining({ id: "attention", href: "/admin/leads?view=attention&tab=deals" }),
        ]),
      }),
    );

    expect(resolveAdminWorkspaceContext("/admin/conversations", new URLSearchParams("view=themes"))).toEqual(
      expect.objectContaining({
        currentItemId: "themes",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "inbox", href: "/admin/conversations" }),
          expect.objectContaining({ id: "themes", href: "/admin/conversations?view=themes" }),
        ]),
      }),
    );

    expect(resolveAdminWorkspaceContext("/admin/journal/attribution")).toEqual(
      expect.objectContaining({
        currentItemId: "attribution",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "inventory", href: "/admin/journal" }),
          expect.objectContaining({ id: "attribution", href: "/admin/journal/attribution" }),
        ]),
      }),
    );
  });

  it("returns the expected admin route helpers", () => {
    expect(getAdminDashboardPath()).toBe("/admin");
    expect(getAdminUsersPath()).toBe("/admin/users");
    expect(getAdminUserDetailPath("usr_1")).toBe("/admin/users/usr_1");
    expect(getAdminSystemPath()).toBe("/admin/system");
    expect(getAdminLeadsPath()).toBe("/admin/leads");
    expect(getAdminJournalPath()).toBe("/admin/journal");
  });

  it("enforces RBAC in the shared admin layout", async () => {
    const view = await AdminLayout({ children: <div>Admin child</div> });
    render(view);

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
    expect(screen.getByText("Admin child").closest('[data-admin-scroll-region="true"]')).not.toBeNull();
    expect(screen.getByText("Admin child")).toBeInTheDocument();
  });

  it("renders the dashboard shell with helpful empty states", async () => {
    render(await AdminDashboardPage());

    expect(loadSystemHealthBlockMock).toHaveBeenCalled();
    expect(loadLeadQueueBlockMock).toHaveBeenCalled();
    expect(loadAdminJournalListMock).toHaveBeenCalledWith({});
    expect(loadAdminJobListMock).toHaveBeenCalledWith({}, ["ADMIN"], { limit: 10, offset: 0 });
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByLabelText("System sections")).toHaveAttribute("data-admin-system-selection-column", "true");
    expect(screen.getByRole("link", { name: /Health/ })).toHaveAttribute("href", "/admin?section=system-health");
    expect(screen.getByText("All clear.")).toBeInTheDocument();
    expect(screen.getByText("No active pipeline follow-ups.")).toBeInTheDocument();
    expect(screen.getByText("No journal posts yet.")).toBeInTheDocument();
  });

  it("keeps account and access routes in the admin account menu route set", () => {
    const adminUser = { id: "admin_1", email: "admin@example.com", name: "Admin", roles: ["ADMIN"] as RoleName[] };

    expect(resolveAccountMenuRoutes(adminUser).map((route) => route.id)).toEqual([
      "profile",
      "referrals",
    ]);
  });
});
