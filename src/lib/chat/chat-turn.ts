import type Anthropic from "@anthropic-ai/sdk";

import type { User } from "@/core/entities/user";
import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";

import { createSelectedIntelligenceRuntime } from "@/lib/ai/providers/selected-intelligence-runtime";
import { createSystemPromptBuilder } from "@/lib/chat/policy";
import {
  getPromptAssemblyReplayContext,
  type PromptRuntimeReplayContext,
  type PromptRuntimeResult,
} from "@/lib/chat/prompt-runtime";
import { orchestrateChatTurn } from "@/lib/chat/orchestrator";
import {
  getLatestUserMessage,
  toAnthropicMessages,
} from "@/lib/chat/validation";
import { createAnthropicProvider } from "@/lib/chat/anthropic-client";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { looksLikeMath } from "@/lib/chat/math-classifier";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";
import { resolveSessionAuthorizationRole } from "@/lib/auth";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import {
  filterOperationBackedPromptTools,
} from "@/lib/chat/tool-capability-routing";
import { DeterministicOperationIntentCompiler } from "@/lib/operations/operation-intent-compiler";
import { detectDirectTurnOperationIntent } from "@/lib/operations/operation-intent-ingress";

type ChatRequestUser = Pick<User, "id" | "roles" | "realRoles">;

interface ExecuteDirectChatTurnOptions {
  incomingMessages: Array<{ role: "user" | "assistant"; content: string }>;
  user: ChatRequestUser;
  route: string;
  requestId: string;
  onPromptBuilt?: (payload: {
    promptRuntime: PromptRuntimeResult;
    replayContext: PromptRuntimeReplayContext | null;
  }) => void | Promise<void>;
}

export async function executeDirectChatTurn({
  incomingMessages,
  user,
  route: _route,
  requestId: _requestId,
  onPromptBuilt,
}: ExecuteDirectChatTurnOptions): Promise<string> {
  const latestUserMessage = getLatestUserMessage(incomingMessages);
  const role = resolveSessionAuthorizationRole(user);
  const directOperationRejection = await detectDirectTurnOperationIntent({
    compiler: new DeterministicOperationIntentCompiler(),
    compilerInput: {
      conversationId: "direct_turn",
      originMessageId: null,
      userId: user.id,
      role,
      latestUserText: latestUserMessage,
      latestUserContent: latestUserMessage,
      routingSnapshot: createConversationRoutingSnapshot(),
      attachments: [],
      taskOriginHandoff: null,
      mediaContinuityHandoff: null,
      effectiveToolManifestVersion: null,
      availableToolNames: [],
      providerCapabilitySummary: {},
      gateSnapshot: {
        generatedAt: new Date().toISOString(),
        gates: [],
      },
      now: new Date().toISOString(),
    },
  });
  if (directOperationRejection) {
    return directOperationRejection;
  }

  const intelligenceRuntime = createSelectedIntelligenceRuntime();
  const conversation = toAnthropicMessages(incomingMessages);
  const builder = await createSystemPromptBuilder(role, { surface: "direct_turn" });

  if (!user.roles.includes("ANONYMOUS")) {
    const prefRepo = getUserPreferencesDataMapper();
    const userPrefs = await prefRepo.getAll(user.id);
    builder.withUserPreferences(userPrefs);
  }

  const { registry, executor } = getAgentPlatformFacade().getExecutionSurface();
  const tools = filterOperationBackedPromptTools(registry.getPromptVisibleSchemasForRole(role, {
    mode: role === "ADMIN" ? "operator_chat" : "default_chat",
  }) as Anthropic.Tool[]);
  builder.withToolManifest?.(tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
  })));
  const promptRuntime = await builder.buildResult();
  await onPromptBuilt?.({
    promptRuntime,
    replayContext: getPromptAssemblyReplayContext(builder),
  });
  const systemPrompt = promptRuntime.text;

  const toolContext: ToolExecutionContext = {
    role,
    userId: user.id,
    promptRuntime,
  };
  const toolExecutor = (name: string, input: Record<string, unknown>) =>
    executor(name, input, toolContext);

  const provider = createAnthropicProvider(intelligenceRuntime.client, {
    systemPrompt,
    tools,
    resilience: intelligenceRuntime.policy,
  });

  const toolChoice:
    | { type: "auto" }
    | { type: "tool"; name: "calculator" } = looksLikeMath(
    latestUserMessage,
  )
    ? { type: "tool", name: "calculator" }
    : { type: "auto" };

  return orchestrateChatTurn({
    provider,
    conversation,
    toolChoice,
    toolExecutor,
  });
}
