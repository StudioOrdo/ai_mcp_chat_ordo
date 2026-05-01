import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import {
  clearActiveStreamsForTests,
  getActiveStreamSnapshot,
  stopActiveStream,
} from "@/lib/chat/active-stream-registry";
import { createRouteRequest } from "../../../../../tests/helpers/workflow-route-fixture";

const {
  getAnthropicApiKeyMock,
  createSystemPromptBuilderMock,
  getAgentPlatformFacadeMock,
  getSessionUserMock,
  resolveUserIdMock,
  createConversationRuntimeServicesMock,
  runClaudeAgentLoopStreamMock,
  executeDirectChatTurnMock,
  getReferralLedgerServiceMock,
  getJobQueueRepositoryMock,
  getJobStatusQueryMock,
  getUserPreferencesDataMapperMock,
  recordPromptTurnProvenanceMock,
  recordPromptBindingMock,
  runtimeInteractorMock,
  summarizationInteractorMock,
} = vi.hoisted(() => ({
  getAnthropicApiKeyMock: vi.fn(),
  createSystemPromptBuilderMock: vi.fn(),
  getAgentPlatformFacadeMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  resolveUserIdMock: vi.fn(),
  createConversationRuntimeServicesMock: vi.fn(),
  runClaudeAgentLoopStreamMock: vi.fn(),
  executeDirectChatTurnMock: vi.fn(),
  getReferralLedgerServiceMock: vi.fn(),
  getJobQueueRepositoryMock: vi.fn(),
  getJobStatusQueryMock: vi.fn(),
  getUserPreferencesDataMapperMock: vi.fn(),
  recordPromptTurnProvenanceMock: vi.fn(),
  recordPromptBindingMock: vi.fn(),
  runtimeInteractorMock: {
    archiveActive: vi.fn(),
    ensureActive: vi.fn(),
    appendMessage: vi.fn(),
    get: vi.fn(),
    getForStreamingContext: vi.fn(),
    updateRoutingSnapshot: vi.fn(),
    recordToolUsed: vi.fn(),
    recordToolDenied: vi.fn(),
    recordSessionResolution: vi.fn(),
    recordGenerationLifecycleEvent: vi.fn(),
  },
  summarizationInteractorMock: {
    summarizeIfNeeded: vi.fn(),
  },
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/config/env", () => ({
  getAnthropicApiKey: getAnthropicApiKeyMock,
}));

vi.mock("@/lib/chat/policy", () => ({
  createSystemPromptBuilder: createSystemPromptBuilderMock,
}));

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: getAgentPlatformFacadeMock,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRuntimeServices: createConversationRuntimeServicesMock,
}));

vi.mock("@/lib/chat/anthropic-stream", () => ({
  runClaudeAgentLoopStream: runClaudeAgentLoopStreamMock,
}));

vi.mock("@/lib/chat/chat-turn", () => ({
  executeDirectChatTurn: executeDirectChatTurnMock,
}));

vi.mock("@/lib/referrals/referral-ledger", () => ({
  getReferralLedgerService: getReferralLedgerServiceMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: getJobQueueRepositoryMock,
  getJobStatusQuery: getJobStatusQueryMock,
  getUserPreferencesDataMapper: getUserPreferencesDataMapperMock,
}));

vi.mock("@/lib/prompts/prompt-provenance-service", () => ({
  recordPromptTurnProvenance: recordPromptTurnProvenanceMock,
}));

vi.mock("@/lib/prompts/prompt-binding-service", () => ({
  recordPromptBinding: recordPromptBindingMock,
}));

import { POST } from "@/app/api/chat/stream/route";

