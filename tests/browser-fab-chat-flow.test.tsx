import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSurface } from "@/frameworks/ui/ChatSurface";
import { ChatProvider } from "@/hooks/useGlobalChat";
import { OPEN_GLOBAL_CHAT_EVENT } from "@/lib/chat/chat-events";

const { fetchStreamMock, pushMock } = vi.hoisted(() => ({
  fetchStreamMock: vi.fn(),
  pushMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/adapters/StreamProviderFactory", () => ({
  getChatStreamProvider: () => ({
    fetchStream: fetchStreamMock,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({
    accessibility: { density: "normal" },
    setAccessibility: vi.fn(),
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

function createNoReferralVisitResponse() {
  return {
    status: 404,
    ok: false,
    json: async () => ({ error: "No referral visit" }),
  };
}

describe("browser FAB chat flow", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    fetchStreamMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock
      .mockResolvedValueOnce({
        status: 404,
        ok: false,
        json: async () => ({ error: "No active conversation" }),
      })
      .mockResolvedValueOnce(createNoReferralVisitResponse())
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          conversation: {
            id: "conv_new",
            userId: "anon_123",
            title: "Fresh thread",
            status: "active",
            createdAt: "2026-03-20T16:00:00.000Z",
            updatedAt: "2026-03-20T16:00:05.000Z",
            convertedFrom: null,
            messageCount: 2,
            firstMessageAt: "2026-03-20T16:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: null,
          },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Audit this workflow",
              parts: [{ type: "text", text: "Audit this workflow" }],
              createdAt: "2026-03-20T16:00:00.000Z",
            },
            {
              id: "msg_2",
              role: "assistant",
              content: 'One quick clarifying question before I dig in: what kind of workflow are you auditing?\n\n__suggestions__:["Audit a design handoff workflow","Audit an engineering deployment process","Audit a user onboarding flow"]',
              parts: [{ type: "text", text: 'One quick clarifying question before I dig in: what kind of workflow are you auditing?\n\n__suggestions__:["Audit a design handoff workflow","Audit an engineering deployment process","Audit a user onboarding flow"]' }],
              createdAt: "2026-03-20T16:00:05.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          conversation: {
            id: "conv_new",
            userId: "anon_123",
            title: "Fresh thread",
            status: "active",
            createdAt: "2026-03-20T16:00:00.000Z",
            updatedAt: "2026-03-20T16:00:10.000Z",
            convertedFrom: null,
            messageCount: 4,
            firstMessageAt: "2026-03-20T16:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: null,
          },
          messages: [
            {
              id: "msg_1",
              role: "user",
              content: "Audit this workflow",
              parts: [{ type: "text", text: "Audit this workflow" }],
              createdAt: "2026-03-20T16:00:00.000Z",
            },
            {
              id: "msg_2",
              role: "assistant",
              content: 'One quick clarifying question before I dig in: what kind of workflow are you auditing?\n\n__suggestions__:["Audit a design handoff workflow","Audit an engineering deployment process","Audit a user onboarding flow"]',
              parts: [{ type: "text", text: 'One quick clarifying question before I dig in: what kind of workflow are you auditing?\n\n__suggestions__:["Audit a design handoff workflow","Audit an engineering deployment process","Audit a user onboarding flow"]' }],
              createdAt: "2026-03-20T16:00:05.000Z",
            },
            {
              id: "msg_3",
              role: "user",
              content: "Audit a user onboarding flow",
              parts: [{ type: "text", text: "Audit a user onboarding flow" }],
              createdAt: "2026-03-20T16:00:07.000Z",
            },
            {
              id: "msg_4",
              role: "assistant",
              content: "For a user onboarding flow, start by checking where activation drops after the first-value step.",
              parts: [{ type: "text", text: "For a user onboarding flow, start by checking where activation drops after the first-value step." }],
              createdAt: "2026-03-20T16:00:10.000Z",
            },
          ],
        }),
      });

    fetchStreamMock
      .mockResolvedValueOnce({
        events: async function* () {
          yield { type: "conversation_id", id: "conv_new" };
          yield { type: "text", delta: "Working through the first workflow request." };
        },
        cancel: vi.fn(),
      })
      .mockResolvedValueOnce({
        events: async function* () {
          yield {
            type: "text",
            delta: "For a user onboarding flow, start by checking where activation drops after the first-value step.",
          };
        },
        cancel: vi.fn(),
      });
  });

  it("keeps the FAB flow stable from open to initial chip send to follow-up chip send", async () => {
    const { container } = render(
      <ChatProvider>
        <ChatSurface mode="floating" />
      </ChatProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    const composer = await screen.findByPlaceholderText("Ask Studio Ordo...");
    fireEvent.change(composer, { target: { value: "Audit this workflow" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Audit this workflow" }),
        ]),
        expect.objectContaining({ conversationId: undefined, attachments: [] }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Audit a user onboarding flow" })).toBeInTheDocument();
      const chrome = container.querySelector('[data-chat-floating-header-chrome="true"]');

      // In single-conversation mode, leading region no longer renders (no conversation actions)
      expect(container.querySelector('[data-chat-floating-header-leading="true"]')).toBeNull();
      expect(chrome).not.toBeNull();
      expect(container.querySelector('[data-chat-transcript-plane="true"]')).not.toBeNull();
      expect(container.querySelector('[data-chat-message-role="assistant"][data-chat-message-emphasis="anchor"]')).not.toBeNull();
      expect(container.querySelector('[data-chat-composer-plane="true"]')).not.toBeNull();
      expect(container.querySelector('[data-chat-suggestion-group="followup"]')).not.toBeNull();
      expect(container.querySelector('[data-chat-suggestion-priority="promoted"]')).not.toBeNull();
      expect(container.querySelector('[data-chat-suggestion-rank="primary"]')).not.toBeNull();
      expect(container.querySelector('[data-chat-suggestion-rank="secondary"]')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Audit a user onboarding flow" }));

    await waitFor(() => {
      expect(fetchStreamMock).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "Audit a user onboarding flow" }),
        ]),
        expect.objectContaining({ conversationId: "conv_new", attachments: [] }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/For a user onboarding flow, start by checking where activation drops/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renders action link as a focusable button inside the assistant bubble", async () => {
    // Override mocks: hero state shows "Show actions" chip, conversation reply has action links
    fetchMock.mockReset();
    fetchStreamMock.mockReset();

    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          conversation: {
            id: "conv_action",
            userId: "anon_123",
            title: "Action thread",
            status: "active",
            createdAt: "2026-03-20T16:00:00.000Z",
            updatedAt: "2026-03-20T16:00:05.000Z",
            convertedFrom: null,
            messageCount: 1,
            firstMessageAt: "2026-03-20T16:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: null,
          },
          messages: [
            {
              id: "msg_hero",
              role: "assistant",
              content: 'Check [Morgan Lee](?conversation=conv_001) for details\n\n__suggestions__:["Show actions"]',
              parts: [{ type: "text", text: 'Check [Morgan Lee](?conversation=conv_001) for details\n\n__suggestions__:["Show actions"]' }],
              createdAt: "2026-03-20T16:00:00.000Z",
            },
          ],
        }),
      });
    fetchMock.mockResolvedValueOnce(createNoReferralVisitResponse());

    const { container } = render(
      <ChatProvider>
        <ChatSurface mode="floating" />
      </ChatProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    await waitFor(() => {
      const actionButton = container.querySelector('[data-chat-action-link="conversation"]');
      expect(actionButton).not.toBeNull();
      expect(actionButton?.tagName.toLowerCase()).toBe("button");
      expect(actionButton?.getAttribute("aria-label")).toBe("Morgan Lee (conversation)");
    });
  });

  it("renders action chips with data-chat-action-chip attributes inside the bubble", async () => {
    fetchMock.mockReset();
    fetchStreamMock.mockReset();

    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          conversation: {
            id: "conv_chips",
            userId: "anon_123",
            title: "Chip thread",
            status: "active",
            createdAt: "2026-03-20T16:00:00.000Z",
            updatedAt: "2026-03-20T16:00:05.000Z",
            convertedFrom: null,
            messageCount: 1,
            firstMessageAt: "2026-03-20T16:00:00.000Z",
            lastToolUsed: null,
            sessionSource: "anonymous_cookie",
            promptVersion: null,
            routingSnapshot: null,
          },
          messages: [
            {
              id: "msg_hero",
              role: "assistant",
              content: 'Here are your options\n\n__suggestions__:["Start"] __actions__:[{"label":"Open library","action":"route","params":{"path":"/library"}},{"label":"Ask AI","action":"send","params":{"text":"help me"}}]',
              parts: [{ type: "text", text: 'Here are your options\n\n__suggestions__:["Start"] __actions__:[{"label":"Open library","action":"route","params":{"path":"/library"}},{"label":"Ask AI","action":"send","params":{"text":"help me"}}]' }],
              createdAt: "2026-03-20T16:00:00.000Z",
            },
          ],
        }),
      });
    fetchMock.mockResolvedValueOnce(createNoReferralVisitResponse());

    const { container } = render(
      <ChatProvider>
        <ChatSurface mode="floating" />
      </ChatProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_CHAT_EVENT));
    });

    await waitFor(() => {
      const chipContainer = container.querySelector('[data-chat-action-chips="true"]');
      expect(chipContainer).not.toBeNull();
      const routeChip = container.querySelector('[data-chat-action-chip="route"]');
      const sendChip = container.querySelector('[data-chat-action-chip="send"]');
      expect(routeChip).not.toBeNull();
      expect(sendChip).not.toBeNull();
    });
  });
});