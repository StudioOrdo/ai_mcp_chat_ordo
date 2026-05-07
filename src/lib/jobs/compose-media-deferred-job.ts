import type {
  JobEvent,
  JobInitiatorType,
  JobRequest,
} from "@/core/entities/job";
import type { MediaWorkflowJobOperationMetadata } from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import {
  normalizeMediaCompositionPlan,
  validateMediaCompositionAssetReferences,
  validatePlanConstraints,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";

import type { DeferredJobResultPayload } from "./deferred-job-result";
import { createDeferredJobResultPayload } from "./deferred-job-result";
import { buildComposeMediaMaterializationKey } from "./materialization-key";
import {
  enqueueDeferredToolJob,
  type EnqueueDeferredToolJobResult,
} from "./enqueue-deferred-tool-job";
import { buildSyntheticJobEvent } from "./job-read-model";
import { recordPromptBindingFromSource } from "@/lib/prompts/prompt-binding-service";

export class InvalidComposeMediaDeferredJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidComposeMediaDeferredJobError";
  }
}

export interface EnqueueComposeMediaDeferredJobOptions {
  repository: JobQueueRepository;
  materializationRepository?: MaterializationRepository;
  conversationId: string;
  userId: string;
  plan: unknown;
  initiatorType?: JobInitiatorType;
  priority?: number;
  promptBindingId?: string | null;
  operation?: MediaWorkflowJobOperationMetadata;
}

export interface EnqueueComposeMediaDeferredJobResult {
  outcome: "queued" | "active_equivalent" | "exact_reuse";
  job: JobRequest | null;
  event: JobEvent | null;
  deduplicated: boolean;
  payload: DeferredJobResultPayload | null;
  materialization: MaterializationRecord | null;
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

  const materializationKey = buildComposeMediaMaterializationKey(plan);
  const dedupeKey = materializationKey;

  const active = await options.repository.findActiveJobByDedupeKey(options.conversationId, dedupeKey);
  if (active) {
    const event = await options.repository.findLatestRenderableEventForJob(active.id);
    const resolvedEvent = event ?? buildSyntheticJobEvent(active);

    await appendRuntimeAuditLog(
      "deferred_job",
      "enqueue_deduplicated",
      {
        jobId: active.id,
        eventId: resolvedEvent.id,
        toolName: active.toolName,
        conversationId: options.conversationId,
        userId: options.userId,
        planId: plan.id,
        dedupeKey,
        deduplicated: true,
        initiatorType: options.initiatorType ?? "user",
        priority: options.priority ?? 5,
        status: active.status,
      },
    );

    const resultPayload: DeferredJobResultPayload = createDeferredJobResultPayload(active, resolvedEvent, {
      deduped: true,
    });

    return {
      outcome: "active_equivalent",
      job: active,
      event: resolvedEvent,
      deduplicated: true,
      payload: resultPayload,
      materialization: null,
    };
  }

  const reusableMaterialization = options.materializationRepository
    ? await options.materializationRepository.findReusableSuccess(materializationKey, options.userId, options.conversationId)
    : null;

  if (reusableMaterialization) {
    if (options.promptBindingId) {
      await recordPromptBindingFromSource({
        userId: options.userId,
        conversationId: options.conversationId,
        sourcePromptBindingId: options.promptBindingId,
        surface: "materialization_decision",
        target: {
          targetKind: "materialization_record",
          targetId: reusableMaterialization.id,
        },
        decisionSourceRefs: [
          {
            sourceKind: "materialization_record",
            sourceId: reusableMaterialization.id,
            userId: options.userId,
            conversationId: reusableMaterialization.conversationId,
          },
        ],
        evidenceRefs: [...reusableMaterialization.evidenceRefs],
        createdAt: reusableMaterialization.updatedAt,
      });
    }

    await appendRuntimeAuditLog(
      "deferred_job",
      "materialization_reused",
      {
        toolName: "compose_media",
        conversationId: options.conversationId,
        userId: options.userId,
        planId: plan.id,
        dedupeKey,
        materializationId: reusableMaterialization.id,
        materializationKey,
        producedByJobId: reusableMaterialization.producedByJobId,
      },
    );

    return {
      outcome: "exact_reuse",
      job: null,
      event: null,
      deduplicated: false,
      payload: null,
      materialization: reusableMaterialization,
    };
  }

  const result: EnqueueDeferredToolJobResult = await enqueueDeferredToolJob({
    repository: options.repository,
    conversationId: options.conversationId,
    userId: options.userId,
    toolName: "compose_media",
    requestPayload: {
      plan,
      materializationKey,
      executionTarget: "deferred_remote",
      ...(options.promptBindingId ? { promptBindingId: options.promptBindingId } : {}),
      ...(options.operation ? { operation: options.operation } : {}),
    },
    promptBindingId: options.promptBindingId,
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

  return {
    outcome: "queued",
    job: result.job,
    event: result.event,
    deduplicated: result.deduplicated,
    payload: result.payload,
    materialization: null,
  };
}