function createBuilder() {
  const builder = {
    withToolManifest: vi.fn(() => builder),
    withTrustedReferralContext: vi.fn(() => builder),
    withUserPreferences: vi.fn(() => builder),
    withConversationSummary: vi.fn(() => builder),
    withRoutingContext: vi.fn(() => builder),
    withSection: vi.fn(() => builder),
    getReplayContext: vi.fn(() => ({
      surface: "chat_stream",
      role: "ANONYMOUS",
    })),
    buildResult: vi.fn(async () => ({
      surface: "chat_stream",
      text: "system-prompt",
      effectiveHash: "hash_chat_stream",
      slotRefs: [],
      sections: [],
      warnings: [],
    })),
    build: vi.fn(() => "system-prompt"),
  };

  return builder;
}

async function readSsePayloads(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  count: number,
): Promise<Array<Record<string, unknown>>> {
  if (!reader) {
    return [];
  }

  const decoder = new TextDecoder();
  const payloads: Array<Record<string, unknown>> = [];
  let buffer = "";

  while (payloads.length < count) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const line = block
        .split("\n")
        .find((candidate) => candidate.startsWith("data:"));
      if (!line) {
        continue;
      }

      payloads.push(JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
      if (payloads.length >= count) {
        break;
      }
    }
  }

  return payloads;
}

async function drainReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  while (true) {
    const { done } = await reader.read();
    if (done) {
      return;
    }
  }
}

