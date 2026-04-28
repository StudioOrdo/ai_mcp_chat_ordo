import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { AppShell } from "@/components/AppShell";
import type { ChatMessage } from "@/core/entities/chat-message";
import type { User } from "@/core/entities/user";

import { evaluateHomepageScenario } from "./helpers/homepageEvalHarness";

const { getSessionUserMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
}));

let pathname = "/";
let mockMessages: ChatMessage[] = [
  {
    id: "hero-1",
    role: "assistant" as const,
    content:
      "Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, search your library, turn it into assets, and keep it moving from one governed workspace.\n\n__suggestions__:[\"Plan this workflow\",\"Search my library\",\"Turn this into an asset\",\"What makes this different?\"]",
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

vi.mock("@/components/GlobalSearchBar", () => ({
  GlobalSearchBar: () => <div data-testid="global-search" />,
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

vi.mock("@/frameworks/ui/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

describe("homepage shell eval harness", () => {
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
          "Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, search your library, turn it into assets, and keep it moving from one governed workspace.\n\n__suggestions__:[\"Plan this workflow\",\"Search my library\",\"Turn this into an asset\",\"What makes this different?\"]",
        timestamp: new Date("2026-03-18T10:00:00.000Z"),
        parts: [{ type: "text", text: "hero" }],
      },
    ];
  });

  async function renderHome() {
    return render(
      <AppShell user={baseUser}>
        {await Home()}
      </AppShell>,
    );
  }

  it("passes the default hero-state homepage eval scenario", async () => {
    const { container } = await renderHome();

    const report = evaluateHomepageScenario({
      scenario: "default-hero",
      container,
      expectIntro: true,
    });

    expect(report.passed, JSON.stringify(report.checks, null, 2)).toBe(true);
  });

  it("passes the active-conversation homepage eval scenario", async () => {
    mockMessages = [
      {
        id: "user-1",
        role: "user",
        content: "Map the current intake workflow",
        timestamp: new Date("2026-03-18T10:00:00.000Z"),
        parts: [{ type: "text", text: "Map the current intake workflow" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "I can help you isolate the intake bottleneck and define a scoped architecture sprint.",
        timestamp: new Date("2026-03-18T10:01:00.000Z"),
        parts: [{ type: "text", text: "I can help you isolate the intake bottleneck and define a scoped architecture sprint." }],
      },
    ];

    const { container } = await renderHome();

    const report = evaluateHomepageScenario({
      scenario: "active-conversation",
      container,
      expectIntro: false,
    });

    expect(report.passed, JSON.stringify(report.checks, null, 2)).toBe(true);
  });
});