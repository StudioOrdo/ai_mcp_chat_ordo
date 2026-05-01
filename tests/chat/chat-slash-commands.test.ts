import { describe, expect, it, vi } from "vitest";

import type { ChatSlashCommandContext } from "@/lib/chat/chat-slash-commands";
import {
  createEmptyChatSlashCommandMessage,
  createUnsupportedChatSlashCommandMessage,
  getSupportedChatSlashCommandNames,
  resolveChatSlashCommand,
} from "@/lib/chat/chat-slash-commands";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";

vi.mock("@/lib/chat/embed-conversation", () => ({
  embedConversation: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/observability/logger", () => ({
  logDegradation: vi.fn(),
}));

function createMockConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv_1",
    userId: "usr_1",
    title: "",
    status: "active" as const,
    createdAt: "2026-04-09T00:00:00Z",
    updatedAt: "2026-04-09T00:00:00Z",
    convertedFrom: null,
    messageCount: 5,
    firstMessageAt: "2026-04-09T00:00:00Z",
    lastToolUsed: "search_corpus",
    sessionSource: "authenticated",
    promptVersion: 1,
    routingSnapshot: createConversationRoutingSnapshot({ lane: "organization", confidence: 0.9 }),
    referralId: null,
    referralSource: null,
    deletedAt: null,
    deletedByUserId: null,
    deleteReason: null,
    purgeAfter: null,
    restoredAt: null,
    importedAt: null,
    importSourceConversationId: null,
    importedFromExportedAt: null,
    ...overrides,
  };
}

function createMockMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    conversationId: "conv_1",
    role: "user" as const,
    content: "hello",
    parts: [{ type: "text" as const, text: "hello" }],
    createdAt: "2026-04-09T00:00:00Z",
    tokenEstimate: 2,
    ...overrides,
  };
}

function createMockContext(overrides: Partial<ChatSlashCommandContext> = {}): ChatSlashCommandContext {
  return {
    conversationId: "conv_1",
    userId: "usr_1",
    role: "ADMIN",
    isAnonymous: false,
    interactor: {
      archiveActive: vi.fn().mockResolvedValue(createMockConversation({ status: "archived" })),
      ensureActive: vi.fn().mockResolvedValue(createMockConversation({ id: "conv_2" })),
      appendMessage: vi.fn().mockResolvedValue(createMockMessage({ role: "assistant" })),
      get: vi.fn().mockResolvedValue({
        conversation: createMockConversation(),
        messages: [createMockMessage()],
      }),
    } as unknown as ChatSlashCommandContext["interactor"],
    summarizationInteractor: {
      summarizeIfNeeded: vi.fn().mockResolvedValue(undefined),
    } as unknown as ChatSlashCommandContext["summarizationInteractor"],
    jobStatusQuery: {
      listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
    } as unknown as ChatSlashCommandContext["jobStatusQuery"],
    ...overrides,
  };
}

describe("chat slash commands", () => {
  it("resolves supported slash commands through the shared command registry", () => {
    const result = resolveChatSlashCommand("/clear");

    expect(result).toMatchObject({
      kind: "supported",
      commandName: "clear",
      argsText: "",
    });
  });

  it("reports unsupported slash commands predictably", () => {
    const result = resolveChatSlashCommand("/unknown extra args");

    expect(result).toEqual({
      kind: "unsupported",
      commandName: "unknown",
      argsText: "extra args",
    });
    expect(createUnsupportedChatSlashCommandMessage("unknown")).toContain("Available commands: /clear, /compact, /export, /status.");
  });

  it("treats a bare slash as an empty command payload", () => {
    expect(resolveChatSlashCommand("/")).toEqual({ kind: "empty" });
    expect(createEmptyChatSlashCommandMessage()).toContain("Enter a slash command after \"/\".");
  });

  it("ignores ordinary messages that are not slash command attempts", () => {
    expect(resolveChatSlashCommand("Please explain /clear to me")).toBeNull();
  });

  it("keeps the supported slash command list stable", () => {
    expect(getSupportedChatSlashCommandNames()).toEqual(["clear", "compact", "export", "status"]);
  });
});

