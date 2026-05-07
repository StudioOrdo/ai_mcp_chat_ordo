import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/AppShell";
import Home from "@/app/page";
import type { User } from "@/core/entities/user";

const { getSessionUserMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
}));

let pathname = "/";
let mockMessages = [
  {
    id: "hero-1",
    role: "assistant" as const,
    content:
      "Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, find the right internal material, turn it into assets, and keep it moving from one governed workspace.\n\n__suggestions__:[\"Plan this workflow\",\"Find source material\",\"Turn this into an asset\",\"What makes this different?\"]",
    timestamp: new Date("2026-03-18T10:00:00.000Z"),
    parts: [{ type: "text" as const, text: "hero" }],
  },
];

const baseUser: User = {
  id: "usr_1",
  email: "user@example.com",
  name: "Test User",
  roles: ["AUTHENTICATED"],
};

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/AccountMenu", () => ({
  AccountMenu: () => <div data-testid="account-menu" />,
}));

vi.mock("@/components/ShellWorkspaceMenu", () => ({
  ShellWorkspaceMenu: () => <div data-testid="workspace-menu" />,
}));

vi.mock("@/components/NotificationFeed", () => ({
  NotificationFeed: () => <div data-testid="notification-feed" />,
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({
    accessibility: { density: "normal" },
    setAccessibility: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/hooks/useGlobalChat", () => ({
  useGlobalChat: () => ({
    messages: mockMessages,
    isSending: false,
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
  MessageList: ({ isEmbedded }: { isEmbedded?: boolean }) => (
    <div data-embedded={isEmbedded ? "true" : "false"} data-testid="message-list" />
  ),
}));

vi.mock("@/frameworks/ui/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

describe("homepage shell layout", () => {
  beforeEach(() => {
    pathname = "/";
    getSessionUserMock.mockResolvedValue({
      id: "usr_anonymous",
      email: "anonymous@example.com",
      name: "Anonymous User",
      roles: ["ANONYMOUS"],
    });
    mockMessages = [
      {
        id: "hero-1",
        role: "assistant",
        content:
          "Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, find the right internal material, turn it into assets, and keep it moving from one governed workspace.\n\n__suggestions__:[\"Plan this workflow\",\"Find source material\",\"Turn this into an asset\",\"What makes this different?\"]",
        timestamp: new Date("2026-03-18T10:00:00.000Z"),
        parts: [{ type: "text", text: "hero" }],
      },
    ];
  });

  async function renderHomeShell() {
    return render(
      <AppShell user={baseUser}>
        {await Home()}
      </AppShell>,
    );
  }

  it("renders the embedded chat workspace directly inside the home route main region", async () => {
    const { container } = await renderHomeShell();

    const chatContainer = container.querySelector<HTMLElement>(
      '[data-chat-container-mode="embedded"]',
    );
    expect(chatContainer).not.toBeNull();
    expect(screen.getByRole("main")).toContainElement(chatContainer);
  });

  it("does not render a separate route-level homepage hero stage wrapper", async () => {
    const { container } = await renderHomeShell();

    expect(
      container.querySelector('[data-homepage-chat-stage="true"]'),
    ).toBeNull();
  });

  it("keeps the footer outside the homepage stage", async () => {
    const { container } = await renderHomeShell();

    const chatContainer = container.querySelector<HTMLElement>(
      '[data-chat-container-mode="embedded"]',
    );
    const footer = screen.getByRole("contentinfo");

    expect(chatContainer).not.toContainElement(footer);
  });

  it("keeps the viewport stage separate from the document scroll owner", async () => {
    const { container } = await renderHomeShell();

    const shell = container.querySelector<HTMLElement>(
      '[data-shell-scroll-owner="document"]',
    );
    const viewportStage = container.querySelector<HTMLElement>(
      '[data-shell-viewport-stage="true"]',
    );
    const footer = screen.getByRole("contentinfo");

    expect(shell).not.toBeNull();
    expect(viewportStage).not.toBeNull();
    expect(shell).toContainElement(viewportStage);
    expect(shell).toContainElement(footer);
    expect(viewportStage).not.toContainElement(footer);
  });

  it("keeps the embedded workspace inside the viewport stage", async () => {
    const { container } = await renderHomeShell();

    const viewportStage = container.querySelector<HTMLElement>(
      '[data-shell-viewport-stage="true"]',
    );
    const chatContainer = container.querySelector<HTMLElement>(
      '[data-chat-container-mode="embedded"]',
    );

    expect(viewportStage).toContainElement(chatContainer);
  });

  it("renders embedded chat as a strict message/composer workspace", async () => {
    const { container } = await renderHomeShell();

    const chatContainer = container.querySelector<HTMLElement>(
      '[data-chat-container-mode="embedded"]',
    );
    const messageViewport = container.querySelector<HTMLElement>(
      '[data-chat-message-viewport="true"]',
    );
    const composerRow = container.querySelector<HTMLElement>(
      '[data-chat-composer-row="true"]',
    );

    expect(chatContainer).not.toBeNull();
    expect(chatContainer).toHaveAttribute("data-chat-layout", "message-composer");
    expect(messageViewport).not.toBeNull();
    expect(composerRow).not.toBeNull();
    expect(screen.getByTestId("message-list")).toHaveAttribute(
      "data-embedded",
      "true",
    );
  });

  it("keeps the composer row outside the message viewport subtree", async () => {
    const { container } = await renderHomeShell();

    const messageViewport = container.querySelector<HTMLElement>(
      '[data-chat-message-viewport="true"]',
    );
    const composerRow = container.querySelector<HTMLElement>(
      '[data-chat-composer-row="true"]',
    );
    const messageList = screen.getByTestId("message-list");

    expect(messageViewport).toContainElement(messageList);
    expect(messageViewport).not.toContainElement(composerRow);
  });

  it("keeps reduced-height pressure on the message viewport instead of the composer row", async () => {
    const { container } = await renderHomeShell();

    const main = screen.getByRole("main");
    const messageRegion = container.querySelector<HTMLElement>(
      '[data-chat-message-region="true"]',
    );
    const messageViewport = container.querySelector<HTMLElement>(
      '[data-chat-message-viewport="true"]',
    );
    const composerRow = container.querySelector<HTMLElement>(
      '[data-chat-composer-row="true"]',
    );

    expect(main.className).toContain("overflow-hidden");
    expect(messageRegion?.className).toContain("flex");
    expect(messageRegion?.className).toContain("overflow-hidden");
    expect(messageViewport?.className).toContain("min-h-0");
    expect(messageViewport?.className).toContain("flex-1");
    expect(messageViewport?.className).toContain("overflow-y-auto");
    expect(composerRow?.className).toContain("flex-none");
  });
});
