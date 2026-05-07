import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { getSessionUserMock, redirectMock, chatSurfaceMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  chatSurfaceMock: vi.fn(() => <div data-testid="chat-surface" />),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/frameworks/ui/ChatSurface", () => ({
  ChatSurface: chatSurfaceMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import Home from "./page";

describe("/ page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chat homepage for authenticated users", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_auth",
      email: "auth@example.com",
      name: "Auth User",
      roles: ["AUTHENTICATED"],
    });

    render(await Home());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(chatSurfaceMock).toHaveBeenCalledWith(
      { mode: "embedded", showConversationSelector: true },
      undefined,
    );
    expect(screen.getByTestId("chat-surface")).toBeInTheDocument();
  });

  it("renders the chat homepage for anonymous users", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_anonymous",
      email: "anonymous@example.com",
      name: "Anonymous User",
      roles: ["ANONYMOUS"],
    });

    render(await Home());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(chatSurfaceMock).toHaveBeenCalledWith(
      { mode: "embedded", showConversationSelector: false },
      undefined,
    );
    expect(screen.getByTestId("chat-surface")).toBeInTheDocument();
  });
});
