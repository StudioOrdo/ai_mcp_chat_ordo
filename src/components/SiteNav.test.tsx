import fs from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/core/entities/user";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/shell/ShellBrand", () => ({
  ShellBrand: ({
    href,
    className,
    showMark = true,
  }: {
    href: string;
    className?: string;
    showMark?: boolean;
  }) => (
    <a
      href={href}
      className={className}
      data-testid="shell-brand"
      data-shell-brand-mark-visible={String(showMark)}
    >
      {showMark ? <span data-shell-brand-mark="true" data-shell-brand-mark-source="/ordo-mark.png" /> : null}
      Studio Ordo
    </a>
  ),
}));

vi.mock("@/components/AccountMenu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

vi.mock("@/components/NotificationFeed", () => ({
  NotificationFeed: () => <div data-testid="notification-feed" />,
}));

vi.mock("@/components/ShellNavDrawer", () => ({
  ShellNavDrawer: () => <div data-testid="shell-nav-drawer" data-shell-nav-region="primary-links" />,
}));

vi.mock("@/components/ShellWorkspaceMenu", () => ({
  ShellWorkspaceMenu: () => <div data-testid="workspace-menu" data-shell-workspace-menu="true" />,
}));

vi.mock("@/frameworks/ui/jobs-rail/JobsRail", () => ({
  JobsRail: () => <div data-testid="jobs-rail" />,
}));

vi.mock("@/frameworks/ui/jobs-rail/useJobsRailController", () => ({
  useJobsRailController: () => ({
    model: {},
    utilityActions: {},
    onAction: vi.fn(),
  }),
}));

import { SiteNav } from "@/components/SiteNav";

const user: User = {
  id: "usr_1",
  email: "keith@example.com",
  name: "Keith",
  roles: ["AUTHENTICATED"],
};

const adminUser: User = {
  ...user,
  id: "usr_admin",
  roles: ["ADMIN"],
};

const anonymousUser: User = {
  id: "usr_anon",
  email: "anonymous@example.com",
  name: "Anonymous User",
  roles: ["ANONYMOUS"],
};

const publishedFeedContext = { hasPublicFeedItems: true };

describe("SiteNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the quiet nav tone on the feed index", () => {
    usePathnameMock.mockReturnValue("/feed");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-shell-nav-tone", "quiet");
    expect(nav).toHaveAttribute("data-shell-nav-authenticated", "true");
    expect(nav.className).toContain("ui-shell-rail");
    expect(screen.queryByTestId("workspace-menu")).toBeNull();
    expect(screen.getByTestId("account-menu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.queryByRole("link", { name: "Feed" })).toBeNull();
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
  });

  it("uses the quiet nav tone on feed item routes", () => {
    usePathnameMock.mockReturnValue("/feed/systems-essay");

    render(<SiteNav user={user} />);

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute("data-shell-nav-tone", "quiet");
  });

  it("keeps the default nav tone on non-feed routes", () => {
    usePathnameMock.mockReturnValue("/offers");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-shell-nav-tone", "default");
    expect(nav.querySelector('[data-shell-nav-band="true"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps public route links visible off the home route", () => {
    usePathnameMock.mockReturnValue("/offers");

    render(<SiteNav user={user} />);

    expect(screen.queryByTestId("workspace-menu")).toBeNull();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
    expect(screen.getByTestId("account-menu")).toBeInTheDocument();
  });

  it("keeps the public top rail without a dedicated search or work utility cluster", () => {
    usePathnameMock.mockReturnValue("/");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(nav).toHaveAttribute("data-shell-nav-authenticated", "true");
    expect(screen.queryByTestId("notification-feed")).toBeNull();
    expect(screen.queryByTestId("jobs-rail")).toBeNull();
    expect(screen.queryByTestId("workspace-menu")).toBeNull();
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
    expect(screen.getByTestId("account-menu")).toBeInTheDocument();
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.queryByRole("link", { name: "Feed" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Studio" })).toBeNull();
    expect(screen.queryByRole("link", { name: "People" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Jobs" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Operations" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Logs" })).toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="search"]')).toBeNull();
  });

  it("opens authenticated owner navigation from the mobile hamburger without polluting the public top rail", () => {
    usePathnameMock.mockReturnValue("/workspace");

    render(<SiteNav user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Open main menu" }));

    const dialog = screen.getByRole("dialog", { name: "Main menu" });
    const ownerLinks = within(dialog)
      .getAllByRole("link")
      .filter((link) => link.closest('[data-shell-mobile-main-menu-group="owner"]'));

    expect(ownerLinks.map((link) => link.textContent)).toEqual([
      "ConversationsOpen conversations with Ordo now and future person transfer slots later.",
      "TodayOpen Today for attention, current work, outputs, and the next useful action.",
      "StudioOpen the production workspace for generated media, workflows, and current work.",
      "PeopleOpen People for relationships, referrals, and customer-facing signals.",
      "OffersReview public offers or govern owner offers after signing in.",
      "AboutReview the business and public About surface from the owner workspace.",
      "Knowledge BaseInspect role-governed business knowledge and source evidence.",
    ]);
    expect(within(dialog).getByRole("link", { name: /Conversations/i })).toHaveAttribute("href", "/");
    expect(within(dialog).getByRole("link", { name: /Today/i })).toHaveAttribute("aria-current", "page");
    expect(within(dialog).queryByRole("link", { name: /Admin/i })).toBeNull();
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
  });

  it("adds role-gated Admin, Jobs, and System to the authenticated mobile menu for admins", () => {
    usePathnameMock.mockReturnValue("/admin/jobs");

    render(<SiteNav user={adminUser} />);

    fireEvent.click(screen.getByRole("button", { name: "Open main menu" }));

    const dialog = screen.getByRole("dialog", { name: "Main menu" });
    const adminGroup = dialog.querySelector('[data-shell-mobile-main-menu-group="admin"]');

    expect(adminGroup).not.toBeNull();
    expect(within(adminGroup as HTMLElement).getByRole("link", { name: /Admin/i })).toHaveAttribute("href", "/admin");
    expect(within(adminGroup as HTMLElement).getByRole("link", { name: /Jobs/i })).toHaveAttribute("href", "/admin/jobs");
    expect(within(adminGroup as HTMLElement).getByRole("link", { name: /Jobs/i })).toHaveAttribute("aria-current", "page");
    expect(within(adminGroup as HTMLElement).getByRole("link", { name: /System/i })).toHaveAttribute("href", "/admin/system");
    expect(within(adminGroup as HTMLElement).queryByRole("link", { name: /Factory/i })).toBeNull();
  });

  it("keeps brand mark singular and removes the workspace drawer from the account utility region", () => {
    usePathnameMock.mockReturnValue("/");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const brandRegion = nav.querySelector('[data-shell-nav-region="brand"]');
    const accountRegion = nav.querySelector('[data-shell-nav-region="account-access"]');

    expect(brandRegion?.querySelectorAll('[data-shell-workspace-menu="true"]')).toHaveLength(0);
    expect(brandRegion?.querySelector('[data-shell-mobile-main-menu="true"]')).not.toBeNull();
    expect(brandRegion?.querySelector('[data-testid="shell-brand"]')).toHaveAttribute("data-shell-brand-mark-visible", "true");
    expect(nav.querySelectorAll('[data-shell-brand-mark="true"]')).toHaveLength(1);
    expect(nav.querySelector('[data-shell-brand-mark="true"]')).toHaveAttribute("data-shell-brand-mark-source", "/ordo-mark.png");
    expect(accountRegion?.querySelectorAll('[data-shell-workspace-menu="true"]')).toHaveLength(0);
    expect(accountRegion?.querySelector('[data-shell-mobile-main-menu="true"]')).toBeNull();
    expect(accountRegion?.querySelector('[data-testid="jobs-rail"]')).toBeNull();
    expect(accountRegion?.querySelector('[data-testid="notification-feed"]')).toBeNull();
    expect(accountRegion?.querySelector('[data-testid="account-menu"]')).not.toBeNull();
  });

  it("adds feed to visible public nav when public feed content exists", () => {
    usePathnameMock.mockReturnValue("/feed");

    render(<SiteNav user={anonymousUser} navigationContext={publishedFeedContext} />);

    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute("aria-current", "page");
  });

  it("replaces jobs and notifications with login and register links for anonymous users", () => {
    usePathnameMock.mockReturnValue("/");

    render(<SiteNav user={anonymousUser} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(nav).not.toHaveAttribute("data-shell-nav-authenticated");
    expect(screen.queryByTestId("jobs-rail")).toBeNull();
    expect(screen.queryByTestId("notification-feed")).toBeNull();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(nav.querySelector('[data-shell-nav-guest-access="true"]')).not.toBeNull();
  });

  it("keeps spacing ladder and rail tokens in the global foundation authority", () => {
    const foundationCss = fs.readFileSync(
      path.join(process.cwd(), "src/app/styles/foundation.css"),
      "utf8",
    );

    expect(foundationCss).toContain("@property --space-1");
    expect(foundationCss).toContain("@property --space-rail-gap");
    expect(foundationCss).toContain("--container-padding: var(--space-frame-default);");
  });

  it("anchors the account-access rail with tokenized shell layout rules", () => {
    const utilitiesCss = fs.readFileSync(
      path.join(process.cwd(), "src/app/styles/utilities.css"),
      "utf8",
    );
    const shellCss = fs.readFileSync(
      path.join(process.cwd(), "src/app/styles/shell.css"),
      "utf8",
    );

    expect(utilitiesCss).toContain("margin-inline: auto;");
    expect(utilitiesCss).toContain("padding-inline: var(--container-padding);");
    expect(shellCss).toContain("grid-template-areas:");
    expect(shellCss).toContain('"brand primary actions"');
    expect(shellCss).toContain('"brand brand primary actions"');
    expect(shellCss).toContain("minmax(max-content, 1fr)");
    expect(shellCss).toContain("--shell-owner-rail-width");
    expect(shellCss).toContain("--shell-owner-secondary-column-width");
    expect(shellCss).toContain('[data-shell-nav-authenticated="true"] .shell-nav-band');
    expect(shellCss).toContain('[data-shell-nav-authenticated="true"].ui-shell-rail');
    expect(shellCss).toContain("box-shadow: none;");
    expect(shellCss).toContain(".shell-governance-grid");
    expect(shellCss).toContain("grid-template-columns: var(--shell-owner-secondary-column-width) minmax(0, 1fr);");
    expect(shellCss).toContain(".authenticated-work-rail-link::before");
    expect(shellCss).toContain(".shell-account-menu-icon");
    expect(shellCss).toContain(".shell-mobile-main-menu");
    expect(shellCss).toContain(".shell-mobile-main-menu-trigger");
    expect(shellCss).toContain("@media (max-width: 55.999rem)");
    expect(
      shellCss.lastIndexOf(".shell-mobile-main-menu {\n      display: inline-flex;"),
    ).toBeGreaterThan(shellCss.indexOf(".shell-mobile-main-menu {\n    display: none;"));
    expect(shellCss).toContain("justify-self: end;");
    expect(shellCss).toContain(".public-mobile-route-dock");
  });
});
