import type Anthropic from "@anthropic-ai/sdk";
import type { ToolChoice } from "@/lib/chat/types";
import { ChatProviderError } from "@/lib/chat/provider-decorators";
import {
  isModelNotFoundError,
  isTimeoutError,
  isTransientProviderError,
  toErrorMessage,
} from "@/lib/chat/provider-policy";
import type { ProviderResiliencePolicy } from "@/lib/chat/provider-policy";
import {
  createProviderRuntime,
  type ProviderAttemptAction,
} from "@/lib/chat/provider-runtime";

export type ChatProvider = {
  createMessage(args: {
    messages: Anthropic.MessageParam[];
    toolChoice: ToolChoice;
  }): Promise<Anthropic.Message>;
};

export type AnthropicResilienceOptions = Partial<ProviderResiliencePolicy>;

const providerRuntime = createProviderRuntime();

type ErrorHandlingContext = {
  error: unknown;
  attempt: number;
  retryAttempts: number;
};

type ErrorHandlingAction =
  | { type: "next-model" }
  | { type: "retry" }
  | { type: "throw"; error: Error };

type ErrorHandler = (
  context: ErrorHandlingContext,
) => ErrorHandlingAction | null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Provider request timed out.")),
        timeoutMs,
      );
    }),
  ]);
}

function normalizeProviderError(error: unknown): Error {
  return new ChatProviderError(
    `Intelligence provider error: ${toErrorMessage(error)}`,
    error,
  );
}

const modelNotFoundHandler: ErrorHandler = ({ error }) => {
  if (isModelNotFoundError(error)) {
    return { type: "next-model" };
  }

  return null;
};

const transientRetryHandler: ErrorHandler = ({
  error,
  attempt,
  retryAttempts,
}) => {
  // Timeouts with the same payload are not transient — the request
  // will always be slow.  Fail fast instead of amplifying the wait.
  if (isTimeoutError(error)) {
    return null;
  }

  if (isTransientProviderError(error) && attempt < retryAttempts) {
    return { type: "retry" };
  }

  return null;
};

const defaultThrowHandler: ErrorHandler = ({ error }) => {
  return { type: "throw", error: normalizeProviderError(error) };
};

const errorHandlerChain: ErrorHandler[] = [
  modelNotFoundHandler,
  transientRetryHandler,
  defaultThrowHandler,
];

function resolveErrorAction(
  context: ErrorHandlingContext,
): ErrorHandlingAction {
  for (const handler of errorHandlerChain) {
    const action = handler(context);
    if (action) {
      return action;
    }
  }

  return { type: "throw", error: normalizeProviderError(context.error) };
}

export async function createMessageWithModelFallback({
  client,
  messages,
  toolChoice,
  options,
  systemPrompt,
  tools,
}: {
  client: Anthropic;
  messages: Anthropic.MessageParam[];
  toolChoice: ToolChoice;
  options?: AnthropicResilienceOptions;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}): Promise<Anthropic.Message> {
  const basePolicy = providerRuntime.resolvePolicy("direct_turn");
  const resolvedPolicy: ProviderResiliencePolicy = {
    ...basePolicy,
    ...options,
    provider: options?.provider ?? basePolicy.provider,
    modelCandidates: options?.modelCandidates ?? basePolicy.modelCandidates,
    timeoutMs: options?.timeoutMs ?? basePolicy.timeoutMs,
    retryAttempts: options?.retryAttempts ?? basePolicy.retryAttempts,
    retryDelayMs: options?.retryDelayMs ?? basePolicy.retryDelayMs,
  };

  return providerRuntime.runWithResilience({
    surface: "direct_turn",
    policy: resolvedPolicy,
    runAttempt: async ({ model }) =>
      (await withTimeout(
        client.messages.create({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages,
          tools,
          tool_choice: toolChoice,
        }),
        resolvedPolicy.timeoutMs,
      )) as Anthropic.Message,
    handleError: ({ error, attempt, policy }): ProviderAttemptAction =>
      resolveErrorAction({
        error,
        attempt,
        retryAttempts: policy.retryAttempts,
      }),
    onExhausted: (lastError) => normalizeProviderError(lastError),
    onNoModels: () =>
      new Error(
        `No valid intelligence provider model found for ${resolvedPolicy.provider}. Configure a valid selected-provider model.`,
      ),
  });
}

export function createAnthropicProvider(
  client: Anthropic,
  config: {
    systemPrompt: string;
    tools: Anthropic.Tool[];
    resilience?: AnthropicResilienceOptions;
  },
): ChatProvider {
  return {
    createMessage: ({ messages, toolChoice }) =>
      createMessageWithModelFallback({
        client,
        messages,
        toolChoice,
        options: config.resilience,
        systemPrompt: config.systemPrompt,
        tools: config.tools,
      }),
  };
}
