import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadBusinessWorkspaceMock,
  redirectMock,
  workspaceMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadBusinessWorkspaceMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  workspaceMock: vi.fn((props: { userName: string; workspace: { cards: unknown[] } }) => (
    <div data-testid="business-workspace">{props.userName}:{props.workspace.cards.length}</div>
  )),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/business/load-business-workspace", () => ({
  loadBusinessWorkspace: loadBusinessWorkspaceMock,
}));

vi.mock("@/components/business/BusinessWorkspace", () => ({
  BusinessWorkspace: workspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import BusinessPage from "@/app/business/page";

describe("/business page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    await expect(BusinessPage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders the signed-in People owner surface", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", email: "keith@example.com", name: "Keith", roles: ["AUTHENTICATED"] });
    loadBusinessWorkspaceMock.mockResolvedValue({ cards: [{ id: "card_1" }, { id: "card_2" }] });

    render(await BusinessPage({ searchParams: Promise.resolve({ bucket: "business_loop" }) }));

    expect(loadBusinessWorkspaceMock).toHaveBeenCalledWith("usr_1", { bucket: "business_loop" });
    expect(screen.getByTestId("business-workspace")).toHaveTextContent("Keith:2");
  });
});
