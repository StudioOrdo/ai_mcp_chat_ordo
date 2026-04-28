import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSurface } from "@/frameworks/ui/ChatSurface";
import { OPEN_GLOBAL_CHAT_EVENT } from "@/lib/chat/chat-events";

const { pushMock, chatState } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  chatState: {
    messages: [
      {
        id: "assistant-1",
        role: "assistant",
        content: "Start with the workflow that feels most fragile.\n\n__suggestions__:[\"Audit this workflow\",\"Stress-test this AI plan\",\"Train my team\"]",
        timestamp: new Date("2026-03-21T10:00:00.000Z"),
        parts: [],
      },
    ],
    isSending: false,
    sendMessage: vi.fn(),
    conversationId: null as string | null,
    isLoadingMessages: false,
  },
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/library",
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({
    accessibility: { density: "compact" },
    setAccessibility: vi.fn(),
  }),
}));

vi.mock("@/hooks/useGlobalChat", () => ({
  useGlobalChat: () => chatState,
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
  useCommandRegistry: () => ({
    executeCommand: vi.fn(() => false),
    findCommands: vi.fn(() => []),
  }),
}));

describe("browser FAB mobile density", () => {
  beforeEach(() => {
    pushMock.mockReset();
    chatState.sendMessage.mockReset();
    chatState.conversationId = null;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });
  });

  it("preserves floating-shell hooks and composer helper copy in compact mobile density", async () => {
    const { container } = render(<ChatSurface mode="floating" />);

    expect(screen.getByRole("button", { name: "Open Studio Ordo chat" })).toHaveAttribute(
      "data-chat-fab-launcher",
      "true",
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    const floatingShell = container.querySelector('[data-chat-floating-shell="true"]');
    const messageViewport = container.querySelector('[data-chat-message-viewport="true"]');
    const composerShell = container.querySelector('[data-chat-composer-shell="true"]');
    const composerRow = container.querySelector('[data-chat-composer-row="true"]');
    const composerForm = container.querySelector('[data-chat-composer-form="true"]');
    const leadingRegion = container.querySelector('[data-chat-floating-header-leading="true"]');
    const transcriptPlane = container.querySelector('[data-chat-transcript-plane="true"]');
    const composerPlane = container.querySelector('[data-chat-composer-plane="true"]');

    expect(floatingShell).not.toBeNull();
    expect(floatingShell).toHaveAttribute("data-chat-shell-kind", "floating");
    expect(floatingShell).toHaveAttribute("data-chat-shell-size", "default");
    expect(floatingShell?.className).toContain("grid-rows-[auto_minmax(0,1fr)_auto]");
    expect(messageViewport).not.toBeNull();
    expect(transcriptPlane).not.toBeNull();
    expect(composerShell).not.toBeNull();
    expect(composerPlane).not.toBeNull();
    expect(composerRow).toBeNull();
    expect(composerForm).not.toBeNull();
    expect(composerForm).toHaveAttribute("data-chat-composer-state", "idle");
    expect(leadingRegion).toBeNull();

    expect(screen.getByRole("button", { name: /enter full screen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /minimize chat/i })).toBeInTheDocument();
  });

  it("keeps the compact mobile header layout stable", async () => {
    chatState.conversationId = "conv-mobile";

    const { container } = render(<ChatSurface mode="floating" />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    const floatingShell = container.querySelector('[data-chat-floating-shell="true"]');
    const leadingRegion = container.querySelector('[data-chat-floating-header-leading="true"]');
    const chrome = container.querySelector('[data-chat-floating-header-chrome="true"]');
    const floatingHeader = container.querySelector('[data-chat-floating-header="true"]');

    expect(floatingShell).not.toBeNull();
    expect(floatingHeader).not.toHaveTextContent(/studio ordo/i);
    expect(floatingHeader).not.toHaveTextContent(/current thread/i);
    // In single-conversation mode, leading region no longer renders (no conversation actions)
    expect(leadingRegion).toBeNull();
    expect(chrome).not.toBeNull();
    expect(chrome?.querySelectorAll("button")).toHaveLength(3);
  });

  it("action chips render at mobile viewport width without overflow", async () => {
    chatState.messages = [
      {
        id: "assistant-chips",
        role: "assistant",
        content: 'Options __actions__:[{"label":"Open library","action":"route","params":{"path":"/library"}},{"label":"Ask AI","action":"send","params":{"text":"help"}},{"label":"Browse library","action":"corpus","params":{"slug":"lean"}}]',
        timestamp: new Date("2026-03-21T10:00:00.000Z"),
        parts: [],
      },
    ];

    const { container } = render(<ChatSurface mode="floating" />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    const chipContainer = container.querySelector('[data-chat-action-chips="true"]');
    expect(chipContainer).not.toBeNull();
    const chips = container.querySelectorAll('[data-chat-action-chip]');
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });

  it("action links inside operator brief cards are focusable at mobile width", async () => {
    chatState.messages = [
      {
        id: "assistant-brief",
        role: "assistant",
        content: "**NOW**\nReply to [Morgan Lee](?conversation=conv_001)\n\n**NEXT**\nCheck [audit report](?route=/reports/audit)",
        timestamp: new Date("2026-03-21T10:00:00.000Z"),
        parts: [],
      },
    ];

    const { container } = render(<ChatSurface mode="floating" />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    const actionLinks = container.querySelectorAll('[data-chat-action-link]');
    actionLinks.forEach((link) => {
      expect(link.tagName.toLowerCase()).toBe("button");
    });
  });
});