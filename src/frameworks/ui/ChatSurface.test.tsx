import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

const { usePathnameMock, chatSurfaceState } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  chatSurfaceState: {
    conversationId: "conv_ordo" as string | null,
    currentConversation: { title: "Strategy session" } as { title: string } | null,
  },
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
    conversationId: chatSurfaceState.conversationId,
    currentConversation: chatSurfaceState.currentConversation,
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
    chatSurfaceState.conversationId = "conv_ordo";
    chatSurfaceState.currentConversation = { title: "Strategy session" };
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
    usePathnameMock.mockReturnValue("/offers");

    render(<ChatSurface mode="floating" />);

    expect(screen.getByTestId("floating-chat-launcher")).toHaveAttribute("data-route-tone", "default");
  });

  it("uses the quiet route tone for feed routes", () => {
    usePathnameMock.mockReturnValue("/feed");

    render(<ChatSurface mode="floating" />);

    expect(screen.getByTestId("floating-chat-launcher")).toHaveAttribute("data-route-tone", "quiet");
  });

  it("renders embedded chat content without a second top rail", () => {
    usePathnameMock.mockReturnValue("/offers");

    render(<ChatSurface mode="embedded" />);

    expect(screen.queryByTestId("chat-surface-header-embedded")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Conversations" })).toBeNull();
    expect(screen.getByTestId("chat-content-surface")).toBeInTheDocument();
  });

  it("renders the authenticated conversation selector beside embedded chat when requested", () => {
    usePathnameMock.mockReturnValue("/");

    render(<ChatSurface mode="embedded" showConversationSelector />);

    expect(screen.getByRole("complementary", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ordo/i })).toHaveAttribute("href", "/");
    expect(screen.getByText("Strategy session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Person transfer slot/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Follow-up thread slot/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Customer thread slot/i })).toBeDisabled();
    expect(screen.getAllByText("Not live")).toHaveLength(3);
    const selector = screen.getByRole("complementary", { name: "Conversations" });
    const placeholderRows = within(selector)
      .getAllByRole("button")
      .filter((button) => button.getAttribute("data-chat-conversation-row")?.startsWith("placeholder"));
    expect(placeholderRows.map((button) => within(button).getByText(/slot$/i).textContent)).toEqual([
      "Person transfer slot",
      "Follow-up thread slot",
      "Customer thread slot",
    ]);
    expect(screen.getByText("Placeholder - no unread activity")).toBeInTheDocument();
    expect(screen.getByTestId("chat-content-surface")).toBeInTheDocument();
  });

  it("renders a safe Ordo starter row when no active conversation exists", () => {
    usePathnameMock.mockReturnValue("/");
    chatSurfaceState.conversationId = null;
    chatSurfaceState.currentConversation = null;

    render(<ChatSurface mode="embedded" showConversationSelector />);

    const ordoRow = screen.getByRole("link", { name: /Ordo/i });
    expect(ordoRow).toHaveAttribute("href", "/");
    expect(screen.getByText("Current Ordo chat")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Person transfer slot/i })).toBeDisabled();
  });

  it("renders floating top chrome after the launcher opens", () => {
    usePathnameMock.mockReturnValue("/offers");

    render(<ChatSurface mode="floating" />);

    act(() => {
      window.dispatchEvent(new Event(OPEN_GLOBAL_CHAT_EVENT));
    });

    expect(screen.getByTestId("floating-chat-frame")).toBeInTheDocument();
    expect(screen.getByTestId("chat-surface-header-floating")).toBeInTheDocument();
    expect(screen.getByTestId("chat-content-surface")).toBeInTheDocument();
  });
});
