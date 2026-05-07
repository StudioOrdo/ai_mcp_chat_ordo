import type Anthropic from "@anthropic-ai/sdk";
import { createAbortTimeout } from "@/lib/chat/disposability";
import { CHAT_CONFIG } from "@/lib/chat/chat-config";
import {
  isModelNotFoundError,
  isTimeoutError,
  isTransientProviderError,
  toErrorMessage,
} from "@/lib/chat/provider-policy";
import type { ProviderResiliencePolicy } from "@/lib/chat/provider-policy";
import { ChatProviderError } from "@/lib/chat/provider-decorators";
import {
  createProviderRuntime,
  type ProviderAttemptAction,
} from "@/lib/chat/provider-runtime";

export interface StreamCallbacks {
  onDelta?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>, toolInvocationId: string) => void;
  onToolResult?: (name: string, result: unknown, toolInvocationId: string) => void;
}

export interface ClaudeAgentLoopToolCall {
  name: string;
  args: Record<string, unknown>;
  toolInvocationId: string;
}

export interface ClaudeAgentLoopToolResult {
  name: string;
  result: unknown;
  isError: boolean;
  toolInvocationId: string;
}

export interface ClaudeAgentLoopResult {
  model: string;
  assistantText: string;
  stopReason: string | null;
  toolRoundCount: number;
  toolCalls: ClaudeAgentLoopToolCall[];
  toolResults: ClaudeAgentLoopToolResult[];
}

const providerRuntime = createProviderRuntime();

function resolveAbortReason(signal?: AbortSignal): string {
  const reason = signal?.reason;
  if (typeof reason === "string" && reason.trim().length > 0) {
    return reason;
  }

  if (reason instanceof Error && reason.message.trim().length > 0) {
    return reason.message;
  }

  return "aborted";
}

function createAbortError(signal?: AbortSignal): Error {
  const error = new Error(resolveAbortReason(signal));
  error.name = "AbortError";
  return error;
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error
    && (error.name === "AbortError" || error.message.toLowerCase().includes("abort"));
}

function normalizeStreamProviderError(error: unknown): Error {
  return new ChatProviderError(
    `Stream provider error: ${toErrorMessage(error)}`,
    error,
  );
}

function resolveStreamErrorAction({
  error,
  attempt,
  retryAttempts,
  timeoutMs,
  completedRounds,
}: {
  error: unknown;
  attempt: number;
  retryAttempts: number;
  timeoutMs: number;
  completedRounds: number;
}): ProviderAttemptAction {
  if (isModelNotFoundError(error)) {
    return { type: "next-model" };
  }

  if (isTimeoutError(error) && completedRounds > 0) {
    return {
      type: "throw",
      error: new ChatProviderError(
        `Stream provider timed out after ${timeoutMs}ms (round ${completedRounds}).`,
        error,
      ),
    };
  }

  if (isTransientProviderError(error) && attempt < retryAttempts) {
    return { type: "retry" };
  }

  return { type: "throw", error: normalizeStreamProviderError(error) };
}

