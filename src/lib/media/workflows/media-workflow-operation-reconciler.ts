import { randomUUID } from "node:crypto";

import type {
  JobRequest,
} from "@/core/entities/job";
import type {
  Operation,
  OperationArtifact,
  OperationResourceRef,
  OperationStep,
  OperationStepStatus,
} from "@/core/entities/operation";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import {
  createMediaWorkflowCancelAction,
  createMediaWorkflowRetryStepAction,
  mediaWorkflowOperationStepId,
  mediaWorkflowOperationStepKindForMediaStepKind,
  type MediaWorkflowOperationIdFactory,
} from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import {
  mapMediaWorkflowStatusToOperationStatus,
  mapMediaWorkflowStepStatusToOperationStepStatus,
} from "@/core/use-cases/operations/OperationStatusMapping";

import type { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";
import type {
  MediaWorkflowEvent,
  MediaWorkflowSnapshot,
  MediaWorkflowStep,
} from "./types";

export interface MediaWorkflowOperationReconcilerDeps {
  operations: OperationRepository;
  workflows: SqliteMediaWorkflowRepository;
  jobs?: JobQueueRepository;
  idFactory?: MediaWorkflowOperationIdFactory;
  now?: () => string;
}

interface OperationMetadata {
  operationId: string;
  actionId: string;
}

const RETRYABLE_STEP_KINDS = new Set<string>([
  "generate_audio",
  "compose_media",
  "generate_image",
]);

export class MediaWorkflowOperationReconciler {
  private readonly idFactory: MediaWorkflowOperationIdFactory;

  constructor(private readonly deps: MediaWorkflowOperationReconcilerDeps) {
    this.idFactory = deps.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  async reconcileRecent(limit = 50): Promise<void> {
    const operations = await this.deps.operations.listOperationsForAdmin({
      kind: "media_workflow",
      limit,
    });
    for (const operation of operations) {
      await this.reconcileOperation(operation.id);
    }
  }

  async reconcileOperation(operationId: string): Promise<void> {
    const workflow = this.deps.workflows.findWorkflowByOperationId(operationId);
    if (!workflow) {
      return;
    }
    await this.reconcileWorkflow(workflow.workflow.id, operationId);
  }

  async reconcileWorkflow(workflowId: string, operationId?: string): Promise<void> {
    const workflow = this.deps.workflows.findWorkflowById(workflowId);
    if (!workflow) {
      return;
    }
    const metadata = readOperationMetadata(workflow);
    const resolvedOperationId = operationId ?? metadata?.operationId ?? null;
    if (!resolvedOperationId) {
      return;
    }

    const operationSnapshot = await this.deps.operations.findOperationById(resolvedOperationId);
    if (!operationSnapshot) {
      return;
    }

    await this.reconcileSteps(operationSnapshot.operation, workflow);
    await this.reconcileEvents(operationSnapshot.operation.id, workflow);
    await this.reconcileJobEvents(operationSnapshot.operation.id, workflow);
    await this.reconcileArtifacts(operationSnapshot.operation.id, workflow);
    await this.advanceOperation(operationSnapshot.operation.id, mapMediaWorkflowStatusToOperationStatus(workflow.workflow.status));
    await this.replaceAvailableActions(operationSnapshot.operation.id, workflow);
  }

  private async reconcileSteps(operation: Operation, workflow: MediaWorkflowSnapshot): Promise<void> {
    for (const step of workflow.steps) {
      const existing = await this.deps.operations.findOperationById(operation.id);
      const currentStep = existing?.steps.find((candidate) => candidate.id === mediaWorkflowOperationStepId(operation.id, step.id));
      const status = mapMediaWorkflowStepStatusToOperationStepStatus(step.status);
      if (isSameStepProjection(currentStep, step, status)) {
        continue;
      }

      await this.deps.operations.upsertStep({
        step: this.toOperationStep(operation.id, step, currentStep),
        actorType: "system",
        actorId: null,
        now: this.now(),
      });
    }
  }

  private async reconcileEvents(operationId: string, workflow: MediaWorkflowSnapshot): Promise<void> {
    const existingIds = new Set((await this.deps.operations.listEvents(operationId, { limit: 200 }))
      .map((event) => event.id));

    for (const event of workflow.events) {
      const eventId = mediaWorkflowEventId(operationId, event);
      if (existingIds.has(eventId)) {
        continue;
      }
      await this.deps.operations.appendEvent({
        id: eventId,
        operationId,
        stepId: event.stepId ? mediaWorkflowOperationStepId(operationId, event.stepId) : null,
        type: "executor_event_received",
        actorType: "system",
        actorId: null,
        payload: {
          source: "media_workflow",
          workflowId: event.workflowId,
          workflowStepId: event.stepId,
          eventType: event.eventType,
          payload: event.payload,
        },
        now: event.createdAt,
      });
      existingIds.add(eventId);
    }
  }

  private async reconcileJobEvents(operationId: string, workflow: MediaWorkflowSnapshot): Promise<void> {
    if (!this.deps.jobs) {
      return;
    }
    const existingIds = new Set((await this.deps.operations.listEvents(operationId, { limit: 200 }))
      .map((event) => event.id));

    for (const step of workflow.steps) {
      if (!step.jobId) {
        continue;
      }
      const job = await this.deps.jobs.findJobById(step.jobId);
      if (!job) {
        continue;
      }
      const eventId = mediaWorkflowJobEventId(operationId, job);
      if (existingIds.has(eventId)) {
        continue;
      }
      await this.deps.operations.appendEvent({
        id: eventId,
        operationId,
        stepId: mediaWorkflowOperationStepId(operationId, step.id),
        type: "executor_event_received",
        actorType: "worker",
        actorId: job.claimedBy,
        payload: {
          source: "media_job",
          workflowId: workflow.workflow.id,
          workflowStepId: step.id,
          jobId: job.id,
          toolName: job.toolName,
          status: job.status,
          progressPercent: job.progressPercent,
          progressLabel: job.progressLabel,
          errorMessage: job.errorMessage,
        },
        now: job.updatedAt,
      });
      existingIds.add(eventId);
    }
  }

  private async reconcileArtifacts(operationId: string, workflow: MediaWorkflowSnapshot): Promise<void> {
    await this.attachArtifactOnce(workflowArtifact(operationId, workflow));

    for (const step of workflow.steps) {
      if (step.jobId) {
        await this.attachArtifactOnce(jobArtifact(operationId, step));
      }
      if (step.assetId) {
        await this.attachArtifactOnce(assetArtifact(operationId, step));
      }
      const materializationId = stringValue(step.output["materializationId"]);
      if (materializationId) {
        await this.attachArtifactOnce(materializationArtifact(operationId, step, materializationId));
      }
    }
  }

  private async replaceAvailableActions(operationId: string, workflow: MediaWorkflowSnapshot): Promise<void> {
    const current = await this.deps.operations.findOperationById(operationId);
    if (!current) {
      return;
    }

    const actions = [];
    const failedStep = workflow.steps.find((step) =>
      (step.status === "failed" || step.status === "blocked")
      && RETRYABLE_STEP_KINDS.has(step.kind)
    );

    if ((workflow.workflow.status === "failed" || workflow.workflow.status === "blocked") && failedStep) {
      actions.push(createMediaWorkflowRetryStepAction({
        operationId,
        operationRevision: current.operation.revision,
        idFactory: this.idFactory,
        workflowId: workflow.workflow.id,
        stepId: failedStep.id,
      }));
    }

    if (workflow.workflow.status === "queued" || workflow.workflow.status === "running" || workflow.workflow.status === "blocked") {
      actions.push(createMediaWorkflowCancelAction({
        operationId,
        operationRevision: current.operation.revision,
        idFactory: this.idFactory,
        workflowId: workflow.workflow.id,
      }));
    }

    const available = await this.deps.operations.listAvailableActions(operationId);
    if (sameAvailableActions(available, actions, current.operation.revision)) {
      return;
    }

    await this.deps.operations.replaceActions({
      operationId,
      actions,
      actorType: "system",
      actorId: null,
      now: this.now(),
    });
  }

  private async advanceOperation(operationId: string, targetStatus: Operation["status"]): Promise<OperationSnapshot> {
    let snapshot = await requireOperationSnapshot(this.deps.operations, operationId);
    if (snapshot.operation.status === targetStatus) {
      return snapshot;
    }
    if (snapshot.operation.status === "succeeded" || snapshot.operation.status === "cancelled" || snapshot.operation.status === "expired") {
      return snapshot;
    }

    for (const status of statusPath(snapshot.operation.status, targetStatus)) {
      snapshot = await this.deps.operations.updateOperationStatus({
        operationId,
        status,
        supportsRetry: true,
        actorType: "system",
        actorId: null,
        now: this.now(),
      });
    }

    return snapshot;
  }

  private toOperationStep(
    operationId: string,
    step: MediaWorkflowStep,
    existing: OperationStep | undefined,
  ): OperationStep {
    const status = mapMediaWorkflowStepStatusToOperationStepStatus(step.status);
    const now = this.now();
    return {
      id: mediaWorkflowOperationStepId(operationId, step.id),
      operationId,
      sequence: step.sequence,
      kind: mediaWorkflowOperationStepKindForMediaStepKind(step.kind),
      status,
      dependsOnStepIds: step.dependsOnStepIds.map((dependencyId) => mediaWorkflowOperationStepId(operationId, dependencyId)),
      capabilityName: capabilityNameForStep(step),
      jobId: step.jobId,
      systemCommandId: null,
      resourceRef: resourceRefForStep(step),
      input: {
        workflowId: step.workflowId,
        workflowStepId: step.id,
        ...step.input,
      },
      output: Object.keys(step.output).length > 0 ? {
        workflowId: step.workflowId,
        workflowStepId: step.id,
        ...step.output,
        ...(step.assetId ? { assetId: step.assetId } : {}),
        ...(step.jobId ? { jobId: step.jobId } : {}),
      } : null,
      error: step.failureCode || step.failureMessage
        ? {
            code: step.failureCode ?? "MEDIA_WORKFLOW_STEP_FAILED",
            message: step.failureMessage ?? "Media workflow step failed.",
            details: {
              workflowId: step.workflowId,
              workflowStepId: step.id,
              jobId: step.jobId,
            },
          }
        : null,
      retryCount: existing?.retryCount ?? 0,
      startedAt: existing?.startedAt ?? (status === "running" ? now : null),
      completedAt: terminalStepStatus(status) ? now : null,
    };
  }

  private async attachArtifactOnce(artifact: Omit<OperationArtifact, "createdAt">): Promise<void> {
    const existing = await this.deps.operations.listArtifacts(artifact.operationId, { limit: 200 });
    if (existing.some((candidate) => candidate.id === artifact.id)) return;
    await this.deps.operations.attachArtifact({
      artifact,
      actorType: "system",
      actorId: null,
      now: this.now(),
    });
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }
}

async function requireOperationSnapshot(
  repository: OperationRepository,
  operationId: string,
): Promise<OperationSnapshot> {
  const snapshot = await repository.findOperationById(operationId);
  if (!snapshot) throw new Error(`Operation not found: ${operationId}`);
  return snapshot;
}

function readOperationMetadata(snapshot: MediaWorkflowSnapshot): OperationMetadata | null {
  const operation = snapshot.workflow.request["operation"];
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    return null;
  }
  const raw = operation as Record<string, unknown>;
  if (
    typeof raw.operationId !== "string"
    || typeof raw.actionId !== "string"
    || raw.operationKind !== "media_workflow"
  ) {
    return null;
  }
  return {
    operationId: raw.operationId,
    actionId: raw.actionId,
  };
}

function isSameStepProjection(
  existing: OperationStep | undefined,
  source: MediaWorkflowStep,
  status: OperationStepStatus,
): boolean {
  return Boolean(existing)
    && existing?.status === status
    && existing.jobId === source.jobId
    && existing.resourceRef?.id === resourceRefForStep(source)?.id
    && (existing.error?.message ?? null) === (source.failureMessage ?? null);
}

function sameAvailableActions(
  left: readonly { actionType: string; payload: Record<string, unknown>; operationRevision: number }[],
  right: readonly { actionType: string; payload: Record<string, unknown> }[],
  currentRevision: number,
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((action, index) => {
    const other = right[index];
    return Boolean(other)
      && action.operationRevision === currentRevision
      && action.actionType === other.actionType
      && JSON.stringify(action.payload) === JSON.stringify(other.payload);
  });
}

function resourceRefForStep(step: MediaWorkflowStep): OperationResourceRef | null {
  if (step.assetId) {
    return { type: "media_asset", id: step.assetId, uri: `media-asset:${step.assetId}` };
  }
  if (step.jobId) {
    return { type: "media_job", id: step.jobId, uri: `job:${step.jobId}` };
  }
  const materializationId = stringValue(step.output["materializationId"]);
  if (materializationId) {
    return { type: "materialization", id: materializationId, uri: `materialization:${materializationId}` };
  }
  return null;
}

function capabilityNameForStep(step: MediaWorkflowStep): string | null {
  switch (step.kind) {
    case "generate_audio":
      return "generate_audio";
    case "compose_media":
      return "compose_media";
    case "generate_image":
      return "generate_blog_image";
    case "generate_chart":
      return "chart_generation";
    case "reuse_asset":
      return null;
  }
}

function terminalStepStatus(status: OperationStepStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "skipped" || status === "cancelled";
}

function statusPath(current: Operation["status"], target: Operation["status"]): Operation["status"][] {
  if (current === target) return [];
  if (target === "succeeded" && current === "draft") return ["queued", "running", "succeeded"];
  if (target === "succeeded" && current === "queued") return ["running", "succeeded"];
  if (target === "succeeded" && current !== "running") return ["running", "succeeded"];
  if (target === "failed" && current === "draft") return ["blocked", "failed"];
  if (target === "failed" && current === "awaiting_confirmation") return ["blocked", "failed"];
  if (target === "failed") return ["failed"];
  if (target === "running" && current === "draft") return ["queued", "running"];
  if (target === "queued" && current === "failed") return ["queued"];
  return [target];
}

function mediaWorkflowEventId(operationId: string, event: MediaWorkflowEvent): string {
  return `${operationId}:media_workflow_event:${event.id}`;
}

function mediaWorkflowJobEventId(operationId: string, job: JobRequest): string {
  return `${operationId}:media_job:${job.id}:${job.status}:${job.updatedAt}`;
}

function workflowArtifact(
  operationId: string,
  snapshot: MediaWorkflowSnapshot,
): Omit<OperationArtifact, "createdAt"> {
  return {
    id: `${operationId}:media_workflow:${snapshot.workflow.id}`,
    operationId,
    stepId: null,
    kind: "media_workflow",
    uri: `media-workflow:${snapshot.workflow.id}`,
    label: snapshot.workflow.title,
    metadata: {
      workflowId: snapshot.workflow.id,
      status: snapshot.workflow.status,
      requestedDeliverable: snapshot.workflow.requestedDeliverable,
      finalAssetId: snapshot.workflow.finalAssetId,
    },
  };
}

function jobArtifact(
  operationId: string,
  step: MediaWorkflowStep,
): Omit<OperationArtifact, "createdAt"> {
  return {
    id: `${operationId}:media_job:${step.jobId}`,
    operationId,
    stepId: mediaWorkflowOperationStepId(operationId, step.id),
    kind: "media_job",
    uri: `job:${step.jobId}`,
    label: `${step.kind} job ${step.jobId}`,
    metadata: {
      workflowId: step.workflowId,
      workflowStepId: step.id,
      jobId: step.jobId,
      stepKind: step.kind,
      status: step.status,
    },
  };
}

function assetArtifact(
  operationId: string,
  step: MediaWorkflowStep,
): Omit<OperationArtifact, "createdAt"> {
  return {
    id: `${operationId}:media_asset:${step.assetId}`,
    operationId,
    stepId: mediaWorkflowOperationStepId(operationId, step.id),
    kind: "media_asset",
    uri: `media-asset:${step.assetId}`,
    label: `${step.kind} asset ${step.assetId}`,
    metadata: {
      workflowId: step.workflowId,
      workflowStepId: step.id,
      assetId: step.assetId,
      stepKind: step.kind,
    },
  };
}

function materializationArtifact(
  operationId: string,
  step: MediaWorkflowStep,
  materializationId: string,
): Omit<OperationArtifact, "createdAt"> {
  return {
    id: `${operationId}:materialization:${materializationId}`,
    operationId,
    stepId: mediaWorkflowOperationStepId(operationId, step.id),
    kind: "materialization",
    uri: `materialization:${materializationId}`,
    label: `Exact media reuse ${materializationId}`,
    metadata: {
      workflowId: step.workflowId,
      workflowStepId: step.id,
      materializationId,
      assetId: step.assetId,
    },
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
