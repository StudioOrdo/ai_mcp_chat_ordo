import type {
  JobEvent,
  JobInitiatorType,
  JobRequest,
} from "@/core/entities/job";
import type { MaterializationRecord } from "@/core/entities/materialization";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import { parseGenerateAudioInput } from "@/core/use-cases/tools/generate-audio.tool";
import { appendRuntimeAuditLog } from "@/lib/observability/runtime-audit-log";
import { recordPromptBindingFromSource } from "@/lib/prompts/prompt-binding-service";

import { createDeferredJobResultPayload, type DeferredJobResultPayload } from "./deferred-job-result";
import { enqueueDeferredToolJob, type EnqueueDeferredToolJobResult } from "./enqueue-deferred-tool-job";
import { buildSyntheticJobEvent } from "./job-read-model";
import { buildGenerateAudioMaterializationKey } from "./materialization-key";

export class InvalidGenerateAudioDeferredJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGenerateAudioDeferredJobError";
  }
}

export interface EnqueueGenerateAudioDeferredJobOptions {
  repository: JobQueueRepository;
  materializationRepository?: MaterializationRepository;
  conversationId: string;
  userId: string;
  input: unknown;
  initiatorType?: JobInitiatorType;
  priority?: number;
  promptBindingId?: string | null;
  toolInvocationId?: string;
}

export interface EnqueueGenerateAudioDeferredJobResult {
  outcome: "queued" | "active_equivalent" | "exact_reuse";
  job: JobRequest | null;
  event: JobEvent | null;
  deduplicated: boolean;
  payload: DeferredJobResultPayload | null;
  materialization: MaterializationRecord | null;
}

function summarizeAudioInput(input: ReturnType<typeof parseGenerateAudioInput>): Record<string, unknown> {
  return {
    title: input.title,
    textLength: input.text.length,
    hasPreallocatedAsset: Boolean(input.assetId),
  };
}

export async function enqueueGenerateAudioDeferredJob(
  options: EnqueueGenerateAudioDeferredJobOptions,
): Promise<EnqueueGenerateAudioDeferredJobResult> {
  const input = parseGenerateAudioInput(options.input);
  if (input.text.trim().length === 0 || input.title.trim().length === 0) {
    throw new InvalidGenerateAudioDeferredJobError("generate_audio title and text must be non-empty.");
  }

  const materializationKey = buildGenerateAudioMaterializationKey(input);
  const dedupeKey = materializationKey;
  const active = await options.repository.findActiveJobByDedupeKey(options.conversationId, dedupeKey);

  if (active) {
    const event = await options.repository.findLatestRenderableEventForJob(active.id);
    const resolvedEvent = event ?? buildSyntheticJobEvent(active);

    await appendRuntimeAuditLog("deferred_job", "enqueue_deduplicated", {
      jobId: active.id,
      eventId: resolvedEvent.id,
      toolName: active.toolName,
      conversationId: options.conversationId,
      userId: options.userId,
      dedupeKey,
      deduplicated: true,
      initiatorType: options.initiatorType ?? "user",
      priority: options.priority ?? 5,
      status: active.status,
      audio: summarizeAudioInput(input),
    });

    return {
      outcome: "active_equivalent",
      job: active,
      event: resolvedEvent,
      deduplicated: true,
      payload: createDeferredJobResultPayload(active, resolvedEvent, {
        deduped: true,
        toolInvocationId: options.toolInvocationId,
      }),
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

    await appendRuntimeAuditLog("deferred_job", "materialization_reused", {
      toolName: "generate_audio",
      conversationId: options.conversationId,
      userId: options.userId,
      dedupeKey,
      materializationId: reusableMaterialization.id,
      materializationKey,
      producedByJobId: reusableMaterialization.producedByJobId,
      audio: summarizeAudioInput(input),
    });

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
    toolName: "generate_audio",
    requestPayload: {
      ...input,
      materializationKey,
      executionTarget: "deferred_remote",
      ...(options.promptBindingId ? { promptBindingId: options.promptBindingId } : {}),
    },
    promptBindingId: options.promptBindingId,
    toolInvocationId: options.toolInvocationId,
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
      dedupeKey,
      deduplicated: result.deduplicated,
      initiatorType: options.initiatorType ?? "user",
      priority: options.priority ?? 5,
      status: result.job.status,
      audio: summarizeAudioInput(input),
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
