import React, { createElement, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/core/entities/user";
import type * as ThemeProviderModule from "@/components/ThemeProvider";
import type * as ReactDOMModule from "react-dom";

const {
  logoutMock,
  setAccessibilityMock,
  setIsDarkMock,
  switchRoleMock,
  usePathnameMock,
  useSearchParamsMock,
} = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  setAccessibilityMock: vi.fn(),
  setIsDarkMock: vi.fn(),
  switchRoleMock: vi.fn(),
  usePathnameMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    return createElement("img", { ...imageProps, alt: props.alt ?? "" });
  },
}));

vi.mock("@/hooks/useMockAuth", () => ({
  useMockAuth: () => ({ logout: logoutMock, switchRole: switchRoleMock }),
}));

vi.mock("@/components/ThemeProvider", async () => {
  const actual = await vi.importActual<typeof ThemeProviderModule>("@/components/ThemeProvider");

  return {
    ...actual,
    useTheme: () => ({
      isDark: false,
      setIsDark: setIsDarkMock,
      accessibility: {
        fontSize: "md",
        lineHeight: "normal",
        letterSpacing: "normal",
        density: "normal",
        colorBlindMode: "none",
      },
      setAccessibility: setAccessibilityMock,
    }),
  };
});

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof ReactDOMModule>("react-dom");

  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

import { ShellWorkspaceMenu } from "@/components/ShellWorkspaceMenu";

const anonymousUser: User = {
  id: "usr_anon",
  email: "",
  name: "Anonymous User",
  roles: ["ANONYMOUS"],
};

const authenticatedUser: User = {
  id: "usr_auth",
  email: "operator@studioordo.test",
  name: "Operator",
  roles: ["AUTHENTICATED"],
};

describe("ShellWorkspaceMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("shows login and register links for anonymous users", () => {
    render(<ShellWorkspaceMenu user={anonymousUser} />);

    fireEvent.click(screen.getByRole("button", { name: "Open workspace menu" }));

    expect(screen.getByText("Login or register to save conversations, unlock richer tools, and track referrals.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
  });

  it("shows canonical workspace links for signed-in users including referrals", () => {
    render(<ShellWorkspaceMenu user={authenticatedUser} />);

    fireEvent.click(screen.getByRole("button", { name: "Open workspace menu" }));

    expect(screen.getByRole("link", { name: /My Jobs/i })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: /My Media/i })).toHaveAttribute("href", "/my/media");
    expect(screen.getByRole("link", { name: /Referrals/i })).toHaveAttribute("href", "/referrals");
    expect(screen.getByRole("link", { name: /Profile/i })).toHaveAttribute("href", "/profile");
  });

  it("uses the Ordo mark trigger and opens a left-anchored drawer", () => {
    const { container } = render(<ShellWorkspaceMenu user={authenticatedUser} />);

    const trigger = screen.getByRole("button", { name: "Open workspace menu" });
    expect(trigger.querySelector('img[src="/ordo_icon.png"]')).not.toBeNull();

    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog", { name: "Workspace menu" });
    expect(drawer.className).toContain("left-0");
    expect(drawer.className).toContain("border-r");
    expect(drawer.className).not.toContain("right-0");
    expect(drawer.className).not.toContain("border-l");
    expect(container.querySelectorAll('[data-shell-workspace-menu="true"]')).toHaveLength(1);
  });
});
