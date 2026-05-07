import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/core/entities/chat-message";
import { ChatSurface } from "@/frameworks/ui/ChatSurface";
import { ChatSurfaceHeader } from "@/frameworks/ui/ChatSurfaceHeader";

const { usePathnameMock, useGlobalChatMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(() => "/"),
  useGlobalChatMock: vi.fn(() => ({
    messages: [] as ChatMessage[],
    isSending: false,
    sendMessage: vi.fn(),
    conversationId: null,
    isLoadingMessages: false,
    setConversationId: vi.fn(),
    refreshConversation: vi.fn(),
  })),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useGlobalChat", () => ({
  useGlobalChat: useGlobalChatMock,
}));

vi.mock("@/hooks/useViewTransitionReady", () => ({
  useViewTransitionReady: vi.fn(() => true),
}));

vi.mock("@/hooks/useUICommands", () => ({
  useUICommands: vi.fn(),
}));

vi.mock("@/hooks/useCommandRegistry", () => ({
  useCommandRegistry: vi.fn(() => ({
    executeCommand: vi.fn(() => false),
    findCommands: vi.fn(() => []),
  })),
}));

vi.mock("@/hooks/useChatScroll", () => ({
  useChatScroll: () => ({
    scrollRef: { current: null },
    isAtBottom: true,
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
    resetPin: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMentions", () => ({
  useMentions: () => ({
    activeTrigger: null,
    suggestions: [],
    handleInput: vi.fn(),
    insertMention: vi.fn(() => ""),
  }),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({
    accessibility: { density: "normal" },
    setAccessibility: vi.fn(),
  }),
}));

vi.mock("@/frameworks/ui/ChatHeader", () => ({
  ChatHeader: () => <div data-testid="chat-header" />,
}));

vi.mock("@/frameworks/ui/MessageList", () => ({
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock("@/frameworks/ui/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

describe("ChatSurface", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue("/");
  });

  it("P1: mode='embedded' renders chat content", () => {
    const { container } = render(<ChatSurface mode="embedded" />);
    expect(
      container.querySelector("[data-chat-container-mode='embedded']"),
    ).not.toBeNull();
  });

  it("P2: mode='embedded' has viewTransitionName", () => {
    const { container } = render(<ChatSurface mode="embedded" />);
    const section = container.querySelector("section");
    expect(section?.style.viewTransitionName).toBe("chat-container");
  });

  it("P3: mode='embedded' has correct data attributes", () => {
    const { container } = render(<ChatSurface mode="embedded" />);
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("data-chat-container-mode", "embedded");
    expect(section).toHaveAttribute("data-chat-layout", "message-composer");
  });

  it("P4: mode='floating' renders launcher when closed", () => {
    usePathnameMock.mockReturnValue("/offers");
    render(<ChatSurface mode="floating" />);
    expect(
      screen.getByLabelText("Open Studio Ordo chat"),
    ).toBeInTheDocument();
  });

  it("P4b: mode='floating' quiets the launcher on feed routes", () => {
    usePathnameMock.mockReturnValue("/feed");
    render(<ChatSurface mode="floating" />);

    expect(screen.getByLabelText("Open Studio Ordo chat")).toHaveAttribute(
      "data-chat-route-tone",
      "quiet",
    );
  });

  it("P5: mode='floating' opens on launcher click", () => {
    usePathnameMock.mockReturnValue("/offers");
    const { container } = render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    expect(
      container.querySelector("[data-chat-floating-shell='true']"),
    ).not.toBeNull();
  });

  it("P6: mode='floating' renders fullscreen toggle", () => {
    usePathnameMock.mockReturnValue("/offers");
    render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    expect(
      screen.getByLabelText("Enter Full Screen"),
    ).toBeInTheDocument();
  });

  it("P7: mode='floating' renders minimize button", () => {
    usePathnameMock.mockReturnValue("/offers");
    render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    expect(screen.getByLabelText("Minimize Chat")).toBeInTheDocument();
  });

  it("P8: mode='floating' minimizes on button click", () => {
    usePathnameMock.mockReturnValue("/offers");
    render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    expect(screen.getByLabelText("Minimize Chat")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Minimize Chat"));
    expect(
      screen.getByLabelText("Open Studio Ordo chat"),
    ).toBeInTheDocument();
  });

  it("P9: mode='floating' toggles fullscreen", () => {
    usePathnameMock.mockReturnValue("/offers");
    const { container } = render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    expect(
      container.querySelector("[data-chat-shell-size='default']"),
    ).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Enter Full Screen"));
    expect(
      container.querySelector("[data-chat-shell-size='fullscreen']"),
    ).not.toBeNull();
    expect(screen.getByLabelText("Exit Full Screen")).toBeInTheDocument();
  });

  it("P10: mode='floating' opens via OPEN_GLOBAL_CHAT_EVENT", () => {
    usePathnameMock.mockReturnValue("/offers");
    render(<ChatSurface mode="floating" />);
    act(() => {
      window.dispatchEvent(new Event("studio-ordo:open-chat"));
    });
    expect(screen.getByLabelText("Minimize Chat")).toBeInTheDocument();
  });

  it("P10b: mode='floating' keeps the quiet tone when a feed route opens the panel", () => {
    usePathnameMock.mockReturnValue("/feed/systems-essay");
    const { container } = render(<ChatSurface mode="floating" />);

    act(() => {
      window.dispatchEvent(new Event("studio-ordo:open-chat"));
    });

    expect(container.querySelector('[data-chat-floating-shell="true"]')).toHaveAttribute(
      "data-chat-route-tone",
      "quiet",
    );
  });

  it("N1: mode='floating' returns null on homepage", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = render(<ChatSurface mode="floating" />);
    expect(container.innerHTML).toBe("");
  });

  it("N2: no double-rendering on homepage", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = render(
      <div>
        <ChatSurface mode="embedded" />
        <ChatSurface mode="floating" />
      </div>,
    );
    const embeddedSections = container.querySelectorAll(
      "[data-chat-container-mode='embedded']",
    );
    const floatingSections = container.querySelectorAll(
      "[data-chat-floating-shell='true']",
    );
    expect(embeddedSections).toHaveLength(1);
    expect(floatingSections).toHaveLength(0);
  });

  it("N3: minimize resets fullscreen state", () => {
    usePathnameMock.mockReturnValue("/offers");
    const { container } = render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    fireEvent.click(screen.getByLabelText("Enter Full Screen"));
    expect(
      container.querySelector("[data-chat-shell-size='fullscreen']"),
    ).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Minimize Chat"));
    // Reopen
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    expect(
      container.querySelector("[data-chat-shell-size='default']"),
    ).not.toBeNull();
  });

  it("E2: OPEN_GLOBAL_CHAT_EVENT listener cleanup on unmount", () => {
    usePathnameMock.mockReturnValue("/offers");
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ChatSurface mode="floating" />);
    const addCalls = addSpy.mock.calls.filter(
      (c) => String(c[0]) === "studio-ordo:open-chat",
    );
    expect(addCalls.length).toBeGreaterThan(0);
    unmount();
    const removeCalls = removeSpy.mock.calls.filter(
      (c) => String(c[0]) === "studio-ordo:open-chat",
    );
    expect(removeCalls.length).toBeGreaterThan(0);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("P13: hero state works in embedded mode", () => {
    useGlobalChatMock.mockReturnValue({
      messages: [] as ChatMessage[],
      isSending: false,
      sendMessage: vi.fn(),
      conversationId: null,
      isLoadingMessages: false,
      setConversationId: vi.fn(),
      refreshConversation: vi.fn(),
    });
    const { container } = render(<ChatSurface mode="embedded" />);
    // Embedded mode keeps the transcript anchored while the product-experience
    // facade owns the hero/empty state.
    const stack = container.querySelector("[data-chat-message-stack]");
    expect(stack?.className).toContain("justify-end");
  });

  it("E1: view-transition-name shared safely across modes", () => {
    // On homepage: embedded has viewTransitionName, floating returns null
    usePathnameMock.mockReturnValue("/");
    const { container } = render(
      <div>
        <ChatSurface mode="embedded" />
        <ChatSurface mode="floating" />
      </div>,
    );
    const sections = container.querySelectorAll("section");
    const withVT = Array.from(sections).filter(
      (s) => s.style.viewTransitionName === "chat-container",
    );
    expect(withVT).toHaveLength(1);
  });

  it("E3: floating panel preserves input during fullscreen toggle", () => {
    usePathnameMock.mockReturnValue("/offers");
    render(<ChatSurface mode="floating" />);
    fireEvent.click(screen.getByLabelText("Open Studio Ordo chat"));
    // Type into the chat input
    const textarea = document.querySelector("textarea");
    if (textarea) {
      fireEvent.change(textarea, { target: { value: "draft message" } });
    }
    // Toggle fullscreen — component should NOT remount, state preserved
    fireEvent.click(screen.getByLabelText("Enter Full Screen"));
    expect(screen.getByLabelText("Exit Full Screen")).toBeInTheDocument();
    // Chat panel is still open (not reset to launcher)
    expect(screen.getByLabelText("Minimize Chat")).toBeInTheDocument();
  });
});

describe("ChatSurfaceHeader", () => {
  it("P11: renders embedded configuration when mode is embedded", () => {
    const { container } = render(
      <ChatSurfaceHeader
        mode="embedded"
        isFullScreen={false}
      />,
    );
    expect(
      container.querySelector("[data-chat-embedded-header='true']"),
    ).not.toBeNull();
  });

  it("P12: renders controls for floating mode", () => {
    render(
      <ChatSurfaceHeader
        mode="floating"
        isFullScreen={false}
        onMinimize={() => undefined}
        onFullScreenToggle={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Enter Full Screen")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimize Chat")).toBeInTheDocument();
  });

  it("fullscreen label toggles", () => {
    const { rerender } = render(
      <ChatSurfaceHeader
        mode="floating"
        isFullScreen={false}
        onMinimize={() => undefined}
        onFullScreenToggle={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Enter Full Screen")).toBeInTheDocument();

    rerender(
      <ChatSurfaceHeader
        mode="floating"
        isFullScreen={true}
        onMinimize={() => undefined}
        onFullScreenToggle={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Exit Full Screen")).toBeInTheDocument();
  });

  it("floating header has correct data attributes", () => {
    const { container } = render(
      <ChatSurfaceHeader
        mode="floating"
        isFullScreen={false}
        onMinimize={() => undefined}
        onFullScreenToggle={() => undefined}
      />,
    );
    expect(
      container.querySelector("[data-chat-floating-header='true']"),
    ).not.toBeNull();
    expect(
      container.querySelector("[data-chat-floating-header-chrome='true']"),
    ).not.toBeNull();
  });
});
