import type { JobEvent, JobInitiatorType, JobRequest } from "@/core/entities/job";
import type { DeferredExecutionConfig } from "@/core/tool-registry/ToolDescriptor";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { recordPromptBindingFromSource } from "@/lib/prompts/prompt-binding-service";

import {
  createDeferredJobResultPayload,
  type DeferredJobResultPayload,
} from "./deferred-job-result";
import { buildDeferredJobDedupeKey } from "./job-dedupe";
import { buildSyntheticJobEvent } from "./job-read-model";

export interface EnqueueDeferredToolJobOptions {
  repository: JobQueueRepository;
  conversationId: string;
  userId: string;
  toolName: string;
  requestPayload: Record<string, unknown>;
  initiatorType?: JobInitiatorType;
  priority?: number;
  deferred?: DeferredExecutionConfig;
  dedupeKey?: string | null;
  promptBindingId?: string | null;
  toolInvocationId?: string;
}

export interface EnqueueDeferredToolJobResult {
  job: JobRequest;
  event: JobEvent;
  deduplicated: boolean;
  payload: DeferredJobResultPayload;
}

function resolveDedupeKey(options: EnqueueDeferredToolJobOptions): string | null {
  if (options.dedupeKey !== undefined) {
    return options.dedupeKey;
  }

  if (options.deferred?.dedupeStrategy !== "per-conversation-payload") {
    return null;
  }

  return buildDeferredJobDedupeKey(
    options.conversationId,
    options.toolName,
    options.requestPayload,
  );
}

export async function enqueueDeferredToolJob(
  options: EnqueueDeferredToolJobOptions,
): Promise<EnqueueDeferredToolJobResult> {
  const dedupeKey = resolveDedupeKey(options);
  const existing = dedupeKey
    ? await options.repository.findActiveJobByDedupeKey(options.conversationId, dedupeKey)
    : null;

  if (existing) {
    const existingEvent = await options.repository.findLatestRenderableEventForJob(existing.id);
    const event = existingEvent ?? buildSyntheticJobEvent(existing);

    return {
      job: existing,
      event,
      deduplicated: true,
      payload: createDeferredJobResultPayload(existing, event, {
        deduped: true,
        toolInvocationId: options.toolInvocationId,
      }),
    };
  }

  const job = await options.repository.createJob({
    conversationId: options.conversationId,
    userId: options.userId,
    toolName: options.toolName,
    dedupeKey,
    initiatorType: options.initiatorType ?? "user",
    requestPayload: options.requestPayload,
    priority: options.priority,
    toolInvocationId: options.toolInvocationId ?? null,
  });

  const event = await options.repository.appendEvent({
    jobId: job.id,
    conversationId: options.conversationId,
    eventType: "queued",
    payload: {
      toolName: options.toolName,
      ...(options.toolInvocationId ? { toolInvocationId: options.toolInvocationId } : {}),
    },
  });

  if (options.promptBindingId) {
    await recordPromptBindingFromSource({
      userId: options.userId,
      conversationId: options.conversationId,
      sourcePromptBindingId: options.promptBindingId,
      surface: "job_execution",
      target: {
        targetKind: "job",
        targetId: job.id,
      },
      decisionSourceRefs: [
        {
          sourceKind: "job",
          sourceId: job.id,
          userId: options.userId,
          conversationId: options.conversationId,
        },
      ],
      evidenceRefs: [
        {
          source: {
            sourceKind: "job_event",
            sourceId: event.id,
            userId: options.userId,
            conversationId: options.conversationId,
          },
          observedAt: event.createdAt,
          summary: `Deferred job ${options.toolName} queued for execution.`,
        },
      ],
      createdAt: event.createdAt,
    });
  }

  return {
    job,
    event,
    deduplicated: false,
    payload: createDeferredJobResultPayload(job, event, { toolInvocationId: options.toolInvocationId }),
  };
}
