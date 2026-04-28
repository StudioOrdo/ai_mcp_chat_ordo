import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/AppShell";
import { ChatSurface } from "@/frameworks/ui/ChatSurface";
import type { User } from "@/core/entities/user";

let pathname = "/";
let mockMessages = [
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
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock("@/frameworks/ui/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

describe("homepage shell ownership", () => {
  beforeEach(() => {
    pathname = "/";
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

  it("renders the real footer on the home route while keeping the home stage marker", () => {
    const { container } = render(
      <AppShell user={baseUser}>
        <div>Homepage Stage</div>
      </AppShell>,
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-home-chat-route", "true");
    expect(
      container.querySelector('[data-shell-scroll-owner="document"]'),
    ).not.toBeNull();
  });

  it("keeps the real footer on non-home routes too", () => {
    pathname = "/dashboard";

    render(
      <AppShell user={baseUser}>
        <div>Dashboard</div>
      </AppShell>,
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveAttribute(
      "data-home-chat-route",
    );
  });

  it("keeps the footer outside the viewport stage at the shell level", () => {
    const { container } = render(
      <AppShell user={baseUser}>
        <div>Homepage Stage</div>
      </AppShell>,
    );

    const viewportStage = container.querySelector<HTMLElement>(
      '[data-shell-viewport-stage="true"]',
    );
    const footer = screen.getByRole("contentinfo");

    expect(viewportStage).not.toBeNull();
    expect(viewportStage).not.toContainElement(footer);
  });

  it("renders the canonical homepage nav contract with shared search intact", () => {
    render(
      <AppShell user={baseUser}>
        <div>Homepage Stage</div>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: /studio ordo home/i })).toBeInTheDocument();
    expect(nav.querySelector('[data-shell-nav-region="primary-links"]')).toBeNull();
    expect(nav.querySelector('[data-shell-nav-region="search"]')).not.toBeNull();
    expect(within(nav).queryByRole("link", { name: "Library" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Home" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(within(nav).queryByTestId("account-menu")).toBeNull();
    expect(within(nav).getByTestId("global-search")).toBeInTheDocument();
    expect(within(nav).getByTestId("notification-feed")).toBeInTheDocument();
    expect(within(nav).getByTestId("workspace-menu")).toBeInTheDocument();
  });

  it("shows login and register links instead of notifications for anonymous users", () => {
    const anonymousUser: User = {
      id: "usr_anon",
      email: "anonymous@example.com",
      name: "Anonymous User",
      roles: ["ANONYMOUS"],
    };

    render(
      <AppShell user={anonymousUser}>
        <div>Homepage Stage</div>
      </AppShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(within(nav).queryByTestId("notification-feed")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
    expect(within(nav).getByTestId("workspace-menu")).toBeInTheDocument();
  });

  it("does not render a footer substitute inside the embedded chat container", () => {
    render(<ChatSurface mode="embedded" />);

    expect(
      screen.queryByRole("button", { name: /open site links/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/site links/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });
});