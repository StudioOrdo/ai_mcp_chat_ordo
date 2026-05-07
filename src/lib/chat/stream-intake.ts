import type { NextRequest } from "next/server";

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import type { createConversationRuntimeServices } from "@/lib/chat/conversation-root";
import {
  errorJson,
  type RouteContext,
} from "@/lib/chat/http-facade";
import type { AttachmentPart } from "@/lib/chat/message-attachments";
import {
  normalizeCurrentPageSnapshot,
  type CurrentPageSnapshot,
} from "@/lib/chat/current-page-context";
import {
  getActiveStreamSnapshotForOwnerConversation,
} from "@/lib/chat/active-stream-registry";
import { logDegradation } from "@/lib/observability/logger";
import { MessageLimitError } from "@/core/use-cases/ConversationInteractor";
import { ChatStreamRequestSchema } from "@/app/api/chat/stream/schema";
import type { ChatStreamRequest } from "@/app/api/chat/stream/schema";
import {
  REFERRAL_VISIT_COOKIE_NAME,
  resolveValidatedReferralVisit,
} from "@/lib/referrals/referral-visit";
import { getReferralLedgerService } from "@/lib/referrals/referral-ledger";
import {
  resolveValidatedTrackedLinkVisit,
  TRACKED_LINK_VISIT_COOKIE_NAME,
} from "@/lib/tracked-links/tracked-link-visit";
import { getTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";
import {
  normalizeMediaContinuityHandoff,
} from "@/lib/chat/media-continuity-handoff";
import {
  normalizeTaskOriginHandoff,
} from "@/lib/chat/task-origin-handoff";
import { UserFileSystem } from "@/lib/user-files";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ParsedRequestBody = {
  incomingMessages: ChatMessage[];
  incomingAttachments: AttachmentPart[];
  taskOriginHandoff: ReturnType<typeof normalizeTaskOriginHandoff>;
  mediaContinuityHandoff: ReturnType<typeof normalizeMediaContinuityHandoff>;
};

export type NormalizedChatStreamRequest = Omit<ChatStreamRequest, "currentPageSnapshot"> & {
  currentPageSnapshot?: CurrentPageSnapshot;
};

export type ConversationState = {
  conversationId: string;
  services: ReturnType<typeof createConversationRuntimeServices>;
};

function isAttachmentCandidate(value: unknown): value is Omit<AttachmentPart, "type"> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.assetId === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.fileSize === "number"
  );
}

function normalizeValidatedRequest(body: ChatStreamRequest): NormalizedChatStreamRequest {
  const { currentPageSnapshot, ...rest } = body;
  const normalizedSnapshot = normalizeCurrentPageSnapshot(currentPageSnapshot);

  if (!normalizedSnapshot) {
    return rest;
  }

  return {
    ...rest,
    currentPageSnapshot: normalizedSnapshot,
  };
}

function parseRequestBody(body: {
  messages?: ChatMessage[];
  attachments?: unknown[];
  taskOriginHandoff?: unknown;
  mediaContinuityHandoff?: unknown;
}): ParsedRequestBody {
  return {
    incomingMessages: body.messages ?? [],
    taskOriginHandoff: normalizeTaskOriginHandoff(body.taskOriginHandoff),
    mediaContinuityHandoff: normalizeMediaContinuityHandoff(body.mediaContinuityHandoff),
    incomingAttachments: (body.attachments ?? [])
      .filter(isAttachmentCandidate)
      .map((attachment) => ({
        type: "attachment" as const,
        assetId: attachment.assetId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        ...(attachment.assetKind ? { assetKind: attachment.assetKind } : {}),
        ...(typeof attachment.width === "number" ? { width: attachment.width } : {}),
        ...(typeof attachment.height === "number" ? { height: attachment.height } : {}),
        ...(typeof attachment.durationSeconds === "number"
          ? { durationSeconds: attachment.durationSeconds }
          : {}),
        ...(attachment.source ? { source: attachment.source } : {}),
        ...(attachment.retentionClass ? { retentionClass: attachment.retentionClass } : {}),
        ...(attachment.toolName ? { toolName: attachment.toolName } : {}),
      })),
  };
}

