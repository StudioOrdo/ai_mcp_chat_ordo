import type Anthropic from "@anthropic-ai/sdk";

import { getJobQueueRepository, getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import type { MessagePart } from "@/core/entities/message-parts";
import type { RoleName } from "@/core/entities/user";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { SelectedIntelligenceRuntime } from "@/lib/ai/providers/selected-intelligence-runtime";
import { runClaudeAgentLoopStream } from "@/lib/chat/anthropic-stream";
import {
  ActiveStreamConflictError,
  registerActiveStream,
} from "@/lib/chat/active-stream-registry";
import type { createConversationRuntimeServices } from "@/lib/chat/conversation-root";
import type { RouteContext } from "@/lib/chat/http-facade";
import type { AttachmentPart } from "@/lib/chat/message-attachments";
import { buildMultimodalContentBlocks } from "@/lib/chat/multimodal-content";
import type {
  createChatRuntimeHookRunner,
  TurnCompletionHookState,
} from "@/lib/chat/runtime-hooks";
import { resolveSessionResolutionSignal } from "@/lib/chat/session-resolution";
import type { ToolCompositionResult } from "@/lib/chat/tool-composition-root";
import {
  deferredJobResultToStreamEvent,
  isDeferredJobResultPayload,
} from "@/lib/jobs/deferred-job-result";
import { enqueueDeferredToolJob } from "@/lib/jobs/enqueue-deferred-tool-job";
import { logDegradation, logFailure } from "@/lib/observability/logger";
import { REASON_CODES } from "@/lib/observability/reason-codes";

import {
  attachPromptProvenanceRecord,
  createSseResponse,
  sseChunk,
  toStreamErrorMessage,
} from "@/lib/chat/stream-response-helpers";

type RuntimeHookRunner = ReturnType<typeof createChatRuntimeHookRunner>;

export type DeferredToolExecutorOptions = {
  conversationId: string;
  isAnonymous: boolean;
  registry: ToolCompositionResult["registry"];
  baseExecutor: ToolCompositionResult["executor"];
  context: ToolExecutionContext;
};

type GenerationLifecycleDescriptor = {
  status: "stopped" | "interrupted";
  eventType: "generation_stopped" | "generation_interrupted";
  actor: "user" | "system";
  reason: string;
};

export type CreateStreamResponseOptions = {
  runtimeHookRunner: RuntimeHookRunner;
  intelligenceRuntime: Pick<SelectedIntelligenceRuntime, "client" | "policy">;
  context: RouteContext;
  conversationId: string;
  interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"];
  summarizationInteractor: ReturnType<typeof createConversationRuntimeServices>["summarizationInteractor"];
  role: RoleName;
  userId: string;
  systemPrompt: string;
  contextMessages: Array<{ role: "user" | "assistant"; content: string }>;
  tools: Anthropic.Tool[];
  toolExecutor: (
    name: string,
    input: Record<string, unknown>,
    abortSignal?: AbortSignal,
    toolInvocationId?: string,
  ) => Promise<unknown>;
  requestSignal?: AbortSignal;
  latestAttachments?: AttachmentPart[];
  promptProvenanceRecordId?: string | null;
  promptBindingId?: string | null;
};

function resolveAbortReason(signal: AbortSignal, fallbackReason: string): string {
  if (typeof signal.reason === "string" && signal.reason.trim().length > 0) {
    return signal.reason;
  }

  if (signal.reason instanceof Error && signal.reason.message.trim().length > 0) {
    return signal.reason.message;
  }

  return fallbackReason;
}

function createAbortSignalError(signal: AbortSignal, fallbackReason: string): Error {
  const error = new Error(resolveAbortReason(signal, fallbackReason));
  error.name = "AbortError";
  return error;
}

function isAbortSignalError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
}

function forwardAbortSignal(
  source: AbortSignal | undefined,
  target: AbortController,
  fallbackReason: string,
): () => void {
  if (!source) {
    return () => {};
  }

  const handleAbort = () => {
    if (!target.signal.aborted) {
      target.abort(resolveAbortReason(source, fallbackReason));
    }
  };

  if (source.aborted) {
    handleAbort();
    return () => {};
  }

  source.addEventListener("abort", handleAbort, { once: true });
  return () => {
    source.removeEventListener("abort", handleAbort);
  };
}

function hasAssistantOutput(assistantText: string, assistantParts: MessagePart[]): boolean {
  return assistantText.length > 0 || assistantParts.length > 0;
}

function buildGenerationLifecyclePart(
  lifecycle: GenerationLifecycleDescriptor,
  partialContentRetained: boolean,
  recordedAt: string,
): MessagePart {
  return {
    type: "generation_status",
    status: lifecycle.status,
    actor: lifecycle.actor,
    reason: lifecycle.reason,
    partialContentRetained,
    recordedAt,
  };
}

