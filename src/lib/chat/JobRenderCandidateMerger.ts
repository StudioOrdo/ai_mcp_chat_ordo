import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobStatusMessagePart, GenerationStatusMessagePart, MessagePart } from "@/core/entities/message-parts";
import type { InlineNode } from "@/core/entities/rich-content";
import { describeJobStatus } from "@/lib/jobs/job-status";

export type JobRenderCandidate = {
  part: JobStatusMessagePart;
  computedActions?: InlineNode[];
  descriptor?: CapabilityPresentationDescriptor;
  resultEnvelope?: CapabilityResultEnvelope | null;
  encounterOrder: number;
};

export const MEDIA_TOOL_NAMES = new Set([
  "compose_media",
  "generate_audio",
  "generate_chart",
  "generate_graph",
]);

export function isJobStatusMessagePart(part: MessagePart): part is JobStatusMessagePart {
  return part.type === "job_status";
}

export function isGenerationStatusMessagePart(part: MessagePart): part is GenerationStatusMessagePart {
  return part.type === "generation_status";
}

export function getGenerationStatusPart(parts?: MessagePart[]): GenerationStatusMessagePart | null {
  if (!parts || parts.length === 0) {
    return null;
  }

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (isGenerationStatusMessagePart(part)) {
      return part;
    }
  }

  return null;
}

export function parseJobUpdatedAt(updatedAt: string | undefined): number {
  if (!updatedAt) {
    return 0;
  }

  const value = Date.parse(updatedAt);
  return Number.isNaN(value) ? 0 : value;
}

export function compareJobRenderCandidateFreshness(left: JobRenderCandidate, right: JobRenderCandidate): number {
  const leftSequence = left.part.sequence ?? Number.NEGATIVE_INFINITY;
  const rightSequence = right.part.sequence ?? Number.NEGATIVE_INFINITY;

  if (leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  const leftUpdatedAt = parseJobUpdatedAt(left.part.updatedAt);
  const rightUpdatedAt = parseJobUpdatedAt(right.part.updatedAt);
  if (leftUpdatedAt !== rightUpdatedAt) {
    return leftUpdatedAt - rightUpdatedAt;
  }

  return left.encounterOrder - right.encounterOrder;
}

export function upsertRenderedJobCandidate(
  candidates: JobRenderCandidate[],
  indexesByJobId: Map<string, number>,
  nextCandidate: JobRenderCandidate,
): void {
  const existingIndex = indexesByJobId.get(nextCandidate.part.jobId);
  if (existingIndex === undefined) {
    indexesByJobId.set(nextCandidate.part.jobId, candidates.length);
    candidates.push(nextCandidate);
    return;
  }

  const existingCandidate = candidates[existingIndex];
  if (!existingCandidate) {
    indexesByJobId.set(nextCandidate.part.jobId, candidates.length);
    candidates.push(nextCandidate);
    return;
  }

  if (compareJobRenderCandidateFreshness(existingCandidate, nextCandidate) < 0) {
    candidates[existingIndex] = nextCandidate;
  }
}

export function isMediaJobStatusPart(part: JobStatusMessagePart): boolean {
  return MEDIA_TOOL_NAMES.has(part.toolName);
}

export function resolveTruthBoundMediaText(
  originalText: string,
  parts: JobStatusMessagePart[],
): string {
  if (originalText.trim().length === 0) {
    return originalText;
  }

  const activeMediaParts = parts.filter((part) =>
    isMediaJobStatusPart(part)
    && (part.status === "queued"
      || part.status === "running"
      || part.status === "failed"
      || part.status === "canceled"),
  );

  if (activeMediaParts.length === 0) {
    return originalText;
  }

  return activeMediaParts.map((part) => describeJobStatus(part)).join("\n\n");
}
