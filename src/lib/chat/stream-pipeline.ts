import type { NextRequest } from "next/server";

import type { RoleName, User } from "@/core/entities/user";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import { getSessionUser, resolveSessionAuthorizationRole } from "@/lib/auth";
import type { createConversationRuntimeServices } from "@/lib/chat/conversation-root";
import type { RouteContext } from "@/lib/chat/http-facade";
import type { MediaContinuityHandoff } from "@/lib/chat/media-continuity-handoff";
import type { AttachmentPart } from "@/lib/chat/message-attachments";
import type { PromptAssemblyBuilder } from "@/lib/chat/prompt-runtime";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { getChatRuntimeHooks } from "@/lib/chat/runtime-hook-composition";
import {
  createChatRuntimeHookRunner,
  type ChatRuntimeHook,
  type InboundClaimHookState,
} from "@/lib/chat/runtime-hooks";
import type { TaskOriginHandoff } from "@/lib/chat/task-origin-handoff";

import {
  assignStreamAttachments,
  ensureStreamConversation,
  persistStreamUserMessage,
  rejectStreamIfActiveExists,
  validateAndParseChatStreamRequest,
  type ChatMessage,
  type ConversationState,
  type NormalizedChatStreamRequest,
  type ParsedRequestBody,
} from "@/lib/chat/stream-intake";
import {
  createDeferredToolExecutor as createDeferredToolExecutorStage,
  createStreamResponse as createStreamResponseStage,
  type CreateStreamResponseOptions,
  type DeferredToolExecutorOptions,
} from "@/lib/chat/stream-execution";
import {
  finalizePreparedStreamContext as finalizePreparedStreamContextStage,
  isSafeStreamPreparationFallback,
  prepareFallbackContext as prepareFallbackContextStage,
  prepareStreamContext as prepareStreamContextStage,
  type FinalizedStreamPreparation,
  type PreparedStreamContext,
} from "@/lib/chat/stream-preparation";
import {
  checkMathShortCircuit as checkMathShortCircuitStage,
  maybeHandleSlashCommand as maybeHandleSlashCommandStage,
} from "@/lib/chat/stream-short-circuits";
import {
  appendShortCircuitAssistantMessage,
  createShortCircuitStreamResponse,
} from "@/lib/chat/stream-response-helpers";
import {
  buildOperationIntentCompilerInput,
  createOperationIntentIngress,
} from "@/lib/operations/operation-intent-root";

export class ChatStreamPipeline {
  private readonly runtimeHookRunner;

  constructor(
    private readonly runtimeHooks: readonly ChatRuntimeHook[] = getChatRuntimeHooks(),
  ) {
    this.runtimeHookRunner = createChatRuntimeHookRunner(runtimeHooks);
  }

  async resolveSession(routeContext: RouteContext | null = null) {
    const state: InboundClaimHookState = {
      routeContext,
      meta: {},
    };

    const result = await this.runtimeHookRunner.runInboundClaim(state, async (hookState) => {
      const user = await getSessionUser();
      const role = resolveSessionAuthorizationRole(user);
      const { userId, isAnonymous } = await resolveUserId();

      return {
        ...hookState,
        session: { user, role, userId, isAnonymous },
      };
    });

    return result.session;
  }

  validateAndParse(
    raw: unknown,
    context: RouteContext,
  ): { parsed: ParsedRequestBody; body: NormalizedChatStreamRequest } | Response {
    return validateAndParseChatStreamRequest(raw, context);
  }

  async ensureConversation(
    userId: string,
    request: NextRequest,
    services: ReturnType<typeof createConversationRuntimeServices>,
  ): Promise<ConversationState> {
    return ensureStreamConversation(userId, request, services);
  }

  rejectIfActiveStreamExists(
    userId: string,
    conversationId: string,
    context: RouteContext,
  ): Response | null {
    return rejectStreamIfActiveExists(userId, conversationId, context);
  }

  async assignAttachments(
    userId: string,
    conversationId: string,
    attachments: AttachmentPart[],
  ) {
    return assignStreamAttachments(userId, conversationId, attachments);
  }

  async persistUserMessage(
    interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"],
    conversationId: string,
    userId: string,
    latestUserText: string,
    incomingAttachments: AttachmentPart[],
  ) {
    return persistStreamUserMessage(
      interactor,
      conversationId,
      userId,
      latestUserText,
      incomingAttachments,
    );
  }

