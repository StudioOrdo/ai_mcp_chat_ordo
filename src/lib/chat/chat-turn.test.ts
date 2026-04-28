import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeDirectChatTurn } from "./chat-turn";

const {
  buildMock,
  buildResultMock,
  getAllMock,
  createMessageMock,
  orchestrateChatTurnMock,
  logEventMock,
  getSchemasForRoleMock,
  getToolExecutorFactoryMock,
  withToolManifestMock,
} = vi.hoisted(() => ({
  buildMock: vi.fn(),
  buildResultMock: vi.fn(),
  getAllMock: vi.fn(),
  createMessageMock: vi.fn(),
  orchestrateChatTurnMock: vi.fn(),
  logEventMock: vi.fn(),
  getSchemasForRoleMock: vi.fn(),
  getToolExecutorFactoryMock: vi.fn(),
  withToolManifestMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: createMessageMock,
    };
  },
}));

vi.mock("@/lib/config/env", () => ({
  getAnthropicApiKey: vi.fn(() => "test-key"),
  getAnthropicRequestTimeoutMs: vi.fn(() => 10000),
  getAnthropicRequestRetryAttempts: vi.fn(() => 2),
  getAnthropicRequestRetryDelayMs: vi.fn(() => 150),
  getModelFallbacks: vi.fn(() => ["claude-haiku-4-5"]),
}));

vi.mock("@/lib/chat/policy", () => ({
  createSystemPromptBuilder: vi.fn(async () => ({
    withUserPreferences: vi.fn(),
    withToolManifest: withToolManifestMock,
    buildResult: buildResultMock,
    build: buildMock,
  })),
}));

vi.mock("@/adapters/UserPreferencesDataMapper", () => ({
  UserPreferencesDataMapper: class UserPreferencesDataMapper {
    getAll = getAllMock;
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/chat/orchestrator", () => ({
  orchestrateChatTurn: orchestrateChatTurnMock,
}));

vi.mock("@/lib/observability/logger", () => ({
  logEvent: logEventMock,
}));

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: vi.fn(() => ({
    getExecutionSurface: () => ({
      registry: {
        getSchemasForRole: getSchemasForRoleMock,
      },
      executor: getToolExecutorFactoryMock(),
    }),
  })),
}));

describe("executeDirectChatTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildMock.mockReturnValue("system prompt");
    buildResultMock.mockResolvedValue({
      surface: "direct_turn",
      text: "system prompt",
      effectiveHash: "hash_direct_turn",
      slotRefs: [],
      sections: [],
      warnings: [],
    });
    getAllMock.mockResolvedValue([]);
    getSchemasForRoleMock.mockReturnValue([]);
    getToolExecutorFactoryMock.mockReturnValue(vi.fn());
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: "hi" }],
    });
    orchestrateChatTurnMock.mockImplementation(async ({ provider }) => {
      await provider.createMessage({
        messages: [{ role: "user", content: "hello" }],
        toolChoice: { type: "auto" },
      });

      return "ok";
    });
  });

  it("logs provider resilience settings on successful provider calls", async () => {
    await executeDirectChatTurn({
      incomingMessages: [{ role: "user", content: "hello" }],
      user: { id: "usr_1", roles: ["ANONYMOUS"] },
      route: "/api/chat",
      requestId: "req_1",
    });

    expect(logEventMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          "info",
          "provider.attempt_start",
          expect.objectContaining({
            surface: "direct_turn",
            model: expect.any(String),
            attempt: 1,
          }),
        ],
        [
          "info",
          "provider.attempt_success",
          expect.objectContaining({
            surface: "direct_turn",
            model: expect.any(String),
            attempt: 1,
            durationMs: expect.any(Number),
          }),
        ],
      ]),
    );
  });

  it("adds the direct-turn tool manifest to the prompt builder", async () => {
    getSchemasForRoleMock.mockReturnValue([
      { name: "search_corpus", description: "Search the corpus.", input_schema: {} },
    ]);

    await executeDirectChatTurn({
      incomingMessages: [{ role: "user", content: "hello" }],
      user: { id: "usr_1", roles: ["ANONYMOUS"] },
      route: "/api/chat",
      requestId: "req_tools",
    });

    expect(withToolManifestMock).toHaveBeenCalledWith([
      { name: "search_corpus", description: "Search the corpus." },
    ]);
  });

  it("threads prompt runtime provenance into the tool execution context", async () => {
    const baseExecutor = vi.fn().mockResolvedValue({ ok: true });
    getToolExecutorFactoryMock.mockReturnValue(baseExecutor);
    orchestrateChatTurnMock.mockImplementationOnce(async ({ toolExecutor }) => {
      await toolExecutor("inspect_runtime_context", { includePrompt: true });
      return "ok";
    });

    await executeDirectChatTurn({
      incomingMessages: [{ role: "user", content: "hello" }],
      user: { id: "usr_1", roles: ["ANONYMOUS"] },
      route: "/api/chat",
      requestId: "req_prompt_runtime",
    });

    expect(baseExecutor).toHaveBeenCalledWith(
      "inspect_runtime_context",
      { includePrompt: true },
      expect.objectContaining({
        promptRuntime: expect.objectContaining({
          surface: "direct_turn",
          effectiveHash: "hash_direct_turn",
          text: "system prompt",
        }),
      }),
    );
  });

  it("logs provider resilience settings on failed provider calls", async () => {
    createMessageMock.mockReset();
    createMessageMock.mockRejectedValue(new Error("Provider request timed out."));

    await expect(executeDirectChatTurn({
      incomingMessages: [{ role: "user", content: "hello" }],
      user: { id: "usr_1", roles: ["ANONYMOUS"] },
      route: "/api/chat",
      requestId: "req_2",
    })).rejects.toThrow("Anthropic provider error: Provider request timed out.");

    expect(logEventMock.mock.calls).toEqual(
      expect.arrayContaining([
        [
          "info",
          "provider.attempt_start",
          expect.objectContaining({
            surface: "direct_turn",
            model: expect.any(String),
            attempt: 1,
          }),
        ],
        [
          "error",
          "provider.attempt_failure",
          expect.objectContaining({
            surface: "direct_turn",
            model: expect.any(String),
            attempt: 1,
            durationMs: expect.any(Number),
            error: "Anthropic provider error: Provider request timed out.",
            errorClassification: expect.any(String),
          }),
        ],
      ]),
    );
  });
});