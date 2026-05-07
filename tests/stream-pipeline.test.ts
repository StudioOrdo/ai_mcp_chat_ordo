import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearActiveStreamsForTests,
  getActiveStreamSnapshot,
  registerActiveStream,
} from "@/lib/chat/active-stream-registry";
import type { ContextWindowGuardReason } from "@/lib/chat/context-window";
import { SystemPromptBuilder } from "@/core/use-cases/SystemPromptBuilder";
import type { SelectedIntelligenceRuntime } from "@/lib/ai/providers/selected-intelligence-runtime";

function createContextWindowGuard(
  overrides: Partial<{
    status: "ok" | "warn" | "block";
    reasons: ContextWindowGuardReason[];
    rawMessageCount: number;
    rawCharacterCount: number;
    finalMessageCount: number;
    finalCharacterCount: number;
    warnMessageCount: number;
    warnCharacterCount: number;
    maxMessageCount: number;
    maxCharacterCount: number;
  }> = {},
) {
  return {
    status: "ok" as const,
    reasons: [],
    rawMessageCount: 1,
    rawCharacterCount: 5,
    finalMessageCount: 1,
    finalCharacterCount: 5,
    warnMessageCount: 32,
    warnCharacterCount: 64_000,
    maxMessageCount: 40,
    maxCharacterCount: 80_000,
    ...overrides,
  };
}

function createMockIntelligenceRuntime(): Pick<SelectedIntelligenceRuntime, "client" | "policy"> {
  return {
    client: { messages: { stream: vi.fn() } },
    policy: {
      provider: "anthropic",
      timeoutMs: 45_000,
      retryAttempts: 1,
      retryDelayMs: 0,
      modelCandidates: ["claude-test"],
    },
  } as unknown as Pick<SelectedIntelligenceRuntime, "client" | "policy">;
}

/* ------------------------------------------------------------------ */
/*  Mocks — shared across pipeline method tests                        */
/* ------------------------------------------------------------------ */

const getSessionUserMock = vi.fn();
const resolveUserIdMock = vi.fn();
const getSessionMock = vi.fn();
const resolveValidatedReferralVisitMock = vi.fn();
const attachValidatedVisitToConversationMock = vi.fn();

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  getSession: getSessionMock,
  resolveSessionAuthorizationRole: (user: { roles: string[]; realRoles?: string[] }) =>
    [...(user.realRoles ?? []), ...user.roles].includes("ADMIN") ? "ADMIN" : user.roles[0],
}));

vi.mock("@/lib/referrals/referral-visit", () => ({
  REFERRAL_VISIT_COOKIE_NAME: "lms_referral_visit",
  resolveValidatedReferralVisit: resolveValidatedReferralVisitMock,
}));

vi.mock("@/lib/referrals/referral-ledger", () => ({
  getReferralLedgerService: vi.fn(() => ({
    attachValidatedVisitToConversation: attachValidatedVisitToConversationMock,
  })),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));

const runClaudeAgentLoopStreamMock = vi.fn();
vi.mock("@/lib/chat/anthropic-stream", () => ({
  runClaudeAgentLoopStream: runClaudeAgentLoopStreamMock,
}));

vi.mock("@/lib/config/env", () => ({
  getAnthropicApiKey: () => "test-key",
}));

vi.mock("@/lib/chat/policy", () => ({
  createSystemPromptBuilder: vi.fn(() => ({
    withUserPreferences: vi.fn(),
    withToolManifest: vi.fn(),
    withConversationSummary: vi.fn(),
    withRoutingContext: vi.fn(),
    withSection: vi.fn(),
    build: () => "system prompt",
  })),
}));

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: () => ({
    registry: {
      getSchemasForRole: () => [],
      getDescriptor: () => null,
    },
    executor: vi.fn(),
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRuntimeServices: () => ({
    interactor: {
      ensureActive: vi.fn(async () => ({ id: "conv-test" })),
      appendMessage: vi.fn(),
      getForStreamingContext: vi.fn(),
      updateRoutingSnapshot: vi.fn(),
      recordToolUsed: vi.fn(),
      recordSessionResolution: vi.fn(),
    },
    routingAnalyzer: { analyze: vi.fn() },
    summarizationInteractor: { summarizeIfNeeded: vi.fn() },
    relationshipMemoryReader: { listActiveByConversation: vi.fn(async () => []) },
  }),
}));

