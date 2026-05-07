import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/core/entities/user";

const { usePathnameMock, siteNavMock, siteFooterMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  siteNavMock: vi.fn(() => <div data-testid="site-nav" />),
  siteFooterMock: vi.fn(() => <div data-testid="site-footer" />),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/SiteNav", () => ({
  SiteNav: siteNavMock,
}));

vi.mock("@/components/SiteFooter", () => ({
  SiteFooter: siteFooterMock,
}));

vi.mock("@/components/AuthenticatedWorkRail", () => ({
  AuthenticatedWorkRail: ({ user }: { user: User }) => (
    user.roles.every((role) => role === "ANONYMOUS")
      ? null
      : <div data-testid="authenticated-work-rail" />
  ),
}));

import { AppShell } from "@/components/AppShell";

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

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the viewport-stage shell on the home route", () => {
    usePathnameMock.mockReturnValue("/");

    const { container } = render(
      <AppShell user={user}>
        <div>home</div>
      </AppShell>,
    );

    expect(container.querySelector('[data-shell-route-mode="viewport-stage"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-viewport-stage="true"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-public-mobile-nav="true"]')).toBeNull();
    expect(screen.getByTestId("site-nav")).toBeInTheDocument();
    expect(screen.getByTestId("authenticated-work-rail")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
    expect(siteNavMock).toHaveBeenCalledWith(expect.objectContaining({ user }), undefined);
  });

  it("mounts the public mobile route dock for anonymous users", () => {
    usePathnameMock.mockReturnValue("/");

    const { container } = render(
      <AppShell user={anonymousUser}>
        <div>home</div>
      </AppShell>,
    );

    expect(container.querySelector('[data-shell-public-mobile-nav="true"]')).not.toBeNull();
    expect(screen.queryByTestId("authenticated-work-rail")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.queryByRole("link", { name: "Feed" })).toBeNull();
  });

  it("adds feed to the public mobile dock when content exists", () => {
    usePathnameMock.mockReturnValue("/feed");

    render(
      <AppShell user={anonymousUser} navigationContext={{ hasPublicFeedItems: true }}>
        <div>feed</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute("aria-current", "page");
  });

  it("uses document flow on non-home routes", () => {
    usePathnameMock.mockReturnValue("/feed");

    const { container } = render(
      <AppShell user={user}>
        <div>feed</div>
      </AppShell>,
    );

    expect(container.querySelector('[data-shell-route-mode="document-flow"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-viewport-stage="true"]')).toBeNull();
    expect(container.querySelector('[data-shell-route-surface="feed"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-main-surface="feed"]')).not.toBeNull();
    expect(screen.getByTestId("site-nav")).toBeInTheDocument();
    expect(screen.getByTestId("authenticated-work-rail")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });

  it("uses the feed surface on feed item routes", () => {
    usePathnameMock.mockReturnValue("/feed/systems-essay");

    const { container } = render(
      <AppShell user={user}>
        <div>feed item</div>
      </AppShell>,
    );

    expect(container.querySelector('[data-shell-route-mode="document-flow"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-route-surface="feed"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-main-surface="feed"]')).not.toBeNull();
  });

  it("marks non-feed document routes with the default surface", () => {
    usePathnameMock.mockReturnValue("/offers");

    const { container } = render(
      <AppShell user={user}>
        <div>offers</div>
      </AppShell>,
    );

    expect(container.querySelector('[data-shell-route-surface="default"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-main-surface="default"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-main-surface="default"][data-shell-floating-chat-clearance="true"]')).not.toBeNull();
  });

  it("uses document-flow mode and shows footer on admin routes", () => {
    usePathnameMock.mockReturnValue("/admin");

    const { container } = render(
      <AppShell user={user}>
        <div>admin</div>
      </AppShell>,
    );

    expect(container.querySelector('[data-shell-route-mode="document-flow"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-route-surface="admin"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-main-surface="admin"]')).not.toBeNull();
    expect(container.querySelector('[data-shell-main-surface="admin"][data-shell-floating-chat-clearance="true"]')).toBeNull();
    expect(screen.getByTestId("site-nav")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });
});
