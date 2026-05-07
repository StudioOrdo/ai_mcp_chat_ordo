import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeDirectChatTurn } from "./chat-turn";

const {
  buildMock,
  buildResultMock,
  getAllMock,
  createMessageMock,
  createSelectedIntelligenceRuntimeMock,
  orchestrateChatTurnMock,
  logEventMock,
  getSchemasForRoleMock,
  getPromptVisibleSchemasForRoleMock,
  getToolExecutorFactoryMock,
  withToolManifestMock,
} = vi.hoisted(() => ({
  buildMock: vi.fn(),
  buildResultMock: vi.fn(),
  getAllMock: vi.fn(),
  createMessageMock: vi.fn(),
  createSelectedIntelligenceRuntimeMock: vi.fn(),
  orchestrateChatTurnMock: vi.fn(),
  logEventMock: vi.fn(),
  getSchemasForRoleMock: vi.fn(),
  getPromptVisibleSchemasForRoleMock: vi.fn(),
  getToolExecutorFactoryMock: vi.fn(),
  withToolManifestMock: vi.fn(),
}));

vi.mock("@/lib/ai/providers/selected-intelligence-runtime", () => ({
  createSelectedIntelligenceRuntime: createSelectedIntelligenceRuntimeMock,
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
        getPromptVisibleSchemasForRole: getPromptVisibleSchemasForRoleMock,
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
    getPromptVisibleSchemasForRoleMock.mockReturnValue([]);
    getToolExecutorFactoryMock.mockReturnValue(vi.fn());
    createSelectedIntelligenceRuntimeMock.mockReturnValue({
      provider: "anthropic",
      client: {
        messages: {
          create: createMessageMock,
        },
      },
      model: "claude-haiku-4-5",
      policy: {
        provider: "anthropic",
        timeoutMs: 10000,
        retryAttempts: 2,
        retryDelayMs: 150,
        modelCandidates: ["claude-haiku-4-5"],
      },
    });
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
      { name: "inspect_runtime_context", description: "Inspect runtime.", input_schema: {} },
      { name: "search_corpus", description: "Search the corpus.", input_schema: {} },
    ]);
    getPromptVisibleSchemasForRoleMock.mockReturnValue([
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
    expect(getPromptVisibleSchemasForRoleMock).toHaveBeenCalledWith("ANONYMOUS", {
      mode: "default_chat",
    });
  });

  it("filters operation-backed tools out of direct-turn prompt exposure", async () => {
    getPromptVisibleSchemasForRoleMock.mockReturnValue([
      { name: "search_corpus", description: "Search the corpus.", input_schema: {} },
      { name: "create_appliance_backup", description: "Create backup.", input_schema: {} },
      { name: "list_appliance_backups", description: "List backups.", input_schema: {} },
    ]);

    await executeDirectChatTurn({
      incomingMessages: [{ role: "user", content: "hello" }],
      user: { id: "usr_admin", roles: ["ADMIN"] },
      route: "/api/chat",
      requestId: "req_tools_pruned",
    });

    expect(withToolManifestMock).toHaveBeenCalledWith([
      { name: "search_corpus", description: "Search the corpus." },
    ]);
  });

  it("rejects operation-backed direct turns before model or tool exposure", async () => {
    const reply = await executeDirectChatTurn({
      incomingMessages: [{ role: "user", content: "create an appliance backup now" }],
      user: { id: "usr_admin", roles: ["ADMIN"] },
      route: "/api/chat",
      requestId: "req_direct_operation",
    });

    expect(reply).toContain("conversation-backed operation");
    expect(createSelectedIntelligenceRuntimeMock).not.toHaveBeenCalled();
    expect(createMessageMock).not.toHaveBeenCalled();
    expect(orchestrateChatTurnMock).not.toHaveBeenCalled();
    expect(withToolManifestMock).not.toHaveBeenCalled();
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
    })).rejects.toThrow("Intelligence provider error: Provider request timed out.");

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
            error: "Intelligence provider error: Provider request timed out.",
            errorClassification: expect.any(String),
          }),
        ],
      ]),
    );
  });
});
