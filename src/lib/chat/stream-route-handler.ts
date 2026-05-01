import type { NextRequest } from "next/server";

import {
  getJobStatusQuery,
  getUserPreferencesDataMapper,
} from "@/adapters/RepositoryFactory";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { createConversationRuntimeServices } from "@/lib/chat/conversation-root";
import {
  errorJson,
  type RouteContext,
} from "@/lib/chat/http-facade";
import { buildMessageContextText } from "@/lib/chat/message-attachments";
import { findLatestUserMessage } from "@/lib/chat/validation";
import { createSystemPromptBuilder } from "@/lib/chat/policy";
import { getPromptAssemblyReplayContext } from "@/lib/chat/prompt-runtime";
import { getRequestScopedToolSelection } from "@/lib/chat/tool-capability-routing";
import { getAnthropicApiKey } from "@/lib/config/env";
import { logDegradation } from "@/lib/observability/logger";
import { REASON_CODES } from "@/lib/observability/reason-codes";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";
import { recordPromptTurnProvenance } from "@/lib/prompts/prompt-provenance-service";
import { recordPromptBinding } from "@/lib/prompts/prompt-binding-service";
import { getReferralLedgerService } from "@/lib/referrals/referral-ledger";

import type { ChatStreamPipeline } from "@/lib/chat/stream-pipeline";

