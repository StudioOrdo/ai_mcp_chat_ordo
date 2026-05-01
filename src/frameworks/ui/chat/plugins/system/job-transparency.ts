import type { JobFailureClass, JobStatus } from "@/core/entities/job";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";
import type { CapabilityTone } from "../../primitives/capability-card-tone";

type FailurePresentation = {
  label: string;
  tone: CapabilityTone;
};

type ReplayRepairPresentation = {
  reference: string;
  resolvedAssetId: string;
  strategy: string;
};

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toSentenceCase(value: string): string {
  return value
    .replaceAll(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function formatDurationMs(durationMs: number): string {
  const boundedDurationMs = Math.max(0, durationMs);
  const totalSeconds = Math.floor(boundedDurationMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatSystemTimestamp(value: string | null | undefined): string | null {
  const parsed = parseTimestamp(value);
  if (parsed == null) {
    return null;
  }

  return new Date(parsed).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function resolveFailurePresentation(
  failureClass: JobFailureClass | null | undefined,
  status: JobStatus,
): FailurePresentation {
  if (status === "canceled" || failureClass === "canceled") {
    return { label: "Canceled", tone: "warning" };
  }

  switch (failureClass) {
    case "policy":
      return { label: "Policy block", tone: "accent" };
    case "terminal":
      return { label: "Terminal error", tone: "danger" };
    case "transient":
      return { label: "Transient issue", tone: "warning" };
    case "unknown":
      return { label: "Unexpected error", tone: "accent" };
    default:
      if (status === "dead_letter") {
        return { label: "Terminal error", tone: "danger" };
      }
      if (status === "failed") {
        return { label: "Failed", tone: "danger" };
      }
      return { label: "Canceled", tone: "warning" };
  }
}

export function resolveReplayRouteLabel(
  resultEnvelope: CapabilityResultEnvelope | null | undefined,
): string | null {
  const replaySnapshot = asRecord(resultEnvelope?.replaySnapshot);
  if (!replaySnapshot || typeof replaySnapshot.route !== "string" || replaySnapshot.route.length === 0) {
    return null;
  }

  return toSentenceCase(replaySnapshot.route);
}

export function resolveReplayRepairs(
  resultEnvelope: CapabilityResultEnvelope | null | undefined,
): ReplayRepairPresentation[] {
  const replaySnapshot = asRecord(resultEnvelope?.replaySnapshot);
  if (!replaySnapshot || !Array.isArray(replaySnapshot.repairs)) {
    return [];
  }

  return replaySnapshot.repairs.flatMap((repair) => {
    const repairRecord = asRecord(repair);
    if (!repairRecord) {
      return [];
    }

    const reference = typeof repairRecord.reference === "string" ? repairRecord.reference : null;
    const resolvedAssetId = typeof repairRecord.resolvedAssetId === "string" ? repairRecord.resolvedAssetId : null;
    const strategy = typeof repairRecord.strategy === "string" ? repairRecord.strategy : null;
    if (!reference || !resolvedAssetId || !strategy) {
      return [];
    }

    return [{
      reference,
      resolvedAssetId,
      strategy: toSentenceCase(strategy),
    }];
  });
}

export function resolveReplayRepairSummary(repairs: readonly ReplayRepairPresentation[]): string | null {
  if (repairs.length === 0) {
    return null;
  }

  return `${repairs.length} asset repair${repairs.length === 1 ? "" : "s"}`;
}

export function resolveJobAttemptLabel(part: JobStatusMessagePart | undefined): string | null {
  if (!part?.attemptCount) {
    return null;
  }

  if (typeof part.maxAttempts === "number" && part.maxAttempts > 0) {
    return `Attempt ${part.attemptCount} of ${part.maxAttempts}`;
  }

  return `Attempt ${part.attemptCount}`;
}

export function resolveRetryCountdownLabel(nextRetryAt: string | null | undefined, nowMs: number): string | null {
  const retryAtMs = parseTimestamp(nextRetryAt);
  if (retryAtMs == null) {
    return null;
  }

  const remainingMs = retryAtMs - nowMs;
  if (remainingMs <= 0) {
    return "Retrying now...";
  }

  return `Retry in ${formatDurationMs(remainingMs)}`;
}

export function resolveRunDurationLabel(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  nowMs: number,
): string | null {
  const startedAtMs = parseTimestamp(startedAt);
  if (startedAtMs == null) {
    return null;
  }

  const completedAtMs = parseTimestamp(completedAt) ?? nowMs;
  return formatDurationMs(Math.max(0, completedAtMs - startedAtMs));
}

export function resolveCompactProgressLabel(
  part: JobStatusMessagePart | undefined,
  resultEnvelope: CapabilityResultEnvelope | null | undefined,
): string | null {
  const progressLabel = part?.progressLabel ?? resultEnvelope?.progress?.label ?? null;
  const progressPercent = part?.progressPercent ?? resultEnvelope?.progress?.percent ?? null;

  if (progressLabel && progressPercent != null) {
    return `${progressLabel} ${Math.round(progressPercent)}%`;
  }

  if (progressLabel) {
    return progressLabel;
  }

  if (progressPercent != null) {
    return `${Math.round(progressPercent)}%`;
  }

  return null;
}

export function resolveCompactMeta(
  part: JobStatusMessagePart | undefined,
  resultEnvelope: CapabilityResultEnvelope | null | undefined,
): string | null {
  const nowMs = Date.now();
  const parts = [
    resolveJobAttemptLabel(part),
    resolveCompactProgressLabel(part, resultEnvelope),
    resolveRetryCountdownLabel(part?.nextRetryAt, nowMs),
    part?.supersededByJobId ? `Superseded by ${part.supersededByJobId}` : null,
    part?.recoveryMode === "checkpoint_resume" ? "Checkpoint resume" : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function resolveJobPresentationNowMs(part: JobStatusMessagePart | undefined): number {
  if (!part) {
    return Date.now();
  }

  if (part.status === "queued" || part.status === "running" || part.nextRetryAt) {
    return Date.now();
  }

  const presentationAnchor = part.completedAt ?? part.updatedAt ?? part.startedAt;
  const parsedAnchor = parseTimestamp(presentationAnchor);
  return parsedAnchor ?? Date.now();
}

export function resolveJobDisplayStatus(
  part: JobStatusMessagePart | undefined,
  fallbackStatus: JobStatus,
  nowMs: number,
): string {
  if (!part) {
    switch (fallbackStatus) {
      case "succeeded":
        return "Completed";
      case "dead_letter":
        return "Terminal error";
      default:
        return fallbackStatus.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
    }
  }

  switch (part.status) {
    case "queued":
      return resolveRetryCountdownLabel(part.nextRetryAt, nowMs) ?? "Queued";
    case "running": {
      const elapsed = resolveRunDurationLabel(part.startedAt, null, nowMs);
      return elapsed ? `Running · ${elapsed}` : "Running";
    }
    case "succeeded": {
      const duration = resolveRunDurationLabel(part.startedAt, part.completedAt, nowMs);
      return duration ? `Completed in ${duration}` : "Completed";
    }
    case "failed":
    case "dead_letter":
    case "canceled":
      return resolveFailurePresentation(part.failureClass, part.status).label;
  }
}
