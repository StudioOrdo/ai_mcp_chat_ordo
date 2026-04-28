import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteNav } from "@/components/SiteNav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChatSurface } from "@/frameworks/ui/ChatSurface";
import type { User } from "@/core/entities/user";

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const startViewTransitionMock = vi.fn((callback: () => void) => {
  callback();
  return {
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
  };
});

const baseUser: User = {
  id: "usr_1",
  email: "user@example.com",
  name: "Test User",
  roles: ["AUTHENTICATED"],
};

function installMatchMedia(reducedMotion: boolean) {
  const matchMediaMock = vi.fn((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  vi.stubGlobal("matchMedia", matchMediaMock);
  return matchMediaMock;
}

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/AccountMenu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

vi.mock("@/hooks/useGlobalChat", () => ({
  useGlobalChat: () => ({
    messages: [],
    input: "",
    isSending: false,
    canSend: false,
    setInput: vi.fn(),
    sendMessage: vi.fn(),
    conversationId: null,
    isLoadingMessages: false,
  }),
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

vi.mock("@/hooks/useUICommands", () => ({
  useUICommands: vi.fn(),
}));

vi.mock("@/hooks/useCommandRegistry", () => ({
  useCommandRegistry: vi.fn(() => ({
    executeCommand: vi.fn(() => false),
    findCommands: vi.fn(() => []),
  })),
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

beforeEach(() => {
  localStorageMock.getItem.mockReset();
  localStorageMock.getItem.mockReturnValue(null);
  localStorageMock.setItem.mockReset();
  localStorageMock.removeItem.mockReset();
  localStorageMock.clear.mockReset();
  startViewTransitionMock.mockClear();
  vi.stubGlobal("localStorage", localStorageMock);
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("browser motion hardening", () => {
  it("uses view transitions for theme updates only when reduced motion is off", async () => {
    installMatchMedia(false);
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransitionMock,
      configurable: true,
    });

    render(
      <ThemeProvider>
        <div>Theme child</div>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(startViewTransitionMock).toHaveBeenCalled();
    });
  });

  it("skips theme view transitions when reduced motion is enabled", async () => {
    installMatchMedia(true);
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransitionMock,
      configurable: true,
    });

    render(
      <ThemeProvider>
        <div>Theme child</div>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    expect(startViewTransitionMock).not.toHaveBeenCalled();
  });

  it("adds a chat container view transition name only when motion is allowed", async () => {
    installMatchMedia(false);
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransitionMock,
      configurable: true,
    });

    const { container } = render(
      <ThemeProvider>
        <ChatSurface mode="embedded" />
      </ThemeProvider>,
    );

    const chatSection = container.querySelector("section");
    expect(chatSection).not.toBeNull();

    await waitFor(() => {
      expect(chatSection?.style.viewTransitionName).toBe("chat-container");
    });
  });

  it("keeps nav layering semantics through the extracted shell rail class", () => {
    installMatchMedia(false);

    render(<SiteNav user={baseUser} />);

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav.className).toContain("ui-shell-rail");
    expect(nav).toHaveAttribute("data-shell-nav-rail", "true");
  });
});
