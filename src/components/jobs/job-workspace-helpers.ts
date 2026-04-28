import type { JobFailureClass } from "@/core/entities/job";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { JobStatusSnapshot } from "@/lib/jobs/job-read-model";
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
    status: JobStatusSnapshot["part"]["status"];
    summary: string;
    error: string | null;
    updatedAt: string | null;
    conversationId: string | null;
    failureClass: JobFailureClass | null;
    recoveryMode: JobStatusSnapshot["part"]["recoveryMode"];
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

export const STATUS_LABELS: Record<JobStatusSnapshot["part"]["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
  dead_letter: "Needs recovery",
};

export function getStatusTone(status: JobStatusSnapshot["part"]["status"]): string {
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

export function getJobAction(status: JobStatusSnapshot["part"]["status"]): { action: JobAction; label: string } | null {
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

export function formatJobSummary(snapshot: JobStatusSnapshot): string {
  if (snapshot.part.error) {
    return snapshot.part.error;
  }

  if (snapshot.part.summary) {
    return snapshot.part.summary;
  }

  if (snapshot.part.progressLabel) {
    return snapshot.part.progressPercent != null
      ? `${snapshot.part.progressLabel} (${Math.round(snapshot.part.progressPercent)}%)`
      : snapshot.part.progressLabel;
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

export function getJobArtifactLink(snapshot: JobStatusSnapshot | null): JobArtifactLink | null {
  if (!snapshot) {
    return null;
  }

  const artifactPolicy = getJobCapability(snapshot.part.toolName)?.artifactPolicy.mode;
  if (artifactPolicy !== "open_artifact" && artifactPolicy !== "open_or_download") {
    return null;
  }

  if (typeof snapshot.part.resultPayload !== "object" || snapshot.part.resultPayload === null) {
    return null;
  }

  const payload = snapshot.part.resultPayload as Record<string, unknown>;
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

export function buildJobSummaryClipboardText(snapshot: JobStatusSnapshot): string {
  const title = snapshot.part.title ?? snapshot.part.label;
  const lines = [
    title,
    `Job ID: ${snapshot.part.jobId}`,
    `Status: ${STATUS_LABELS[snapshot.part.status]}`,
  ];

  if (snapshot.part.updatedAt) {
    lines.push(`Updated: ${formatJobTimestamp(snapshot.part.updatedAt)}`);
  }

  const failureClass = formatJobFailureClass(snapshot.part.failureClass);
  if (failureClass) {
    lines.push(`Failure class: ${failureClass}`);
  }

  if (snapshot.part.replayedFromJobId) {
    lines.push(`Replayed from: ${snapshot.part.replayedFromJobId}`);
  }

  if (snapshot.part.supersededByJobId) {
    lines.push(`Superseded by: ${snapshot.part.supersededByJobId}`);
  }

  lines.push(`Summary: ${formatJobSummary(snapshot)}`);
  return lines.join("\n");
}

export function buildJobFailureClipboardText(snapshot: JobStatusSnapshot): string | null {
  if (!snapshot.part.error) {
    return null;
  }

  const title = snapshot.part.title ?? snapshot.part.label;
  const lines = [
    title,
    `Job ID: ${snapshot.part.jobId}`,
    `Status: ${STATUS_LABELS[snapshot.part.status]}`,
  ];

  const failureClass = formatJobFailureClass(snapshot.part.failureClass);
  if (failureClass) {
    lines.push(`Failure class: ${failureClass}`);
  }

  lines.push(`Failure: ${snapshot.part.error}`);
  return lines.join("\n");
}

function sanitizeFileSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function getJobLogExportFileName(snapshot: JobStatusSnapshot): string {
  const baseName = sanitizeFileSegment(snapshot.part.title ?? snapshot.part.label) || "job-log";
  return `${baseName}-${snapshot.part.jobId}.json`;
}

export function buildJobLogExport(snapshot: JobStatusSnapshot, history: JobHistoryEntry[]): ExportedJobLog {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    job: {
      jobId: snapshot.part.jobId,
      toolName: snapshot.part.toolName,
      label: snapshot.part.label,
      title: snapshot.part.title ?? null,
      subtitle: snapshot.part.subtitle ?? null,
      status: snapshot.part.status,
      summary: formatJobSummary(snapshot),
      error: snapshot.part.error ?? null,
      updatedAt: snapshot.part.updatedAt ?? null,
      conversationId: snapshot.conversationId ?? null,
      failureClass: snapshot.part.failureClass ?? null,
      recoveryMode: snapshot.part.recoveryMode ?? null,
      replayedFromJobId: snapshot.part.replayedFromJobId ?? null,
      supersededByJobId: snapshot.part.supersededByJobId ?? null,
      resultPayload: snapshot.part.resultPayload ?? null,
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