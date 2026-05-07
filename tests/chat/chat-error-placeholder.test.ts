/**
 * QA tests for Bug 2B — error placeholder persistence on stream failure.
 *
 * When the streaming agent loop throws, the pipeline must persist an
 * assistant placeholder message so the conversation maintains
 * user/assistant alternation.
 *
 * Separate file from chat-timeout-and-corruption.test.ts because the
 * vi.mock on anthropic-stream would break the real-import tests there.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SelectedIntelligenceRuntime } from "@/lib/ai/providers/selected-intelligence-runtime";

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const appendMessageMock = vi.fn();
const recordToolUsedMock = vi.fn();
const summarizeIfNeededMock = vi.fn();
const runAgentMock = vi.fn();

function createContextWindowGuard(
  overrides: Partial<{
    status: "ok" | "warn" | "block";
    reasons: string[];
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

/* ------------------------------------------------------------------ */
/*  Module mocks                                                       */
/* ------------------------------------------------------------------ */

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/chat/anthropic-stream", () => ({
  runClaudeAgentLoopStream: (...args: unknown[]) => runAgentMock(...args),
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
    registry: { getSchemasForRole: () => [], getDescriptor: () => null },
    executor: vi.fn(),
  }),
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRuntimeServices: () => ({
    interactor: {
      ensureActive: vi.fn(async () => ({ id: "conv-test" })),
      appendMessage: appendMessageMock,
      getForStreamingContext: vi.fn(),
      updateRoutingSnapshot: vi.fn(),
      recordToolUsed: recordToolUsedMock,
    },
    routingAnalyzer: { analyze: vi.fn() },
    summarizationInteractor: { summarizeIfNeeded: summarizeIfNeededMock },
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
  UserFileDataMapper: class {},
}));

vi.mock("@/adapters/UserPreferencesDataMapper", () => ({
  UserPreferencesDataMapper: class {
    getAll = vi.fn(async () => ({}));
  },
}));

vi.mock("@/lib/db", () => ({ getDb: () => ({}) }));

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

vi.mock("@/lib/referrals/referral-visit", () => ({
  REFERRAL_VISIT_COOKIE_NAME: "lms_referral_visit",
  resolveValidatedReferralVisit: vi.fn(),
}));

vi.mock("@/lib/referrals/referral-ledger", () => ({
  getReferralLedgerService: vi.fn(() => ({
    attachValidatedVisitToConversation: vi.fn(),
  })),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */

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

function buildStreamOptions(overrides?: Record<string, unknown>) {
  return {
    intelligenceRuntime: createMockIntelligenceRuntime(),
    context: { requestId: "r1", route: "/test" } as never,
    conversationId: "conv_abc",
    interactor: {
      appendMessage: appendMessageMock,
      recordToolUsed: recordToolUsedMock,
    } as never,
    summarizationInteractor: {
      summarizeIfNeeded: summarizeIfNeededMock,
    } as never,
    role: "STAFF" as never,
    userId: "u1",
    systemPrompt: "sys",
    contextMessages: [{ role: "user" as const, content: "hi" }],
    tools: [],
    toolExecutor: vi.fn(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Bug 2B — error placeholder persistence on stream failure", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    appendMessageMock.mockResolvedValue(undefined);
    recordToolUsedMock.mockResolvedValue(undefined);
    summarizeIfNeededMock.mockResolvedValue(undefined);
  });

  it("persists a lifecycle placeholder when the stream throws before output", async () => {
    runAgentMock.mockRejectedValue(
      new Error("Provider request timed out after 45000ms."),
    );

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const res = pipeline.createStreamResponse(buildStreamOptions());

    // Consume the stream to trigger the error path
    const body = await res.text();

    // The interrupted assistant turn should still be persisted
    expect(appendMessageMock).toHaveBeenCalledTimes(1);
    const call = appendMessageMock.mock.calls[0];
    expect(call[0].conversationId).toBe("conv_abc");
    expect(call[0].role).toBe("assistant");
    expect(call[0].content).toBe("");
    expect(call[0].parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "generation_status",
          status: "interrupted",
          actor: "system",
          reason: "Provider request timed out after 45000ms.",
          partialContentRetained: false,
        }),
      ]),
    );

    // Stream should contain the lifecycle event reason
    expect(body).toContain("timed out");
  });

  it("placeholder uses partial assistantText when available", async () => {
    runAgentMock.mockImplementation(
      async ({
        callbacks,
      }: {
        callbacks: { onDelta: (t: string) => void };
      }) => {
        callbacks.onDelta("partial response so far");
        throw new Error("connection reset");
      },
    );

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const res = pipeline.createStreamResponse(
      buildStreamOptions({ conversationId: "conv_partial" }),
    );

    await res.text();

    expect(appendMessageMock).toHaveBeenCalledTimes(1);
    const call = appendMessageMock.mock.calls[0];
    // content should include the partial text, not the fallback placeholder
    expect(call[0].content).toBe("partial response so far");
    // parts should include both the text and the interrupted lifecycle marker
    expect(call[0].parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: "partial response so far",
        }),
        expect.objectContaining({
          type: "generation_status",
          status: "interrupted",
          actor: "system",
          reason: "connection reset",
          partialContentRetained: true,
        }),
      ]),
    );
  });

  it("stream still closes cleanly when placeholder persistence itself fails", async () => {
    runAgentMock.mockRejectedValue(new Error("API failure"));
    appendMessageMock.mockRejectedValue(new Error("DB write failed"));

    const { ChatStreamPipeline } = await import("@/lib/chat/stream-pipeline");
    const pipeline = new ChatStreamPipeline();
    const res = pipeline.createStreamResponse(
      buildStreamOptions({ conversationId: "conv_double_fail" }),
    );

    // Should NOT throw — stream closes gracefully even on double failure
    const body = await res.text();
    expect(body).toContain("API failure");
    // Persistence was attempted even though it failed
    expect(appendMessageMock).toHaveBeenCalledTimes(1);
  });
});
