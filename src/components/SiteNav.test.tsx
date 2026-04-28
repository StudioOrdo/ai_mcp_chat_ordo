import fs from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
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
  ShellBrand: ({ href, className }: { href: string; className?: string }) => (
    <a href={href} className={className} data-testid="shell-brand">
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
  ShellWorkspaceMenu: () => <div data-testid="workspace-menu" />,
}));

vi.mock("@/components/GlobalSearchBar", () => ({
  GlobalSearchBar: () => <div data-testid="global-search" />,
}));

vi.mock("@/lib/shell/shell-navigation", () => ({
  resolveShellHomeHref: () => "/",
}));

import { SiteNav } from "@/components/SiteNav";

const user: User = {
  id: "usr_1",
  email: "keith@example.com",
  name: "Keith",
  roles: ["AUTHENTICATED"],
};

const anonymousUser: User = {
  id: "usr_anon",
  email: "anonymous@example.com",
  name: "Anonymous User",
  roles: ["ANONYMOUS"],
};

describe("SiteNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the quiet nav tone on the journal index", () => {
    usePathnameMock.mockReturnValue("/journal");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-shell-nav-tone", "quiet");
    expect(nav.className).toContain("ui-shell-rail");
    expect(screen.getByTestId("workspace-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
  });

  it("uses the quiet nav tone on journal article routes", () => {
    usePathnameMock.mockReturnValue("/journal/systems-essay");

    render(<SiteNav user={user} />);

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute("data-shell-nav-tone", "quiet");
  });

  it("keeps the default nav tone on non-journal routes", () => {
    usePathnameMock.mockReturnValue("/library");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toHaveAttribute("data-shell-nav-tone", "default");
    expect(nav.querySelector('[data-shell-nav-band="true"]')).not.toBeNull();
  });

  it("renders the shell-owned global search region off the home route", () => {
    usePathnameMock.mockReturnValue("/library");

    render(<SiteNav user={user} />);

    expect(screen.getByTestId("global-search")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
    expect(screen.queryByTestId("account-menu")).toBeNull();
  });

  it("keeps shell search available alongside the unified home utility cluster", () => {
    usePathnameMock.mockReturnValue("/");

    render(<SiteNav user={user} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(screen.getByTestId("notification-feed")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-menu")).toBeInTheDocument();
    expect(screen.queryByTestId("shell-nav-drawer")).toBeNull();
    expect(screen.queryByTestId("account-menu")).toBeNull();
    expect(screen.getByTestId("global-search")).toBeInTheDocument();
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="search"]')).not.toBeNull();
  });

  it("replaces notifications with login and register links for anonymous users", () => {
    usePathnameMock.mockReturnValue("/");

    render(<SiteNav user={anonymousUser} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(screen.queryByTestId("notification-feed")).toBeNull();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
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
    expect(shellCss).toContain("--shell-nav-search-max-inline");
    expect(shellCss).toContain("grid-template-areas:");
    expect(shellCss).toContain('"brand search actions"');
    expect(shellCss).toContain("minmax(max-content, 1fr)");
    expect(shellCss).toContain("@media (min-width: 56rem)");
    expect(shellCss).toContain("justify-self: end;");
  });
});