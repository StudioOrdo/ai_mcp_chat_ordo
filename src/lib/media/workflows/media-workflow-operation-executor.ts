import { randomUUID } from "node:crypto";

import type { MaterializationRecord } from "@/core/entities/materialization";
import type {
  Operation,
  OperationErrorPayload,
  OperationStep,
} from "@/core/entities/operation";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type {
  OperationActionExecutor,
  OperationActionExecutorInput,
  OperationActionExecutorResult,
} from "@/core/use-cases/operations/OperationActionDispatch";
import {
  isMediaWorkflowOperationActionType,
  mediaWorkflowOperationStepId,
  type MediaWorkflowJobOperationMetadata,
  type MediaWorkflowOperationActionType,
  type MediaWorkflowOperationIdFactory,
} from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import {
  enqueueComposeMediaDeferredJob,
} from "@/lib/jobs/compose-media-deferred-job";
import {
  enqueueGenerateAudioDeferredJob,
} from "@/lib/jobs/generate-audio-deferred-job";

import {
  createGeneratedAudioWorkflowDraft,
  createVisualAudioVideoWorkflowDraft,
} from "./factory";
import type { MediaWorkflowOrchestrator } from "./orchestrator";
import type { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";
import type {
  MediaWorkflowDraft,
  MediaWorkflowSnapshot,
  MediaWorkflowStep,
} from "./types";

const MEDIA_WORKFLOW_ACTIONS = new Set<string>([
  "media.workflow.create",
  "media.workflow.retry_step",
  "media.workflow.cancel",
]);

export interface MediaWorkflowOperationExecutorDeps {
  workflowRepository: SqliteMediaWorkflowRepository;
  jobRepository: JobQueueRepository;
  materializationRepository?: MaterializationRepository;
  orchestrator?: MediaWorkflowOrchestrator;
  idFactory?: MediaWorkflowOperationIdFactory;
  reconcile?: (operationId?: string, workflowId?: string) => Promise<void>;
}

export class MediaWorkflowOperationExecutor implements OperationActionExecutor {
  private readonly idFactory: MediaWorkflowOperationIdFactory;

  constructor(private readonly deps: MediaWorkflowOperationExecutorDeps) {
    this.idFactory = deps.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  canExecute(actionType: string): boolean {
    return MEDIA_WORKFLOW_ACTIONS.has(actionType);
  }

  async execute(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    try {
      if (!isMediaWorkflowOperationActionType(input.action.actionType)) {
        throw new Error(`Unsupported media workflow action: ${input.action.actionType}`);
      }

      switch (input.action.actionType as MediaWorkflowOperationActionType) {
        case "media.workflow.create":
          return await this.createWorkflow(input);
        case "media.workflow.retry_step":
          return await this.retryStep(input);
        case "media.workflow.cancel":
          return await this.cancelWorkflow(input);
      }
    } catch (error) {
      return { snapshot: await this.blockAfterExecutorError(input, error) };
    }
  }

  private async createWorkflow(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const existing = this.deps.workflowRepository.findWorkflowByOperationId(input.snapshot.operation.id);
    if (existing) {
      await this.reconcile(input.snapshot.operation.id, existing.workflow.id);
      return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
    }

    const template = payloadString(input.payload, "template") ?? "missing_template";
    if (template === "generated_audio") {
      return await this.createGeneratedAudio(input);
    }
    if (template === "compose_media") {
      return await this.createComposeMedia(input);
    }
    if (template === "visual_audio_video" || template === "chart_audio_video") {
      return await this.createVisualAudioVideo(input);
    }

    await this.blockOperation(input.repository, input.snapshot.operation, "MEDIA_WORKFLOW_TEMPLATE_UNSUPPORTED", `Media workflow template is not executable yet: ${template}`, input.payload, input.actorUserId, input.now);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async createGeneratedAudio(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const operation = input.snapshot.operation;
    const audioInput = recordValue(input.payload["audio"])
      ?? recordValue(input.payload["input"])
      ?? input.payload;
    const title = payloadString(audioInput, "title") ?? operation.title;
    const text = payloadString(audioInput, "text") ?? payloadString(input.payload, "requestedText") ?? "";
    if (!text.trim()) {
      await this.blockOperation(input.repository, operation, "MEDIA_WORKFLOW_AUDIO_TEXT_REQUIRED", "Audio generation requires non-empty text.", input.payload, input.actorUserId, input.now);
      return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
    }

    const workflow = this.deps.workflowRepository.createValidatedWorkflow(createGeneratedAudioWorkflowDraft({
      userId: operation.createdByUserId ?? input.actorUserId ?? "",
      conversationId: operation.conversationId ?? payloadString(input.payload, "conversationId") ?? "",
      originMessageId: operation.originMessageId ?? payloadNullableString(input.payload, "originMessageId"),
      originTurnId: payloadNullableString(input.payload, "originTurnId"),
      title,
      audio: {
        title,
        text,
        input: audioInput,
      },
      request: this.workflowRequest(input),
      now: input.now,
    }));

    const step = requireStep(workflow, "generate_audio");
    await this.reconcile(operation.id, workflow.workflow.id);
    const enqueueResult = await enqueueGenerateAudioDeferredJob({
      repository: this.deps.jobRepository,
      materializationRepository: this.deps.materializationRepository,
      conversationId: workflow.workflow.conversationId,
      userId: workflow.workflow.userId,
      input: audioInput,
      initiatorType: "user",
      priority: 5,
      operation: operationMetadata(operation.id, workflow.workflow.id, step.id, input.action.id),
    });

    await this.projectEnqueueResult(workflow.workflow.id, step, enqueueResult);
    await this.reconcile(operation.id, workflow.workflow.id);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async createComposeMedia(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const operation = input.snapshot.operation;
    const plan = recordValue(input.payload["compose"])?.["plan"] ?? input.payload["plan"];
    if (!plan) {
      await this.blockOperation(input.repository, operation, "MEDIA_WORKFLOW_COMPOSE_PLAN_REQUIRED", "Media composition requires a concrete plan.", input.payload, input.actorUserId, input.now);
      return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
    }

    const workflowId = this.idFactory("mwf");
    const stepId = this.idFactory("mwfs");
    const now = input.now ?? new Date().toISOString();
    const draft: MediaWorkflowDraft = {
      workflow: {
        id: workflowId,
        userId: operation.createdByUserId ?? input.actorUserId ?? "",
        conversationId: operation.conversationId ?? payloadString(input.payload, "conversationId") ?? "",
        originMessageId: operation.originMessageId ?? payloadNullableString(input.payload, "originMessageId"),
        originTurnId: payloadNullableString(input.payload, "originTurnId"),
        requestedDeliverable: "video",
        title: operation.title,
        status: "queued",
        request: this.workflowRequest(input),
        createdAt: now,
        updatedAt: now,
      },
      steps: [{
        id: stepId,
        workflowId,
        sequence: 1,
        kind: "compose_media",
        status: "pending",
        input: { plan },
        createdAt: now,
        updatedAt: now,
      }],
      initialEvent: {
        eventType: "workflow_created",
        payload: { template: "compose_media" },
        createdAt: now,
      },
    };
    const workflow = this.deps.workflowRepository.createValidatedWorkflow(draft);
    const step = requireStep(workflow, "compose_media");
    await this.reconcile(operation.id, workflow.workflow.id);

    const enqueueResult = await enqueueComposeMediaDeferredJob({
      repository: this.deps.jobRepository,
      materializationRepository: this.deps.materializationRepository,
      conversationId: workflow.workflow.conversationId,
      userId: workflow.workflow.userId,
      plan,
      initiatorType: "user",
      priority: 5,
      operation: operationMetadata(operation.id, workflow.workflow.id, step.id, input.action.id),
    });
    await this.projectEnqueueResult(workflow.workflow.id, step, enqueueResult);
    await this.reconcile(operation.id, workflow.workflow.id);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async createVisualAudioVideo(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const operation = input.snapshot.operation;
    const visual = recordValue(input.payload["visual"]);
    const audio = recordValue(input.payload["audio"]);
    const assetId = payloadString(visual ?? {}, "assetId");
    const text = payloadString(audio ?? {}, "text");

    if (!visual || !assetId || !audio || !text) {
      await this.blockOperation(input.repository, operation, "MEDIA_WORKFLOW_VISUAL_AUDIO_REQUIRED", "Visual/audio video workflows require a ready visual asset and non-empty audio text.", input.payload, input.actorUserId, input.now);
      return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
    }

    const workflow = this.deps.workflowRepository.createValidatedWorkflow(createVisualAudioVideoWorkflowDraft({
      userId: operation.createdByUserId ?? input.actorUserId ?? "",
      conversationId: operation.conversationId ?? payloadString(input.payload, "conversationId") ?? "",
      originMessageId: operation.originMessageId ?? payloadNullableString(input.payload, "originMessageId"),
      originTurnId: payloadNullableString(input.payload, "originTurnId"),
      title: operation.title,
      visual: {
        assetId,
        kind: payloadString(visual, "kind") === "generate_chart" ? "generate_chart" : payloadString(visual, "kind") === "generate_image" ? "generate_image" : "reuse_asset",
        title: payloadString(visual, "title") ?? operation.title,
        input: visual,
      },
      audio: {
        title: payloadString(audio, "title") ?? operation.title,
        text,
        input: audio,
      },
      compose: recordValue(input.payload["compose"]) ?? undefined,
      request: this.workflowRequest(input),
      now: input.now,
    }));

    const step = requireStep(workflow, "generate_audio");
    await this.reconcile(operation.id, workflow.workflow.id);
    const enqueueResult = await enqueueGenerateAudioDeferredJob({
      repository: this.deps.jobRepository,
      materializationRepository: this.deps.materializationRepository,
      conversationId: workflow.workflow.conversationId,
      userId: workflow.workflow.userId,
      input: audio,
      initiatorType: "user",
      priority: 5,
      operation: operationMetadata(operation.id, workflow.workflow.id, step.id, input.action.id),
    });
    await this.projectEnqueueResult(workflow.workflow.id, step, enqueueResult);
    await this.deps.orchestrator?.advanceWorkflow(workflow.workflow.id);
    await this.reconcile(operation.id, workflow.workflow.id);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async retryStep(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const operation = input.snapshot.operation;
    const workflowId = requirePayloadString(input.payload, "workflowId");
    const stepId = requirePayloadString(input.payload, "stepId");
    let workflow = this.requireWorkflow(workflowId);
    const step = workflow.steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      throw new Error(`Media workflow step ${stepId} was not found.`);
    }
    if (!RETRYABLE_STEP_KINDS.has(step.kind)) {
      throw new Error(`Media workflow step ${step.kind} cannot be retried.`);
    }

    workflow = this.deps.workflowRepository.resetWorkflowForRetry({
      workflowId,
      reason: "User requested media workflow step retry.",
      updatedAt: input.now,
    });
    const resetStep = workflow.steps.find((candidate) => candidate.id === stepId) ?? step;

    if (resetStep.kind === "generate_audio") {
      const enqueueResult = await enqueueGenerateAudioDeferredJob({
        repository: this.deps.jobRepository,
        materializationRepository: this.deps.materializationRepository,
        conversationId: workflow.workflow.conversationId,
        userId: workflow.workflow.userId,
        input: resetStep.input,
        initiatorType: "user",
        priority: 5,
        operation: operationMetadata(operation.id, workflow.workflow.id, resetStep.id, input.action.id),
      });
      await this.projectEnqueueResult(workflowId, resetStep, enqueueResult);
    } else if (resetStep.kind === "compose_media") {
      const plan = resetStep.input["plan"];
      if (plan) {
        const enqueueResult = await enqueueComposeMediaDeferredJob({
          repository: this.deps.jobRepository,
          materializationRepository: this.deps.materializationRepository,
          conversationId: workflow.workflow.conversationId,
          userId: workflow.workflow.userId,
          plan,
          initiatorType: "user",
          priority: 5,
          operation: operationMetadata(operation.id, workflow.workflow.id, resetStep.id, input.action.id),
        });
        await this.projectEnqueueResult(workflowId, resetStep, enqueueResult);
      } else {
        this.deps.workflowRepository.updateStep({
          stepId: resetStep.id,
          status: "pending",
          jobId: null,
          failureCode: null,
          failureMessage: null,
          eventType: "step_retry_queued",
          eventPayload: { reason: "Retry requested." },
        });
        await this.deps.orchestrator?.advanceWorkflow(workflowId);
      }
    } else {
      await this.deps.orchestrator?.advanceWorkflow(workflowId);
    }

    await this.reconcile(operation.id, workflowId);
    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async cancelWorkflow(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const workflowId = requirePayloadString(input.payload, "workflowId");
    const reason = requirePayloadString(input.payload, "reason");
    const workflow = this.requireWorkflow(workflowId);
    const now = input.now ?? new Date().toISOString();

    for (const step of workflow.steps) {
      if (step.jobId) {
        const job = await this.deps.jobRepository.findJobById(step.jobId);
        if (job && (job.status === "queued" || job.status === "running")) {
          await this.deps.jobRepository.cancelJob(job.id, now);
        }
      }
      if (step.status === "pending" || step.status === "queued" || step.status === "running" || step.status === "blocked") {
        this.deps.workflowRepository.updateStep({
          stepId: step.id,
          status: "skipped",
          failureCode: null,
          failureMessage: null,
          eventType: "step_skipped",
          eventPayload: { reason },
          updatedAt: now,
        });
      }
    }

    this.deps.workflowRepository.markWorkflowCanceled({
      workflowId,
      reason,
      completedAt: now,
    });
    await this.reconcile(input.snapshot.operation.id, workflowId);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async projectEnqueueResult(
    workflowId: string,
    step: MediaWorkflowStep,
    result: Awaited<ReturnType<typeof enqueueGenerateAudioDeferredJob>> | Awaited<ReturnType<typeof enqueueComposeMediaDeferredJob>>,
  ): Promise<void> {
    if (result.outcome === "exact_reuse" && result.materialization) {
      const assetId = materializationAssetId(result.materialization);
      if (assetId) {
        this.deps.workflowRepository.updateStep({
          stepId: step.id,
          status: "ready",
          jobId: null,
          assetId,
          output: { assetId, materializationId: result.materialization.id },
          failureCode: null,
          failureMessage: null,
          eventType: "step_ready",
          eventPayload: { assetId, materializationId: result.materialization.id },
        });
        if (step.kind === "generate_audio" || step.kind === "compose_media") {
          const snapshot = this.deps.workflowRepository.findWorkflowById(workflowId);
          if (snapshot?.workflow.requestedDeliverable === "audio" || step.kind === "compose_media") {
            this.deps.workflowRepository.markWorkflowSucceeded({
              workflowId,
              finalAssetId: assetId,
            });
          }
        }
      }
      return;
    }

    if (result.job) {
      this.deps.workflowRepository.updateStep({
        stepId: step.id,
        status: result.job.status === "running" ? "running" : "queued",
        jobId: result.job.id,
        failureCode: null,
        failureMessage: null,
        eventType: "step_queued",
        eventPayload: { jobId: result.job.id, toolName: result.job.toolName },
      });
    }
  }

  private async blockAfterExecutorError(
    input: OperationActionExecutorInput,
    error: unknown,
  ): Promise<OperationSnapshot> {
    const message = error instanceof Error ? error.message : "Media workflow operation failed.";
    await this.blockOperation(input.repository, input.snapshot.operation, "MEDIA_WORKFLOW_EXECUTOR_BLOCKED", message, input.payload, input.actorUserId, input.now);
    return await requireOperationSnapshot(input.repository, input.snapshot.operation.id);
  }

  private async blockOperation(
    repository: OperationRepository,
    operation: Operation,
    code: string,
    message: string,
    actionPayload: Record<string, unknown>,
    actorUserId: string | null,
    now?: string,
  ): Promise<void> {
    const error: OperationErrorPayload = {
      code,
      message,
      details: { payload: actionPayload },
    };
    const step: OperationStep = {
      id: `${operation.id}:media_workflow:blocker`,
      operationId: operation.id,
      sequence: 999,
      kind: "media.compose",
      status: "blocked",
      dependsOnStepIds: [],
      capabilityName: "media_workflow",
      jobId: null,
      systemCommandId: null,
      resourceRef: null,
      input: actionPayload,
      output: null,
      error,
      retryCount: 0,
      startedAt: null,
      completedAt: null,
    };
    await repository.upsertStep({
      step,
      actorType: "system",
      actorId: actorUserId,
      now,
    });
    const current = await requireOperationSnapshot(repository, operation.id);
    if (current.operation.status !== "blocked") {
      await repository.updateOperationStatus({
        operationId: operation.id,
        status: "blocked",
        supportsRetry: true,
        actorType: "system",
        actorId: actorUserId,
        now,
      });
    }
    await repository.replaceActions({
      operationId: operation.id,
      actions: [],
      actorType: "system",
      actorId: actorUserId,
      now,
    });
  }

  private requireWorkflow(workflowId: string): MediaWorkflowSnapshot {
    const workflow = this.deps.workflowRepository.findWorkflowById(workflowId);
    if (!workflow) {
      throw new Error(`Media workflow ${workflowId} was not found.`);
    }
    return workflow;
  }

  private workflowRequest(input: OperationActionExecutorInput): Record<string, unknown> {
    return {
      ...input.payload,
      operation: {
        operationId: input.snapshot.operation.id,
        actionId: input.action.id,
        operationKind: "media_workflow",
      },
    };
  }

  private async reconcile(operationId: string, workflowId: string): Promise<void> {
    await this.deps.reconcile?.(operationId, workflowId);
  }
}

const RETRYABLE_STEP_KINDS = new Set<string>([
  "generate_audio",
  "compose_media",
  "generate_image",
]);

function operationMetadata(
  operationId: string,
  workflowId: string,
  workflowStepId: string,
  actionId: string,
): MediaWorkflowJobOperationMetadata {
  return {
    operationId,
    stepId: mediaWorkflowOperationStepId(operationId, workflowStepId),
    actionId,
    operationKind: "media_workflow",
    workflowId,
    workflowStepId,
  };
}

async function requireOperationSnapshot(
  repository: OperationRepository,
  operationId: string,
): Promise<OperationSnapshot> {
  const snapshot = await repository.findOperationById(operationId);
  if (!snapshot) throw new Error(`Operation not found: ${operationId}`);
  return snapshot;
}

function requireStep(snapshot: MediaWorkflowSnapshot, kind: MediaWorkflowStep["kind"]): MediaWorkflowStep {
  const step = snapshot.steps.find((candidate) => candidate.kind === kind);
  if (!step) {
    throw new Error(`Media workflow step ${kind} was not found.`);
  }
  return step;
}

function requirePayloadString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function payloadString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function payloadNullableString(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function materializationAssetId(materialization: MaterializationRecord): string | null {
  const output = materialization.outputRefs.find((ref) => ref.kind === "asset" && ref.id);
  return output?.id ?? null;
}
