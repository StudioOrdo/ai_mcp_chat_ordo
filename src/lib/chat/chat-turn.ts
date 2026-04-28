import Anthropic from "@anthropic-ai/sdk";

import type { RoleName, User } from "@/core/entities/user";
import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";

import { getAnthropicApiKey } from "@/lib/config/env";
import { createSystemPromptBuilder } from "@/lib/chat/policy";
import {
  getPromptAssemblyReplayContext,
  type PromptRuntimeReplayContext,
  type PromptRuntimeResult,
} from "@/lib/chat/prompt-runtime";
import { resolveProviderPolicy } from "@/lib/chat/provider-policy";
import { orchestrateChatTurn } from "@/lib/chat/orchestrator";
import {
  getLatestUserMessage,
  toAnthropicMessages,
} from "@/lib/chat/validation";
import { createAnthropicProvider } from "@/lib/chat/anthropic-client";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { looksLikeMath } from "@/lib/chat/math-classifier";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";

type ChatRequestUser = Pick<User, "id" | "roles">;

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
  const apiKey = getAnthropicApiKey();
  const conversation = toAnthropicMessages(incomingMessages);
  const role = user.roles[0] as RoleName;
  const builder = await createSystemPromptBuilder(role, { surface: "direct_turn" });

  if (!user.roles.includes("ANONYMOUS")) {
    const prefRepo = getUserPreferencesDataMapper();
    const userPrefs = await prefRepo.getAll(user.id);
    builder.withUserPreferences(userPrefs);
  }

  const { registry, executor } = getAgentPlatformFacade().getExecutionSurface();
  const tools = registry.getSchemasForRole(role) as Anthropic.Tool[];
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
  const resilience = resolveProviderPolicy();

  const toolContext: ToolExecutionContext = {
    role,
    userId: user.id,
    promptRuntime,
  };
  const toolExecutor = (name: string, input: Record<string, unknown>) =>
    executor(name, input, toolContext);

  const client = new Anthropic({ apiKey });
  const provider = createAnthropicProvider(client, {
    systemPrompt,
    tools,
    resilience,
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