  async prepareStreamContext(
    builder: PromptAssemblyBuilder,
    interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"],
    routingAnalyzer: ReturnType<typeof createConversationRuntimeServices>["routingAnalyzer"],
    relationshipMemoryReader: ReturnType<typeof createConversationRuntimeServices>["relationshipMemoryReader"],
    conversationId: string,
    userId: string,
    incomingMessages: ChatMessage[],
    latestUserText: string,
    latestUserContent: string,
    taskOriginHandoff: TaskOriginHandoff | null,
    mediaContinuityHandoff: MediaContinuityHandoff | null,
    role?: RoleName,
  ): Promise<PreparedStreamContext> {
    return prepareStreamContextStage({
      builder,
      interactor,
      routingAnalyzer,
      relationshipMemoryReader,
      conversationId,
      userId,
      role,
      incomingMessages,
      latestUserText,
      latestUserContent,
      taskOriginHandoff,
      mediaContinuityHandoff,
    });
  }

  async prepareFallbackContext(
    builder: PromptAssemblyBuilder,
    incomingMessages: ChatMessage[],
    latestUserContent: string,
    taskOriginHandoff: TaskOriginHandoff | null,
    mediaContinuityHandoff: MediaContinuityHandoff | null,
  ): Promise<PreparedStreamContext> {
    return prepareFallbackContextStage({
      builder,
      incomingMessages,
      latestUserContent,
      taskOriginHandoff,
      mediaContinuityHandoff,
    });
  }

  isSafePreparationFallback(error: unknown): boolean {
    return isSafeStreamPreparationFallback(error);
  }

  async finalizePreparedPrompt(options: {
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
    return finalizePreparedStreamContextStage({
      runtimeHookRunner: this.runtimeHookRunner,
      ...options,
    });
  }

  async maybeHandleSlashCommand(options: {
    latestUserText: string;
    conversationId: string;
    userId: string;
    role: RoleName;
    isAnonymous: boolean;
    interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"];
    summarizationInteractor: ReturnType<typeof createConversationRuntimeServices>["summarizationInteractor"];
    jobStatusQuery: JobStatusQuery;
    context: RouteContext;
  }): Promise<Response | null> {
    return maybeHandleSlashCommandStage(options);
  }

  async checkMathShortCircuit(
    latestUserText: string,
    incomingMessages: ChatMessage[],
    conversationId: string,
    interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"],
    user: Pick<User, "id" | "roles">,
    userId: string,
    context: RouteContext,
    userMessageId: string | null,
  ) {
    return checkMathShortCircuitStage({
      latestUserText,
      incomingMessages,
      conversationId,
      interactor,
      user,
      userId,
      context,
      userMessageId,
    });
  }

  async maybeHandleOperationIntent(options: {
    latestUserText: string;
    latestUserContent: string;
    conversationId: string;
    userId: string;
    role: RoleName;
    interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"];
    preparedContext: PreparedStreamContext;
    incomingAttachments: AttachmentPart[];
    taskOriginHandoff: TaskOriginHandoff | null;
    mediaContinuityHandoff: MediaContinuityHandoff | null;
    context: RouteContext;
    userMessageId: string | null;
  }): Promise<Response | null> {
    const compilerInput = await buildOperationIntentCompilerInput({
      conversationId: options.conversationId,
      originMessageId: options.userMessageId,
      userId: options.userId,
      role: options.role,
      latestUserText: options.latestUserText,
      latestUserContent: options.latestUserContent,
      routingSnapshot: options.preparedContext.routingSnapshot,
      attachments: options.incomingAttachments,
      taskOriginHandoff: options.taskOriginHandoff,
      mediaContinuityHandoff: options.mediaContinuityHandoff,
      operationGrounding: options.preparedContext.operationGrounding ?? null,
    });
    const result = await createOperationIntentIngress().handle(compilerInput);
    if (!result.handled || !result.replyText) {
      return null;
    }

    await appendShortCircuitAssistantMessage(
      options.interactor,
      options.conversationId,
      options.userId,
      result.replyText,
    );

    return createShortCircuitStreamResponse(
      options.context,
      options.conversationId,
      result.replyText,
    );
  }

  async createDeferredToolExecutor(options: DeferredToolExecutorOptions) {
    return createDeferredToolExecutorStage(options);
  }

  createStreamResponse(options: Omit<CreateStreamResponseOptions, "runtimeHookRunner">) {
    return createStreamResponseStage({
      ...options,
      runtimeHookRunner: this.runtimeHookRunner,
    });
  }
}
