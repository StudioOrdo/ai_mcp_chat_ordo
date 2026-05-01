import type { JobStatusMessagePart } from "@/core/entities/message-parts";

function parseUpdatedAt(updatedAt: string | undefined): number {
  if (!updatedAt) {
    return 0;
  }

  const value = Date.parse(updatedAt);
  return Number.isNaN(value) ? 0 : value;
}

function getTerminalStatusWeight(status: JobStatusMessagePart["status"]): number {
  return status === "succeeded"
    || status === "failed"
    || status === "dead_letter"
    || status === "canceled"
    ? 1
    : 0;
}

function getProgressStatusWeight(status: JobStatusMessagePart["status"]): number {
  if (status === "queued") {
    return 0;
  }

  if (status === "running") {
    return 1;
  }

  return 2;
}

function getResultWeight(part: JobStatusMessagePart): number {
  return part.resultPayload !== undefined || part.resultEnvelope !== undefined ? 1 : 0;
}

export function compareJobStatusPartFreshness(
  left: JobStatusMessagePart,
  right: JobStatusMessagePart,
): number {
  const leftSequence = left.sequence ?? Number.NEGATIVE_INFINITY;
  const rightSequence = right.sequence ?? Number.NEGATIVE_INFINITY;

  if (leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  const leftUpdatedAt = parseUpdatedAt(left.updatedAt);
  const rightUpdatedAt = parseUpdatedAt(right.updatedAt);
  if (leftUpdatedAt !== rightUpdatedAt) {
    return leftUpdatedAt - rightUpdatedAt;
  }

  const leftTerminalWeight = getTerminalStatusWeight(left.status);
  const rightTerminalWeight = getTerminalStatusWeight(right.status);
  if (leftTerminalWeight !== rightTerminalWeight) {
    return leftTerminalWeight - rightTerminalWeight;
  }

  const leftProgressWeight = getProgressStatusWeight(left.status);
  const rightProgressWeight = getProgressStatusWeight(right.status);
  if (leftProgressWeight !== rightProgressWeight) {
    return leftProgressWeight - rightProgressWeight;
  }

  return getResultWeight(left) - getResultWeight(right);
}

function mergeNullable<T>(next: T | undefined, previous: T | undefined): T | undefined {
  return next !== undefined ? next : previous;
}

export function mergeJobStatusPart(
  existing: JobStatusMessagePart,
  incoming: JobStatusMessagePart,
): JobStatusMessagePart {
  if (compareJobStatusPartFreshness(existing, incoming) > 0) {
    return existing;
  }

  const existingSequence = existing.sequence ?? -1;
  const incomingSequence = incoming.sequence ?? -1;
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