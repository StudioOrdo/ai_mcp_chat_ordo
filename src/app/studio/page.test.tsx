import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadStudioWorkspaceMock,
  redirectMock,
  workspaceMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadStudioWorkspaceMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  workspaceMock: vi.fn((props: { userName: string; workspace: { cards: unknown[] } }) => (
    <div data-testid="studio-workspace">{props.userName}:{props.workspace.cards.length}</div>
  )),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/studio/load-studio-workspace", () => ({
  loadStudioWorkspace: loadStudioWorkspaceMock,
}));

vi.mock("@/components/studio/StudioWorkspace", () => ({
  StudioWorkspace: workspaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import StudioPage from "@/app/studio/page";

describe("/studio page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    await expect(StudioPage()).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders the signed-in Studio owner surface", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", email: "keith@example.com", name: "Keith", roles: ["AUTHENTICATED"] });
    loadStudioWorkspaceMock.mockResolvedValue({ cards: [{ id: "card_1" }] });

    render(await StudioPage({ searchParams: Promise.resolve({ bucket: "produced" }) }));

    expect(loadStudioWorkspaceMock).toHaveBeenCalledWith("usr_1", { bucket: "produced" });
    expect(screen.getByTestId("studio-workspace")).toHaveTextContent("Keith:1");
  });
});
