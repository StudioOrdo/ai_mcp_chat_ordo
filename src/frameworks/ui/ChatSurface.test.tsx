import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("./FloatingChatLauncher", () => ({
  FloatingChatLauncher: ({ onOpen, routeTone }: { onOpen: () => void; routeTone?: string }) => (
    <button type="button" data-testid="floating-chat-launcher" data-route-tone={routeTone} onClick={onOpen}>
      Open launcher
    </button>
  ),
}));

vi.mock("./FloatingChatFrame", () => ({
  FloatingChatFrame: ({ children }: { children: React.ReactNode }) => <div data-testid="floating-chat-frame">{children}</div>,
}));

vi.mock("./ChatSurfaceHeader", () => ({
  ChatSurfaceHeader: ({ mode }: { mode: "embedded" | "floating" }) => (
    <div data-testid={`chat-surface-header-${mode}`} />
  ),
}));

vi.mock("./ChatContentSurface", () => ({
  ChatContentSurface: () => <div data-testid="chat-content-surface" />,
}));

vi.mock("./useChatSurfaceState", () => ({
  useChatSurfaceState: () => ({
    headerProps: {},
    contentProps: {},
  }),
}));

vi.mock("@/hooks/useViewTransitionReady", () => ({
  useViewTransitionReady: () => false,
}));

import { ChatSurface } from "./ChatSurface";
import { OPEN_GLOBAL_CHAT_EVENT } from "@/lib/chat/chat-events";

describe("ChatSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suppresses the floating launcher on the home route", () => {
    usePathnameMock.mockReturnValue("/");

    const { container } = render(<ChatSurface mode="floating" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("suppresses the floating launcher on admin routes", () => {
    usePathnameMock.mockReturnValue("/admin/leads");

    const { container } = render(<ChatSurface mode="floating" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the floating launcher on non-admin content routes", () => {
    usePathnameMock.mockReturnValue("/library");

    render(<ChatSurface mode="floating" />);

    expect(screen.getByTestId("floating-chat-launcher")).toHaveAttribute("data-route-tone", "default");
  });

  it("uses the quiet route tone for journal routes", () => {
    usePathnameMock.mockReturnValue("/journal");

    render(<ChatSurface mode="floating" />);

    expect(screen.getByTestId("floating-chat-launcher")).toHaveAttribute("data-route-tone", "quiet");
  });

  it("renders embedded chat content without a second top rail", () => {
    usePathnameMock.mockReturnValue("/library");

    render(<ChatSurface mode="embedded" />);

    expect(screen.queryByTestId("chat-surface-header-embedded")).toBeNull();
    expect(screen.getByTestId("chat-content-surface")).toBeInTheDocument();
  });

  it("renders floating top chrome after the launcher opens", () => {
    usePathnameMock.mockReturnValue("/library");

    render(<ChatSurface mode="floating" />);

    act(() => {
      window.dispatchEvent(new Event(OPEN_GLOBAL_CHAT_EVENT));
    });

    expect(screen.getByTestId("floating-chat-frame")).toBeInTheDocument();
    expect(screen.getByTestId("chat-surface-header-floating")).toBeInTheDocument();
    expect(screen.getByTestId("chat-content-surface")).toBeInTheDocument();
  });
});