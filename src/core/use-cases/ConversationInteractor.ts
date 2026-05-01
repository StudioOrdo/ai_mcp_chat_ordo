import type {
  ConversationDeleteReason,
  ConversationListScope,
  ConversationRepository,
} from "./ConversationRepository";
import type { MessageRepository } from "./MessageRepository";
import type { ConversationEventRecorder } from "./ConversationEventRecorder";
import type { RelationshipMemoryProjectionService } from "./RelationshipMemoryProjectionService";
import type { UserFileRepository } from "./UserFileRepository";
import type { Conversation, ConversationSummary, Message, NewMessage } from "../entities/conversation";
import type { MessagePart } from "../entities/message-parts";
import type { ToolDeniedReason } from "@/core/tool-registry/ToolExecutionContext";
import type { RoleName } from "../entities/user";
import type { ChatResponseState } from "../entities/chat-message";
import type { SessionResolutionKind } from "@/lib/chat/session-resolution";
import { NotFoundError as BaseNotFoundError, ValidationError as BaseValidationError } from "../common/errors";
import {
  createConversationRoutingSnapshot,
  type ConversationRoutingSnapshot,
} from "../entities/conversation-routing";
import {
  buildConversationExportPayload,
  type ConversationExportPayload,
  type NormalizedImportedConversation,
} from "@/lib/chat/conversation-portability";

const MAX_MESSAGES_PER_CONVERSATION = 200;
const AUTO_TITLE_MAX_LENGTH = 80;
const STREAM_CONTEXT_RECENT_MESSAGE_LIMIT = 50;
const USER_TRASH_RETENTION_DAYS = 30;

interface AtomicLimitedMessageRepository extends MessageRepository {
  createWithinConversationLimit(
    msg: NewMessage & { tokenEstimate?: number; createdAt?: string },
    maxMessages: number,
  ): Promise<Message | null>;
}

interface AtomicUserAppendConversationRepository extends ConversationRepository {
  recordUserMessageAppendedWithEvent(
    id: string,
    timestamp: string,
    metadata: { role: "user"; token_estimate: number },
  ): Promise<void>;
}

function hasSummaryBoundary(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === "system" &&
      message.parts.some((part) => part.type === "summary" || part.type === "meta_summary"),
  );
}

function supportsAtomicLimitedCreate(
  messageRepo: MessageRepository,
): messageRepo is AtomicLimitedMessageRepository {
  return typeof (messageRepo as Partial<AtomicLimitedMessageRepository>).createWithinConversationLimit === "function";
}

function supportsAtomicUserAppendEffects(
  conversationRepo: ConversationRepository,
): conversationRepo is AtomicUserAppendConversationRepository {
  return typeof (conversationRepo as Partial<AtomicUserAppendConversationRepository>).recordUserMessageAppendedWithEvent === "function";
}

function isDeletedConversation(conversation: Conversation | null): conversation is Conversation & { deletedAt: string } {
  return Boolean(conversation?.deletedAt);
}

