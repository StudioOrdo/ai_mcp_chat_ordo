import {
  createConversationRoutingSnapshot,
  type ConversationRoutingSnapshot,
} from "@/core/entities/conversation-routing";
import {
  buildContextWindow,
  buildContextWindowGuardPrompt,
  buildGuardedContextWindow,
  type ContextMessage,
  type ContextWindowGuard,
} from "@/lib/chat/context-window";
import type { createConversationRuntimeServices } from "@/lib/chat/conversation-root";
import type { RouteContext } from "@/lib/chat/http-facade";
import {
  buildMediaContinuityContextBlock,
  type MediaContinuityHandoff,
} from "@/lib/chat/media-continuity-handoff";
import { buildRelationshipMemoryContextBlock } from "@/lib/chat/relationship-memory-context";
import type {
  PromptAssemblyBuilder,
  PromptRuntimeResult,
} from "@/lib/chat/prompt-runtime";
import type { RoleName } from "@/core/entities/user";
import {
  DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
  isOperationGroundingQuestion,
  type OperationPromptGroundingSnapshot,
} from "@/core/use-cases/operations/OperationPromptGrounding";
import { buildOperationPromptGroundingSection } from "@/lib/operations/operation-prompt-grounding";
import { buildOperationPromptGroundingForConversation } from "@/lib/operations/operation-prompt-grounding-root";
import {
  buildTaskOriginContextBlock,
  type TaskOriginHandoff,
} from "@/lib/chat/task-origin-handoff";
import type {
  createChatRuntimeHookRunner,
  RequestAssemblyMode,
  RequestAssemblyHookState,
} from "@/lib/chat/runtime-hooks";
import { logDegradation, logEvent } from "@/lib/observability/logger";
import { REASON_CODES } from "@/lib/observability/reason-codes";
import { compactProvenance } from "@/lib/prompts/prompt-provenance-store";

import type { ChatMessage } from "@/lib/chat/stream-intake";

function summarizeMediaContinuityHandoff(handoff: MediaContinuityHandoff): Array<{
  assetId: string;
  kind: string;
  aliases: string[];
  derivativeOfAssetId?: string | null;
}> {
  return handoff.assets.map((asset) => ({
    assetId: asset.assetId,
    kind: asset.kind,
    aliases: asset.aliases.slice(0, 4),
    ...(asset.derivativeOfAssetId !== undefined
      ? { derivativeOfAssetId: asset.derivativeOfAssetId }
      : {}),
  }));
}

function summarizeUserText(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 160);
}

export type PreparedStreamContext = {
  mode: RequestAssemblyMode;
  contextMessages: ContextMessage[];
  guard: ContextWindowGuard;
  routingSnapshot: ConversationRoutingSnapshot;
  operationGrounding?: OperationPromptGroundingSnapshot | null;
};

export type FinalizedStreamPreparation = PreparedStreamContext & {
  systemPrompt: string;
  promptRuntimeResult?: PromptRuntimeResult | null;
};

type RuntimeHookRunner = ReturnType<typeof createChatRuntimeHookRunner>;

export class StreamPreparationFallbackError extends Error {
  constructor(message = "safe_stream_preparation_fallback") {
    super(message);
    this.name = "StreamPreparationFallbackError";
  }
}

export function isSafeStreamPreparationFallback(error: unknown): error is StreamPreparationFallbackError {
  return error instanceof StreamPreparationFallbackError;
}

function applyContextWindowGuard(
  builder: PromptAssemblyBuilder,
  guard: ContextWindowGuard,
): void {
  const guardPrompt = buildContextWindowGuardPrompt(guard);
  if (!guardPrompt) {
    return;
  }

  builder.withSection({
    key: "context_window_guard",
    content: guardPrompt,
    priority: 42,
  });
}

function applyTaskOriginHandoff(
  builder: PromptAssemblyBuilder,
  taskOriginHandoff: TaskOriginHandoff | null,
): void {
  if (!taskOriginHandoff) {
    return;
  }

  builder.withSection({
    key: "task_origin_handoff",
    content: buildTaskOriginContextBlock(taskOriginHandoff),
    priority: 90,
  });
}

function applyMediaContinuityHandoff(
  builder: PromptAssemblyBuilder,
  mediaContinuityHandoff: MediaContinuityHandoff | null,
): void {
  if (!mediaContinuityHandoff) {
    return;
  }

  builder.withSection({
    key: "media_continuity_handoff",
    content: buildMediaContinuityContextBlock(mediaContinuityHandoff),
    priority: 88,
    payload: {
      assets: summarizeMediaContinuityHandoff(mediaContinuityHandoff),
    },
  });
}

