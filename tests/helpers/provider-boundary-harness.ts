import type Anthropic from "@anthropic-ai/sdk";
import { vi } from "vitest";

import type {
  ClaudeAgentLoopResult,
  StreamCallbacks,
} from "@/lib/chat/anthropic-stream";

export type ProviderBoundaryStep =
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "tool";
      name: string;
      args: Record<string, unknown>;
    };

export interface ProviderBoundaryHarnessCall {
  request: {
    apiKey: string;
    messages: Anthropic.MessageParam[];
    systemPrompt: string;
    tools: Anthropic.Tool[];
    maxToolRounds?: number;
    signalProvided: boolean;
    signalAbortedAtStart: boolean;
  };
  toolCalls: Array<{ name: string; args: Record<string, unknown>; toolInvocationId: string }>;
  toolResults: Array<{ name: string; result: unknown; isError: boolean; toolInvocationId: string }>;
}

function resolveAbortReason(signal?: AbortSignal): string {
  if (typeof signal?.reason === "string" && signal.reason.trim().length > 0) {
    return signal.reason;
  }

  if (signal?.reason instanceof Error && signal.reason.message.trim().length > 0) {
    return signal.reason.message;
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

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError(signal);
  }
}

function normalizeToolResult(result: unknown): unknown {
  if (typeof result !== "string") {
    return result;
  }

  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

export function createProviderBoundaryHarness(options: {
  steps: ProviderBoundaryStep[];
  model?: string;
  stopReason?: string | null;
  toolRoundCount?: number;
}) {
  const calls: ProviderBoundaryHarnessCall[] = [];

  const invokeStream = vi.fn(async ({
    apiKey,
    messages,
    callbacks,
    maxToolRounds,
    signal,
    systemPrompt,
    tools,
    toolExecutor,
  }: {
    apiKey: string;
    messages: Anthropic.MessageParam[];
    callbacks: StreamCallbacks;
    maxToolRounds?: number;
    signal?: AbortSignal;
    systemPrompt: string;
    tools: Anthropic.Tool[];
    toolExecutor: (name: string, input: Record<string, unknown>) => Promise<unknown>;
  }): Promise<ClaudeAgentLoopResult> => {
    const call: ProviderBoundaryHarnessCall = {
      request: {
        apiKey,
        messages: [...messages],
        systemPrompt,
        tools: [...tools],
        maxToolRounds,
        signalProvided: signal !== undefined,
        signalAbortedAtStart: signal?.aborted ?? false,
      },
      toolCalls: [],
      toolResults: [],
    };
    calls.push(call);

    let assistantText = "";

    throwIfAborted(signal);

    let toolInvocationIndex = 0;

    for (const step of options.steps) {
      throwIfAborted(signal);

      if (step.type === "delta") {
        assistantText += step.text;
        callbacks.onDelta?.(step.text);
        continue;
      }

      const toolInvocationId = `test_tool_${toolInvocationIndex += 1}`;
      callbacks.onToolCall?.(step.name, step.args, toolInvocationId);
      call.toolCalls.push({ name: step.name, args: step.args, toolInvocationId });

      try {
        const result = await toolExecutor(step.name, step.args);
        throwIfAborted(signal);

        const normalizedResult = normalizeToolResult(result);
        callbacks.onToolResult?.(step.name, normalizedResult, toolInvocationId);
        call.toolResults.push({
          name: step.name,
          result: normalizedResult,
          isError: false,
          toolInvocationId,
        });
      } catch (error) {
        if (signal?.aborted || isAbortLikeError(error)) {
          throw error;
        }

        const failureResult = error instanceof Error
          ? error.message
          : "Tool execution failed.";
        callbacks.onToolResult?.(step.name, failureResult, toolInvocationId);
        call.toolResults.push({
          name: step.name,
          result: failureResult,
          isError: true,
          toolInvocationId,
        });
      }
    }

    const toolCallCount = call.toolCalls.length;

    return {
      model: options.model ?? "deterministic-test-model",
      assistantText,
      stopReason: options.stopReason ?? "end_turn",
      toolRoundCount: options.toolRoundCount ?? (toolCallCount > 0 ? 1 : 0),
      toolCalls: [...call.toolCalls],
      toolResults: [...call.toolResults],
    };
  });

  return {
    calls,
    invokeStream,
  };
}