vi.mock("@/lib/chat/context-window", () => ({
  buildContextWindow: vi.fn(() => ({
    contextMessages: [{ role: "user", content: "hello" }],
    summaryText: "",
    guard: createContextWindowGuard(),
  })),
  buildGuardedContextWindow: vi.fn((messages: Array<{ role: "user" | "assistant"; content: string }>) => ({
    contextMessages: messages,
    guard: createContextWindowGuard({
      rawMessageCount: messages.length,
      finalMessageCount: messages.length,
      rawCharacterCount: messages.reduce((sum, message) => sum + message.content.length, 0),
      finalCharacterCount: messages.reduce((sum, message) => sum + message.content.length, 0),
    }),
  })),
  buildContextWindowGuardPrompt: vi.fn(() => null),
}));

vi.mock("@/lib/chat/chat-turn", () => ({
  executeDirectChatTurn: vi.fn(async () => null),
}));

vi.mock("@/lib/chat/task-origin-handoff", () => ({
  normalizeTaskOriginHandoff: vi.fn(() => null),
  buildTaskOriginContextBlock: vi.fn(() => ""),
}));

vi.mock("@/adapters/UserFileDataMapper", () => ({
  UserFileDataMapper: class { },
}));

vi.mock("@/adapters/UserPreferencesDataMapper", () => ({
  UserPreferencesDataMapper: class {
    getAll = vi.fn(async () => ({}));
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/user-files", () => ({
  UserFileSystem: class {
    getById = vi.fn(async () => null);
    assignConversation = vi.fn();
  },
}));

vi.mock("@/core/entities/conversation-routing", () => ({
  createConversationRoutingSnapshot: () => ({}),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: () => ({
    createJob: vi.fn(),
    appendEvent: vi.fn(),
    findActiveJobByDedupeKey: vi.fn(),
  }),
  getJobStatusQuery: () => ({
    getJobSnapshot: vi.fn(),
    getUserJobSnapshot: vi.fn(),
    listConversationJobSnapshots: vi.fn(async () => []),
    listUserJobSnapshots: vi.fn(async () => []),
  }),
  getPromptProvenanceDataMapper: () => ({
    create: vi.fn(async () => ({ id: "pprov_pipeline_test" })),
    attachAssistantMessage: vi.fn(async () => undefined),
    findLatestByConversation: vi.fn(async () => null),
    findByConversationAndTurnId: vi.fn(async () => null),
    listByConversation: vi.fn(async () => []),
  }),
  getRelationshipMemoryRepository: () => ({
    listActiveByConversation: vi.fn(async () => []),
  }),
}));

vi.mock("@/lib/jobs/deferred-job-result", () => ({
  createDeferredJobResultPayload: vi.fn(),
  deferredJobResultToStreamEvent: vi.fn(),
  isDeferredJobResultPayload: vi.fn(() => false),
}));

vi.mock("@/lib/jobs/job-dedupe", () => ({
  buildDeferredJobDedupeKey: vi.fn(),
}));

vi.mock("@/lib/jobs/job-status-snapshots", () => ({
  jobStatusSnapshotToStreamEvent: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logEvent: vi.fn(),
  logDegradation: vi.fn(),
  logFailure: vi.fn(),
}));

vi.mock("@/lib/observability/reason-codes", () => ({
  REASON_CODES: {
    ROUTING_ANALYSIS_FAILED: "ROUTING_ANALYSIS_FAILED",
    TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
    MESSAGE_PERSIST_FAILED: "MESSAGE_PERSIST_FAILED",
    CONVERSATION_LOOKUP_FAILED: "CONVERSATION_LOOKUP_FAILED",
    UNKNOWN_ROUTE_ERROR: "UNKNOWN_ROUTE_ERROR",
  },
}));

vi.mock("@/lib/chat/message-attachments", () => ({
  buildMessageContextText: vi.fn(() => "ctx"),
}));

vi.mock("@/lib/chat/math-classifier", () => ({
  looksLikeMath: vi.fn(() => false),
}));

vi.mock("@/lib/chat/http-facade", () => ({
  errorJson: vi.fn((_ctx: unknown, msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status }),
  ),
  successText: vi.fn((_ctx: unknown, text: string) =>
    new Response(text, { status: 200 }),
  ),
  runRouteTemplate: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Spec 10 — Stream Route Decomposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearActiveStreamsForTests();
    resolveValidatedReferralVisitMock.mockReturnValue(null);
    attachValidatedVisitToConversationMock.mockResolvedValue(null);
  });

  function extractStreamId(chunk: string): string | null {
    return chunk.match(/"stream_id":"([^"]+)"/)?.[1] ?? null;
  }

  async function readStreamText(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let output = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      output += decoder.decode(value, { stream: true });
    }

    output += decoder.decode();
    return output;
  }

  // --- Pipeline class tests ---

  it("ChatStreamPipeline has all expected methods", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const expected = [
      "resolveSession",
      "validateAndParse",
      "rejectIfActiveStreamExists",
      "ensureConversation",
      "assignAttachments",
      "persistUserMessage",
      "prepareStreamContext",
      "prepareFallbackContext",
      "isSafePreparationFallback",
      "finalizePreparedPrompt",
      "maybeHandleSlashCommand",
      "checkMathShortCircuit",
      "createDeferredToolExecutor",
      "createStreamResponse",
    ];
    const proto = ChatStreamPipeline.prototype;
    for (const method of expected) {
      expect(typeof proto[method as keyof typeof proto]).toBe("function");
    }
  });

  it("resolveSession returns user from session resolver", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", roles: ["STAFF"] });
    resolveUserIdMock.mockResolvedValue({ userId: "u1", isAnonymous: false });

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const result = await pipeline.resolveSession();

    expect(result.user.id).toBe("u1");
    expect(result.role).toBe("STAFF");
    expect(result.userId).toBe("u1");
    expect(result.isAnonymous).toBe(false);
  });

  it("resolveSession runs inbound claim hooks around session resolution", async () => {
    const callOrder: string[] = [];
    getSessionUserMock.mockImplementation(async () => {
      callOrder.push("execute:getSessionUser");
      return { id: "u1", roles: ["STAFF"] };
    });
    resolveUserIdMock.mockResolvedValue({ userId: "u1", isAnonymous: false });

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline([
      {
        beforeInboundClaim(state) {
          callOrder.push(`before:${state.routeContext?.route ?? "none"}`);
        },
        afterInboundClaim(state) {
          callOrder.push(`after:${state.session.role}`);
        },
      },
    ]);

    await pipeline.resolveSession({ requestId: "r1", route: "/api/chat/stream", startedAt: Date.now() } as never);

    expect(callOrder).toEqual([
      "before:/api/chat/stream",
      "execute:getSessionUser",
      "after:STAFF",
    ]);
  });

  it("validateAndParse rejects invalid request bodies", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const fakeContext = { requestId: "r1", route: "/test" } as never;
    const result = pipeline.validateAndParse({ messages: "not-an-array" }, fakeContext);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("validateAndParse accepts valid request body", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const fakeContext = { requestId: "r1", route: "/test" } as never;
    const result = pipeline.validateAndParse(
      { messages: [{ role: "user", content: "hi" }] },
      fakeContext,
    );
    expect(result).not.toBeInstanceOf(Response);
    expect((result as { parsed: unknown }).parsed).toBeDefined();
  });

  it("validateAndParse rejects attachments with invalid file metadata", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const fakeContext = { requestId: "r1", route: "/test", startedAt: Date.now() } as never;
    const result = pipeline.validateAndParse(
      {
        messages: [{ role: "user", content: "hi" }],
        attachments: [{ assetId: "asset_1", fileName: "brief.txt", mimeType: "text/plain", fileSize: -1 }],
      },
      fakeContext,
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("rejectIfActiveStreamExists returns a 409 response for overlapping conversation streams", async () => {
    registerActiveStream({
      streamId: "stream_conflict",
      ownerUserId: "u1",
      conversationId: "conv_1",
      abortController: new AbortController(),
    });

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const response = pipeline.rejectIfActiveStreamExists(
      "u1",
      "conv_1",
      { requestId: "r1", route: "/test", startedAt: Date.now() } as never,
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(409);
  });

  it("createDeferredToolExecutor forwards the abort signal into inline tool execution context", async () => {
    const baseExecutor = vi.fn(async (_name: string, _input: Record<string, unknown>, context: { abortSignal?: AbortSignal }) => context.abortSignal);
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const abortController = new AbortController();

    const executor = await pipeline.createDeferredToolExecutor({
      conversationId: "conv_1",
      isAnonymous: false,
      registry: { getDescriptor: vi.fn(() => undefined) } as never,
      baseExecutor,
      context: {
        role: "STAFF",
        userId: "u1",
        conversationId: "conv_1",
      },
    });

    await expect(executor("inspect_runtime_context", {}, abortController.signal)).resolves.toBe(abortController.signal);
    expect(baseExecutor).toHaveBeenCalledWith(
      "inspect_runtime_context",
      {},
      expect.objectContaining({ abortSignal: abortController.signal }),
    );
  });

  it("createDeferredToolExecutor rejects immediately when the abort signal is already fired", async () => {
    const baseExecutor = vi.fn(async () => "unexpected");
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const abortController = new AbortController();
    abortController.abort("request_disconnected");

    const executor = await pipeline.createDeferredToolExecutor({
      conversationId: "conv_1",
      isAnonymous: false,
      registry: { getDescriptor: vi.fn(() => undefined) } as never,
      baseExecutor,
      context: {
        role: "STAFF",
        userId: "u1",
        conversationId: "conv_1",
      },
    });

    await expect(executor("inspect_runtime_context", {}, abortController.signal)).rejects.toMatchObject({
      name: "AbortError",
      message: "request_disconnected",
    });
    expect(baseExecutor).not.toHaveBeenCalled();
  });

  it("ensureConversation creates conversation and returns ID", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const mockServices = {
      interactor: {
        ensureActive: vi.fn(async () => ({ id: "conv-123" })),
      },
    };
    const fakeReq = { cookies: { get: () => undefined } } as never;
    const state = await pipeline.ensureConversation("u1", fakeReq, mockServices as never);
    expect(state.conversationId).toBe("conv-123");
  });

  it("ensureConversation attaches validated referral visits to the canonical ledger", async () => {
    resolveValidatedReferralVisitMock.mockReturnValue({
      visitId: "visit_123",
      code: "mentor-42",
      issuedAt: "2026-04-01T10:00:00.000Z",
      referrer: {
        userId: "usr_affiliate",
        code: "mentor-42",
        name: "Ada Lovelace",
        credential: "Founder",
      },
    });

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const mockServices = {
      interactor: {
        ensureActive: vi.fn(async () => ({ id: "conv-123" })),
      },
    };
    const fakeReq = { cookies: { get: () => ({ value: "signed-cookie" }) } } as never;

    await pipeline.ensureConversation("anon_123", fakeReq, mockServices as never);

    expect(mockServices.interactor.ensureActive).toHaveBeenCalledWith(
      "anon_123",
      { referralSource: "mentor-42" },
    );
    expect(attachValidatedVisitToConversationMock).toHaveBeenCalledWith({
      conversationId: "conv-123",
      userId: "anon_123",
      visit: expect.objectContaining({ code: "mentor-42", visitId: "visit_123" }),
    });
  });

  it("assignAttachments returns null for empty attachments", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const result = await pipeline.assignAttachments("u1", "conv1", []);
    expect(result).toBeNull();
  });

  it("prepareStreamContext appends a visible guard section while preserving summary injection", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const contextWindowModule = await import("@/lib/chat/context-window");
    const pipeline = new ChatStreamPipeline();
    const builder = {
      withConversationSummary: vi.fn(),
      withRoutingContext: vi.fn(),
      withSection: vi.fn(),
      build: vi.fn(() => "system prompt"),
      buildResult: vi.fn(async () => ({
        surface: "chat_stream",
        text: "system prompt",
        effectiveHash: "hash_stream_pipeline_primary",
        slotRefs: [],
        sections: [],
        warnings: [],
      })),
    };
    const interactor = {
      getForStreamingContext: vi.fn(async () => ({
        conversation: { routingSnapshot: { lane: "general" } },
        messages: [],
      })),
      updateRoutingSnapshot: vi.fn(async () => undefined),
    };
    const routingAnalyzer = {
      analyze: vi.fn(async () => ({ lane: "organization" })),
    };
    const relationshipMemoryReader = {
      listActiveByConversation: vi.fn(async () => []),
    };

    vi.mocked(contextWindowModule.buildContextWindow).mockReturnValueOnce({
      contextMessages: [{ role: "user", content: "hello" }],
      hasSummary: true,
      summaryText: "quoted summary",
      guard: createContextWindowGuard({
        status: "warn",
        reasons: ["message_count_near_limit"],
        rawMessageCount: 32,
        finalMessageCount: 32,
        rawCharacterCount: 1200,
        finalCharacterCount: 1200,
      }),
    });
    vi.mocked(contextWindowModule.buildContextWindowGuardPrompt).mockReturnValueOnce(
      "\n[Context window guard]\nKeep the answer tight.",
    );

    const result = await pipeline.prepareStreamContext(
      builder as never,
      interactor as never,
      routingAnalyzer as never,
      relationshipMemoryReader as never,
      "conv_1",
      "u1",
      [{ role: "user", content: "hello" }],
      "hello",
      "hello",
      null,
      null,
    );

    expect(builder.withConversationSummary).toHaveBeenCalledWith("quoted summary");
    expect(builder.withSection).toHaveBeenCalledWith({
      key: "context_window_guard",
      content: "\n[Context window guard]\nKeep the answer tight.",
      priority: 42,
    });
    expect(result.mode).toBe("primary");
    expect(result.guard.status).toBe("warn");
    expect(result.contextMessages).toEqual([{ role: "user", content: "hello" }]);
  });

  it("finalizePreparedPrompt runs request-assembly hooks around final builder assembly", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline([
      {
        beforeRequestAssembly(state) {
          state.builder.withSection({
            key: "hook_section",
            content: "\n[Hook Section]\nAdded by runtime hook.",
            priority: 12,
          });
        },
        afterRequestAssembly(state) {
          expect(state.mode).toBe("primary");
          expect(state.systemPrompt).toContain("[Hook Section]");
        },
      },
    ]);

    const baseBuilder = new SystemPromptBuilder();
    const builder = {
      withUserPreferences(prefs: Parameters<SystemPromptBuilder["withUserPreferences"]>[0]) {
        baseBuilder.withUserPreferences(prefs);
        return this;
      },
      withConversationSummary(summaryText: Parameters<SystemPromptBuilder["withConversationSummary"]>[0]) {
        baseBuilder.withConversationSummary(summaryText);
        return this;
      },
      withRoutingContext(snapshot: Parameters<SystemPromptBuilder["withRoutingContext"]>[0]) {
        baseBuilder.withRoutingContext(snapshot);
        return this;
      },
      withTrustedReferralContext(context: Parameters<SystemPromptBuilder["withTrustedReferralContext"]>[0]) {
        baseBuilder.withTrustedReferralContext(context);
        return this;
      },
      withToolManifest(schemas: Parameters<SystemPromptBuilder["withToolManifest"]>[0]) {
        baseBuilder.withToolManifest(schemas);
        return this;
      },
      withSection(section: Parameters<SystemPromptBuilder["withSection"]>[0]) {
        baseBuilder.withSection(section);
        return this;
      },
      async build() {
        return baseBuilder.build();
      },
      buildResult: vi.fn(async () => {
        return {
          surface: "chat_stream" as const,
          text: baseBuilder.build(),
          effectiveHash: "hash_stream_pipeline_hook",
          slotRefs: [],
          sections: [],
          warnings: [],
        };
      }),
    };
    const result = await pipeline.finalizePreparedPrompt({
      builder,
      preparedContext: {
        mode: "primary",
        contextMessages: [{ role: "user", content: "hello" }],
        guard: createContextWindowGuard(),
        routingSnapshot: { lane: "organization" } as never,
      },
      incomingMessages: [{ role: "user", content: "hello" }],
      latestUserText: "hello",
      latestUserContent: "hello",
      taskOriginHandoff: null,
      mediaContinuityHandoff: null,
      conversationId: "conv_1",
      userId: "u1",
    });

    expect(result.systemPrompt).toContain("[Hook Section]");
  });

  it("prepareFallbackContext applies the same guard logic to the fallback window", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const contextWindowModule = await import("@/lib/chat/context-window");
    const pipeline = new ChatStreamPipeline();
    const builder = {
      withRoutingContext: vi.fn(),
      withSection: vi.fn(),
      build: vi.fn(() => "fallback prompt"),
      buildResult: vi.fn(async () => ({
        surface: "chat_stream",
        text: "fallback prompt",
        effectiveHash: "hash_stream_pipeline_fallback",
        slotRefs: [],
        sections: [],
        warnings: [],
      })),
    };

    vi.mocked(contextWindowModule.buildGuardedContextWindow).mockReturnValueOnce({
      contextMessages: [{ role: "user", content: "ctx" }],
      guard: createContextWindowGuard({
        status: "warn",
        reasons: ["characters_trimmed"],
        rawCharacterCount: 90_000,
        finalCharacterCount: 79_000,
      }),
    });
    vi.mocked(contextWindowModule.buildContextWindowGuardPrompt).mockReturnValueOnce(
      "\n[Context window guard]\nOlder turns were trimmed.",
    );

    const result = await pipeline.prepareFallbackContext(
      builder as never,
      [{ role: "user", content: "short" }],
      "ctx",
      null,
      null,
    );

    expect(contextWindowModule.buildGuardedContextWindow).toHaveBeenCalledWith([
      { role: "user", content: "ctx" },
    ]);
    expect(builder.withSection).toHaveBeenCalledWith({
      key: "context_window_guard",
      content: "\n[Context window guard]\nOlder turns were trimmed.",
      priority: 42,
    });
    expect(result.mode).toBe("fallback");
    expect(result.contextMessages).toEqual([{ role: "user", content: "ctx" }]);
    expect(result.guard.status).toBe("warn");
  });

  it("maybeHandleSlashCommand short-circuits unsupported commands with a persisted assistant reply", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const interactor = {
      appendMessage: vi.fn(async () => undefined),
    };

    const response = await pipeline.maybeHandleSlashCommand({
      latestUserText: "/unknown",
      conversationId: "conv_1",
      userId: "u1",
      role: "ANONYMOUS",
      isAnonymous: true,
      interactor: interactor as never,
      summarizationInteractor: { summarizeIfNeeded: vi.fn(async () => undefined) } as never,
      jobStatusQuery: {
        getJobSnapshot: vi.fn(async () => null),
        getUserJobSnapshot: vi.fn(async () => null),
        listConversationJobSnapshots: vi.fn(async () => []),
        listUserJobSnapshots: vi.fn(async () => []),
      },
      context: { requestId: "r1", route: "/test", startedAt: Date.now() } as never,
    });

    expect(response).toBeInstanceOf(Response);
    expect(interactor.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv_1",
        role: "assistant",
        content: "Unsupported slash command \"/unknown\". Available commands: /clear, /compact, /export, /status.",
      }),
      "u1",
    );
    const body = await readStreamText(response as Response);
    expect(body).toContain('"conversation_id":"conv_1"');
    expect(body).toContain('Unsupported slash command \\\"/unknown\\\". Available commands: /clear, /compact, /export, /status.');
  });

  it("maybeHandleSlashCommand short-circuits an empty slash payload predictably", async () => {
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const interactor = {
      appendMessage: vi.fn(async () => undefined),
    };

    const response = await pipeline.maybeHandleSlashCommand({
      latestUserText: "/",
      conversationId: "conv_1",
      userId: "u1",
      role: "ANONYMOUS",
      isAnonymous: true,
      interactor: interactor as never,
      summarizationInteractor: { summarizeIfNeeded: vi.fn(async () => undefined) } as never,
      jobStatusQuery: {
        getJobSnapshot: vi.fn(async () => null),
        getUserJobSnapshot: vi.fn(async () => null),
        listConversationJobSnapshots: vi.fn(async () => []),
        listUserJobSnapshots: vi.fn(async () => []),
      },
      context: { requestId: "r1", route: "/test", startedAt: Date.now() } as never,
    });

    expect(response).toBeInstanceOf(Response);
    const body = await readStreamText(response as Response);
    expect(body).toContain('Enter a slash command after \\\"/\\\". Available commands: /clear, /compact, /export, /status.');
  });

  it("createStreamResponse returns Response with SSE content type", async () => {
    runClaudeAgentLoopStreamMock.mockImplementation(async ({ callbacks }: { callbacks: { onDelta: (text: string) => void } }) => {
      callbacks.onDelta("hello");
    });

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const res = pipeline.createStreamResponse({
      intelligenceRuntime: createMockIntelligenceRuntime(),
      context: { requestId: "r1", route: "/test" } as never,
      conversationId: "c1",
      interactor: {
        appendMessage: vi.fn(),
        recordToolUsed: vi.fn(async () => {}),
        recordSessionResolution: vi.fn(async () => {}),
      } as never,
      summarizationInteractor: {
        summarizeIfNeeded: vi.fn(async () => {}),
      } as never,
      role: "STAFF" as never,
      userId: "u1",
      systemPrompt: "sys",
      contextMessages: [{ role: "user" as const, content: "hi" }],
      tools: [],
      toolExecutor: vi.fn(),
    });

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("createStreamResponse runs turn-completion hooks after assistant persistence", async () => {
    runClaudeAgentLoopStreamMock.mockImplementation(async ({ callbacks }: { callbacks: { onDelta: (text: string) => void } }) => {
      callbacks.onDelta("hello");
    });

    const afterTurnCompletion = vi.fn();
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline([
      {
        afterTurnCompletion,
      },
    ]);

    const response = pipeline.createStreamResponse({
      intelligenceRuntime: createMockIntelligenceRuntime(),
      context: { requestId: "r1", route: "/test" } as never,
      conversationId: "c1",
      interactor: {
        appendMessage: vi.fn(async () => ({ id: "msg_assistant" })),
        recordToolUsed: vi.fn(async () => {}),
        recordSessionResolution: vi.fn(async () => {}),
      } as never,
      summarizationInteractor: {
        summarizeIfNeeded: vi.fn(async () => {}),
      } as never,
      role: "STAFF" as never,
      userId: "u1",
      systemPrompt: "sys",
      contextMessages: [{ role: "user" as const, content: "hi" }],
      tools: [],
      toolExecutor: vi.fn(),
    });

    await readStreamText(response);

    expect(afterTurnCompletion).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "c1",
      streamId: expect.any(String),
      status: "completed",
      persistedMessageId: "msg_assistant",
      assistantText: "hello",
    }));
  });

  it("registers an active stream while work is in flight and unregisters it after successful completion", async () => {
    const streamControl: { resolve: (() => void) | null } = { resolve: null };
    runClaudeAgentLoopStreamMock.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        streamControl.resolve = resolve;
      });
    });

    const appendMessage = vi.fn(async () => ({ id: "msg_assistant" }));
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const response = pipeline.createStreamResponse({
      intelligenceRuntime: createMockIntelligenceRuntime(),
      context: { requestId: "r1", route: "/test" } as never,
      conversationId: "c1",
      interactor: {
        appendMessage,
        recordToolUsed: vi.fn(async () => {}),
        recordSessionResolution: vi.fn(async () => {}),
      } as never,
      summarizationInteractor: {
        summarizeIfNeeded: vi.fn(async () => {}),
      } as never,
      role: "STAFF" as never,
      userId: "u1",
      systemPrompt: "sys",
      contextMessages: [{ role: "user" as const, content: "hi" }],
      tools: [],
      toolExecutor: vi.fn(),
    });

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const firstChunk = await reader!.read();
    const firstChunkText = new TextDecoder().decode(firstChunk.value);
    const streamId = extractStreamId(firstChunkText);

    expect(streamId).toBeTruthy();
    expect(getActiveStreamSnapshot(streamId!)).toMatchObject({
      ownerUserId: "u1",
      conversationId: "c1",
    });

    if (streamControl.resolve) {
      streamControl.resolve();
    }

    let remainingText = "";
    while (true) {
      const { done, value } = await reader!.read();
      if (done) {
        break;
      }
      remainingText += new TextDecoder().decode(value, { stream: true });
    }

    expect(appendMessage).toHaveBeenCalledTimes(1);
    expect(getActiveStreamSnapshot(streamId!)).toBeNull();
    expect(remainingText).toContain('"conversation_id":"c1"');
  });

  it("unregisters the active stream after an unexpected provider failure", async () => {
    runClaudeAgentLoopStreamMock.mockRejectedValue(new Error("provider exploded"));

    const appendMessage = vi.fn(async () => ({ id: "msg_lifecycle" }));
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const response = pipeline.createStreamResponse({
      intelligenceRuntime: createMockIntelligenceRuntime(),
      context: { requestId: "r1", route: "/test" } as never,
      conversationId: "c1",
      interactor: {
        appendMessage,
        recordToolUsed: vi.fn(async () => {}),
        recordSessionResolution: vi.fn(async () => {}),
        recordGenerationLifecycleEvent: vi.fn(async () => {}),
      } as never,
      summarizationInteractor: {
        summarizeIfNeeded: vi.fn(async () => {}),
      } as never,
      role: "STAFF" as never,
      userId: "u1",
      systemPrompt: "sys",
      contextMessages: [{ role: "user" as const, content: "hi" }],
      tools: [],
      toolExecutor: vi.fn(),
    });

    const body = await readStreamText(response);
    const streamId = extractStreamId(body);

    expect(streamId).toBeTruthy();
    expect(appendMessage).toHaveBeenCalledTimes(1);
    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "c1",
        role: "assistant",
        parts: expect.arrayContaining([
          expect.objectContaining({ type: "generation_status" }),
        ]),
      }),
      "u1",
      expect.objectContaining({ sourcePromptBindingId: undefined }),
    );
    expect(getActiveStreamSnapshot(streamId!)).toBeNull();
    expect(body).toContain('"type":"generation_interrupted"');
  });

  it("forwards request-signal aborts into the active stream lifecycle and cleanup path", async () => {
    const requestAbortController = new AbortController();
    runClaudeAgentLoopStreamMock.mockImplementation(async ({ signal }: { signal: AbortSignal }) => {
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error(String(signal.reason ?? "request_disconnected"));
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    });

    const appendMessage = vi.fn(async () => ({ id: "msg_lifecycle" }));
    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const response = pipeline.createStreamResponse({
      intelligenceRuntime: createMockIntelligenceRuntime(),
      context: { requestId: "r1", route: "/test" } as never,
      conversationId: "c1",
      interactor: {
        appendMessage,
        recordToolUsed: vi.fn(async () => {}),
        recordSessionResolution: vi.fn(async () => {}),
        recordGenerationLifecycleEvent: vi.fn(async () => {}),
      } as never,
      summarizationInteractor: {
        summarizeIfNeeded: vi.fn(async () => {}),
      } as never,
      role: "STAFF" as never,
      userId: "u1",
      systemPrompt: "sys",
      contextMessages: [{ role: "user" as const, content: "hi" }],
      tools: [],
      toolExecutor: vi.fn(),
      requestSignal: requestAbortController.signal,
    });

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const firstChunk = await reader!.read();
    const firstChunkText = new TextDecoder().decode(firstChunk.value);
    const streamId = extractStreamId(firstChunkText);
    expect(streamId).toBeTruthy();
    expect(getActiveStreamSnapshot(streamId!)).toMatchObject({ streamId: streamId! });

    requestAbortController.abort("request_disconnected");

    let remainingText = "";
    while (true) {
      const { done, value } = await reader!.read();
      if (done) {
        break;
      }
      remainingText += new TextDecoder().decode(value, { stream: true });
    }

    expect(appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "c1",
        role: "assistant",
        parts: expect.arrayContaining([
          expect.objectContaining({ type: "generation_status", reason: "request_disconnected" }),
        ]),
      }),
      "u1",
      expect.objectContaining({ sourcePromptBindingId: undefined }),
    );
    expect(getActiveStreamSnapshot(streamId!)).toBeNull();
    expect(remainingText).toContain('"type":"generation_interrupted"');
    expect(remainingText).toContain('"reason":"request_disconnected"');
  });

  // --- Structural tests ---

  it("route.ts stays thin enough to delegate behavior into the pipeline", () => {
    const routePath = join(process.cwd(), "src/app/api/chat/stream/route.ts");
    const content = readFileSync(routePath, "utf-8");
    const implementationLines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("import "))
      .length;

    expect(implementationLines).toBeLessThanOrEqual(140);
  });

  it("route.ts delegates orchestration to the extracted stream route handler", () => {
    const routePath = join(process.cwd(), "src/app/api/chat/stream/route.ts");
    const content = readFileSync(routePath, "utf-8");

    expect(content).toContain('executeChatStreamRoute');
    expect(content).not.toContain('createSystemPromptBuilder');
    expect(content).not.toContain('getToolComposition');
    expect(content).not.toContain('recordPromptTurnProvenance');
  });

  it("stream-pipeline.ts delegates stage logic to extracted stream helpers", () => {
    const pipelinePath = join(process.cwd(), "src/lib/chat/stream-pipeline.ts");
    const content = readFileSync(pipelinePath, "utf-8");

    expect(content).toContain('from "@/lib/chat/stream-intake"');
    expect(content).toContain('from "@/lib/chat/stream-preparation"');
    expect(content).toContain('from "@/lib/chat/stream-short-circuits"');
    expect(content).toContain('from "@/lib/chat/stream-execution"');
  });

  it("stream-pipeline.ts exists and exports ChatStreamPipeline", async () => {
    const mod = await import("@/lib/chat/stream-pipeline");
    expect(mod.ChatStreamPipeline).toBeDefined();
    expect(typeof mod.ChatStreamPipeline).toBe("function");
  });
});