function buildPurgeAfter(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function bypassesPurgeWindow(reason: ConversationDeleteReason): boolean {
  return reason === "privacy_request" || reason === "retention_policy";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectAssetIdsFromUnknown(value: unknown, collected: Set<string>): void {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectAssetIdsFromUnknown(entry, collected);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.assetId === "string" && value.assetId.trim().length > 0) {
    collected.add(value.assetId.trim());
  }

  if (typeof value.primaryAssetId === "string" && value.primaryAssetId.trim().length > 0) {
    collected.add(value.primaryAssetId.trim());
  }

  for (const entry of Object.values(value)) {
    collectAssetIdsFromUnknown(entry, collected);
  }
}

function collectAssetIdsFromParts(parts: MessagePart[]): string[] {
  const collected = new Set<string>();

  for (const part of parts) {
    if (part.type === "attachment" && part.assetId.trim().length > 0) {
      collected.add(part.assetId.trim());
      continue;
    }

    if (part.type === "imported_attachment" && typeof part.originalAssetId === "string" && part.originalAssetId.trim().length > 0) {
      collected.add(part.originalAssetId.trim());
      continue;
    }

    if (part.type === "tool_result") {
      collectAssetIdsFromUnknown(part.result, collected);
      continue;
    }

    if (part.type === "job_status") {
      if (part.resultPayload !== undefined) {
        collectAssetIdsFromUnknown(part.resultPayload, collected);
      }
      if (part.resultEnvelope) {
        collectAssetIdsFromUnknown(part.resultEnvelope, collected);
      }
    }
  }

  return [...collected];
}

export class ConversationInteractor {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly eventRecorder?: ConversationEventRecorder,
    private readonly userFileRepo?: UserFileRepository,
    private readonly relationshipMemoryProjectionService?: RelationshipMemoryProjectionService,
  ) {}

  async ensureActive(
    userId: string,
    options?: { sessionSource?: string; referralId?: string; referralSource?: string },
  ): Promise<Conversation> {
    const existing = await this.conversationRepo.findActiveByUser(userId);
    if (existing) return existing;

    return this.create(userId, "", { ...options, status: "active" }, true);
  }

  private async create(
    userId: string,
    title: string = "",
    options?: {
      sessionSource?: string;
      referralId?: string;
      referralSource?: string;
      status?: Conversation["status"];
      importedAt?: string | null;
      importSourceConversationId?: string | null;
      importedFromExportedAt?: string | null;
    },
    archiveExisting = true,
  ): Promise<Conversation> {
    if (archiveExisting) {
      // Archive any existing active conversation before creating a new conversation.
      await this.conversationRepo.archiveByUser(userId);
    }

    const id = `conv_${crypto.randomUUID()}`;
    const sessionSource = options?.sessionSource ?? (userId.startsWith("anon_") ? "anonymous_cookie" : "authenticated");
    const referralId = options?.referralId;
    const referralSource = options?.referralSource;
    const conversation = await this.conversationRepo.create({
      id,
      userId,
      title,
      status: options?.status ?? "active",
      sessionSource,
      referralId,
      referralSource,
      importedAt: options?.importedAt ?? null,
      importSourceConversationId: options?.importSourceConversationId ?? null,
      importedFromExportedAt: options?.importedFromExportedAt ?? null,
    });

    await this.eventRecorder?.record(id, "started", {
      session_source: sessionSource,
      status: options?.status ?? "active",
    });

    return conversation;
  }

  async get(conversationId: string, userId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId || isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }
    const messages = await this.messageRepo.listByConversation(conversationId);
    return { conversation, messages };
  }

  async getForStreamingContext(
    conversationId: string,
    userId: string,
  ): Promise<{ conversation: Conversation; messages: Message[]; usedFullHistory: boolean }> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId || isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    if (conversation.messageCount <= STREAM_CONTEXT_RECENT_MESSAGE_LIMIT) {
      const messages = await this.messageRepo.listByConversation(conversationId);
      return { conversation, messages, usedFullHistory: true };
    }

    const recentMessages = await this.messageRepo.listRecentByConversation(
      conversationId,
      STREAM_CONTEXT_RECENT_MESSAGE_LIMIT,
    );

    if (hasSummaryBoundary(recentMessages)) {
      return { conversation, messages: recentMessages, usedFullHistory: false };
    }

    const messages = await this.messageRepo.listByConversation(conversationId);
    return { conversation, messages, usedFullHistory: true };
  }

  async getActiveForUser(userId: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = await this.conversationRepo.findActiveByUser(userId);
    if (!conversation) return null;
    const messages = await this.messageRepo.listByConversation(conversation.id);
    return { conversation, messages };
  }

  async list(
    userId: string,
    options?: { scope?: ConversationListScope; limit?: number },
  ): Promise<ConversationSummary[]> {
    return this.conversationRepo.listByUser(userId, options);
  }

  async exportConversation(
    conversationId: string,
    userId: string,
  ): Promise<ConversationExportPayload> {
    const { conversation, messages } = await this.get(conversationId, userId);
    const payload = buildConversationExportPayload({ conversation, messages });

    await this.eventRecorder?.record(conversationId, "exported", {
      exported_by: userId,
      exported_at: payload.exportedAt,
      message_count: messages.length,
    });

    return payload;
  }

  async importConversation(
    userId: string,
    importedConversation: NormalizedImportedConversation,
  ): Promise<{ conversation: Conversation; messages: Message[] }> {
    const importedAt = new Date().toISOString();
    const conversation = await this.create(
      userId,
      importedConversation.payload.conversation.title || "Imported conversation",
      {
        status: "archived",
        sessionSource: importedConversation.payload.conversation.sessionSource || "imported_export",
        referralSource: importedConversation.payload.conversation.referralSource ?? undefined,
        importedAt,
        importSourceConversationId: importedConversation.payload.conversation.id,
        importedFromExportedAt: importedConversation.payload.exportedAt,
      },
      false,
    );

    const importedMessages: Message[] = [];
    const referencedAssetIds = new Set<string>();
    for (const message of importedConversation.importedMessages) {
      for (const assetId of collectAssetIdsFromParts(message.parts)) {
        referencedAssetIds.add(assetId);
      }

      const created = await this.messageRepo.create({
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        parts: message.parts,
        createdAt: importedConversation.payload.messages[importedMessages.length]?.createdAt,
      });
      importedMessages.push(created);
      await this.conversationRepo.recordMessageAppended(conversation.id, created.createdAt);
    }

    if (this.userFileRepo && referencedAssetIds.size > 0) {
      await this.userFileRepo.assignConversation([...referencedAssetIds], userId, conversation.id);
    }

    const refreshedConversation = await this.conversationRepo.findById(conversation.id);
    if (!refreshedConversation) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    await this.eventRecorder?.record(conversation.id, "imported", {
      imported_by: userId,
      imported_at: importedAt,
      source_conversation_id: importedConversation.payload.conversation.id,
      source_exported_at: importedConversation.payload.exportedAt,
      imported_message_count: importedMessages.length,
    });

    await this.projectRelationshipMemory(conversation.id, userId);

    return {
      conversation: refreshedConversation,
      messages: importedMessages,
    };
  }

  async delete(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId || isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    const reason: ConversationDeleteReason = "user_removed";
    const purgeAfter = buildPurgeAfter(USER_TRASH_RETENTION_DAYS);

    await this.conversationRepo.softDelete(
      conversationId,
      { userId, role: userId.startsWith("anon_") ? "ANONYMOUS" : "AUTHENTICATED", reason },
      { purgeAfter },
    );
    await this.eventRecorder?.record(conversationId, "soft_deleted", {
      deleted_by: userId,
      reason,
      purge_after: purgeAfter,
    });
  }

  async restore(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId || !isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    await this.conversationRepo.restoreDeleted(conversationId, userId);
    await this.eventRecorder?.record(conversationId, "restored", {
      restored_by: userId,
    });
  }

  async purge(
    conversationId: string,
    actor: { userId: string; role: RoleName; reason: ConversationDeleteReason },
  ): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    if (!bypassesPurgeWindow(actor.reason)) {
      if (!isDeletedConversation(conversation)) {
        throw new ConversationValidationError("Conversation must be moved to trash before it can be purged.");
      }

      if (conversation.purgeAfter) {
        const purgeAfter = Date.parse(conversation.purgeAfter);
        if (!Number.isNaN(purgeAfter) && purgeAfter > Date.now()) {
          throw new ConversationValidationError("Conversation is not yet purge eligible.");
        }
      }
    }

    await this.conversationRepo.purge(conversationId, actor);
  }

  async rename(conversationId: string, userId: string, title: string): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId || isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new ConversationValidationError("Conversation title cannot be empty");
    }

    await this.conversationRepo.updateTitle(conversationId, trimmedTitle);
    await this.eventRecorder?.record(conversationId, "renamed", {
      renamed_by: userId,
      title: trimmedTitle,
    });
  }

  async archive(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId || isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    if (conversation.status === "archived") {
      return;
    }

    await this.conversationRepo.archiveById(conversationId);
    await this.eventRecorder?.record(conversationId, "archived", {
      message_count: conversation.messageCount,
    });
  }

  async archiveActive(userId: string): Promise<Conversation | null> {
    const active = await this.conversationRepo.findActiveByUser(userId);
    if (!active) return null;

    await this.conversationRepo.archiveByUser(userId);

    const durationMs = new Date().getTime() - new Date(active.createdAt).getTime();
    const durationHours = Math.round((durationMs / 3_600_000) * 10) / 10;

    await this.eventRecorder?.record(active.id, "archived", {
      message_count: active.messageCount,
      duration_hours: durationHours,
    });

    return active;
  }

  async appendMessage(
    msg: NewMessage,
    userId: string,
    options?: { sourcePromptBindingId?: string | null },
  ): Promise<Message> {
    const conversation = await this.conversationRepo.findById(msg.conversationId);
    if (!conversation || conversation.userId !== userId || isDeletedConversation(conversation)) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    const tokenEstimate = Math.ceil(msg.content.length / 4);
    const message = supportsAtomicLimitedCreate(this.messageRepo)
      ? await this.messageRepo.createWithinConversationLimit(
          { ...msg, tokenEstimate },
          MAX_MESSAGES_PER_CONVERSATION,
        )
      : await this.createMessageWithFallbackLimitCheck(msg, tokenEstimate);

    if (!message) {
      throw new MessageLimitError(`Conversation has reached the ${MAX_MESSAGES_PER_CONVERSATION}-message limit`);
    }

    // Auto-title from first user message
    if (msg.role === "user" && !conversation.title) {
      const title = msg.content.slice(0, AUTO_TITLE_MAX_LENGTH);
      await this.conversationRepo.updateTitle(msg.conversationId, title);
    }

    if (msg.role === "user" && supportsAtomicUserAppendEffects(this.conversationRepo)) {
      await this.conversationRepo.recordUserMessageAppendedWithEvent(
        msg.conversationId,
        message.createdAt,
        { role: "user", token_estimate: tokenEstimate },
      );
    } else {
      // Update denormalized metadata in one repository operation.
      await this.conversationRepo.recordMessageAppended(msg.conversationId, message.createdAt);

      if (msg.role === "user") {
        await this.eventRecorder?.record(msg.conversationId, "message_sent", {
          role: "user",
          token_estimate: tokenEstimate,
        });
      }
    }

      await this.projectRelationshipMemory(msg.conversationId, userId, options?.sourcePromptBindingId);

    return message;
  }

    private async projectRelationshipMemory(
      conversationId: string,
      userId: string,
      sourcePromptBindingId?: string | null,
    ): Promise<void> {
      if (!this.relationshipMemoryProjectionService) {
        return;
      }

      try {
        await this.relationshipMemoryProjectionService.projectConversation({
          conversationId,
          userId,
          sourcePromptBindingId,
        });
      } catch (error) {
        await this.eventRecorder?.record(conversationId, "relationship_memory_projection_failed", {
          projected_by: userId,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

  private async createMessageWithFallbackLimitCheck(
    msg: NewMessage,
    tokenEstimate: number,
  ): Promise<Message | null> {
    const count = await this.messageRepo.countByConversation(msg.conversationId);
    if (count >= MAX_MESSAGES_PER_CONVERSATION) {
      return null;
    }

    return this.messageRepo.create({ ...msg, tokenEstimate });
  }

  async recordToolUsed(conversationId: string, toolName: string, role: string): Promise<void> {
    await this.conversationRepo.setLastToolUsed(conversationId, toolName);
    await this.eventRecorder?.record(conversationId, "tool_used", {
      tool_name: toolName,
      role,
    });
  }

  async recordToolDenied(
    conversationId: string,
    metadata: {
      toolName: string;
      role: RoleName;
      reason: ToolDeniedReason;
      lane?: string | null;
      allowedToolCount?: number;
    },
  ): Promise<void> {
    await this.eventRecorder?.record(conversationId, "tool_denied", {
      tool_name: metadata.toolName,
      role: metadata.role,
      reason: metadata.reason,
      lane: metadata.lane ?? null,
      allowed_tool_count: metadata.allowedToolCount ?? null,
    });
  }

  async recordGenerationLifecycleEvent(
    conversationId: string,
    eventType: "generation_stopped" | "generation_interrupted",
    metadata: {
      actor: "user" | "system";
      reason: string;
      partial_content_retained: boolean;
      stream_id: string;
      recorded_at: string;
      message_id?: string;
    },
  ): Promise<void> {
    await this.eventRecorder?.record(conversationId, eventType, metadata);
  }

  async recordSessionResolution(
    conversationId: string,
    metadata: {
      kind: SessionResolutionKind;
      responseState: ChatResponseState;
      reason: string;
      streamId: string;
      recordedAt: string;
      messageId?: string;
    },
  ): Promise<void> {
    await this.eventRecorder?.record(conversationId, "session_resolution", {
      kind: metadata.kind,
      response_state: metadata.responseState,
      reason: metadata.reason,
      stream_id: metadata.streamId,
      recorded_at: metadata.recordedAt,
      message_id: metadata.messageId ?? null,
    });
  }

  async updateRoutingSnapshot(
    conversationId: string,
    userId: string,
    snapshot: ConversationRoutingSnapshot,
  ): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new ConversationNotFoundError("Conversation not found");
    }

    const normalizedSnapshot = createConversationRoutingSnapshot(snapshot);
    const previousLane = conversation.routingSnapshot.lane;

    await this.conversationRepo.updateRoutingSnapshot(conversationId, normalizedSnapshot);
    await this.conversationRepo.touch(conversationId);

    const eventMetadata = {
      lane: normalizedSnapshot.lane,
      confidence: normalizedSnapshot.confidence,
      recommended_next_step: normalizedSnapshot.recommendedNextStep,
      detected_need_summary: normalizedSnapshot.detectedNeedSummary,
      analyzed_at: normalizedSnapshot.lastAnalyzedAt,
    };

    await this.eventRecorder?.record(conversationId, "lane_analyzed", eventMetadata);

    if (previousLane !== normalizedSnapshot.lane) {
      await this.eventRecorder?.record(conversationId, "lane_changed", {
        from_lane: previousLane,
        to_lane: normalizedSnapshot.lane,
        confidence: normalizedSnapshot.confidence,
        analyzed_at: normalizedSnapshot.lastAnalyzedAt,
      });
    }

    if (normalizedSnapshot.lane === "uncertain") {
      await this.eventRecorder?.record(conversationId, "lane_uncertain", eventMetadata);
    }
  }

  async migrateAnonymousConversations(
    anonUserId: string,
    newUserId: string,
  ): Promise<string[]> {
    // Archive any existing active conversation for the authenticated user
    // so the transferred anonymous conversation becomes the active one.
    await this.conversationRepo.archiveByUser(newUserId);

    const migratedIds = await this.conversationRepo.transferOwnership(anonUserId, newUserId);

    for (const convId of migratedIds) {
      await this.eventRecorder?.record(convId, "converted", {
        from: anonUserId,
        to: newUserId,
      });
    }

    return migratedIds;
  }
}

export class ConversationNotFoundError extends BaseNotFoundError {}

/** @deprecated Use ConversationNotFoundError — kept for backward compatibility. Remove after 2025-10-01. */
export { ConversationNotFoundError as NotFoundError };

export class MessageLimitError extends BaseValidationError {}

export class ConversationValidationError extends BaseValidationError {}