export async function executeChatStreamRoute(options: {
  request: NextRequest;
  context: RouteContext;
  pipeline: Pick<
    ChatStreamPipeline,
    | "resolveSession"
    | "validateAndParse"
    | "ensureConversation"
    | "rejectIfActiveStreamExists"
    | "assignAttachments"
    | "persistUserMessage"
    | "maybeHandleSlashCommand"
    | "prepareStreamContext"
    | "prepareFallbackContext"
    | "isSafePreparationFallback"
    | "finalizePreparedPrompt"
    | "checkMathShortCircuit"
    | "createDeferredToolExecutor"
    | "createStreamResponse"
  >;
}): Promise<Response> {
  const apiKey = getAnthropicApiKey();
  const { user, role, userId, isAnonymous } = await options.pipeline.resolveSession(options.context);

  const parseResultOrResponse = options.pipeline.validateAndParse(
    await options.request.json(),
    options.context,
  );
  if (parseResultOrResponse instanceof Response) {
    return parseResultOrResponse;
  }

  const {
    parsed: { incomingMessages, incomingAttachments, taskOriginHandoff, mediaContinuityHandoff },
    body,
  } = parseResultOrResponse;

  const systemPromptOptions = {
    surface: "chat_stream" as const,
    ...(body.currentPathname ? { currentPathname: body.currentPathname } : {}),
    ...(body.currentPageSnapshot ? { currentPageSnapshot: body.currentPageSnapshot } : {}),
  };
  const builder = await createSystemPromptBuilder(role, systemPromptOptions);
  const { registry: toolRegistry, executor: baseToolExecutor } = getAgentPlatformFacade().getExecutionSurface();

  if (!user.roles.includes("ANONYMOUS")) {
    const prefRepo = getUserPreferencesDataMapper();
    const userPrefs = await prefRepo.getAll(userId);
    builder.withUserPreferences(userPrefs);
  }

  const services = createConversationRuntimeServices();
  const latestUserMessage = findLatestUserMessage(incomingMessages);

  if (!latestUserMessage && incomingAttachments.length === 0) {
    return errorJson(options.context, "No user message found.", 400);
  }

  const latestUserText = latestUserMessage ?? "";
  const latestUserContent = buildMessageContextText(latestUserText, incomingAttachments);

  const { conversationId } = await options.pipeline.ensureConversation(
    userId,
    options.request,
    services,
  );
  const activeStreamConflict = options.pipeline.rejectIfActiveStreamExists(
    userId,
    conversationId,
    options.context,
  );
  if (activeStreamConflict) {
    return activeStreamConflict;
  }

  builder.withTrustedReferralContext(
    await getReferralLedgerService().getTrustedReferrerContext(conversationId),
  );

  const { interactor, routingAnalyzer, summarizationInteractor, relationshipMemoryReader } = services;

  const attachmentsAssigned = await options.pipeline.assignAttachments(
    userId,
    conversationId,
    incomingAttachments,
  );
  if (attachmentsAssigned === false) {
    return errorJson(options.context, "Attachment not found.", 404);
  }

  const userMessagePersistence = await options.pipeline.persistUserMessage(
    interactor,
    conversationId,
    userId,
    latestUserText,
    incomingAttachments,
  );
  if (userMessagePersistence.error) {
    return errorJson(options.context, userMessagePersistence.error.message, 400);
  }

  const slashCommandResponse = await options.pipeline.maybeHandleSlashCommand({
    latestUserText,
    conversationId,
    userId,
    role,
    isAnonymous,
    interactor,
    summarizationInteractor,
    jobStatusQuery: getJobStatusQuery(),
    context: options.context,
  });
  if (slashCommandResponse) {
    return slashCommandResponse;
  }

  let preparedContext;
  try {
    preparedContext = await options.pipeline.prepareStreamContext(
      builder,
      interactor,
      routingAnalyzer,
      relationshipMemoryReader,
      conversationId,
      userId,
      incomingMessages,
      latestUserText,
      latestUserContent,
      taskOriginHandoff,
      mediaContinuityHandoff,
    );
  } catch (error) {
    if (!options.pipeline.isSafePreparationFallback(error)) {
      throw error;
    }

    preparedContext = await options.pipeline.prepareFallbackContext(
      builder,
      incomingMessages,
      latestUserContent,
      taskOriginHandoff,
      mediaContinuityHandoff,
    );
  }

  const mathResult = await options.pipeline.checkMathShortCircuit(
    latestUserText,
    incomingMessages,
    conversationId,
    interactor,
    user,
    userId,
    options.context,
    userMessagePersistence.messageId,
  );
  if (mathResult) {
    return mathResult;
  }

  if (preparedContext.guard.status === "block") {
    return errorJson(
      options.context,
      "The latest message exceeds the safe chat context window. Shorten the message or move large material into an attachment before retrying.",
      413,
      undefined,
      "CONTEXT_LIMIT",
    );
  }

  const toolSelection = getRequestScopedToolSelection(
    toolRegistry,
    role,
    preparedContext.routingSnapshot,
    latestUserText,
    mediaContinuityHandoff,
  );
  const tools = toolSelection.tools ?? [];
  builder.withToolManifest(
    tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
    })),
  );
  const preparation = await options.pipeline.finalizePreparedPrompt({
    builder,
    preparedContext,
    incomingMessages,
    latestUserContent,
    latestUserText,
    taskOriginHandoff,
    mediaContinuityHandoff,
    routeContext: options.context,
    conversationId,
    userId,
  });
  const finalPromptRuntimeResult = preparation.promptRuntimeResult;
  if (!finalPromptRuntimeResult) {
    throw new Error("Prompt runtime result missing after request assembly.");
  }
  const promptReplayContext = getPromptAssemblyReplayContext(builder);
  let promptProvenanceRecord = null;
  let rootPromptBinding = null;

  if (userMessagePersistence.messageId && promptReplayContext) {
    try {
      promptProvenanceRecord = await recordPromptTurnProvenance({
        conversationId,
        userMessageId: userMessagePersistence.messageId,
        promptRuntime: finalPromptRuntimeResult,
        replayContext: promptReplayContext,
      });
    } catch (error) {
      logDegradation(
        REASON_CODES.UNKNOWN_ROUTE_ERROR,
        "Prompt provenance recording failed",
        { conversationId, userMessageId: userMessagePersistence.messageId },
        error,
      );
    }
  }

  if (promptProvenanceRecord && userMessagePersistence.messageId) {
    const userMessageId = userMessagePersistence.messageId;
    try {
      rootPromptBinding = await recordPromptBinding({
        userId,
        conversationId,
        surface: "chat_stream",
        target: {
          targetKind: "message",
          targetId: userMessageId,
        },
        promptRuntime: finalPromptRuntimeResult,
        decisionSourceRefs: [
          {
            sourceKind: "conversation",
            sourceId: conversationId,
            userId,
            conversationId,
          },
          {
            sourceKind: "message",
            sourceId: userMessageId,
            userId,
            conversationId,
          },
          {
            sourceKind: "prompt_provenance",
            sourceId: promptProvenanceRecord.id,
            userId,
            conversationId,
          },
        ],
        evidenceRefs: [
          {
            source: {
              sourceKind: "prompt_provenance",
              sourceId: promptProvenanceRecord.id,
              userId,
              conversationId,
            },
            observedAt: promptProvenanceRecord.recordedAt,
            summary: "Chat stream prompt runtime captured for the triggering user turn.",
          },
        ],
        createdAt: promptProvenanceRecord.recordedAt,
      });
    } catch (error) {
      logDegradation(
        REASON_CODES.UNKNOWN_ROUTE_ERROR,
        "Prompt binding recording failed",
        { conversationId, promptProvenanceId: promptProvenanceRecord.id },
        error,
      );
    }
  }

  const execContext: ToolExecutionContext = {
    role,
    userId,
    conversationId,
    promptBindingId: rootPromptBinding?.id,
    promptRuntime: finalPromptRuntimeResult,
    allowedToolNames: toolSelection.allowedToolNames,
    conversationLane: preparation.routingSnapshot.lane,
    onToolDenied: ({ toolName, reason, lane, allowedToolCount }) =>
      interactor.recordToolDenied(conversationId, {
        toolName,
        role,
        reason,
        lane,
        allowedToolCount,
      }),
    ...(body.currentPathname ? { currentPathname: body.currentPathname } : {}),
    ...(body.currentPageSnapshot ? { currentPageSnapshot: body.currentPageSnapshot } : {}),
  };
  const toolExecutor = await options.pipeline.createDeferredToolExecutor({
    conversationId,
    isAnonymous,
    registry: toolRegistry,
    baseExecutor: baseToolExecutor,
    context: execContext,
  });

  return options.pipeline.createStreamResponse({
    apiKey,
    context: options.context,
    conversationId,
    interactor,
    summarizationInteractor,
    role,
    userId,
    systemPrompt: preparation.systemPrompt,
    contextMessages: preparation.contextMessages,
    tools,
    toolExecutor,
    requestSignal: options.request.signal,
    latestAttachments: incomingAttachments,
    promptProvenanceRecordId: promptProvenanceRecord?.id ?? null,
    promptBindingId: rootPromptBinding?.id ?? null,
  });
}