describe("POST /api/chat/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearActiveStreamsForTests();

    const builder = createBuilder();
    runtimeInteractorMock.archiveActive.mockResolvedValue(false);
    runtimeInteractorMock.ensureActive.mockResolvedValue({ id: "conv_stream_1" });
    runtimeInteractorMock.appendMessage.mockImplementation(async (message: {
      conversationId: string;
      role: "user" | "assistant" | "system";
      content: string;
      parts: unknown[];
    }) => ({
      id: message.role === "assistant" ? "msg_assistant_1" : "msg_user_1",
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      parts: message.parts,
      createdAt: "2026-03-25T10:00:00.000Z",
      tokenEstimate: 1,
    }));
    runtimeInteractorMock.get.mockResolvedValue({
      conversation: {
        id: "conv_stream_1",
        status: "active",
        messageCount: 1,
        lastToolUsed: null,
        routingSnapshot: createConversationRoutingSnapshot(),
      },
      messages: [],
    });
    runtimeInteractorMock.getForStreamingContext.mockResolvedValue({
      conversation: { routingSnapshot: createConversationRoutingSnapshot() },
      messages: [],
    });
    runtimeInteractorMock.updateRoutingSnapshot.mockResolvedValue(undefined);
    runtimeInteractorMock.recordToolUsed.mockResolvedValue(undefined);
    runtimeInteractorMock.recordToolDenied.mockResolvedValue(undefined);
    runtimeInteractorMock.recordSessionResolution.mockResolvedValue(undefined);
    runtimeInteractorMock.recordGenerationLifecycleEvent.mockResolvedValue(undefined);
    summarizationInteractorMock.summarizeIfNeeded.mockResolvedValue(undefined);

    getAnthropicApiKeyMock.mockReturnValue("test-key");
    createSystemPromptBuilderMock.mockResolvedValue(builder);
    getAgentPlatformFacadeMock.mockReturnValue({
      getExecutionSurface: () => ({
        registry: {
          getSchemasForRole: vi.fn(() => []),
          getDescriptor: vi.fn(() => null),
        },
        executor: vi.fn(),
      }),
    });
    getSessionUserMock.mockResolvedValue({
      id: "usr_anon",
      email: "anon@example.com",
      name: "Anonymous",
      roles: ["ANONYMOUS"],
    });
    resolveUserIdMock.mockResolvedValue({ userId: "anon_stream_owner", isAnonymous: true });
    createConversationRuntimeServicesMock.mockReturnValue({
      interactor: runtimeInteractorMock,
      routingAnalyzer: {
        analyze: vi.fn().mockResolvedValue(createConversationRoutingSnapshot()),
      },
      summarizationInteractor: summarizationInteractorMock,
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn().mockResolvedValue([]),
      },
    });
    getReferralLedgerServiceMock.mockReturnValue({
      getTrustedReferrerContext: vi.fn().mockResolvedValue(null),
      attachValidatedVisitToConversation: vi.fn().mockResolvedValue(undefined),
    });
    getJobQueueRepositoryMock.mockReturnValue({
      findActiveJobByDedupeKey: vi.fn().mockResolvedValue(null),
      createJob: vi.fn(),
      appendEvent: vi.fn(),
    });
    getJobStatusQueryMock.mockReturnValue({
      getJobSnapshot: vi.fn().mockResolvedValue(null),
      getUserJobSnapshot: vi.fn().mockResolvedValue(null),
      listConversationJobSnapshots: vi.fn().mockResolvedValue([]),
      listUserJobSnapshots: vi.fn().mockResolvedValue([]),
    });
    getUserPreferencesDataMapperMock.mockReturnValue({
      getAll: vi.fn().mockResolvedValue({}),
    });
    recordPromptTurnProvenanceMock.mockResolvedValue({
      id: "pprov_1",
      conversationId: "conv_stream_1",
      userMessageId: "msg_user_1",
      assistantMessageId: null,
      surface: "chat_stream",
      effectiveHash: "hash_chat_stream",
      slotRefs: [],
      sections: [],
      warnings: [],
      replayContext: {
        surface: "chat_stream",
        role: "ANONYMOUS",
      },
      recordedAt: "2026-03-25T10:00:00.000Z",
    });
    recordPromptBindingMock.mockResolvedValue({
      id: "pb_1",
      userId: "anon_stream_owner",
      conversationId: "conv_stream_1",
      surface: "chat_stream",
      effectiveHash: "hash_chat_stream",
      slotRefs: [],
      overlayRefs: [],
      decisionSourceRefs: [],
      evidenceRefs: [],
      createdAt: "2026-03-25T10:00:00.000Z",
    });
    executeDirectChatTurnMock.mockResolvedValue("4.");
    runClaudeAgentLoopStreamMock.mockImplementation(async ({ signal }: { signal?: AbortSignal }) => {
      await new Promise<void>((resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });

      return {
        model: "test-model",
        assistantText: "",
        stopReason: "aborted",
        toolRoundCount: 0,
        toolCalls: [],
        toolResults: [],
      };
    });
  });

  afterEach(() => {
    clearActiveStreamsForTests();
  });

  it("emits a stream id before the conversation id and registers the active stream", async () => {
    const response = await POST(
      createRouteRequest("http://localhost:3000/api/chat/stream", "POST", {
        messages: [{ role: "user", content: "Hello there" }],
      }),
    );

    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Expected a response body reader for the chat stream route test");
    }

    const [streamPayload, conversationPayload] = await readSsePayloads(reader, 2);
    const streamId = streamPayload?.stream_id;

    expect(typeof streamId).toBe("string");
    expect(conversationPayload).toEqual({ conversation_id: "conv_stream_1" });
    expect(getActiveStreamSnapshot(streamId as string)).toMatchObject({
      streamId,
      ownerUserId: "anon_stream_owner",
      conversationId: "conv_stream_1",
    });

    expect(stopActiveStream(streamId as string, "anon_stream_owner")).toMatchObject({
      streamId,
      conversationId: "conv_stream_1",
    });

    const [terminalPayload] = await readSsePayloads(reader, 1);

    expect(terminalPayload).toEqual({
      type: "generation_stopped",
      actor: "user",
      reason: "stopped_by_owner",
      partialContentRetained: false,
      recordedAt: expect.any(String),
    });
    await drainReader(reader);

    expect(runtimeInteractorMock.recordGenerationLifecycleEvent).toHaveBeenCalledWith(
      "conv_stream_1",
      "generation_stopped",
      expect.objectContaining({
        actor: "user",
        reason: "stopped_by_owner",
        partial_content_retained: false,
        stream_id: streamId,
      }),
    );
    expect(getActiveStreamSnapshot(streamId as string)).toBeNull();
  });

  it("records a prompt binding from the persisted prompt provenance before streaming", async () => {
    runClaudeAgentLoopStreamMock.mockResolvedValueOnce({
      model: "test-model",
      assistantText: "Hello back",
      stopReason: "end_turn",
      toolRoundCount: 0,
      toolCalls: [],
      toolResults: [],
    });

    const response = await POST(
      createRouteRequest("http://localhost:3000/api/chat/stream", "POST", {
        messages: [{ role: "user", content: "Hello there" }],
      }),
    );

    expect(response.status).toBe(200);
    expect(recordPromptTurnProvenanceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv_stream_1",
        userMessageId: "msg_user_1",
      }),
    );
    expect(recordPromptBindingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "anon_stream_owner",
        conversationId: "conv_stream_1",
        surface: "chat_stream",
        target: {
          targetKind: "message",
          targetId: "msg_user_1",
        },
        promptRuntime: expect.objectContaining({
          effectiveHash: "hash_chat_stream",
        }),
      }),
    );
  });

  it("persists partial assistant output and records generation_interrupted on unexpected stream errors", async () => {
    runClaudeAgentLoopStreamMock.mockImplementation(async ({ callbacks }: {
      callbacks: { onDelta: (text: string) => void };
    }) => {
      callbacks.onDelta("Partial answer");
      throw new Error("Provider unavailable");
    });

    const response = await POST(
      createRouteRequest("http://localhost:3000/api/chat/stream", "POST", {
        messages: [{ role: "user", content: "Hello there" }],
      }),
    );

    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Expected a response body reader for the chat stream route test");
    }

    const [, , deltaPayload, terminalPayload] = await readSsePayloads(reader, 4);

    expect(deltaPayload).toEqual({ delta: "Partial answer" });
    expect(terminalPayload).toEqual({
      type: "generation_interrupted",
      actor: "system",
      reason: "Provider unavailable",
      partialContentRetained: true,
      recordedAt: expect.any(String),
    });
    expect(runtimeInteractorMock.appendMessage).toHaveBeenLastCalledWith(
      {
        conversationId: "conv_stream_1",
        role: "assistant",
        content: "Partial answer",
        parts: [
          { type: "text", text: "Partial answer" },
          {
            type: "generation_status",
            status: "interrupted",
            actor: "system",
            reason: "Provider unavailable",
            partialContentRetained: true,
            recordedAt: expect.any(String),
          },
        ],
      },
      "anon_stream_owner",
      { sourcePromptBindingId: "pb_1" },
    );
    expect(runtimeInteractorMock.recordGenerationLifecycleEvent).toHaveBeenCalledWith(
      "conv_stream_1",
      "generation_interrupted",
      expect.objectContaining({
        actor: "system",
        reason: "Provider unavailable",
        partial_content_retained: true,
        message_id: "msg_assistant_1",
      }),
    );
    await drainReader(reader);
  });

  it("streams math short-circuit replies as SSE events", async () => {
    const response = await POST(
      createRouteRequest("http://localhost:3000/api/chat/stream", "POST", {
        messages: [{ role: "user", content: "What is 2+2? Keep it short." }],
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Expected a response body reader for the chat stream route test");
    }

    const payloads = await readSsePayloads(reader, 2);

    expect(payloads).toEqual([
      { conversation_id: "conv_stream_1" },
      { delta: "4." },
    ]);
    expect(executeDirectChatTurnMock).toHaveBeenCalledTimes(1);
    expect(runClaudeAgentLoopStreamMock).not.toHaveBeenCalled();
    expect(runtimeInteractorMock.appendMessage).toHaveBeenLastCalledWith(
      {
        conversationId: "conv_stream_1",
        role: "assistant",
        content: "4.",
        parts: [{ type: "text", text: "4." }],
      },
      "anon_stream_owner",
    );

    await drainReader(reader);
  });

  it("drops whitespace-only transcript messages before calling the stream provider", async () => {
    runtimeInteractorMock.getForStreamingContext.mockResolvedValue({
      conversation: { routingSnapshot: createConversationRoutingSnapshot() },
      messages: [
        {
          id: "msg_blank_assistant",
          conversationId: "conv_stream_1",
          role: "assistant",
          content: "   ",
          parts: [],
          createdAt: "2026-03-25T10:00:00.000Z",
          tokenEstimate: 1,
        },
        {
          id: "msg_user_real",
          conversationId: "conv_stream_1",
          role: "user",
          content: "Need the queue summary",
          parts: [{ type: "text", text: "Need the queue summary" }],
          createdAt: "2026-03-25T10:00:01.000Z",
          tokenEstimate: 4,
        },
      ],
    });
    runClaudeAgentLoopStreamMock.mockResolvedValue({
      model: "test-model",
      assistantText: "Queue summary ready",
      stopReason: "end_turn",
      toolRoundCount: 0,
      toolCalls: [],
      toolResults: [],
    });

    const response = await POST(
      createRouteRequest("http://localhost:3000/api/chat/stream", "POST", {
        messages: [{ role: "user", content: "Need the queue summary" }],
      }),
    );

    expect(response.status).toBe(200);
    expect(runClaudeAgentLoopStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Need the queue summary" }],
      }),
    );
  });

  it("injects media continuity context and narrows the tool manifest to reuse tools for later-turn combine requests", async () => {
    const builder = createBuilder();
    const getAllPreferencesMock = vi.fn().mockResolvedValue({});

    createSystemPromptBuilderMock.mockResolvedValueOnce(builder);
    getSessionUserMock.mockResolvedValueOnce({
      id: "usr_member_1",
      email: "member@example.com",
      name: "Member",
      roles: ["AUTHENTICATED"],
    });
    resolveUserIdMock.mockResolvedValueOnce({ userId: "usr_member_1", isAnonymous: false });
    getUserPreferencesDataMapperMock.mockReturnValueOnce({
      getAll: getAllPreferencesMock,
    });
    getAgentPlatformFacadeMock.mockReturnValueOnce({
      getExecutionSurface: () => ({
        registry: {
          getSchemasForRole: vi.fn(() => [
            {
              name: "generate_audio",
              description: "",
              input_schema: { type: "object", properties: {} },
            },
            {
              name: "generate_chart",
              description: "",
              input_schema: { type: "object", properties: {} },
            },
            {
              name: "list_conversation_media_assets",
              description: "",
              input_schema: { type: "object", properties: {} },
            },
            {
              name: "compose_media",
              description: "",
              input_schema: { type: "object", properties: {} },
            },
          ]),
          getDescriptor: vi.fn(() => null),
        },
        executor: vi.fn(),
      }),
    });
    runClaudeAgentLoopStreamMock.mockResolvedValueOnce({
      model: "test-model",
      assistantText: "I can combine those existing assets.",
      stopReason: "end_turn",
      toolRoundCount: 0,
      toolCalls: [],
      toolResults: [],
    });

    const response = await POST(
      createRouteRequest("http://localhost:3000/api/chat/stream", "POST", {
        messages: [{ role: "user", content: "combine them into a short video" }],
        mediaContinuityHandoff: {
          assets: [
            { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
            { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
          ],
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(getAllPreferencesMock).toHaveBeenCalledWith("usr_member_1");
    expect(builder.withSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "media_continuity_handoff",
        content: expect.stringContaining("uf_chart_1"),
      }),
    );
    expect(builder.withToolManifest).toHaveBeenCalledWith([
      { name: "list_conversation_media_assets", description: "" },
      { name: "compose_media", description: "" },
    ]);
    expect(runClaudeAgentLoopStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({ name: "list_conversation_media_assets" }),
          expect.objectContaining({ name: "compose_media" }),
        ],
      }),
    );
  });
});