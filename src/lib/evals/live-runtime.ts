import type Anthropic from "@anthropic-ai/sdk";

import type { RoleName } from "@/core/entities/user";
import { buildSystemPrompt } from "@/lib/chat/policy";
import type { PromptRuntimeResult } from "@/lib/chat/prompt-runtime";
import { getPromptRuntime } from "@/lib/chat/prompt-runtime";
import { runClaudeAgentLoopStream, type ClaudeAgentLoopResult } from "@/lib/chat/anthropic-stream";
import { ProviderClientFactory } from "@/lib/ai/providers/provider-client-factory";
import { resolveProviderPolicy } from "@/lib/chat/provider-policy";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { CurrentPageSnapshot } from "@/lib/chat/current-page-context";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";

export interface LiveEvalRuntimeRequest {
  apiKey: string;
  role: RoleName;
  userId: string;
  messages: Anthropic.MessageParam[];
  currentPathname?: string;
  currentPageSnapshot?: CurrentPageSnapshot;
  maxToolRounds?: number;
  signal?: AbortSignal;
  systemPrompt?: string;
  promptRuntime?: PromptRuntimeResult | null;
  tools?: Anthropic.Tool[];
  toolExecutor?: (name: string, input: Record<string, unknown>, toolInvocationId: string) => Promise<unknown>;
  invokeStream?: typeof runClaudeAgentLoopStream;
}

export interface LiveEvalRuntimeResult extends ClaudeAgentLoopResult {
  systemPrompt: string;
  toolCount: number;
}

export async function executeLiveEvalRuntime(
  request: LiveEvalRuntimeRequest,
): Promise<LiveEvalRuntimeResult> {
  const { registry, executor } = getAgentPlatformFacade().getExecutionSurface();
  let promptRuntime = request.promptRuntime ?? null;
  let systemPrompt = promptRuntime?.text ?? request.systemPrompt;

  if (!systemPrompt) {
    promptRuntime = await getPromptRuntime().build({
      surface: "live_eval",
      role: request.role,
      currentPathname: request.currentPathname,
      currentPageSnapshot: request.currentPageSnapshot,
    });
    systemPrompt = promptRuntime.text;
  }

  if (!systemPrompt) {
    systemPrompt = await buildSystemPrompt(request.role, {
      surface: "live_eval",
      currentPathname: request.currentPathname,
      currentPageSnapshot: request.currentPageSnapshot,
    });
  }

  const tools = request.tools ?? (registry.getPromptVisibleSchemasForRole(request.role, {
    mode: request.role === "ADMIN" ? "operator_chat" : "default_chat",
  }) as Anthropic.Tool[]);
  const execContext: ToolExecutionContext = {
    role: request.role,
    userId: request.userId,
    currentPathname: request.currentPathname,
    currentPageSnapshot: request.currentPageSnapshot,
    ...(promptRuntime ? { promptRuntime } : {}),
  };
  const toolExecutor = request.toolExecutor
    ?? ((name: string, input: Record<string, unknown>) => executor(name, input, execContext));
  const invokeStream = request.invokeStream ?? runClaudeAgentLoopStream;
  const client = request.invokeStream
    ? ({ messages: { stream: () => { throw new Error("Injected live eval stream did not use the SDK client."); } } } as never)
    : ProviderClientFactory.createAnthropicCompatibleClient({
      provider: "anthropic",
      apiKey: request.apiKey,
      baseUrl: null,
    });

  const result = await invokeStream({
    client,
    policy: resolveProviderPolicy(),
    messages: request.messages,
    callbacks: {},
    maxToolRounds: request.maxToolRounds,
    signal: request.signal,
    systemPrompt,
    tools,
    toolExecutor,
  });

  return {
    ...result,
    systemPrompt,
    toolCount: tools.length,
  };
}
