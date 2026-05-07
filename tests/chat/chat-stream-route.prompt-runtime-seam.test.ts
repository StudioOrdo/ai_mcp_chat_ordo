import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/stream/route";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { createInspectRuntimeContextTool } from "@/core/use-cases/tools/inspect-runtime-context.tool";
import { clearActiveStreamsForTests } from "@/lib/chat/active-stream-registry";
import {
  createReferralVisitCookieValue,
  REFERRAL_VISIT_COOKIE_NAME,
  resolveValidatedReferralVisit,
} from "@/lib/referrals/referral-visit";

import { createStreamRouteRequest } from "../helpers/chat-stream-route-fixture";
import { createProviderBoundaryHarness } from "../helpers/provider-boundary-harness";

const {
  getAnthropicApiKeyMock,
  getSessionUserMock,
  resolveUserIdMock,
  createConversationRuntimeServicesMock,
  getToolCompositionMock,
  runClaudeAgentLoopStreamMock,
  getJobQueueRepositoryMock,
  getJobStatusQueryMock,
  getActiveReferralSnapshotMock,
  getTrustedReferrerContextMock,
  attachValidatedVisitToConversationMock,
  createSelectedIntelligenceRuntimeMock,
} = vi.hoisted(() => ({
  getAnthropicApiKeyMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  resolveUserIdMock: vi.fn(),
  createConversationRuntimeServicesMock: vi.fn(),
  getToolCompositionMock: vi.fn(),
  runClaudeAgentLoopStreamMock: vi.fn(),
  getJobQueueRepositoryMock: vi.fn(),
  getJobStatusQueryMock: vi.fn(),
  getActiveReferralSnapshotMock: vi.fn(),
  getTrustedReferrerContextMock: vi.fn(),
  attachValidatedVisitToConversationMock: vi.fn(),
  createSelectedIntelligenceRuntimeMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/config/env", () => ({
  getAnthropicApiKey: getAnthropicApiKeyMock,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  resolveSessionAuthorizationRole: (user: { roles: string[]; realRoles?: string[] }) =>
    [...(user.realRoles ?? []), ...user.roles].includes("ADMIN") ? "ADMIN" : user.roles[0],
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  createConversationRuntimeServices: createConversationRuntimeServicesMock,
}));

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: getToolCompositionMock,
}));

vi.mock("@/lib/platform/agent-platform-facade-root", () => ({
  getAgentPlatformFacade: () => ({
    getExecutionSurface: getToolCompositionMock,
  }),
}));

vi.mock("@/lib/chat/anthropic-stream", () => ({
  runClaudeAgentLoopStream: runClaudeAgentLoopStreamMock,
}));

vi.mock("@/lib/ai/providers/selected-intelligence-runtime", () => ({
  createSelectedIntelligenceRuntime: createSelectedIntelligenceRuntimeMock,
}));

vi.mock("@/adapters/SystemPromptDataMapper", () => ({
  SystemPromptDataMapper: class SystemPromptDataMapper {
    async getActive() {
      return null;
    }
  },
}));

