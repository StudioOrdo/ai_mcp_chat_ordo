import type { PresentedMessage } from "@/adapters/ChatPresenter";
import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type {
  CapabilityProgressPhase,
  CapabilityProgressPhaseStatus,
} from "@/core/entities/capability-result";
import type { JobStatus } from "@/core/entities/job";

export type ProgressStripViewport = "mobile" | "desktop";

export interface ResolvedProgressStripItem {
  jobId: string;
  toolName: string;
  label: string;
  title: string | null;
  subtitle: string | null;
  summary: string | null;
  status: JobStatus;
  bubbleStatus: CapabilityProgressPhaseStatus;
  statusText: string;
  phaseLabel: string | null;
  progressPercent: number | null;
  updatedAt: string | null;
  descriptor: CapabilityPresentationDescriptor;
  canRetryWholeJob: boolean;
}

export interface ResolvedProgressStripLayout {
  items: readonly ResolvedProgressStripItem[];
  visibleItems: readonly ResolvedProgressStripItem[];
  overflowItems: readonly ResolvedProgressStripItem[];
  visibleCap: number;
}

export const MOBILE_PROGRESS_STRIP_VISIBLE_CAP = 2;
export const DESKTOP_PROGRESS_STRIP_VISIBLE_CAP = 3;

const JOB_STATUS_PRIORITY: Record<JobStatus, number> = {
  failed: 0,
  dead_letter: 0,
  canceled: 0,
  running: 1,
  queued: 2,
  succeeded: 3,
};

type DescriptorLookup = (toolName: string) => CapabilityPresentationDescriptor | undefined;

type ProgressCandidate = {
  item: ResolvedProgressStripItem | null;
  sequence: number;
  updatedAtMs: number;
  messageIndex: number;
  entryIndex: number;
};

function resolveProgressBubbleStatus(status: JobStatus): CapabilityProgressPhaseStatus {
  switch (status) {
    case "queued":
      return "pending";
    case "running":
      return "active";
    case "failed":
    case "dead_letter":
      return "failed";
    case "canceled":
      return "canceled";
    case "succeeded":
      return "succeeded";
  }
}

function resolveProgressPhase(
  phases: CapabilityProgressPhase[] | undefined,
  activePhaseKey: string | null | undefined,
): CapabilityProgressPhase | null {
  if (!phases || phases.length === 0) {
    return null;
  }

  if (activePhaseKey) {
    const activeByKey = phases.find((phase) => phase.key === activePhaseKey);
    if (activeByKey) {
      return activeByKey;
    }
  }

  return phases.find((phase) => phase.status === "active") ?? null;
}

function resolvePhaseLabel(candidate: ResolvedProgressStripItem): string {
  if (candidate.status === "failed" || candidate.status === "dead_letter") {
    return "Needs attention";
  }

  if (candidate.status === "canceled") {
    return "Canceled";
  }

  if (candidate.status === "queued") {
    return "Queued";
  }

  if (candidate.phaseLabel && candidate.progressPercent != null) {
    return `${candidate.phaseLabel} ${candidate.progressPercent}%`;
  }

  if (candidate.phaseLabel) {
    return candidate.phaseLabel;
  }

  if (candidate.progressPercent != null) {
    return `Running ${candidate.progressPercent}%`;
  }

  return "Running";
}

function parseUpdatedAt(updatedAt: string | undefined): number {
  if (!updatedAt) {
    return 0;
  }

  const value = Date.parse(updatedAt);
  return Number.isNaN(value) ? 0 : value;
}

function isBrowserRuntimeJobId(jobId: string): boolean {
  return jobId.startsWith("browser:");
}

function isEligibleDescriptor(descriptor: CapabilityPresentationDescriptor | undefined): descriptor is CapabilityPresentationDescriptor {
  if (!descriptor) {
    return false;
  }

  if (descriptor.progressMode === "none") {
    return false;
  }

  return descriptor.executionMode === "deferred"
    || descriptor.executionMode === "browser"
    || descriptor.executionMode === "hybrid"
    || descriptor.defaultSurface === "global_strip";
}

function isEligibleStatus(status: JobStatus): boolean {
  return status === "queued"
    || status === "running"
    || status === "failed"
    || status === "canceled";
}

function compareCandidateFreshness(left: ProgressCandidate, right: ProgressCandidate): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  if (left.updatedAtMs !== right.updatedAtMs) {
    return left.updatedAtMs - right.updatedAtMs;
  }

  if (left.messageIndex !== right.messageIndex) {
    return left.messageIndex - right.messageIndex;
  }

  return left.entryIndex - right.entryIndex;
}