function buildGenerationLifecycleEvent(
  lifecycle: GenerationLifecycleDescriptor,
  partialContentRetained: boolean,
  recordedAt: string,
): Record<string, unknown> {
  return {
    type: lifecycle.eventType,
    actor: lifecycle.actor,
    reason: lifecycle.reason,
    partialContentRetained,
    recordedAt,
  };
}

function resolveAbortLifecycle(signal: AbortSignal): GenerationLifecycleDescriptor {
  const reason = typeof signal.reason === "string" && signal.reason.trim().length > 0
    ? signal.reason
    : "stream_aborted";

  if (reason === "stopped_by_owner") {
    return {
      status: "stopped",
      eventType: "generation_stopped",
      actor: "user",
      reason,
    };
  }

  return {
    status: "interrupted",
    eventType: "generation_interrupted",
    actor: "system",
    reason,
  };
}

function resolveUnexpectedLifecycle(error: unknown): GenerationLifecycleDescriptor {
  return {
    status: "interrupted",
    eventType: "generation_interrupted",
    actor: "system",
    reason: toStreamErrorMessage(error),
  };
}

function hasSameTurnMediaDiscovery(assistantParts: readonly MessagePart[]): boolean {
  return assistantParts.some((part) => (
    part.type === "tool_result"
    && part.name === "list_conversation_media_assets"
    && typeof part.result === "object"
    && part.result !== null
    && (part.result as { ok?: unknown }).ok === true
  ));
}

export function resolveMediaAssetDiscoveryGuard(
  name: string,
  assistantParts: readonly MessagePart[],
): Record<string, unknown> | null {
  if (name !== "compose_media" || hasSameTurnMediaDiscovery(assistantParts)) {
    return null;
  }

  return {
    ok: false,
    action: "media_asset_discovery_required",
    error: "Call list_conversation_media_assets before compose_media, then pass the returned assetId values exactly into the composition plan.",
  };
}

async function buildAnthropicMessages(options: {
  contextMessages: Array<{ role: "user" | "assistant"; content: string }>;
  latestAttachments: AttachmentPart[];
  userId: string;
}): Promise<Anthropic.MessageParam[]> {
  const rawMessages = [...options.contextMessages];
  let lastUserIndex = -1;
  for (let index = rawMessages.length - 1; index >= 0; index -= 1) {
    if (rawMessages[index].role === "user") {
      lastUserIndex = index;
      break;
    }
  }

  const multimodalContent = options.latestAttachments.length > 0 && lastUserIndex >= 0
    ? await buildMultimodalContentBlocks(
      rawMessages[lastUserIndex].content,
      options.latestAttachments,
      options.userId,
      getUserFileDataMapper(),
    )
    : null;

  return rawMessages.flatMap<Anthropic.MessageParam>((message, index) => {
    if (index === lastUserIndex && multimodalContent) {
      return [{ role: "user", content: multimodalContent }];
    }

    const content = message.content.trim();
    if (content.length === 0) {
      return [];
    }

    return [{
      role: message.role,
      content,
    }];
  });
}

export async function createDeferredToolExecutor(options: DeferredToolExecutorOptions) {
  const queueRepository = getJobQueueRepository();

  return async (
    name: string,
    input: Record<string, unknown>,
    abortSignal?: AbortSignal,
    toolInvocationId?: string,
  ) => {
    const executionContext = {
      ...options.context,
      ...(abortSignal ? { abortSignal } : {}),
      ...(toolInvocationId ? { toolInvocationId } : {}),
    };

    if (abortSignal?.aborted) {
      throw createAbortSignalError(abortSignal, "tool_execution_aborted");
    }

    const descriptor = options.registry.getDescriptor(name);
    if (!descriptor || descriptor.executionMode !== "deferred") {
      return options.baseExecutor(name, input, executionContext);
    }

    if (abortSignal?.aborted) {
      throw createAbortSignalError(abortSignal, "tool_execution_aborted");
    }

    return (await enqueueDeferredToolJob({
      repository: queueRepository,
      conversationId: options.conversationId,
      userId: options.context.userId,
      toolName: name,
      requestPayload: input,
      promptBindingId: options.context.promptBindingId,
      initiatorType: options.isAnonymous ? "anonymous_session" : "user",
      deferred: descriptor.deferred,
      toolInvocationId,
    })).payload;
  };
}