vi.mock("@/adapters/UserPreferencesDataMapper", () => ({
  UserPreferencesDataMapper: class UserPreferencesDataMapper {
    async getAll() {
      return [];
    }
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/referrals/referral-resolver", () => ({
  getActiveReferralSnapshot: getActiveReferralSnapshotMock,
}));

vi.mock("@/lib/referrals/referral-ledger", () => ({
  getReferralLedgerService: vi.fn(() => ({
    getTrustedReferrerContext: getTrustedReferrerContextMock,
    attachValidatedVisitToConversation: attachValidatedVisitToConversationMock,
  })),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getJobQueueRepository: getJobQueueRepositoryMock,
  getJobStatusQuery: getJobStatusQueryMock,
  getSystemPromptDataMapper: () => ({
    getActive: vi.fn(async () => null),
  }),
  getUserPreferencesDataMapper: () => ({
    getAll: vi.fn(async () => []),
  }),
  getPromptProvenanceDataMapper: () => ({
    create: vi.fn(async () => ({ id: "pprov_route_test" })),
    attachAssistantMessage: vi.fn(async () => undefined),
    findLatestByConversation: vi.fn(async () => null),
    findByConversationAndTurnId: vi.fn(async () => null),
    listByConversation: vi.fn(async () => []),
  }),
  getPromptBindingRepository: () => ({
    record: vi.fn(async (binding) => binding),
    findById: vi.fn(async () => null),
    findByTarget: vi.fn(async () => null),
    listByConversation: vi.fn(async () => []),
    listBySourcePromptBinding: vi.fn(async () => []),
  }),
  getOperationRepository: vi.fn(() => {
    let latestSnapshot: {
      operation: Record<string, unknown>;
      steps: unknown[];
      actions: unknown[];
      events: unknown[];
      artifacts: unknown[];
    } | null = null;
    const createSnapshot = (input: Record<string, unknown>) => {
      const now = String(input.now ?? "2026-03-25T03:00:00.000Z");
      latestSnapshot = {
        operation: {
          id: input.id,
          kind: input.kind,
          revision: 1,
          title: input.title,
          status: input.status ?? "draft",
          riskLevel: input.riskLevel ?? "medium",
          conversationId: input.conversationId ?? null,
          originMessageId: input.originMessageId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          createdByRole: input.createdByRole ?? "ADMIN",
          visibility: input.visibility ?? "conversation",
          currentStepId: input.currentStepId ?? null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
          summary: input.summary ?? null,
          input: input.input ?? {},
          result: input.result ?? null,
          error: input.error ?? null,
        },
        steps: [],
        actions: [],
        events: [],
        artifacts: [],
      };
      return latestSnapshot;
    };

    return {
      createOperation: vi.fn(async (input: Record<string, unknown>) => createSnapshot(input)),
      replaceActions: vi.fn(async ({ actions }: { actions: unknown[] }) => ({
        ...(latestSnapshot ?? createSnapshot({
          id: "op_test",
          kind: "help_flow",
          title: "Test Operation",
          createdByRole: "ADMIN",
        })),
        actions,
      })),
      findOperationById: vi.fn(async () => null),
      listOperationsByConversation: vi.fn(async () => []),
      listAvailableActions: vi.fn(async () => []),
    };
  }),
}));

function parseSsePayloads(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
}

function registerStaticTool(
  registry: ToolRegistry,
  descriptor: Pick<ToolDescriptor, "name" | "roles" | "category"> & {
    description: string;
  },
): void {
  registry.register({
    name: descriptor.name,
    roles: descriptor.roles,
    category: descriptor.category,
    schema: {
      description: descriptor.description,
      input_schema: {
        type: "object",
        properties: {},
      },
    },
    command: {
      execute: async () => ({ ok: true }),
    },
  });
}

describe("chat stream route prompt-runtime seam", () => {
  let providerHarness: ReturnType<typeof createProviderBoundaryHarness>;
  let ensureActiveMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearActiveStreamsForTests();

    getAnthropicApiKeyMock.mockReturnValue("test-key");
    createSelectedIntelligenceRuntimeMock.mockReturnValue({
      provider: "anthropic",
      client: {},
      model: "claude-haiku-4-5",
      baseUrl: null,
      policy: {
        provider: "anthropic",
        timeoutMs: 10000,
        retryAttempts: 1,
        retryDelayMs: 0,
        modelCandidates: ["claude-haiku-4-5"],
      },
      metadata: {
        providerSource: "default",
        apiKeySource: "env",
        apiKeyConfigured: true,
        modelSource: "default",
        baseUrlSource: "default",
      },
    });
    getSessionUserMock.mockResolvedValue({
      id: "usr_admin",
      email: "admin@example.com",
      name: "Admin",
      roles: ["ADMIN"],
    });
    resolveUserIdMock.mockResolvedValue({
      userId: "usr_admin",
      isAnonymous: false,
    });
    getActiveReferralSnapshotMock.mockReturnValue({
      userId: "usr_affiliate",
      code: "mentor-42",
      name: "Ada Lovelace",
      credential: "Founder",
    });

    const appendMessageMock = vi.fn(async (message: {
      conversationId: string;
      role: "user" | "assistant" | "system";
      content: string;
      parts: unknown[];
    }) => ({
      id: `${message.role}_message_${Math.random()}`,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      parts: message.parts,
      createdAt: "2026-04-02T10:00:00.000Z",
      tokenEstimate: 1,
    }));

    ensureActiveMock = vi.fn(async () => ({ id: "conv_stream_seam" }));

    createConversationRuntimeServicesMock.mockReturnValue({
      interactor: {
        ensureActive: ensureActiveMock,
        appendMessage: appendMessageMock,
        getForStreamingContext: vi.fn(async () => ({
          conversation: {
            routingSnapshot: createConversationRoutingSnapshot(),
          },
          messages: [
            {
              id: "msg_user_1",
              conversationId: "conv_stream_seam",
              role: "user",
              content: "Help my company redesign an internal workflow.",
              parts: [{ type: "text", text: "Help my company redesign an internal workflow." }],
              createdAt: "2026-04-02T09:59:00.000Z",
              tokenEstimate: 12,
            },
          ],
        })),
        updateRoutingSnapshot: vi.fn(async () => undefined),
        recordToolUsed: vi.fn(async () => undefined),
        recordToolDenied: vi.fn(async () => undefined),
        recordSessionResolution: vi.fn(async () => undefined),
        recordGenerationLifecycleEvent: vi.fn(async () => undefined),
      },
      routingAnalyzer: {
        analyze: vi.fn(async () =>
          createConversationRoutingSnapshot({
            lane: "organization",
            confidence: 0.91,
            recommendedNextStep: "Map the workflow constraints.",
            detectedNeedSummary: "Signals point to an organizational workflow need.",
            lastAnalyzedAt: "2026-04-02T09:59:00.000Z",
          }),
        ),
      },
      summarizationInteractor: {
        summarizeIfNeeded: vi.fn(async () => undefined),
      },
      relationshipMemoryReader: {
        listActiveByConversation: vi.fn(async () => []),
        listActiveByUser: vi.fn(async () => []),
        findById: vi.fn(async () => null),
      },
    });

    getTrustedReferrerContextMock.mockResolvedValue({
      referralId: "ref_1",
      referralCode: "mentor-42",
      referrerUserId: "usr_affiliate",
      referrerName: "Ada Lovelace",
      referrerCredential: "Founder",
      referredUserId: null,
      conversationId: "conv_stream_seam",
      status: "visited",
      creditStatus: "tracked",
    });
    attachValidatedVisitToConversationMock.mockResolvedValue(undefined);

    getJobQueueRepositoryMock.mockReturnValue({
      findActiveJobByDedupeKey: vi.fn(async () => null),
      createJob: vi.fn(),
      appendEvent: vi.fn(),
    });
    getJobStatusQueryMock.mockReturnValue({
      getJobSnapshot: vi.fn(async () => null),
      getUserJobSnapshot: vi.fn(async () => null),
      listConversationJobSnapshots: vi.fn(async () => []),
      listUserJobSnapshots: vi.fn(async () => []),
    });

    const registry = new ToolRegistry();
    registry.register(createInspectRuntimeContextTool(registry));
    registerStaticTool(registry, {
      name: "admin_search",
      description: "Search admin entities.",
      roles: ["ADMIN"],
      category: "system",
    });
    registerStaticTool(registry, {
      name: "generate_audio",
      description: "Generate audio output.",
      roles: ["ADMIN"],
      category: "content",
    });
    registerStaticTool(registry, {
      name: "navigate_to_page",
      description: "Navigate to a validated route.",
      roles: ["ADMIN"],
      category: "ui",
    });
    registerStaticTool(registry, {
      name: "search_corpus",
      description: "Search the corpus.",
      roles: ["ADMIN"],
      category: "system",
    });

    getToolCompositionMock.mockReturnValue({
      registry,
      executor: (name: string, input: Record<string, unknown>, context: Parameters<ToolRegistry["execute"]>[2]) =>
        registry.execute(name, input, context),
    });

    providerHarness = createProviderBoundaryHarness({
      steps: [
        {
          type: "tool",
          name: "inspect_runtime_context",
          args: { includePrompt: true, includeTools: true },
        },
        {
          type: "delta",
          text: "Prompt provenance inspected.",
        },
      ],
    });
    runClaudeAgentLoopStreamMock.mockImplementation(providerHarness.invokeStream);
  });

  afterEach(() => {
    clearActiveStreamsForTests();
  });

  it("threads the final post-tool-selection prompt runtime through governed runtime inspection", async () => {
    const referralCookieValue = createReferralVisitCookieValue("mentor-42");
    const validatedVisit = resolveValidatedReferralVisit(referralCookieValue);

    expect(validatedVisit).toEqual(
      expect.objectContaining({
        code: "mentor-42",
        referrer: expect.objectContaining({
          userId: "usr_affiliate",
          name: "Ada Lovelace",
          credential: "Founder",
        }),
      }),
    );

    const response = await POST(
      createStreamRouteRequest({
        messages: [{ role: "user", content: "Help my company redesign an internal workflow." }],
      }, {
        cookies: {
          [REFERRAL_VISIT_COOKIE_NAME]: referralCookieValue,
        },
      }) as never,
    );

    expect(response.status).toBe(200);

    const body = await response.text();
    const payloads = parseSsePayloads(body);
    const providerCall = providerHarness.calls[0];
    const toolResultPayload = payloads.find((payload) => "tool_result" in payload) as {
      tool_result: {
        name: string;
        result: {
          availableTools: Array<{ name: string }>;
          promptRuntime: {
            surface: string;
            effectiveHash: string;
            sections: Array<{ key: string }>;
            redacted: boolean;
          } | null;
        };
      };
    } | undefined;

    expect(ensureActiveMock).toHaveBeenCalledWith("usr_admin", {
      referralSource: "mentor-42",
    });
    expect(attachValidatedVisitToConversationMock).toHaveBeenCalledWith({
      conversationId: "conv_stream_seam",
      userId: "usr_admin",
      visit: validatedVisit,
    });

    expect(providerCall?.request.tools.map((tool) => tool.name)).toEqual([
      "admin_search",
      "inspect_runtime_context",
      "navigate_to_page",
      "search_corpus",
    ]);
    expect(providerCall?.request.messages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "Help my company redesign an internal workflow.",
      }),
    ]);
    expect(providerCall?.request.signalProvided).toBe(true);
    expect(providerCall?.request.signalAbortedAtStart).toBe(false);
    expect(providerCall?.request.systemPrompt).toContain("**admin_search**");
    expect(providerCall?.request.systemPrompt).toContain("**inspect_runtime_context**");
    expect(providerCall?.request.systemPrompt).toContain("**navigate_to_page**");
    expect(providerCall?.request.systemPrompt).toContain("**search_corpus**");
    expect(providerCall?.request.systemPrompt).not.toContain("**generate_audio**");

    expect(toolResultPayload?.tool_result.name).toBe("inspect_runtime_context");
    expect(toolResultPayload?.tool_result.result.availableTools.map((tool) => tool.name)).toEqual([
      "admin_search",
      "inspect_runtime_context",
      "navigate_to_page",
      "search_corpus",
    ]);
    expect(toolResultPayload?.tool_result.result.promptRuntime).toEqual(
      expect.objectContaining({
        surface: "chat_stream",
        effectiveHash: expect.any(String),
        redacted: true,
      }),
    );
    expect(toolResultPayload?.tool_result.result.promptRuntime?.sections.map((section) => section.key)).toEqual(
      expect.arrayContaining(["tool_manifest", "routing", "trusted_referral"]),
    );
  });
});