describe("slash command execution", () => {
  describe("/clear", () => {
    it("archives the active conversation and returns a new conversation id", async () => {
      const context = createMockContext();
      const resolved = resolveChatSlashCommand("/clear");
      expect(resolved?.kind).toBe("supported");
      if (resolved?.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.conversationId).toBe("conv_2");
      expect(result.replyText).toContain("archived");
      expect(result.streamText).toBeNull();
      expect(context.interactor.archiveActive).toHaveBeenCalledWith("usr_1");
      expect(context.interactor.ensureActive).toHaveBeenCalledWith("usr_1");
      expect(context.interactor.appendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv_1", role: "assistant" }),
        "usr_1",
      );
    });

    it("skips embedding for anonymous users", async () => {
      const { embedConversation } = await import("@/lib/chat/embed-conversation");
      const context = createMockContext({ isAnonymous: true });
      const resolved = resolveChatSlashCommand("/clear")!;
      if (resolved.kind !== "supported") return;

      await resolved.command.execute(context);

      expect(embedConversation).not.toHaveBeenCalled();
    });

    it("handles no active conversation to archive gracefully", async () => {
      const context = createMockContext();
      (context.interactor.archiveActive as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const resolved = resolveChatSlashCommand("/clear")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.replyText).toBe("Started a fresh conversation.");
      expect(context.interactor.appendMessage).not.toHaveBeenCalled();
    });
  });

  describe("/compact", () => {
    it("triggers summarization and reports compaction boundaries", async () => {
      const context = createMockContext();
      const interactor = context.interactor as unknown as { get: ReturnType<typeof vi.fn> };
      interactor.get
        .mockResolvedValueOnce({
          conversation: createMockConversation(),
          messages: [createMockMessage()],
        })
        .mockResolvedValueOnce({
          conversation: createMockConversation(),
          messages: [createMockMessage({ parts: [{ type: "summary", text: "s" }] })],
        });

      const resolved = resolveChatSlashCommand("/compact")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(context.summarizationInteractor.summarizeIfNeeded).toHaveBeenCalledWith("conv_1");
      expect(result.replyText).toContain("compacted");
      expect(result.replyText).toContain("from 0 to 1");
    });

    it("reports when no compaction was needed", async () => {
      const context = createMockContext();

      const resolved = resolveChatSlashCommand("/compact")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.replyText).toContain("No compaction was needed");
      expect(result.replyText).toContain("5 messages");
    });
  });

  describe("/export", () => {
    it("returns a download link with the conversation id", async () => {
      const context = createMockContext();

      const resolved = resolveChatSlashCommand("/export")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.conversationId).toBe("conv_1");
      expect(result.replyText).toContain("conv_1");
      expect(result.replyText).toContain("export");
      expect(result.replyText).toContain("Download the JSON export");
      expect(context.interactor.appendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv_1", role: "assistant" }),
        "usr_1",
      );
    });
  });

  describe("/status", () => {
    it("returns structured conversation status with routing and job information", async () => {
      const context = createMockContext();

      const resolved = resolveChatSlashCommand("/status")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.conversationId).toBe("conv_1");
      expect(result.replyText).toContain("Conversation status: active");
      expect(result.replyText).toContain("Messages: 5");
      expect(result.replyText).toContain("Lane: organization (90% confidence)");
      expect(result.replyText).toContain("Last tool: search_corpus");
      expect(result.replyText).toContain("Active jobs: none");
    });

    it("formats active jobs when present", async () => {
      const context = createMockContext();
      (context.jobStatusQuery.listConversationJobSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue([
        { label: "Audio generation", status: "running", progressLabel: "50%" },
      ]);

      const resolved = resolveChatSlashCommand("/status")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.replyText).toContain("Audio generation: running (50%)");
    });

    it("shows unknown confidence when confidence is null", async () => {
      const context = createMockContext();
      (context.interactor.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversation: createMockConversation({
          routingSnapshot: createConversationRoutingSnapshot({ lane: "uncertain", confidence: null }),
        }),
        messages: [],
      });

      const resolved = resolveChatSlashCommand("/status")!;
      if (resolved.kind !== "supported") return;

      const result = await resolved.command.execute(context);

      expect(result.replyText).toContain("unknown confidence");
    });
  });

  describe("edge cases", () => {
    it("all commands throw when context is missing", async () => {
      for (const name of ["clear", "compact", "export", "status"]) {
        const resolved = resolveChatSlashCommand(`/${name}`)!;
        if (resolved.kind !== "supported") continue;

        await expect(resolved.command.execute()).rejects.toThrow("requires runtime context");
      }
    });
  });
});
