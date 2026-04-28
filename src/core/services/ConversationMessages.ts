import type { ChatMessage, FailedSendMetadata } from "@/core/entities/chat-message";
import type { GenerationStatusMessagePart, JobStatusMessagePart, MessagePart } from "@/core/entities/message-parts";

export interface GenerationStatusUpdate {
  status: GenerationStatusMessagePart["status"];
  actor: GenerationStatusMessagePart["actor"];
  reason: string;
  partialContentRetained?: boolean;
  recordedAt?: string;
}

export function updateMessageAtIndex(
  state: ChatMessage[],
  index: number,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const message = state[index];
  if (!message) {
    return state;
  }

  const updated = [...state];
  updated[index] = updater(message);
  return updated;
}

export function updateMessageById(
  state: ChatMessage[],
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const index = state.findIndex((message) => message.id === messageId);
  if (index < 0) {
    return state;
  }

  return updateMessageAtIndex(state, index, updater);
}

export function appendPart(
  message: ChatMessage,
  part: NonNullable<ChatMessage["parts"]>[number],
): ChatMessage {
  return {
    ...message,
    parts: [...(message.parts || []), part],
  };
}

export function appendTextDelta(message: ChatMessage, delta: string): ChatMessage {
  const parts = [...(message.parts || [])];
  const lastPart = parts[parts.length - 1];

  if (lastPart && lastPart.type === "text") {
    parts[parts.length - 1] = {
      ...lastPart,
      text: lastPart.text + delta,
    };
  } else {
    parts.push({ type: "text", text: delta });
  }

  return {
    ...message,
    content: (message.content || "") + delta,
    parts,
  };
}

export function isJobStatusMessagePart(
  part: NonNullable<ChatMessage["parts"]>[number],
): part is JobStatusMessagePart {
  return part.type === "job_status";
}

export function isGenerationStatusMessagePart(
  part: NonNullable<ChatMessage["parts"]>[number],
): part is GenerationStatusMessagePart {
  return part.type === "generation_status";
}

export function hasRetainedAssistantOutput(message: ChatMessage): boolean {
  if ((message.content || "").trim().length > 0) {
    return true;
  }

  return (message.parts ?? []).some((part) => part.type !== "generation_status");
}

function mergeJobStatusMessagePart(
  existing: JobStatusMessagePart,
  incoming: JobStatusMessagePart,
): JobStatusMessagePart {
  const existingSequence = existing.sequence ?? -1;
  const incomingSequence = incoming.sequence ?? -1;

  if (incomingSequence < existingSequence) {
    return existing;
  }

  const newer = incomingSequence >= existingSequence ? incoming : existing;
  const older = newer === incoming ? existing : incoming;

  const mergeNullable = <T,>(next: T | undefined, previous: T | undefined): T | undefined => (
    next !== undefined ? next : previous
  );

  return {
    ...older,
    ...newer,
    title: newer.title ?? older.title,
    subtitle: newer.subtitle ?? older.subtitle,
    progressPercent: mergeNullable(newer.progressPercent, older.progressPercent),
    progressLabel: mergeNullable(newer.progressLabel, older.progressLabel),
    summary: newer.summary ?? older.summary,
    error: newer.error ?? older.error,
    updatedAt: newer.updatedAt ?? older.updatedAt,
    resultPayload: newer.resultPayload ?? older.resultPayload,
    resultEnvelope: mergeNullable(newer.resultEnvelope, older.resultEnvelope),
    failureClass: newer.failureClass ?? older.failureClass,
    recoveryMode: newer.recoveryMode ?? older.recoveryMode,
    nextRetryAt: mergeNullable(newer.nextRetryAt, older.nextRetryAt),
    lastCheckpointId: mergeNullable(newer.lastCheckpointId, older.lastCheckpointId),
    replayedFromJobId: newer.replayedFromJobId ?? older.replayedFromJobId,
    supersededByJobId: newer.supersededByJobId ?? older.supersededByJobId,
    actions: newer.actions ?? older.actions,
  };
}

export function upsertJobStatusMessage(
  state: ChatMessage[],
  part: JobStatusMessagePart,
  messageId?: string,
): ChatMessage[] {
  const targetIndex = state.findIndex((message) => {
    if (messageId && message.id === messageId) {
      return true;
    }

    return message.parts?.some(
      (candidate) => isJobStatusMessagePart(candidate) && candidate.jobId === part.jobId,
    ) ?? false;
  });

  if (targetIndex >= 0) {
    return updateMessageAtIndex(state, targetIndex, (message) => ({
      ...(() => {
        const existingPart = (message.parts ?? []).find(
          (candidate): candidate is JobStatusMessagePart => (
            isJobStatusMessagePart(candidate) && candidate.jobId === part.jobId
          ),
        );
        const mergedPart = existingPart ? mergeJobStatusMessagePart(existingPart, part) : part;
        const parts = message.parts ?? [];
        const nextParts = existingPart
          ? parts.map((candidate) => (
            isJobStatusMessagePart(candidate) && candidate.jobId === part.jobId
              ? mergedPart
              : candidate
          ))
          : [...parts, mergedPart];

        return {
          ...message,
          content: "",
          timestamp: mergedPart.updatedAt ? new Date(mergedPart.updatedAt) : message.timestamp,
          parts: nextParts,
        };
      })(),
    }));
  }

  return [
    ...state,
    {
      id: messageId ?? `job_${part.jobId}`,
      role: "assistant",
      content: "",
      timestamp: part.updatedAt ? new Date(part.updatedAt) : new Date(),
      parts: [part],
    },
  ];
}

export function upsertGenerationStatusMessage(
  state: ChatMessage[],
  index: number,
  generation: GenerationStatusUpdate,
): ChatMessage[] {
  return updateMessageAtIndex(state, index, (message) => ({
    ...message,
    parts: [
      ...(message.parts ?? []).filter(
        (candidate) => !isGenerationStatusMessagePart(candidate),
      ),
      {
        type: "generation_status" as const,
        status: generation.status,
        actor: generation.actor,
        reason: generation.reason,
        partialContentRetained:
          generation.partialContentRetained ?? hasRetainedAssistantOutput(message),
        recordedAt: generation.recordedAt,
      },
    ],
  }));
}

export function setFailedSendMetadata(
  state: ChatMessage[],
  index: number,
  failedSend: FailedSendMetadata,
): ChatMessage[] {
  return updateMessageAtIndex(state, index, (message) => ({
    ...message,
    metadata: {
      ...message.metadata,
      failedSend,
    },
  }));
}

export function replaceMessageParts(
  state: ChatMessage[],
  messageId: string,
  parts: MessagePart[],
  content?: string,
): ChatMessage[] {
  return updateMessageById(state, messageId, (message) => ({
    ...message,
    ...(content === undefined ? {} : { content }),
    parts,
  }));
}
