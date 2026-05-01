import type { JobRequest } from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { canManualReplayJob, isJobCancelable, performManualJobReplay } from "@/lib/jobs/manual-replay";
import { jobEventBus } from "@/lib/jobs/job-event-bus";

export type JobAction = "cancel" | "retry";

interface ExecuteJobActionOptions {
  repository: JobQueueRepository;
  job: JobRequest;
  action: JobAction;
  actorId: string;
  ownerUserId?: string | null;
  now?: string;
}

type ExecuteJobActionResult =
  | {
    ok: true;
    action: "cancel";
    job: JobRequest;
    eventSequence: number;
  }
  | {
    ok: true;
    action: "retry";
    job: JobRequest;
    deduped: boolean;
    replay: {
      outcome: "deduped" | "queued";
      sourceJobId: string;
      targetJobId: string;
      dedupeKey: string | null;
    };
    eventSequence?: number;
  }
  | {
    ok: false;
    status: 409;
    error: string;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildCanceledEventPayload(
  latestRenderablePayload: Record<string, unknown> | undefined,
  canceledBy: string,
): Record<string, unknown> {
  return {
    ...(typeof latestRenderablePayload?.progressPercent === "number"
      ? { progressPercent: latestRenderablePayload.progressPercent }
      : {}),
    ...(typeof latestRenderablePayload?.progressLabel === "string"
      || latestRenderablePayload?.progressLabel === null
      ? { progressLabel: latestRenderablePayload.progressLabel }
      : {}),
    ...(Array.isArray(latestRenderablePayload?.phases)
      ? { phases: latestRenderablePayload.phases }
      : {}),
    ...(typeof latestRenderablePayload?.activePhaseKey === "string"
      || latestRenderablePayload?.activePhaseKey === null
      ? { activePhaseKey: latestRenderablePayload.activePhaseKey }
      : {}),
    ...(typeof latestRenderablePayload?.summary === "string"
      ? { summary: latestRenderablePayload.summary }
      : {}),
    ...(latestRenderablePayload?.resultEnvelope === null || isRecord(latestRenderablePayload?.resultEnvelope)
      ? { resultEnvelope: latestRenderablePayload.resultEnvelope }
      : {}),
    ...(latestRenderablePayload?.replaySnapshot === null || isRecord(latestRenderablePayload?.replaySnapshot)
      ? { replaySnapshot: latestRenderablePayload.replaySnapshot }
      : {}),
    ...(Array.isArray(latestRenderablePayload?.artifacts)
      ? { artifacts: latestRenderablePayload.artifacts }
      : {}),
    canceledBy,
  };
}

export async function executeJobAction(
  options: ExecuteJobActionOptions,
): Promise<ExecuteJobActionResult> {
  const now = options.now ?? new Date().toISOString();

  if (options.action === "cancel") {
    if (!isJobCancelable(options.job.status)) {
      return {
        ok: false,
        status: 409,
        error: "Job cannot be canceled in its current state",
      };
    }

    const latestRenderableEvent = await options.repository.findLatestRenderableEventForJob(options.job.id);
    const canceledJob = await options.repository.cancelJob(options.job.id, now);
    const canceledEvent = await options.repository.appendEvent({
      jobId: options.job.id,
      conversationId: options.job.conversationId,
      eventType: "canceled",
      payload: buildCanceledEventPayload(latestRenderableEvent?.payload, options.actorId),
    });

    jobEventBus.emitJobCanceled(options.job.id, options.actorId);

    return {
      ok: true,
      action: "cancel",
      job: canceledJob,
      eventSequence: canceledEvent.sequence,
    };
  }

  if (!canManualReplayJob(options.job)) {
    return {
      ok: false,
      status: 409,
      error: "Job cannot be retried in its current state",
    };
  }

  const replay = await performManualJobReplay(options.repository, options.job, {
    ownerUserId: options.ownerUserId ?? options.actorId,
    requestedByUserId: options.actorId,
  });

  return {
    ok: true,
    action: "retry",
    deduped: replay.outcome === "deduped",
    replay: {
      outcome: replay.outcome,
      sourceJobId: replay.sourceJobId,
      targetJobId: replay.job.id,
      dedupeKey: replay.dedupeKey,
    },
    job: replay.job,
    ...(replay.eventSequence ? { eventSequence: replay.eventSequence } : {}),
  };
}