function logPromptProvenance(
  mode: RequestAssemblyMode,
  promptRuntimeResult: PromptRuntimeResult,
  conversationId?: string,
): void {
  const compact = compactProvenance(promptRuntimeResult);

  logEvent("info", mode === "fallback" ? "PROMPT_PROVENANCE_FALLBACK" : "PROMPT_PROVENANCE", {
    ...(conversationId ? { conversationId } : {}),
    surface: compact.surface,
    effectiveHash: compact.effectiveHash,
    slotRefs: compact.slotRefs.map((slot) => `${slot.role}/${slot.promptType}:${slot.source}`),
    sections: compact.sections.map((section) => `${section.key}(${section.sourceKind})`),
    warnings: compact.warnings.map((warning) => warning.code),
  });
}

export async function prepareStreamContext(options: {
  builder: PromptAssemblyBuilder;
  interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"];
  routingAnalyzer: ReturnType<typeof createConversationRuntimeServices>["routingAnalyzer"];
  relationshipMemoryReader: ReturnType<typeof createConversationRuntimeServices>["relationshipMemoryReader"];
  conversationId: string;
  userId: string;
  role?: RoleName;
  incomingMessages: ChatMessage[];
  latestUserText: string;
  latestUserContent: string;
  taskOriginHandoff: TaskOriginHandoff | null;
  mediaContinuityHandoff: MediaContinuityHandoff | null;
}): Promise<PreparedStreamContext> {
  const allMessages = await options.interactor.getForStreamingContext(
    options.conversationId,
    options.userId,
  );
  let routingSnapshot = createConversationRoutingSnapshot();

  try {
    routingSnapshot = await options.routingAnalyzer.analyze({
      conversation: allMessages.conversation,
      messages: allMessages.messages,
      latestUserText: options.latestUserText,
    });

    await options.interactor.updateRoutingSnapshot(
      options.conversationId,
      options.userId,
      routingSnapshot,
    );
  } catch (error) {
    logDegradation(
      REASON_CODES.ROUTING_ANALYSIS_FAILED,
      "Routing analysis failed; proceeding with previous snapshot",
      { conversationId: options.conversationId },
      error,
    );
    routingSnapshot = allMessages.conversation.routingSnapshot;
  }

  const contextWindow = buildContextWindow(allMessages.messages);
  options.builder.withConversationSummary(contextWindow.summaryText);
  applyContextWindowGuard(options.builder, contextWindow.guard);
  const operationGrounding = await buildOperationPromptGroundingForConversation({
    conversationId: options.conversationId,
    userId: options.userId,
    role: options.role ?? "AUTHENTICATED",
    latestUserText: options.latestUserText,
    messages: allMessages.messages,
    contextWindowGuard: contextWindow.guard,
    now: new Date().toISOString(),
  });
  if (operationGrounding.section) {
    options.builder.withSection(operationGrounding.section);
  }
  const activeRelationshipMemory = await options.relationshipMemoryReader.listActiveByConversation(options.conversationId);
  const relationshipMemoryBlock = buildRelationshipMemoryContextBlock(activeRelationshipMemory);
  if (relationshipMemoryBlock) {
    options.builder.withSection({
      key: "relationship_memory",
      content: relationshipMemoryBlock,
      priority: 44,
      payload: {
        memoryRefs: activeRelationshipMemory.map((record) => ({
          id: record.id,
          memoryType: record.memoryType,
          updatedAt: record.updatedAt,
        })),
      },
    });
  }
  options.builder.withRoutingContext(routingSnapshot);
  applyMediaContinuityHandoff(options.builder, options.mediaContinuityHandoff);
  if (options.mediaContinuityHandoff) {
    logEvent("info", "MEDIA_CONTINUITY_HANDOFF_APPLIED", {
      conversationId: options.conversationId,
      mode: "primary",
      latestUserText: summarizeUserText(options.latestUserText),
      assetCount: options.mediaContinuityHandoff.assets.length,
      assets: summarizeMediaContinuityHandoff(options.mediaContinuityHandoff),
    });
  }
  applyTaskOriginHandoff(options.builder, options.taskOriginHandoff);

  return {
    mode: "primary",
    contextMessages: contextWindow.contextMessages,
    guard: contextWindow.guard,
    routingSnapshot,
    operationGrounding: operationGrounding.snapshot,
  };
}

