import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadUserDashboardMock,
  redirectMock,
  userDashboardMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadUserDashboardMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  userDashboardMock: vi.fn(({ userName, dashboard, query }: {
    userName: string | null;
    dashboard: unknown;
    query?: { q: string | null; intent: string | null; objectId: string | null };
  }) => (
    <div data-testid="user-dashboard">
      {userName}:{dashboard ? "loaded" : "missing"}:{query?.q ?? "no-query"}:{query?.intent ?? "no-intent"}
    </div>
  )),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/dashboard/load-user-dashboard", () => ({
  loadUserDashboard: loadUserDashboardMock,
}));

vi.mock("@/components/dashboard/UserDashboard", () => ({
  parseUserDashboardQuery: (rawSearchParams: Record<string, string | string[] | undefined> = {}) => ({
    q: typeof rawSearchParams.q === "string" ? rawSearchParams.q : null,
    intent: typeof rawSearchParams.intent === "string" ? rawSearchParams.intent : null,
    objectId: typeof rawSearchParams.object === "string" ? rawSearchParams.object : null,
  }),
  UserDashboard: userDashboardMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import WorkspacePage from "@/app/workspace/page";

describe("/workspace dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_anon",
      email: "anon@example.com",
      name: "Anon",
      roles: ["ANONYMOUS"],
    });

    await expect(WorkspacePage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(loadUserDashboardMock).not.toHaveBeenCalled();
  });

  it("loads the signed-in user's durable dashboard", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_1",
      email: "user@example.com",
      name: "Keith",
      roles: ["AUTHENTICATED"],
    });
    loadUserDashboardMock.mockResolvedValue({ attention: { total: 0, items: [] } });

    render(await WorkspacePage({ searchParams: Promise.resolve({ q: "follow up", intent: "decide" }) }));

    expect(loadUserDashboardMock).toHaveBeenCalledWith("usr_1");
    expect(userDashboardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: "Keith",
        dashboard: { attention: { total: 0, items: [] } },
        query: { q: "follow up", intent: "decide", objectId: null },
      }),
      undefined,
    );
    expect(screen.getByTestId("user-dashboard")).toHaveTextContent("Keith:loaded:follow up:decide");
  });
});
