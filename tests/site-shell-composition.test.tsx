import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/AppShell";
import {
  resolveFooterGroups,
  resolveFooterGroupRoutes,
  resolvePrimaryNavRoutes,
} from "@/lib/shell/shell-navigation";
import type { User } from "@/core/entities/user";

let pathname = "/";

const baseUser: User = {
  id: "usr_1",
  email: "user@example.com",
  name: "Test User",
  roles: ["AUTHENTICATED"],
};

const publishedFeedContext = { hasPublicFeedItems: true };

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/AccountMenu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

vi.mock("@/components/ShellWorkspaceMenu", () => ({
  ShellWorkspaceMenu: () => <div data-testid="workspace-menu" />,
}));

vi.mock("@/components/AttentionInbox", () => ({
  AttentionInbox: () => <div data-testid="attention-inbox" />,
}));

vi.mock("@/frameworks/ui/jobs-rail/JobsRail", () => ({
  JobsRail: () => <div data-testid="jobs-rail" />,
}));

vi.mock("@/frameworks/ui/jobs-rail/useJobsRailController", () => ({
  useJobsRailController: () => ({
    model: { items: [] },
    utilityActions: [],
    onAction: vi.fn(),
  }),
}));

describe("site shell composition", () => {
  beforeEach(() => {
    pathname = "/";
  });

  function renderShell(navigationContext = { hasPublicFeedItems: false }) {
    return render(
      <AppShell user={baseUser} navigationContext={navigationContext}>
        <div>Shell Content</div>
      </AppShell>,
    );
  }

  it("reuses the shared brand primitive in both header and footer", () => {
    const { container } = renderShell();

    expect(container.querySelectorAll('[data-shell-brand="true"]')).toHaveLength(2);
  });

  it("renders footer groups from the canonical shell footer definitions", () => {
    renderShell();

    const footer = screen.getByRole("contentinfo");

    for (const group of resolveFooterGroups(baseUser)) {
      const groupHeading = within(footer).getByText(group.label);
      const groupContainer = groupHeading.parentElement;

      expect(groupContainer).not.toBeNull();

      for (const route of resolveFooterGroupRoutes(group, baseUser)) {
        expect(within(groupContainer as HTMLElement).getByRole("link", { name: route.label })).toHaveAttribute(
          "href",
          route.href,
        );
      }
    }
  });

  it("marks the active canonical nav item based on the current route", () => {
    pathname = "/feed";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const workRail = screen.getByRole("navigation", { name: "Workspace" });
    const footer = screen.getByRole("contentinfo");

    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).not.toBeNull();
    expect(within(nav).queryByTestId("workspace-menu")).toBeNull();
    expect(within(nav).queryByTestId("attention-inbox")).toBeNull();
    expect(within(workRail).queryByTestId("attention-inbox")).toBeNull();
    expect(within(footer).queryByRole("link", { name: "Feed" })).toBeNull();
    expect(within(nav).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(nav).queryByRole("link", { name: "Feed" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Today" })).toBeNull();
  });

  it("adds the public feed route to header and footer when content exists", () => {
    pathname = "/feed";

    renderShell(publishedFeedContext);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const footer = screen.getByRole("contentinfo");

    expect(within(nav).getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
    expect(within(nav).getByRole("link", { name: "Feed" })).toHaveAttribute("aria-current", "page");
    expect(within(footer).getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
  });

  it("renders the public offers route in the footer", () => {
    pathname = "/offers";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const footer = screen.getByRole("contentinfo");

    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).not.toBeNull();
    expect(within(nav).queryByTestId("workspace-menu")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
    expect(within(footer).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
  });

  it("does not reintroduce the dead footer routes removed from the canonical shell model", () => {
    renderShell();

    const footer = screen.getByRole("contentinfo");

    for (const label of [
      "Training",
      "Documentation",
      "Patterns",
      "API",
      "Privacy",
      "Terms",
      "Library",
      "Jobs",
      "Activity",
      "My Media",
      "Referrals",
    ]) {
      expect(within(footer).queryByRole("link", { name: label })).toBeNull();
    }
  });

  it("keeps footer supporting copy truthful to the current shell", () => {
    renderShell();

    const footer = screen.getByRole("contentinfo");

    expect(within(footer).queryByText("Global Status: Optimal")).toBeNull();
  });

  it("renders only the canonical primary nav labels", () => {
    pathname = "/feed";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(resolvePrimaryNavRoutes(baseUser).map((route) => route.id)).toEqual(["home", "offers", "about"]);
    expect(resolvePrimaryNavRoutes(baseUser, publishedFeedContext).map((route) => route.id)).toEqual([
      "home",
      "feed",
      "offers",
      "about",
    ]);
    expect(within(nav).getByRole("link", { name: /studio ordo home/i })).toHaveAttribute("href", "/");
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).not.toBeNull();
    expect(within(nav).queryByTestId("workspace-menu")).toBeNull();
    expect(within(nav).getByTestId("account-menu")).toBeInTheDocument();
    expect(within(nav).queryByTestId("jobs-rail")).toBeNull();
    expect(within(screen.getByRole("navigation", { name: "Workspace" })).queryByTestId("jobs-rail")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(nav).queryByRole("link", { name: "Today" })).toBeNull();
  });

  it("shows guest access links on the home rail for anonymous users", () => {
    pathname = "/";

    const anonymousUser: User = {
      id: "usr_anon",
      email: "anonymous@example.com",
      name: "Anonymous User",
      roles: ["ANONYMOUS"],
    };

    render(
      <AppShell user={anonymousUser}>
        <div>Shell Content</div>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const publicDock = screen.getByRole("navigation", { name: "Public navigation" });

    expect(within(nav).queryByTestId("attention-inbox")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(within(nav).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(nav).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(publicDock).getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/");
  });

  it("keeps work utilities in the authenticated workspace rail", () => {
    pathname = "/";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const workRail = screen.getByRole("navigation", { name: "Workspace" });

    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).not.toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="account-access"]')).not.toBeNull();
    expect(within(nav).queryByTestId("jobs-rail")).toBeNull();
    expect(within(nav).queryByTestId("attention-inbox")).toBeNull();
    expect(within(workRail).queryByTestId("jobs-rail")).toBeNull();
    expect(within(workRail).queryByTestId("attention-inbox")).toBeNull();
    expect(within(nav).queryByTestId("workspace-menu")).toBeNull();
    expect(within(nav).getByTestId("account-menu")).toBeInTheDocument();
  });
});
