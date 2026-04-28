import type { Message } from "@/core/entities/conversation";
import {
  buildTranscriptFromMessages,
} from "@/lib/chat/transcript-store";
import {
  CONVERSATION_EXPORT_VERSION,
  deepCloneParts,
  type BuildConversationExportOptions,
  type ConversationExportPayload,
  type ExportConversationMessage,
  type PortableAttachmentManifestEntry,
  type PortableJobReference,
  normalizePortableMessagePartAsync,
} from "@/lib/chat/conversation-portability";
import { rehydratePortableMediaPayloadFromGovernedStorage } from "@/lib/chat/conversation-portability-governed-storage";

function toAttachmentManifestId(messageId: string, partIndex: number): string {
  return `${messageId}:attachment:${partIndex}`;
}

export async function buildConversationExportPayload({
  conversation,
  messages,
  exportedAt = new Date().toISOString(),
  userFileRepository,
}: BuildConversationExportOptions): Promise<ConversationExportPayload> {
  const attachmentManifest: PortableAttachmentManifestEntry[] = [];
  const jobReferences: PortableJobReference[] = [];

  const exportedMessages = await Promise.all(messages.map<Promise<ExportConversationMessage>>(async (message) => {
    const normalizedParts = deepCloneParts(await Promise.all(
      (message.parts ?? []).map((part) => normalizePortableMessagePartAsync(
        part,
        true,
        userFileRepository,
        rehydratePortableMediaPayloadFromGovernedStorage,
      )),
    ));
    const attachmentManifestIds: string[] = [];

    for (const [partIndex, part] of normalizedParts.entries()) {
      if (part.type === "attachment") {
        const manifestId = toAttachmentManifestId(message.id, partIndex);
        attachmentManifestIds.push(manifestId);
        attachmentManifest.push({
          id: manifestId,
          messageId: message.id,
          partIndex,
          fileName: part.fileName,
          mimeType: part.mimeType,
          fileSize: part.fileSize,
          availability: "durable_asset",
          assetId: part.assetId,
          ...(part.assetKind ? { assetKind: part.assetKind } : {}),
          ...(typeof part.width === "number" ? { width: part.width } : {}),
          ...(typeof part.height === "number" ? { height: part.height } : {}),
          ...(typeof part.durationSeconds === "number" ? { durationSeconds: part.durationSeconds } : {}),
          ...(part.source ? { source: part.source } : {}),
          ...(part.retentionClass ? { retentionClass: part.retentionClass } : {}),
          ...(part.toolName ? { toolName: part.toolName } : {}),
        });
      }

      if (part.type === "imported_attachment") {
        const manifestId = toAttachmentManifestId(message.id, partIndex);
        attachmentManifestIds.push(manifestId);
        attachmentManifest.push({
          id: manifestId,
          messageId: message.id,
          partIndex,
          fileName: part.fileName,
          mimeType: part.mimeType,
          fileSize: part.fileSize,
          availability: part.availability,
          assetId: part.originalAssetId ?? null,
          note: part.note,
        });
      }

      if (part.type === "job_status") {
        jobReferences.push({
          jobId: part.jobId,
          toolName: part.toolName,
          status: part.status,
          label: part.label,
          messageId: message.id,
        });
      }
    }

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      parts: normalizedParts,
      createdAt: message.createdAt,
      tokenEstimate: message.tokenEstimate,
      attachmentManifestIds,
    };
  }));

  const transcriptMessages: Message[] = messages.map((message, index) => ({
    ...message,
    parts: exportedMessages[index]?.parts ?? [],
  }));

  return {
    version: CONVERSATION_EXPORT_VERSION,
    exportedAt,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messageCount,
      sessionSource: conversation.sessionSource,
      promptVersion: conversation.promptVersion,
      routingSnapshot: conversation.routingSnapshot,
      referralSource: conversation.referralSource,
      ...(conversation.deletedAt ? { deletedAt: conversation.deletedAt } : {}),
      ...(conversation.purgeAfter ? { purgeAfter: conversation.purgeAfter } : {}),
      ...(conversation.importedAt ? { importedAt: conversation.importedAt } : {}),
      ...(conversation.importSourceConversationId ? { importSourceConversationId: conversation.importSourceConversationId } : {}),
      ...(conversation.importedFromExportedAt ? { importedFromExportedAt: conversation.importedFromExportedAt } : {}),
    },
    messages: exportedMessages,
    attachmentManifest,
    jobReferences,
    transcript: buildTranscriptFromMessages(transcriptMessages),
  };
}