export async function runClaudeAgentLoopStream(options: {
  client: Anthropic;
  policy?: ProviderResiliencePolicy;
  messages: Anthropic.MessageParam[];
  callbacks: StreamCallbacks;
  maxToolRounds?: number;
  signal?: AbortSignal;
  systemPrompt: string;
  tools: Anthropic.Tool[];
  toolExecutor: (name: string, input: Record<string, unknown>, toolInvocationId: string) => Promise<unknown>;
  modelCandidates?: string[];
  retryAttempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}): Promise<ClaudeAgentLoopResult> {
  const {
    client,
    policy = providerRuntime.resolvePolicy("stream"),
    messages,
    callbacks,
    maxToolRounds = CHAT_CONFIG.maxToolRounds,
    signal,
    systemPrompt,
    tools,
    toolExecutor,
    modelCandidates = policy.modelCandidates,
    retryAttempts = policy.retryAttempts,
    retryDelayMs = policy.retryDelayMs,
    timeoutMs = policy.timeoutMs,
  } = options;
  const resolvedPolicy = {
    ...policy,
    modelCandidates,
    retryAttempts,
    retryDelayMs,
    timeoutMs,
  };

  const anthropicTools: Anthropic.Tool[] = (tools ?? []).map((t) => ({
    name: t.name,
    description: t.description || "",
    input_schema: t.input_schema || { type: "object", properties: {} },
  }));
  let activeModel: string | null = null;
  let conversation: Anthropic.MessageParam[] = [];
  let toolCalls: ClaudeAgentLoopToolCall[] = [];
  let toolResults: ClaudeAgentLoopToolResult[] = [];
  let assistantText = "";
  let stopReason: string | null = null;
  let round = 0;
  let completedRounds = 0;
  const executedToolResults = new Map<string, {
    resultBlock: Anthropic.Messages.ToolResultBlockParam;
    finalResult: unknown;
    isError: boolean;
  }>();

  function resetModelState(model: string): void {
    activeModel = model;
    conversation = [...messages];
    toolCalls = [];
    toolResults = [];
    assistantText = "";
    stopReason = null;
    round = 0;
    completedRounds = 0;
  }

  return providerRuntime.runWithResilience({
    surface: "stream",
    policy: resolvedPolicy,
    runAttempt: async ({ model }) => {
      if (activeModel !== model) {
        resetModelState(model);
      }

      while (round < maxToolRounds) {
        round++;
        if (signal?.aborted) {
          throw createAbortError(signal);
        }

        const timeout = createAbortTimeout(resolvedPolicy.timeoutMs);
        const requestSignal = signal
          ? AbortSignal.any([signal, timeout.controller.signal])
          : timeout.controller.signal;

        let stream: ReturnType<typeof client.messages.stream>;
        try {
          stream = client.messages.stream(
            {
              model,
              max_tokens: 2048,
              system: systemPrompt,
              messages: conversation,
              tools: anthropicTools,
            },
            { signal: requestSignal },
          );

          stream.on("text", (text: string) => {
            assistantText += text;
            callbacks.onDelta?.(text);
          });

          const response = await stream.finalMessage();
          stopReason = response.stop_reason;

          if (response.stop_reason !== "tool_use") {
            completedRounds++;
            timeout.clear();
            break;
          }

          const toolUseBlocks = response.content.filter(
            (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );

          if (toolUseBlocks.length === 0) {
            timeout.clear();
            stopReason = "tool_use_without_blocks";
            break;
          }

          conversation.push({ role: "assistant", content: response.content });

          const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

          for (const use of toolUseBlocks) {
            if (signal?.aborted) {
              throw createAbortError(signal);
            }

            const args = use.input as Record<string, unknown>;
            const toolInvocationId = use.id;

            const priorExecution = executedToolResults.get(toolInvocationId);
            let resultBlock = priorExecution?.resultBlock;
            let finalResult = priorExecution?.finalResult;
            let isError = priorExecution?.isError ?? false;

            if (!priorExecution) {
              toolCalls.push({ name: use.name, args, toolInvocationId });
              callbacks.onToolCall?.(use.name, args, toolInvocationId);

              try {
                const result = await toolExecutor(use.name, args, toolInvocationId);
                if (signal?.aborted) {
                  throw createAbortError(signal);
                }
                const content = typeof result === "string" ? result : JSON.stringify(result);
                resultBlock = { type: "tool_result", tool_use_id: use.id, content };
              } catch (error) {
                if (signal?.aborted || isAbortLikeError(error)) {
                  throw error;
                }

                isError = true;
                resultBlock = {
                  type: "tool_result",
                  tool_use_id: use.id,
                  content: error instanceof Error ? error.message : "Tool execution failed.",
                  is_error: true,
                };
              }

              finalResult = resultBlock.content;
              if (typeof resultBlock.content === "string") {
                try {
                  finalResult = JSON.parse(resultBlock.content);
                } catch {
                  // Leave non-JSON tool content as-is.
                }
              }

              executedToolResults.set(toolInvocationId, { resultBlock, finalResult, isError });
              callbacks.onToolResult?.(use.name, finalResult, toolInvocationId);
              toolResults.push({ name: use.name, result: finalResult, isError, toolInvocationId });
            }

            if (!resultBlock) {
              throw new Error(`Missing tool result block for ${use.name}.`);
            }

            toolResultContents.push(resultBlock);
          }

          conversation.push({ role: "user", content: toolResultContents });
          completedRounds++;
          timeout.clear();
        } catch (error) {
          timeout.clear();

          if (timeout.controller.signal.aborted && !signal?.aborted) {
            throw new ChatProviderError(
              `Provider request timed out after ${resolvedPolicy.timeoutMs}ms.`,
            );
          }

          throw error;
        }
      }

      if (stopReason === "tool_use" && round >= maxToolRounds) {
        stopReason = "max_tool_rounds_exhausted";
      }

      return {
        model,
        assistantText,
        stopReason,
        toolRoundCount: round,
        toolCalls,
        toolResults,
      };
    },
    handleError: ({ error, attempt, policy }): ProviderAttemptAction =>
      resolveStreamErrorAction({
        error,
        attempt,
        retryAttempts: policy.retryAttempts,
        timeoutMs: policy.timeoutMs,
        completedRounds,
      }),
    onExhausted: (lastError) =>
      new ChatProviderError(
        `Stream provider exhausted all models/retries: ${toErrorMessage(lastError)}`,
        lastError,
      ),
    onNoModels: () => new Error("No valid Anthropic model configured."),
  });
}
