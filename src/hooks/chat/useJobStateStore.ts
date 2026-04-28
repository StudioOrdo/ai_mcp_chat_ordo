import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";

export interface JobStateEntry {
  messageId: string;
  part: JobStatusMessagePart;
}

function isJobStatusMessagePart(part: NonNullable<ChatMessage["parts"]>[number]): part is JobStatusMessagePart {
  return part.type === "job_status";
}

function mergeNullable<T>(next: T | undefined, previous: T | undefined): T | undefined {
  return next !== undefined ? next : previous;
}

function mergeJobStatusPart(
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
    attemptCount: newer.attemptCount ?? older.attemptCount,
    maxAttempts: mergeNullable(newer.maxAttempts, older.maxAttempts),
    nextRetryAt: mergeNullable(newer.nextRetryAt, older.nextRetryAt),
    startedAt: mergeNullable(newer.startedAt, older.startedAt),
    completedAt: mergeNullable(newer.completedAt, older.completedAt),
    lastCheckpointId: mergeNullable(newer.lastCheckpointId, older.lastCheckpointId),
    failureClass: newer.failureClass ?? older.failureClass,
    recoveryMode: newer.recoveryMode ?? older.recoveryMode,
    replayedFromJobId: newer.replayedFromJobId ?? older.replayedFromJobId,
    supersededByJobId: newer.supersededByJobId ?? older.supersededByJobId,
    actions: newer.actions ?? older.actions,
  };
}

function mergeEntryMap(
  current: Map<string, JobStateEntry>,
  incomingEntries: readonly JobStateEntry[],
): Map<string, JobStateEntry> {
  if (incomingEntries.length === 0) {
    return current;
  }

  const next = new Map(current);

  for (const entry of incomingEntries) {
    const existing = next.get(entry.part.jobId);
    if (!existing) {
      next.set(entry.part.jobId, entry);
      continue;
    }

    next.set(entry.part.jobId, {
      messageId: entry.messageId || existing.messageId,
      part: mergeJobStatusPart(existing.part, entry.part),
    });
  }

  return next;
}

function extractEntriesFromMessages(messages: readonly ChatMessage[]): JobStateEntry[] {
  const entries: JobStateEntry[] = [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (!isJobStatusMessagePart(part)) {
        continue;
      }

      entries.push({
        messageId: message.id,
        part,
      });
    }
  }

  return entries;
}

export function useJobStateStore(
  conversationId: string | null,
  messages: readonly ChatMessage[],
) {
  const [entriesByJobId, setEntriesByJobId] = useState<Map<string, JobStateEntry>>(new Map());
  const previousConversationIdRef = useRef<string | null>(conversationId);

  useEffect(() => {
    const extracted = extractEntriesFromMessages(messages);
    const conversationChanged = previousConversationIdRef.current !== conversationId;
    previousConversationIdRef.current = conversationId;

    setEntriesByJobId((current) => {
      if (!conversationId) {
        return new Map();
      }

      if (conversationChanged) {
        return mergeEntryMap(new Map(), extracted);
      }

      return mergeEntryMap(current, extracted);
    });
  }, [conversationId, messages]);

  const jobStateEntries = useMemo(() => [...entriesByJobId.values()], [entriesByJobId]);

  return {
    jobStateEntries,
  };
}