export function validateAndParseChatStreamRequest(
  raw: unknown,
  context: RouteContext,
): { parsed: ParsedRequestBody; body: NormalizedChatStreamRequest } | Response {
  const parseResult = ChatStreamRequestSchema.safeParse(raw);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    const errorMsg = issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    logDegradation(
      "STREAM_VALIDATION_FAILED",
      "Chat stream request failed schema validation",
      { errorMsg },
    );
    return errorJson(context, errorMsg, 400);
  }

  const body = normalizeValidatedRequest(parseResult.data);
  const parsed = parseRequestBody(body);
  return { parsed, body };
}

export async function ensureStreamConversation(
  userId: string,
  request: NextRequest,
  services: ReturnType<typeof createConversationRuntimeServices>,
): Promise<ConversationState> {
  const { interactor } = services;
  const referralVisit = resolveValidatedReferralVisit(
    request.cookies?.get(REFERRAL_VISIT_COOKIE_NAME)?.value,
  );
  const conversation = await interactor.ensureActive(
    userId,
    referralVisit
      ? {
          referralSource: referralVisit.code,
        }
      : undefined,
  );

  if (referralVisit) {
    await getReferralLedgerService().attachValidatedVisitToConversation({
      conversationId: conversation.id,
      userId,
      visit: referralVisit,
    });
  }

  const trackedLinkVisit = resolveValidatedTrackedLinkVisit(
    request.cookies?.get(TRACKED_LINK_VISIT_COOKIE_NAME)?.value,
  );
  if (trackedLinkVisit) {
    await getTrackedLinkService().recordChatStarted({
      code: trackedLinkVisit.code,
      anonymousVisitId: trackedLinkVisit.visitId,
      conversationId: conversation.id,
      userId,
    });
  }

  return {
    conversationId: conversation.id,
    services,
  };
}

export function rejectStreamIfActiveExists(
  userId: string,
  conversationId: string,
  context: RouteContext,
): Response | null {
  const activeStream = getActiveStreamSnapshotForOwnerConversation(userId, conversationId);
  if (!activeStream) {
    return null;
  }

  return errorJson(
    context,
    "A response is already in progress for this conversation.",
    409,
    undefined,
    "CONFLICT",
  );
}

export async function assignStreamAttachments(
  userId: string,
  conversationId: string,
  attachments: AttachmentPart[],
): Promise<boolean | null> {
  if (attachments.length === 0) {
    return null;
  }

  const userFiles = new UserFileSystem(getUserFileDataMapper());
  const attachmentIds: string[] = [];

  for (const attachment of attachments) {
    const uploaded = await userFiles.getById(attachment.assetId);
    if (!uploaded || uploaded.file.userId !== userId) {
      return false;
    }
    attachmentIds.push(attachment.assetId);
  }

  await userFiles.assignConversation(attachmentIds, userId, conversationId);
  return true;
}

export async function persistStreamUserMessage(
  interactor: ReturnType<typeof createConversationRuntimeServices>["interactor"],
  conversationId: string,
  userId: string,
  latestUserText: string,
  incomingAttachments: AttachmentPart[],
): Promise<{ messageId: string | null; error: MessageLimitError | null }> {
  try {
    const message = await interactor.appendMessage(
      {
        conversationId,
        role: "user",
        content: latestUserText,
        parts: [
          ...(latestUserText ? [{ type: "text" as const, text: latestUserText }] : []),
          ...incomingAttachments,
        ],
      },
      userId,
    );

    return {
      messageId: message.id,
      error: null,
    };
  } catch (error) {
    if (error instanceof MessageLimitError) {
      return {
        messageId: null,
        error,
      };
    }

    throw error;
  }
}
