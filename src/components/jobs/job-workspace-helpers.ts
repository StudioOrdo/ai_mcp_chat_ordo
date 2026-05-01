import type { JobFailureClass } from "@/core/entities/job";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import { getJobCapability } from "@/lib/jobs/job-capability-registry";
import { getAdminJournalPreviewPath } from "@/lib/journal/admin-journal-routes";

export type JobAction = "cancel" | "retry";

export interface JobArtifactLink {
  href: string;
  label: string;
}

export interface ExportedJobLog {
  version: 1;
  exportedAt: string;
  job: {
    jobId: string;
    toolName: string;
    label: string;
    title: string | null;
    subtitle: string | null;
    status: CanonicalJobSnapshot["status"];
    summary: string;
    error: string | null;
    updatedAt: string | null;
    conversationId: string | null;
    failureClass: JobFailureClass | null;
    recoveryMode: CanonicalJobSnapshot["failure"]["recoveryMode"];
    replayedFromJobId: string | null;
    supersededByJobId: string | null;
    resultPayload: unknown | null;
  };
  history: Array<{
    id: string;
    sequence: number;
    eventType: string;
    status: JobHistoryEntry["part"]["status"];
    createdAt: string;
    summary: string;
    error: string | null;
    progressLabel: string | null;
    progressPercent: number | null;
  }>;
}

export const STATUS_LABELS: Record<CanonicalJobSnapshot["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
  dead_letter: "Needs recovery",
};

export function getStatusTone(status: CanonicalJobSnapshot["status"]): string {
  if (status === "succeeded") {
    return "jobs-status-succeeded";
  }
  if (status === "failed") {
    return "jobs-status-failed";
  }
  if (status === "dead_letter") {
    return "jobs-status-failed";
  }
  if (status === "canceled") {
    return "jobs-status-canceled";
  }
  return status === "queued" || status === "running" ? "jobs-status-active" : "jobs-count-pill";
}

export function getJobAction(status: CanonicalJobSnapshot["status"]): { action: JobAction; label: string } | null {
  if (status === "queued" || status === "running") {
    return { action: "cancel", label: "Cancel" };
  }

  if (status === "failed" || status === "canceled" || status === "dead_letter") {
    return { action: "retry", label: "Replay" };
  }

  return null;
}