export function createStreamResponse(options: CreateStreamResponseOptions): Response {
  const encoder = new TextEncoder();
  const streamAbortController = new AbortController();
  let registration;

  try {
    registration = registerActiveStream({
      ownerUserId: options.userId,
      conversationId: options.conversationId,
      abortController: streamAbortController,
    });
  } catch (error) {
    if (error instanceof ActiveStreamConflictError) {
      return new Response(
        JSON.stringify({ error: "A response is already in progress for this conversation." }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw error;
  }

  const { streamId, unregister } = registration;
  const removeRequestAbortForwarding = forwardAbortSignal(
    options.requestSignal,
    streamAbortController,
    "request_disconnected",
  );
  const assistantParts: MessagePart[] = [];
  let assistantText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const finalizeGenerationLifecycle = async (
        lifecycle: GenerationLifecycleDescriptor,
      ) => {
        try {
          const completionState: TurnCompletionHookState = {
            routeContext: options.context,
            conversationId: options.conversationId,
            userId: options.userId,
            role: options.role,
            streamId,
            status: lifecycle.status,
            assistantText,
            assistantParts: [...assistantParts],
            lifecycleEventType: lifecycle.eventType,
            lifecycleActor: lifecycle.actor,
            lifecycleReason: lifecycle.reason,
            meta: {},
          };

          await options.runtimeHookRunner.runTurnCompletion(completionState, async (state) => {
            const recordedAt = new Date().toISOString();
            const partialContentRetained = hasAssistantOutput(assistantText, assistantParts);
            let messageId: string | undefined;

            try {
              const message = await options.interactor.appendMessage(
                {
                  conversationId: options.conversationId,
                  role: "assistant",
                  content: assistantText,
                  parts: [
                    ...assistantParts,
                    buildGenerationLifecyclePart(lifecycle, partialContentRetained, recordedAt),
                  ],
                },
                options.userId,
                { sourcePromptBindingId: options.promptBindingId },
              );

              messageId = message?.id;

              await attachPromptProvenanceRecord(
                options.conversationId,
                options.promptProvenanceRecordId,
                messageId,
              );

              options.summarizationInteractor
                .summarizeIfNeeded(options.conversationId)
                .catch((summarizationError) => logDegradation(
                  REASON_CODES.CONVERSATION_LOOKUP_FAILED,
                  "Summarization failed",
                  { conversationId: options.conversationId },
                  summarizationError,
                ));
            } catch (persistError) {
              logFailure(
                REASON_CODES.MESSAGE_PERSIST_FAILED,
                "Failed to persist assistant lifecycle state",
                { conversationId: options.conversationId },
                persistError,
              );
            }

            try {
              await options.interactor.recordGenerationLifecycleEvent(
                options.conversationId,
                lifecycle.eventType,
                {
                  actor: lifecycle.actor,
                  reason: lifecycle.reason,
                  partial_content_retained: partialContentRetained,
                  stream_id: streamId,
                  recorded_at: recordedAt,
                  message_id: messageId,
                },
              );
            } catch (eventError) {
              logDegradation(
                REASON_CODES.UNKNOWN_ROUTE_ERROR,
                "Generation lifecycle event recording failed",
                { conversationId: options.conversationId, streamId },
                eventError,
              );
            }

            controller.enqueue(
              encoder.encode(
                sseChunk(buildGenerationLifecycleEvent(lifecycle, partialContentRetained, recordedAt)),
              ),
            );

            return {
              ...state,
              persistedMessageId: messageId,
              recordedAt,
              partialContentRetained,
            };
          });
        } catch (hookError) {
          logDegradation(
            REASON_CODES.UNKNOWN_ROUTE_ERROR,
            "Turn completion hook failed",
            { conversationId: options.conversationId, streamId, status: lifecycle.status },
            hookError,
          );
        }
      };

      try {
        controller.enqueue(encoder.encode(sseChunk({ stream_id: streamId })));
        controller.enqueue(encoder.encode(sseChunk({ conversation_id: options.conversationId })));

        const anthropicMessages = await buildAnthropicMessages({
          contextMessages: options.contextMessages,
          latestAttachments: options.latestAttachments ?? [],
          userId: options.userId,
        });

        await runClaudeAgentLoopStream({
          client: options.intelligenceRuntime.client,
          policy: options.intelligenceRuntime.policy,
          messages: anthropicMessages,
          signal: streamAbortController.signal,
          systemPrompt: options.systemPrompt,
          tools: options.tools,
          toolExecutor: (name, input, toolInvocationId) => {
            const guardedResult = resolveMediaAssetDiscoveryGuard(name, assistantParts);
            if (guardedResult) {
              return Promise.resolve(guardedResult);
            }

            return options.toolExecutor(name, input, streamAbortController.signal, toolInvocationId);
          },
          callbacks: {
            onDelta(text) {
              assistantText += text;
              assistantParts.push({ type: "text", text });
              controller.enqueue(encoder.encode(sseChunk({ delta: text })));
            },
            onToolCall(name, args, toolInvocationId) {
              assistantParts.push({ type: "tool_call", name, args, toolInvocationId });
              controller.enqueue(
                encoder.encode(sseChunk({ tool_call: { name, args, toolInvocationId } })),
              );
              options.interactor.recordToolUsed(options.conversationId, name, options.role)
                .catch((error) => logDegradation(
                  REASON_CODES.TOOL_EXECUTION_FAILED,
                  "Tool usage event recording failed",
                  { tool: name },
                  error,
                ));
            },
            onToolResult(name, result, toolInvocationId) {
              assistantParts.push({ type: "tool_result", name, result, toolInvocationId });
              controller.enqueue(
                encoder.encode(sseChunk({ tool_result: { name, result, toolInvocationId } })),
              );

              if (isDeferredJobResultPayload(result)) {
                const streamEvent = deferredJobResultToStreamEvent(result, toolInvocationId);
                controller.enqueue(
                  encoder.encode(sseChunk(streamEvent as unknown as Record<string, unknown>)),
                );
              }
            },
          },
        });

        try {
          const sessionResolution = resolveSessionResolutionSignal({
            status: "completed",
            assistantText,
            assistantParts,
          });
          const completionState: TurnCompletionHookState = {
            routeContext: options.context,
            conversationId: options.conversationId,
            userId: options.userId,
            role: options.role,
            streamId,
            status: "completed",
            assistantText,
            assistantParts: [...assistantParts],
            sessionResolutionKind: sessionResolution?.kind,
            sessionResolutionReason: sessionResolution?.reason,
            sessionResolutionResponseState: sessionResolution?.responseState,
            meta: {},
          };

          await options.runtimeHookRunner.runTurnCompletion(completionState, async (state) => {
            let persistedMessageId: string | undefined;
            let assistantPersisted = false;

            try {
              const message = await options.interactor.appendMessage(
                {
                  conversationId: options.conversationId,
                  role: "assistant",
                  content: assistantText,
                  parts: assistantParts,
                },
                options.userId,
                { sourcePromptBindingId: options.promptBindingId },
              );
              assistantPersisted = true;
              persistedMessageId = message?.id;

              await attachPromptProvenanceRecord(
                options.conversationId,
                options.promptProvenanceRecordId,
                persistedMessageId,
              );
            } catch (error) {
              logFailure(
                REASON_CODES.MESSAGE_PERSIST_FAILED,
                "Failed to persist assistant message",
                { conversationId: options.conversationId },
                error,
              );
              controller.enqueue(
                encoder.encode(sseChunk({ error: toStreamErrorMessage(error) })),
              );
            }

            if (assistantPersisted) {
              options.summarizationInteractor
                .summarizeIfNeeded(options.conversationId)
                .catch((error) => logDegradation(
                  REASON_CODES.CONVERSATION_LOOKUP_FAILED,
                  "Summarization failed",
                  { conversationId: options.conversationId },
                  error,
                ));

              if (sessionResolution) {
                const recordedAt = new Date().toISOString();
                options.interactor.recordSessionResolution(options.conversationId, {
                  kind: sessionResolution.kind,
                  responseState: sessionResolution.responseState,
                  reason: sessionResolution.reason,
                  streamId: state.streamId,
                  recordedAt,
                  messageId: persistedMessageId,
                }).catch((error) => logDegradation(
                  REASON_CODES.CONVERSATION_LOOKUP_FAILED,
                  "Session resolution event recording failed",
                  { conversationId: options.conversationId, streamId: state.streamId },
                  error,
                ));
              }
            }

            return {
              ...state,
              persistedMessageId,
            };
          });
        } catch (hookError) {
          logDegradation(
            REASON_CODES.UNKNOWN_ROUTE_ERROR,
            "Turn completion hook failed",
            { conversationId: options.conversationId, streamId, status: "completed" },
            hookError,
          );
        }

        controller.close();
      } catch (error) {
        if (streamAbortController.signal.aborted || isAbortSignalError(error)) {
          await finalizeGenerationLifecycle(resolveAbortLifecycle(streamAbortController.signal));
          controller.close();
          return;
        }

        logFailure(REASON_CODES.UNKNOWN_ROUTE_ERROR, "Unexpected stream error", {}, error);
        await finalizeGenerationLifecycle(resolveUnexpectedLifecycle(error));
        controller.close();
      } finally {
        removeRequestAbortForwarding();
        unregister();
      }
    },
    cancel() {
      streamAbortController.abort();
      removeRequestAbortForwarding();
      unregister();
    },
  });

  return createSseResponse(options.context, stream);
}
