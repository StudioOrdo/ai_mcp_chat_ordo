import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/core/entities/user";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/frameworks/ui/jobs-rail/useJobsRailController", () => ({
  useJobsRailController: () => ({
    model: {
      activeCount: 2,
      attentionCount: 1,
      completedCount: 0,
      items: [],
    },
    utilityActions: [],
    onAction: vi.fn(),
  }),
}));

import { AuthenticatedWorkRail } from "@/components/AuthenticatedWorkRail";

const authenticatedUser: User = {
  id: "usr_1",
  email: "user@example.com",
  name: "User",
  roles: ["AUTHENTICATED"],
};

const staffUser: User = {
  ...authenticatedUser,
  id: "usr_staff",
  roles: ["STAFF"],
};

const adminUser: User = {
  ...authenticatedUser,
  id: "usr_admin",
  roles: ["ADMIN"],
};

const anonymousUser: User = {
  id: "usr_anon",
  email: "anonymous@example.com",
  name: "Anonymous",
  roles: ["ANONYMOUS"],
};

describe("AuthenticatedWorkRail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    usePathnameMock.mockReturnValue("/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders signed-in owner governance links in the workspace rail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ unreadCount: 3 }),
    })));
    usePathnameMock.mockReturnValue("/studio");

    render(<AuthenticatedWorkRail user={authenticatedUser} />);

    const rail = screen.getByRole("navigation", { name: "Workspace" });
    const ownerLinks = within(rail)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("data-authenticated-work-rail-group") === "owner");

    expect(ownerLinks.map((link) => link.querySelector(".authenticated-work-rail-label")?.textContent)).toEqual([
      "Conversations",
      "Today",
      "Studio",
      "People",
      "Offers",
      "About",
      "Knowledge Base",
    ]);

    expect(within(rail).getByRole("link", { name: "Conversations" })).toHaveAttribute("href", "/");
    expect(within(rail).getByRole("link", { name: "Today" })).toHaveAttribute("href", "/workspace");
    expect(within(rail).getByRole("link", { name: "Studio" })).toHaveAttribute("href", "/studio");
    expect(within(rail).getByRole("link", { name: "Studio" })).toHaveAttribute("aria-current", "page");
    expect(within(rail).getByRole("link", { name: "People" })).toHaveAttribute("href", "/business");
    expect(within(rail).getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/offers");
    expect(within(rail).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(rail).getByRole("link", { name: "Knowledge Base" })).toHaveAttribute("href", "/knowledge");
    expect(within(rail).queryByRole("link", { name: "Jobs" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Activity" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "My Media" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Referrals" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Profile" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "My profile" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Media Ops" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Factory" })).toBeNull();
    expect(within(rail).queryByTestId("jobs-rail")).toBeNull();
    expect(within(rail).queryByTestId("attention-inbox")).toBeNull();
    expect(rail.querySelector('[data-authenticated-work-mobile-controls="true"]')).toBeNull();
    expect(rail.querySelector('[data-authenticated-work-rail-badge="studio"]')).toHaveTextContent("3");
    await waitFor(() => {
      expect(rail.querySelector('[data-authenticated-work-rail-badge="workspace-overview"]')).toHaveTextContent("4");
    });
  });

  it("keeps the rail desktop-only so mobile navigation can use the shell hamburger", () => {
    usePathnameMock.mockReturnValue("/business");

    render(<AuthenticatedWorkRail user={authenticatedUser} />);

    const rail = screen.getByRole("navigation", { name: "Workspace" });

    expect(rail.querySelector('[data-authenticated-work-rail-desktop="true"]')).not.toBeNull();
    expect(rail.querySelector('[data-authenticated-work-mobile-controls="true"]')).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Workspace controls" })).toBeNull();
  });

  it("keeps admin rail entries hidden from staff users", () => {
    render(<AuthenticatedWorkRail user={staffUser} />);

    const rail = screen.getByRole("navigation", { name: "Workspace" });
    expect(within(rail).queryByRole("link", { name: "Jobs" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Factory" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "System" })).toBeNull();
    expect(rail.querySelector('[data-authenticated-work-rail-admin="true"]')).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("shows Admin, Jobs, and System only for authorized admin users", () => {
    render(<AuthenticatedWorkRail user={adminUser} />);

    const rail = screen.getByRole("navigation", { name: "Workspace" });

    expect(within(rail).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    expect(within(rail).getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "/admin/jobs");
    expect(within(rail).getByRole("link", { name: "System" })).toHaveAttribute("href", "/admin/system");
    expect(within(rail).queryByRole("link", { name: "Factory" })).toBeNull();
    expect(within(rail).queryByRole("link", { name: "Profile" })).toBeNull();
  });

  it("renders nothing for anonymous users", () => {
    const { container } = render(<AuthenticatedWorkRail user={anonymousUser} />);

    expect(screen.queryByRole("navigation", { name: "Workspace" })).toBeNull();
    expect(container.querySelector('[data-authenticated-work-rail="true"]')).toBeNull();
  });
});
