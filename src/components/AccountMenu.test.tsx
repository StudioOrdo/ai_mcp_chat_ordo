import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  usePathnameMock,
  useSearchParamsMock,
  useThemeMock,
  switchRoleMock,
  logoutMock,
  resolveAccountMenuRoutesMock,
} = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
  useThemeMock: vi.fn(),
  switchRoleMock: vi.fn(),
  logoutMock: vi.fn(),
  resolveAccountMenuRoutesMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: useThemeMock,
}));

vi.mock("@/hooks/useMockAuth", () => ({
  useMockAuth: () => ({
    switchRole: switchRoleMock,
    logout: logoutMock,
  }),
}));

vi.mock("@/lib/shell/shell-navigation", () => ({
  isShellRouteActive: (route: { href: string }, pathname: string) => pathname === route.href,
  resolveAccountMenuRoutes: resolveAccountMenuRoutesMock,
}));

import { AccountMenu } from "@/components/AccountMenu";

describe("AccountMenu RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    usePathnameMock.mockReturnValue("/profile");
    useSearchParamsMock.mockReturnValue({ toString: () => "" });
    useThemeMock.mockReturnValue({
      isDark: false,
      setIsDark: vi.fn(),
      accessibility: {
        fontSize: "md",
        lineHeight: "normal",
        letterSpacing: "normal",
        density: "normal",
        colorBlindMode: "none",
      },
      setAccessibility: vi.fn(),
    });
    resolveAccountMenuRoutesMock.mockReturnValue([
      { id: "profile", href: "/profile", label: "My Account" },
      { id: "referrals", href: "/referrals", label: "Affiliate Dashboard" },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides admin simulation controls from authenticated non-admin users", () => {
    render(
      <AccountMenu
        user={{
          id: "usr_1",
          email: "user@example.com",
          name: "Standard User",
          roles: ["AUTHENTICATED"],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /standard user/i }));

    expect(screen.getAllByText("Owner").some((node) => node.className.includes("shell-meta-text"))).toBe(true);
    expect(screen.getAllByRole("link", { name: "My Account" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "My Account" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "My Account" }).querySelector('[data-account-menu-icon="profile"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Change Password" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Affiliate Dashboard" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Affiliate Dashboard" })).toHaveAttribute("href", "/referrals");
    expect(screen.getByRole("link", { name: "Affiliate Dashboard" }).querySelector('[data-account-menu-icon="referrals"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "My media" })).toBeNull();
    expect(screen.queryByRole("link", { name: ["My", "Referrals"].join(" ") })).toBeNull();
    expect(screen.queryByRole("link", { name: "Preferences" })).toBeNull();
    expect(screen.getByRole("button", { name: /Theme: light/i })).toHaveAttribute("data-shell-theme-toggle", "true");
    expect(screen.queryByRole("link", { name: "My conversations" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My offers" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My content" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Simulation Mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "System" })).toBeNull();
  });

  it("does not expose simulation controls to non-admin users in development mode", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      <AccountMenu
        user={{
          id: "usr_2",
          email: "staff@example.com",
          name: "Staff User",
          roles: ["STAFF"],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /staff user/i }));

    expect(screen.queryByRole("button", { name: "Simulation Mode" })).not.toBeInTheDocument();
  });

  it("renders the registry-provided account routes without adding admin or work shortcuts", () => {
    resolveAccountMenuRoutesMock.mockReturnValue([
      { id: "profile", href: "/profile", label: "My Account" },
      { id: "referrals", href: "/referrals", label: "Affiliate Dashboard" },
    ]);

    render(
      <AccountMenu
        user={{
          id: "usr_admin",
          email: "admin@example.com",
          name: "Admin User",
          roles: ["ADMIN"],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /admin user/i }));

    expect(screen.queryByRole("link", { name: "System" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "My Account" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "My Account" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "Change Password" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Affiliate Dashboard" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Affiliate Dashboard" })).toHaveAttribute("href", "/referrals");
    expect(screen.queryByRole("button", { name: "Simulation Mode" })).not.toBeInTheDocument();
  });

  it("keeps password query routes out of the top-level account menu", () => {
    useSearchParamsMock.mockReturnValue({ toString: () => "section=password" });

    render(
      <AccountMenu
        user={{
          id: "usr_password",
          email: "password@example.com",
          name: "Password Owner",
          roles: ["AUTHENTICATED"],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /password owner/i }));

    expect(screen.queryByRole("link", { name: "Change Password" })).toBeNull();
    expect(screen.getByRole("link", { name: "My Account" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Affiliate Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("uses a compact account trigger for anonymous users", () => {
    render(
      <AccountMenu
        user={{
          id: "usr_anon",
          email: "",
          name: "Guest",
          roles: ["ANONYMOUS"],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /open account menu/i }));

    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" }).querySelector('[data-account-menu-icon="login"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register" }).querySelector('[data-account-menu-icon="register"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull();
  });

  it("opens the authenticated account menu as a mobile sheet when viewport is constrained", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(min-width: 1024px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <AccountMenu
        user={{
          id: "usr_mobile",
          email: "mobile@example.com",
          name: "Mobile Owner",
          roles: ["AUTHENTICATED"],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mobile owner account menu/i }));

    await waitFor(() => {
      expect(document.querySelector('[data-shell-account-sheet="true"]')).not.toBeNull();
    });

    expect(screen.getByRole("link", { name: "My Account" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Change Password" })).toBeNull();
    expect(screen.getByRole("link", { name: "Affiliate Dashboard" })).toHaveAttribute("href", "/referrals");
    expect(screen.queryByRole("link", { name: "My conversations" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My media" })).toBeNull();
    expect(screen.queryByRole("link", { name: ["My", "Referrals"].join(" ") })).toBeNull();
    expect(screen.queryByRole("link", { name: "Preferences" })).toBeNull();
    expect(screen.getByRole("button", { name: /Theme: light/i })).toHaveAttribute("data-shell-theme-toggle", "true");
    expect(screen.getAllByRole("button", { name: "Close account menu" }).length).toBeGreaterThan(0);
  });
});