export async function prepareFallbackContext(options: {
  builder: PromptAssemblyBuilder;
  incomingMessages: ChatMessage[];
  latestUserContent: string;
  taskOriginHandoff: TaskOriginHandoff | null;
  mediaContinuityHandoff: MediaContinuityHandoff | null;
}): Promise<PreparedStreamContext> {
  const fallbackMessages = options.incomingMessages.map((message, index) => ({
    role: message.role,
    content:
      index === options.incomingMessages.length - 1 && message.role === "user"
        ? options.latestUserContent
        : message.content,
  }));
  const contextWindow = buildGuardedContextWindow(fallbackMessages);
  const routingSnapshot = createConversationRoutingSnapshot();

  applyContextWindowGuard(options.builder, contextWindow.guard);
  const operationGrounding = buildFallbackOperationGrounding(options.latestUserContent);
  if (operationGrounding) {
    const section = buildOperationPromptGroundingSection(operationGrounding);
    if (section) {
      options.builder.withSection(section);
    }
  }
  options.builder.withRoutingContext(routingSnapshot);
  applyMediaContinuityHandoff(options.builder, options.mediaContinuityHandoff);
  if (options.mediaContinuityHandoff) {
    logEvent("info", "MEDIA_CONTINUITY_HANDOFF_APPLIED", {
      mode: "fallback",
      latestUserText: summarizeUserText(options.latestUserContent),
      assetCount: options.mediaContinuityHandoff.assets.length,
      assets: summarizeMediaContinuityHandoff(options.mediaContinuityHandoff),
    });
  }
  applyTaskOriginHandoff(options.builder, options.taskOriginHandoff);

  return {
    mode: "fallback",
    contextMessages: contextWindow.contextMessages,
    guard: contextWindow.guard,
    routingSnapshot,
    operationGrounding,
  };
}

function buildFallbackOperationGrounding(
  latestUserContent: string,
): OperationPromptGroundingSnapshot | null {
  if (!isOperationGroundingQuestion(latestUserContent)) {
    return null;
  }

  return {
    generatedAt: new Date().toISOString(),
    conversationId: "fallback",
    status: "unavailable",
    includeInPrompt: true,
    operations: [],
    toolEvidence: [],
    budget: {
      ...DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
      operationsDropped: 0,
      eventsDropped: 0,
      artifactsDropped: 0,
      actionsDropped: 0,
      toolEvidenceDropped: 0,
    },
    warnings: ["fallback_context_has_no_server_operation_grounding"],
  };
}

export async function finalizePreparedStreamContext(options: {
  runtimeHookRunner: RuntimeHookRunner;
  builder: PromptAssemblyBuilder;
  preparedContext: PreparedStreamContext;
  incomingMessages: ChatMessage[];
  latestUserContent: string;
  latestUserText?: string;
  taskOriginHandoff: TaskOriginHandoff | null;
  mediaContinuityHandoff: MediaContinuityHandoff | null;
  routeContext?: RouteContext | null;
  conversationId?: string;
  userId?: string;
}): Promise<FinalizedStreamPreparation> {
  const hookState: RequestAssemblyHookState = {
    routeContext: options.routeContext ?? null,
    mode: options.preparedContext.mode,
    builder: options.builder,
    incomingMessages: options.incomingMessages,
    latestUserContent: options.latestUserContent,
    taskOriginHandoff: options.taskOriginHandoff,
    ...(options.mediaContinuityHandoff ? { mediaContinuityHandoff: options.mediaContinuityHandoff } : {}),
    ...(options.conversationId ? { conversationId: options.conversationId } : {}),
    ...(options.userId ? { userId: options.userId } : {}),
    ...(options.latestUserText ? { latestUserText: options.latestUserText } : {}),
    meta: {},
  };

  const result = await options.runtimeHookRunner.runRequestAssembly(
    hookState,
    async (state) => {
      const promptRuntimeResult = await state.builder.buildResult();

      logPromptProvenance(
        options.preparedContext.mode,
        promptRuntimeResult,
        options.conversationId,
      );

      return {
        ...state,
        contextMessages: options.preparedContext.contextMessages,
        promptRuntimeResult,
        systemPrompt: promptRuntimeResult.text,
        guard: options.preparedContext.guard,
        routingSnapshot: options.preparedContext.routingSnapshot,
      };
    },
  );

  return {
    mode: result.mode,
    contextMessages: result.contextMessages,
    guard: result.guard,
    routingSnapshot: result.routingSnapshot,
    operationGrounding: options.preparedContext.operationGrounding ?? null,
    systemPrompt: result.systemPrompt,
    promptRuntimeResult: result.promptRuntimeResult,
  };
}
