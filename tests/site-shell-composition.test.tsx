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

vi.mock("@/components/NotificationFeed", () => ({
  NotificationFeed: () => <div data-testid="notification-feed" />,
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

  function renderShell() {
    return render(
      <AppShell user={baseUser}>
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
    pathname = "/library";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const footer = screen.getByRole("contentinfo");

    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(within(nav).getByTestId("workspace-menu")).toBeInTheDocument();
    expect(within(nav).getByTestId("notification-feed")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(within(nav).queryByRole("link", { name: "Home" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).toBeNull();
  });

  it("renders the public journal route in both the primary nav and footer", () => {
    pathname = "/journal";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    const footer = screen.getByRole("contentinfo");

    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(within(nav).getByTestId("workspace-menu")).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Journal" })).toHaveAttribute("href", "/journal");
  });

  it("does not reintroduce the dead footer routes removed from the canonical shell model", () => {
    renderShell();

    const footer = screen.getByRole("contentinfo");

    for (const label of [
      "Training",
      "Studio",
      "Documentation",
      "Patterns",
      "API",
      "Privacy",
      "Terms",
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
    pathname = "/library";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(resolvePrimaryNavRoutes(baseUser).map((route) => route.id)).toEqual(["corpus", "journal"]);
    expect(within(nav).getByRole("link", { name: /studio ordo home/i })).toHaveAttribute("href", "/");
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(within(nav).getByTestId("workspace-menu")).toBeInTheDocument();
    expect(within(nav).queryByTestId("account-menu")).toBeNull();
    expect(within(nav).getByTestId("jobs-rail")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Home" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).toBeNull();
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

    expect(within(nav).queryByTestId("notification-feed")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
  });

  it("keeps the home header on the unified utility cluster", () => {
    pathname = "/";

    renderShell();

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="account-access"]')).not.toBeNull();
    expect(within(nav).getByTestId("jobs-rail")).toBeInTheDocument();
    expect(within(nav).getByTestId("notification-feed")).toBeInTheDocument();
    expect(within(nav).getByTestId("workspace-menu")).toBeInTheDocument();
    expect(within(nav).queryByTestId("account-menu")).toBeNull();
  });
});
