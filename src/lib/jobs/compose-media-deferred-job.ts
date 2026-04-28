import type {
  JobEvent,
  JobInitiatorType,
  JobRequest,
} from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import {
  normalizeMediaCompositionPlan,
  validateMediaCompositionAssetReferences,
  validatePlanConstraints,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";

import type { DeferredJobResultPayload } from "./deferred-job-result";
import {
  enqueueDeferredToolJob,
  type EnqueueDeferredToolJobResult,
} from "./enqueue-deferred-tool-job";

export class InvalidComposeMediaDeferredJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidComposeMediaDeferredJobError";
  }
}

export interface EnqueueComposeMediaDeferredJobOptions {
  repository: JobQueueRepository;
  conversationId: string;
  userId: string;
  plan: unknown;
  initiatorType?: JobInitiatorType;
  priority?: number;
}

export interface EnqueueComposeMediaDeferredJobResult {
  job: JobRequest;
  event: JobEvent;
  deduplicated: boolean;
  payload: DeferredJobResultPayload;
}

export async function enqueueComposeMediaDeferredJob(
  options: EnqueueComposeMediaDeferredJobOptions,
): Promise<EnqueueComposeMediaDeferredJobResult> {
  const plan = normalizeMediaCompositionPlan(options.plan, options.conversationId);
  if (!plan) {
    throw new InvalidComposeMediaDeferredJobError("Invalid or incomplete media composition plan");
  }

  const constraintError = validatePlanConstraints(plan);
  if (constraintError) {
    throw new InvalidComposeMediaDeferredJobError(constraintError);
  }

  const assetReferenceError = validateMediaCompositionAssetReferences(plan);
  if (assetReferenceError) {
    throw new InvalidComposeMediaDeferredJobError(assetReferenceError);
  }

  const dedupeKey = `compose_media:${plan.id}`;
  const result: EnqueueDeferredToolJobResult = await enqueueDeferredToolJob({
    repository: options.repository,
    conversationId: options.conversationId,
    userId: options.userId,
    toolName: "compose_media",
    requestPayload: { plan },
    dedupeKey,
    initiatorType: options.initiatorType,
    priority: options.priority ?? 5,
  });

  await appendRuntimeAuditLog(
    "deferred_job",
    result.deduplicated ? "enqueue_deduplicated" : "enqueued",
    {
      jobId: result.job.id,
      eventId: result.event.id,
      toolName: result.job.toolName,
      conversationId: options.conversationId,
      userId: options.userId,
      planId: plan.id,
      dedupeKey,
      deduplicated: result.deduplicated,
      initiatorType: options.initiatorType ?? "user",
      priority: options.priority ?? 5,
      status: result.job.status,
    },
  );

  return result;
}