function compareItems(left: ResolvedProgressStripItem, right: ResolvedProgressStripItem): number {
  const leftPriority = JOB_STATUS_PRIORITY[left.status];
  const rightPriority = JOB_STATUS_PRIORITY[right.status];

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftUpdatedAtMs = parseUpdatedAt(left.updatedAt ?? undefined);
  const rightUpdatedAtMs = parseUpdatedAt(right.updatedAt ?? undefined);
  if (leftUpdatedAtMs !== rightUpdatedAtMs) {
    return rightUpdatedAtMs - leftUpdatedAtMs;
  }

  return left.label.localeCompare(right.label);
}

export function resolveProgressStrip(
  messages: readonly PresentedMessage[],
  lookupDescriptor: DescriptorLookup,
): ResolvedProgressStripItem[] {
  const latestByJobId = new Map<string, ProgressCandidate>();

  messages.forEach((message, messageIndex) => {
    message.toolRenderEntries.forEach((entry, entryIndex) => {
      if (entry.kind !== "job-status") {
        return;
      }

      const descriptor = entry.descriptor ?? lookupDescriptor(entry.part.toolName);
      if (!isEligibleDescriptor(descriptor)) {
        return;
      }

      if (entry.part.supersededByJobId) {
        return;
      }

      const baseCandidate = {
        sequence: entry.part.sequence ?? Number.NEGATIVE_INFINITY,
        updatedAtMs: parseUpdatedAt(entry.part.updatedAt),
        messageIndex,
        entryIndex,
      };

      if (!isEligibleStatus(entry.part.status)) {
        if (entry.part.status === "succeeded") {
          const candidate: ProgressCandidate = {
            item: null,
            ...baseCandidate,
          };
          const existing = latestByJobId.get(entry.part.jobId);
          if (!existing || compareCandidateFreshness(existing, candidate) < 0) {
            latestByJobId.set(entry.part.jobId, candidate);
          }
        }
        return;
      }

      const progress = entry.resultEnvelope?.progress;
      const terminalStatus = entry.part.status === "failed" || entry.part.status === "canceled";
      const activePhase = terminalStatus ? null : resolveProgressPhase(progress?.phases, progress?.activePhaseKey);
      const phaseLabel = terminalStatus
        ? null
        : activePhase?.label ?? entry.part.progressLabel ?? progress?.label ?? null;
      const progressPercent = terminalStatus
        ? null
        : entry.part.progressPercent ?? activePhase?.percent ?? progress?.percent ?? null;

      const item: ResolvedProgressStripItem = {
        jobId: entry.part.jobId,
        toolName: entry.part.toolName,
        label: entry.part.label || descriptor.label,
        title: entry.part.title ?? entry.resultEnvelope?.summary.title ?? null,
        subtitle: entry.part.subtitle ?? entry.resultEnvelope?.summary.subtitle ?? null,
        summary: entry.part.summary ?? entry.resultEnvelope?.summary.message ?? null,
        status: entry.part.status,
        bubbleStatus: resolveProgressBubbleStatus(entry.part.status),
        statusText: "",
        phaseLabel,
        progressPercent,
        updatedAt: entry.part.updatedAt ?? null,
        descriptor,
        canRetryWholeJob:
          descriptor.supportsRetry === "whole_job"
          && !isBrowserRuntimeJobId(entry.part.jobId)
          && (entry.part.status === "failed" || entry.part.status === "canceled"),
      };

      item.statusText = resolvePhaseLabel(item);

      const candidate: ProgressCandidate = {
        item,
        ...baseCandidate,
      };

      const existing = latestByJobId.get(entry.part.jobId);
      if (!existing || compareCandidateFreshness(existing, candidate) < 0) {
        latestByJobId.set(entry.part.jobId, candidate);
      }
    });
  });

  return [...latestByJobId.values()]
    .flatMap((candidate) => candidate.item ? [candidate.item] : [])
    .sort(compareItems);
}

export function getProgressStripVisibleCap(viewport: ProgressStripViewport): number {
  return viewport === "mobile"
    ? MOBILE_PROGRESS_STRIP_VISIBLE_CAP
    : DESKTOP_PROGRESS_STRIP_VISIBLE_CAP;
}

export function resolveProgressStripLayout(
  items: readonly ResolvedProgressStripItem[],
  viewport: ProgressStripViewport,
): ResolvedProgressStripLayout {
  const visibleCap = getProgressStripVisibleCap(viewport);

  return {
    items,
    visibleItems: items.slice(0, visibleCap),
    overflowItems: items.slice(visibleCap),
    visibleCap,
  };
}
