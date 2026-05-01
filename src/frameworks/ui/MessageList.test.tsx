import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PresentedMessage } from "@/adapters/ChatPresenter";
import { MessageList } from "@/frameworks/ui/MessageList";

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeMessage(overrides: Partial<PresentedMessage>): PresentedMessage {
  return {
    id: overrides.id ?? "msg-1",
    role: overrides.role ?? "assistant",
    rawContent: overrides.rawContent ?? "",
    responseState: overrides.responseState,
    content: overrides.content ?? {
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: overrides.rawContent ?? "" }],
        },
      ],
    },
    commands: overrides.commands ?? [],
    suggestions: overrides.suggestions ?? [],
    actions: overrides.actions ?? [],
    attachments: overrides.attachments ?? [],
    failedSend: overrides.failedSend,
    generationStatus: overrides.generationStatus,
    status: overrides.status ?? "confirmed",
    timestamp: overrides.timestamp ?? "12:00",
    toolRenderEntries: overrides.toolRenderEntries ?? [],
  };
}

describe("MessageList", () => {
  it("does not render suggestion chips for closed assistant messages", () => {
    const messages = [
      makeMessage({
        id: "assistant-closed",
        role: "assistant",
        rawContent: "That resolves it.",
        responseState: "closed",
      }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["This should stay hidden"]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.queryByRole("button", { name: "This should stay hidden" })).not.toBeInTheDocument();
  });

  it("does not render suggestion chips for needs-input assistant messages", () => {
    const messages = [
      makeMessage({
        id: "assistant-needs-input",
        role: "assistant",
        rawContent: "Which workflow do you want audited?",
        responseState: "needs_input",
      }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["Should not appear"]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByText("Which workflow do you want audited?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Should not appear" })).not.toBeInTheDocument();
  });

  it("does not render latest assistant chips when filtering hides the true latest message", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Alpha strategy" }),
      makeMessage({ id: "user-1", role: "user", rawContent: "Tell me more" }),
      makeMessage({ id: "assistant-2", role: "assistant", rawContent: "Beta delivery plan" }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["Explore next sprint"]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery="alpha"
        isEmbedded
      />,
    );

    expect(screen.queryByRole("button", { name: "Explore next sprint" })).not.toBeInTheDocument();
  });

  it("matches search queries against rendered message text", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Architecture guidance" }),
      makeMessage({ id: "assistant-2", role: "assistant", rawContent: "Delivery planning" }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery="delivery"
        isEmbedded
      />,
    );

    expect(screen.getByText("Delivery planning")).toBeInTheDocument();
    expect(screen.queryByText("Architecture guidance")).not.toBeInTheDocument();
  });

  it("matches search queries against action link labels", () => {
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "Talk to Morgan Lee about it.",
        content: {
          blocks: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Talk to " },
                { type: "action-link", label: "Morgan Lee", actionType: "conversation", value: "conv_001" },
                { type: "text", text: " about it." },
              ],
            },
          ],
        },
      }),
      makeMessage({ id: "assistant-2", role: "assistant", rawContent: "Unrelated message" }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery="morgan"
        isEmbedded
      />,
    );

    expect(screen.getByText(/Morgan Lee/)).toBeInTheDocument();
    expect(screen.queryByText("Unrelated message")).not.toBeInTheDocument();
  });

  it("matches search queries against operator brief sections", () => {
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "NOW\nProtect customer outcome.",
        content: {
          blocks: [
            {
              type: "operator-brief",
              sections: [
                {
                  label: "NOW",
                  summary: [{ type: "text", text: "Protect customer outcome." }],
                },
                {
                  label: "NEXT",
                  summary: [{ type: "text", text: "Review the queue." }],
                },
                {
                  label: "WAIT",
                  summary: [{ type: "text", text: "Defer cleanup." }],
                },
              ],
            },
          ],
        },
      }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery="customer outcome"
        isEmbedded
      />,
    );

    expect(screen.getByText("Protect customer outcome.")).toBeInTheDocument();
    expect(screen.getByText("Defer cleanup.")).toBeInTheDocument();
  });

  it("adds an embedded fold gutter so the latest message and chips rest above the fold", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps", suggestions: ["Explore next sprint"] }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["Explore next sprint"]}
        isHeroState
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    const list = screen.getByText("May I help you?").closest("[data-message-list-mode]");
    expect(list).toHaveAttribute("data-chat-fold-buffer", "true");
    expect(list).toHaveAttribute("data-message-list-state", "hero");
    expect(list?.className).toContain("ui-chat-message-stack");
    expect(list).toHaveAttribute("data-chat-suggestion-tail", "absent");
  });

  it("hides the seeded assistant bubble on the first-screen hero state", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, search your library, turn it into assets, and keep it moving from one governed workspace.", suggestions: ["Fix a bottleneck"] }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["Fix a bottleneck"]}
        isHeroState
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.queryByText("Bring me the messy workflow, half-finished idea, or customer task. I can help you plan the work, search your library, turn it into assets, and keep it moving from one governed workspace.")).not.toBeInTheDocument();
    expect(screen.getByText("May I help you?")).toBeInTheDocument();
  });

  it("falls back to conversation state when the single message is not the seeded hero", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps" }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    const list = screen.getByText("Ready with next steps").closest("[data-message-list-mode]");
    expect(list).toHaveAttribute("data-message-list-state", "conversation");
    expect(list).toHaveAttribute("data-chat-suggestion-tail", "absent");
    expect(list?.className).toContain("ui-chat-message-stack");
  });

  it("centers the initial suggestion chips as part of the hero stack", () => {
    const workSuggestions = [
      "Search my materials",
      "Draft a publishable page",
      "Plan a customer workflow",
      "Turn notes into an offer",
    ];
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps", suggestions: workSuggestions }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={workSuggestions}
        isHeroState
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByRole("button", { name: "Search my materials" }).closest("div")?.className).toContain("justify-center");
  });

  it("surfaces imported attachment placeholders instead of rendering a broken link", () => {
    render(
      <MessageList
        messages={[
          makeMessage({
            id: "user-imported-attachment-context",
            role: "user",
            rawContent: "Context message",
          }),
          makeMessage({
            id: "assistant-imported-attachment",
            role: "assistant",
            rawContent: "Imported attachment summary.",
            attachments: [
              {
                kind: "imported",
                type: "imported_attachment",
                fileName: "handoff.pdf",
                mimeType: "application/pdf",
                fileSize: 2048,
                availability: "unavailable",
                note: "The original attachment is unavailable in this workspace and could not be restored.",
              },
            ],
          }),
        ]}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByText("Imported attachment")).toBeInTheDocument();
    expect(screen.getByText("The original attachment is unavailable in this workspace and could not be restored.")).toBeInTheDocument();
  });

  it("applies semantic chat surface classes to assistant and user bubbles", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Assistant note" }),
      makeMessage({ id: "user-1", role: "user", rawContent: "User reply" }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(container.querySelector('[data-chat-message-role="assistant"] [data-chat-bubble-surface="true"]')?.className).toContain("ui-chat-message-assistant");
    expect(container.querySelector('[data-chat-message-role="user"] [data-chat-bubble-surface="true"]')?.className).toContain("ui-chat-message-user");
  });

  it("disables suggestion chips while a send is in flight", () => {
    const workSuggestions = [
      "Search my materials",
      "Draft a publishable page",
      "Plan a customer workflow",
      "Turn notes into an offer",
    ];
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps", suggestions: workSuggestions }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending
        dynamicSuggestions={workSuggestions}
        isHeroState
        isSuggestionDisabled
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByRole("button", { name: "Search my materials" })).toBeDisabled();
  });

  it("renders follow-up suggestions in the secondary chip group after the conversation starts", () => {
    const messages = [
      makeMessage({ id: "user-1", role: "user", rawContent: "Audit this workflow" }),
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Pick the audit path.", responseState: "open" }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["Audit a user onboarding flow"]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(container.querySelector('[data-chat-suggestion-group="followup"]')).not.toBeNull();
    expect(container.querySelector('[data-chat-suggestion-priority="promoted"]')).not.toBeNull();
    expect(container.querySelector('[data-chat-suggestion-rank="primary"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Audit a user onboarding flow" })).toBeInTheDocument();
  });

  it("marks the latest assistant message as the floating conversation anchor while keeping the user reply supporting", () => {
    const messages = [
      makeMessage({ id: "user-1", role: "user", rawContent: "Audit this workflow" }),
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Pick the audit path." }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded={false}
      />,
    );

    expect(container.querySelector('[data-chat-message-role="assistant"][data-chat-message-emphasis="anchor"]')).not.toBeNull();
    expect(container.querySelector('[data-chat-message-role="user"][data-chat-message-emphasis="supporting"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-chat-bubble-surface="true"]')).toHaveLength(2);
  });

  it("marks hero suggestions as balanced and neutral rather than promoted", () => {
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps", suggestions: ["Stress-test this AI plan", "Audit this workflow"] }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={["Stress-test this AI plan", "Audit this workflow"]}
        isHeroState
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(container.querySelector('[data-chat-suggestion-group="hero"]')).not.toBeNull();
    expect(container.querySelector('[data-chat-suggestion-priority="balanced"]')).not.toBeNull();
    expect(container.querySelector('[data-chat-suggestion-rank="neutral"]')).not.toBeNull();
  });

  it("renders the compact homepage helper prompt and work chips inside hero state", () => {
    const workSuggestions = [
      "Search my materials",
      "Draft a publishable page",
      "Plan a customer workflow",
      "Turn notes into an offer",
    ];
    const messages = [
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps", suggestions: workSuggestions }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={workSuggestions}
        isHeroState
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Workflow")).toBeInTheDocument();
    expect(screen.getByText("Publishing")).toBeInTheDocument();
    expect(screen.getByText("May I help you?")).toBeInTheDocument();
    expect(screen.getByText(/I can use Ordo's research, workflow, and publishing tools/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search my materials" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft a publishable page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan a customer workflow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn notes into an offer" })).toBeInTheDocument();
    expect(container.querySelector('[data-homepage-proof-strip="true"]')).toBeNull();
    expect(container.querySelectorAll('[data-homepage-proof-card="true"]')).toHaveLength(0);
    expect(screen.queryByText("Try asking")).not.toBeInTheDocument();
  });

  it("does not render the homepage intro when hero state is inactive", () => {
    const messages = [
      makeMessage({ id: "user-1", role: "user", rawContent: "Show the queue" }),
      makeMessage({ id: "assistant-1", role: "assistant", rawContent: "Ready with next steps" }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.queryByText("Research")).not.toBeInTheDocument();
    expect(screen.queryByText("Workflow")).not.toBeInTheDocument();
    expect(screen.queryByText("May I help you?")).not.toBeInTheDocument();
  });

  it("renders MessageActionChips when an assistant message has actions", () => {
    const onActionClick = vi.fn();
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "Here are your next steps.",
        actions: [
          { label: "Open thread", action: "conversation", params: { id: "conv_001" } },
          { label: "View library", action: "route", params: { path: "/library" } },
        ],
      }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        onActionClick={onActionClick}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(container.querySelector('[data-chat-action-chips="true"]')).not.toBeNull();
    expect(screen.getByRole("group", { name: "Message actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open thread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View library" })).toBeInTheDocument();
    expect(container.querySelector('[data-chat-action-chip="conversation"]')).not.toBeNull();
    expect(container.querySelector('[data-chat-action-chip="route"]')).not.toBeNull();
  });

  it("does not render action chip region when message has no actions", () => {
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "Just a regular message.",
        actions: [],
      }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(container.querySelector('[data-chat-action-chips="true"]')).toBeNull();
  });

  it("dispatches onActionClick with correct arguments when an action chip is clicked", () => {
    const onActionClick = vi.fn();
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "Next steps.",
        actions: [
          { label: "Send offer", action: "send", params: { text: "Draft advisory offer" } },
        ],
      }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        onActionClick={onActionClick}
        searchQuery=""
        isEmbedded
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Send offer" }));
    expect(onActionClick).toHaveBeenCalledWith("send", "Draft advisory offer", { text: "Draft advisory offer" });
  });

  it("disables action chips during streaming", () => {
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "Thinking...",
        actions: [
          { label: "Open thread", action: "conversation", params: { id: "conv_001" } },
        ],
      }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByRole("button", { name: "Open thread" })).toBeDisabled();
  });

  it("limits action chips to 3 when message has more", () => {
    const messages = [
      makeMessage({
        id: "assistant-1",
        role: "assistant",
        rawContent: "Many actions.",
        actions: [
          { label: "Action 1", action: "route", params: { path: "/a" } },
          { label: "Action 2", action: "route", params: { path: "/b" } },
          { label: "Action 3", action: "route", params: { path: "/c" } },
          { label: "Action 4", action: "route", params: { path: "/d" } },
          { label: "Action 5", action: "route", params: { path: "/e" } },
        ],
      }),
    ];

    const { container } = render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    const chips = container.querySelectorAll("[data-chat-action-chip]");
    expect(chips).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Action 4" })).not.toBeInTheDocument();
  });

  it("renders a retry button for failed assistant messages", () => {
    const onRetryClick = vi.fn();
    const messages = [
      makeMessage({ id: "user-1", role: "user", rawContent: "Audit this workflow" }),
      makeMessage({
        id: "assistant-failure",
        role: "assistant",
        rawContent: "Provider unavailable",
        failedSend: {
          retryKey: "user-1",
          failedUserMessageId: "user-1",
        },
      }),
    ];

    render(
      <MessageList
        messages={messages}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        onRetryClick={onRetryClick}
        searchQuery=""
        isEmbedded
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryClick).toHaveBeenCalledWith("user-1");
  });

  it("labels interrupted assistant messages and keeps retry available", () => {
    render(
      <MessageList
        messages={[
          makeMessage({ id: "user-1", role: "user", rawContent: "Audit this workflow" }),
          makeMessage({
            id: "assistant-1",
            role: "assistant",
            rawContent: "Partial answer",
            generationStatus: {
              status: "interrupted",
              actor: "system",
              reason: "Connection lost during streaming.",
              partialContentRetained: true,
            },
            failedSend: {
              retryKey: "user-1",
              failedUserMessageId: "user-1",
            },
          }),
        ]}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        onRetryClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByText("Response interrupted")).toBeInTheDocument();
    expect(screen.getByText("Connection lost during streaming.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("labels stopped assistant messages without showing retry", () => {
    render(
      <MessageList
        messages={[
          makeMessage({
            id: "assistant-1",
            role: "assistant",
            rawContent: "Partial answer",
            generationStatus: {
              status: "stopped",
              actor: "user",
              reason: "Stopped by user.",
              partialContentRetained: true,
            },
          }),
        ]}
        isSending={false}
        dynamicSuggestions={[]}
        isHeroState={false}
        onSuggestionClick={vi.fn()}
        onLinkClick={vi.fn()}
        onRetryClick={vi.fn()}
        searchQuery=""
        isEmbedded
      />,
    );

    expect(screen.getByText("Response stopped")).toBeInTheDocument();
    expect(screen.getByText("Stopped by user.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});