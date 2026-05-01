import type { JobRequest, JobStatus } from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { getCatalogDefinition } from "@/core/capability-catalog/catalog";
import { buildDeferredJobDedupeKey } from "@/lib/jobs/job-dedupe";
import { getJobCapability } from "@/lib/jobs/job-capability-registry";

export const CANCELABLE_JOB_STATUSES = new Set<JobStatus>(["queued", "running"]);
export const RETRIABLE_JOB_STATUSES = new Set<JobStatus>(["failed", "canceled", "dead_letter"]);

export interface ManualJobReplayResult {
  outcome: "deduped" | "queued";
  sourceJobId: string;
  job: JobRequest;
  dedupeKey: string | null;
  eventSequence?: number;
}

export function isJobCancelable(status: JobStatus): boolean {
  return CANCELABLE_JOB_STATUSES.has(status);
}

export function canManualReplayJob(job: Pick<JobRequest, "status" | "toolName">): boolean {
  const capability = getJobCapability(job.toolName);
  return RETRIABLE_JOB_STATUSES.has(job.status) && capability !== null;
}

export function resolveManualReplayDedupeKey(
  job: Pick<JobRequest, "conversationId" | "dedupeKey" | "requestPayload" | "toolName">,
): string | null {
  const deferred = getCatalogDefinition(job.toolName)?.runtime.deferred;

  if (deferred?.dedupeStrategy === "per-conversation-payload") {
    return buildDeferredJobDedupeKey(job.conversationId, job.toolName, job.requestPayload);
  }

  return job.dedupeKey ?? null;
}

function buildManualReplaySummary(status: JobStatus): string {
  return `Manual replay queued from ${status} job.`;
}

export async function performManualJobReplay(
  repository: JobQueueRepository,
  sourceJob: JobRequest,
  options?: {
    ownerUserId?: string | null;
    requestedByUserId?: string | null;
  },
): Promise<ManualJobReplayResult> {
  if (!canManualReplayJob(sourceJob)) {
    throw new Error(`Job ${sourceJob.id} is not configured for manual replay.`);
  }

  const capability = getJobCapability(sourceJob.toolName);

  if (!capability) {
    throw new Error(`No job capability registered for tool: ${sourceJob.toolName}`);
  }

  const dedupeKey = resolveManualReplayDedupeKey(sourceJob);
  const existing = dedupeKey
    ? await repository.findActiveJobByDedupeKey(sourceJob.conversationId, dedupeKey)
    : null;

  if (existing) {
    await repository.updateJobStatus(sourceJob.id, {
      status: sourceJob.status,
      supersededByJobId: existing.id,
    });

    return {
      outcome: "deduped",
      sourceJobId: sourceJob.id,
      job: existing,
      dedupeKey,
    };
  }

  const replayedJob = await repository.createJob({
    conversationId: sourceJob.conversationId,
    userId: sourceJob.userId ?? options?.ownerUserId ?? null,
    toolName: sourceJob.toolName,
    priority: sourceJob.priority,
    dedupeKey,
    initiatorType: sourceJob.initiatorType,
    recoveryMode: capability.recoveryMode,
    replayedFromJobId: sourceJob.id,
    requestPayload: sourceJob.requestPayload,
  });

  await repository.updateJobStatus(sourceJob.id, {
    status: sourceJob.status,
    supersededByJobId: replayedJob.id,
  });

  const queuedEvent = await repository.appendEvent({
    jobId: replayedJob.id,
    conversationId: replayedJob.conversationId,
    eventType: "queued",
    payload: {
      toolName: replayedJob.toolName,
      replayedFromJobId: sourceJob.id,
      recoveryMode: replayedJob.recoveryMode,
      summary: buildManualReplaySummary(sourceJob.status),
      ...(options?.requestedByUserId ? { requestedByUserId: options.requestedByUserId } : {}),
    },
  });

  return {
    outcome: "queued",
    sourceJobId: sourceJob.id,
    job: replayedJob,
    dedupeKey,
    eventSequence: queuedEvent.sequence,
  };
}