export function formatJobTimestamp(value: string | undefined): string {
  if (!value) {
    return "Updated recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatJobSummary(snapshot: CanonicalJobSnapshot): string {
  if (snapshot.error) {
    return snapshot.error;
  }

  if (snapshot.summary) {
    return snapshot.summary;
  }

  if (snapshot.progressLabel) {
    return snapshot.progressPercent != null
      ? `${snapshot.progressLabel} (${Math.round(snapshot.progressPercent)}%)`
      : snapshot.progressLabel;
  }

  return "Waiting for the next job update.";
}

export function formatJobFailureClass(failureClass: JobFailureClass | null | undefined): string | null {
  if (!failureClass) {
    return null;
  }

  const labels: Record<JobFailureClass, string> = {
    canceled: "Canceled",
    policy: "Policy blocked",
    terminal: "Terminal failure",
    transient: "Transient failure",
    unknown: "Unknown failure",
  };

  return labels[failureClass];
}

export function getJobArtifactLink(snapshot: CanonicalJobSnapshot | null): JobArtifactLink | null {
  if (!snapshot) {
    return null;
  }

  const artifactPolicy = getJobCapability(snapshot.toolName)?.artifactPolicy.mode;
  if (artifactPolicy !== "open_artifact" && artifactPolicy !== "open_or_download") {
    return null;
  }

  if (typeof snapshot.resultPayload !== "object" || snapshot.resultPayload === null) {
    return null;
  }

  const payload = snapshot.resultPayload as Record<string, unknown>;
  const slug = typeof payload.slug === "string" && payload.slug.trim().length > 0
    ? payload.slug.trim()
    : null;

  if (!slug) {
    return null;
  }

  if (payload.status === "draft") {
    return {
      href: getAdminJournalPreviewPath(slug),
      label: "Open artifact",
    };
  }

  if (payload.status === "published") {
    return {
      href: `/journal/${slug}`,
      label: "Open artifact",
    };
  }

  return null;
}

export function buildJobSummaryClipboardText(snapshot: CanonicalJobSnapshot): string {
  const title = snapshot.title ?? snapshot.label;
  const lines = [
    title,
    `Job ID: ${snapshot.jobId}`,
    `Status: ${STATUS_LABELS[snapshot.status]}`,
  ];

  if (snapshot.updatedAt) {
    lines.push(`Updated: ${formatJobTimestamp(snapshot.updatedAt)}`);
  }

  const failureClass = formatJobFailureClass(snapshot.failure.failureClass);
  if (failureClass) {
    lines.push(`Failure class: ${failureClass}`);
  }

  if (snapshot.failure.replayedFromJobId) {
    lines.push(`Replayed from: ${snapshot.failure.replayedFromJobId}`);
  }

  if (snapshot.failure.supersededByJobId) {
    lines.push(`Superseded by: ${snapshot.failure.supersededByJobId}`);
  }

  lines.push(`Summary: ${formatJobSummary(snapshot)}`);
  return lines.join("\n");
}

export function buildJobFailureClipboardText(snapshot: CanonicalJobSnapshot): string | null {
  if (!snapshot.error) {
    return null;
  }

  const title = snapshot.title ?? snapshot.label;
  const lines = [
    title,
    `Job ID: ${snapshot.jobId}`,
    `Status: ${STATUS_LABELS[snapshot.status]}`,
  ];

  const failureClass = formatJobFailureClass(snapshot.failure.failureClass);
  if (failureClass) {
    lines.push(`Failure class: ${failureClass}`);
  }

  lines.push(`Failure: ${snapshot.error}`);
  return lines.join("\n");
}

function sanitizeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function getJobLogExportFileName(snapshot: CanonicalJobSnapshot): string {
  const baseName = sanitizeFileSegment(snapshot.title ?? snapshot.label) || "job-log";
  return `${baseName}-${snapshot.jobId}.json`;
}

export function buildJobLogExport(snapshot: CanonicalJobSnapshot, history: JobHistoryEntry[]): ExportedJobLog {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    job: {
      jobId: snapshot.jobId,
      toolName: snapshot.toolName,
      label: snapshot.label,
      title: snapshot.title ?? null,
      subtitle: snapshot.subtitle ?? null,
      status: snapshot.status,
      summary: formatJobSummary(snapshot),
      error: snapshot.error ?? null,
      updatedAt: snapshot.updatedAt ?? null,
      conversationId: snapshot.conversationId ?? null,
      failureClass: snapshot.failure.failureClass ?? null,
      recoveryMode: snapshot.failure.recoveryMode ?? null,
      replayedFromJobId: snapshot.failure.replayedFromJobId ?? null,
      supersededByJobId: snapshot.failure.supersededByJobId ?? null,
      resultPayload: snapshot.resultPayload ?? null,
    },
    history: history.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      eventType: entry.eventType,
      status: entry.part.status,
      createdAt: entry.createdAt,
      summary: formatJobHistoryEntry(entry),
      error: entry.part.error ?? null,
      progressLabel: entry.part.progressLabel ?? null,
      progressPercent: entry.part.progressPercent ?? null,
    })),
  };
}

export function formatJobHistoryEntry(entry: JobHistoryEntry): string {
  if (entry.part.error) {
    return entry.part.error;
  }

  if (entry.part.summary) {
    return entry.part.summary;
  }

  if (entry.part.progressLabel) {
    return entry.part.progressPercent != null
      ? `${entry.part.progressLabel} (${Math.round(entry.part.progressPercent)}%)`
      : entry.part.progressLabel;
  }

  return `${STATUS_LABELS[entry.part.status]} event captured.`;
}
