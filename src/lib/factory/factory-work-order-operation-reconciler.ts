import { randomUUID } from "node:crypto";

import type {
  Operation,
  OperationAction,
  OperationArtifact,
  OperationStatus,
  OperationStep,
  OperationStepStatus,
} from "@/core/entities/operation";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { ProductionStage } from "@/core/entities/production-stage";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import type { WorkOrder } from "@/core/entities/work-order";
import type {
  FactoryCheckpointRecord,
  FactoryEventRecord,
  FactoryOutputRecord,
  FactoryRepository,
} from "@/core/use-cases/FactoryRepository";
import {
  createFactoryWorkOrderApproveCheckpointAction,
  createFactoryWorkOrderCancelAction,
  createFactoryWorkOrderPauseAction,
  createFactoryWorkOrderRefineAssetAction,
  createFactoryWorkOrderResumeAction,
  createFactoryWorkOrderRetryStageAction,
  factoryWorkOrderOperationStepId,
  type FactoryWorkOrderOperationIdFactory,
} from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";
import {
  mapStageRunStatusToOperationStepStatus,
  mapWorkOrderStatusToOperationStatus,
} from "@/core/use-cases/operations/OperationStatusMapping";

export interface FactoryWorkOrderOperationReconcilerDeps {
  operations: OperationRepository;
  factory: FactoryRepository;
  idFactory?: FactoryWorkOrderOperationIdFactory;
  now?: () => string;
}

export class FactoryWorkOrderOperationReconciler {
  private readonly idFactory: FactoryWorkOrderOperationIdFactory;

  constructor(private readonly deps: FactoryWorkOrderOperationReconcilerDeps) {
    this.idFactory = deps.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  async reconcileRecent(limit = 50): Promise<void> {
    const operations = await this.deps.operations.listOperationsForAdmin({
      kind: "factory_work_order",
      limit,
    });

    for (const operation of operations) {
      await this.reconcileOperation(operation.id);
    }
  }

  async reconcileOperation(operationId: string): Promise<OperationSnapshot | null> {
    const snapshot = await this.deps.operations.findOperationById(operationId);
    if (!snapshot) return null;

    const workOrder = await this.deps.factory.findWorkOrderByOperationId(operationId);
    if (!workOrder) return snapshot;

    await this.reconcileSteps(snapshot.operation, workOrder);
    await this.reconcileEvents(snapshot.operation.id, workOrder);
    await this.reconcileArtifacts(snapshot.operation.id, workOrder);
    await this.advanceOperation(snapshot.operation.id, mapWorkOrderStatusToOperationStatus(workOrder.status));
    await this.replaceAvailableActions(snapshot.operation.id, workOrder);

    return this.deps.operations.findOperationById(operationId);
  }

  async reconcileWorkOrder(workOrderId: string): Promise<OperationSnapshot | null> {
    const workOrder = await this.deps.factory.findWorkOrderById(workOrderId);
    if (!workOrder) return null;

    return this.reconcileOperation(workOrder.operationId);
  }

  private async reconcileSteps(operation: Operation, workOrder: WorkOrder): Promise<void> {
    for (let index = 0; index < workOrder.currentDag.stages.length; index += 1) {
      const stage = workOrder.currentDag.stages[index];
      const stageRun = latestStageRunForStage(workOrder, stage.key);
      const current = await this.deps.operations.findOperationById(operation.id);
      const existing = current?.steps.find((candidate) => candidate.id === factoryWorkOrderOperationStepId(operation.id, stage.key));
      const step = this.toOperationStep(operation.id, stage, stageRun, index + 1, existing);

      if (isSameStepProjection(existing, step)) {
        continue;
      }

      await this.deps.operations.upsertStep({
        step,
        actorType: "system",
        actorId: null,
        now: this.now(),
      });
    }
  }

  private async reconcileEvents(operationId: string, workOrder: WorkOrder): Promise<void> {
    const existingIds = new Set((await this.deps.operations.listEvents(operationId, { limit: 200 })).map((event) => event.id));
    const stageRunById = new Map(workOrder.stageRuns.map((stageRun) => [stageRun.id, stageRun]));
    const events = await this.deps.factory.listEventsForWorkOrder(workOrder.id);

    for (const event of events) {
      const eventId = factoryEventOperationEventId(operationId, event);
      if (existingIds.has(eventId)) continue;

      const stageRun = event.stageRunId ? stageRunById.get(event.stageRunId) : null;
      await this.deps.operations.appendEvent({
        id: eventId,
        operationId,
        stepId: stageRun ? factoryWorkOrderOperationStepId(operationId, stageRun.stageKey) : null,
        type: "executor_event_received",
        actorType: "system",
        actorId: null,
        payload: {
          source: "factory_work_order",
          factoryEventId: event.id,
          workOrderId: workOrder.id,
          stageRunId: event.stageRunId,
          eventType: event.eventType,
          payload: event.payload,
        },
        now: event.createdAt,
      });
      existingIds.add(eventId);
    }
  }

  private async reconcileArtifacts(operationId: string, workOrder: WorkOrder): Promise<void> {
    const existingIds = new Set((await this.deps.operations.listArtifacts(operationId, { limit: 200 })).map((artifact) => artifact.id));
    const stageRunById = new Map(workOrder.stageRuns.map((stageRun) => [stageRun.id, stageRun]));
    const outputs = await this.deps.factory.listOutputsForWorkOrder(workOrder.id);

    for (const output of outputs) {
      const artifact = outputArtifact(operationId, output, output.stageRunId ? stageRunById.get(output.stageRunId) : undefined);
      if (existingIds.has(artifact.id)) continue;

      await this.deps.operations.attachArtifact({
        artifact,
        actorType: "system",
        actorId: null,
        now: output.createdAt,
      });
      existingIds.add(artifact.id);
    }
  }

  private async replaceAvailableActions(operationId: string, workOrder: WorkOrder): Promise<void> {
    const current = await this.deps.operations.findOperationById(operationId);
    if (!current) return;

    const actions: OperationAction[] = [];
    const revision = current.operation.revision;
    const base = { operationId, operationRevision: revision, idFactory: this.idFactory };

    if (workOrder.status === "running") {
      actions.push(createFactoryWorkOrderPauseAction({
        ...base,
        payload: {
          workOrderId: workOrder.id,
          reason: "Pause requested from operation action.",
        },
      }));
      actions.push(createFactoryWorkOrderCancelAction({
        ...base,
        running: true,
        payload: {
          workOrderId: workOrder.id,
          reason: "Cancel requested from operation action.",
        },
      }));
    }

    if (workOrder.status === "planned" || workOrder.status === "paused") {
      actions.push(createFactoryWorkOrderCancelAction({
        ...base,
        payload: {
          workOrderId: workOrder.id,
          reason: "Cancel requested from operation action.",
        },
      }));
    }

    if (workOrder.status === "paused" || workOrder.status === "failed") {
      const brief = productBriefFromOperationInput(current.operation.input);
      const checkpoint = await this.deps.factory.findLatestActiveCheckpoint(workOrder.id);
      if (brief && checkpoint) {
        actions.push(...await this.checkpointActions(base, workOrder, checkpoint, brief));
      }
    }

    const available = await this.deps.operations.listAvailableActions(operationId);
    if (sameAvailableActions(available, actions, revision)) return;

    await this.deps.operations.replaceActions({
      operationId,
      actions,
      actorType: "system",
      actorId: null,
      now: this.now(),
    });
  }

  private async checkpointActions(
    base: { operationId: string; operationRevision: number; idFactory: FactoryWorkOrderOperationIdFactory },
    workOrder: WorkOrder,
    checkpoint: FactoryCheckpointRecord,
    brief: ProductBrief,
  ): Promise<OperationAction[]> {
    const actions: OperationAction[] = [
      createFactoryWorkOrderResumeAction({
        ...base,
        payload: {
          workOrderId: workOrder.id,
          checkpointId: checkpoint.checkpointId,
          brief,
          requestedStageKey: checkpoint.resumeFromStageKey,
        },
      }),
      createFactoryWorkOrderRetryStageAction({
        ...base,
        payload: {
          workOrderId: workOrder.id,
          checkpointId: checkpoint.checkpointId,
          stageKey: checkpoint.resumeFromStageKey,
          brief,
        },
      }),
      createFactoryWorkOrderApproveCheckpointAction({
        ...base,
        payload: {
          workOrderId: workOrder.id,
          checkpointId: checkpoint.checkpointId,
        },
      }),
    ];

    const activeAsset = await this.findActiveAssetForRefinement(workOrder.id);
    if (activeAsset) {
      actions.splice(1, 0, createFactoryWorkOrderRefineAssetAction({
        ...base,
        payload: {
          workOrderId: workOrder.id,
          checkpointId: checkpoint.checkpointId,
          assetId: activeAsset.entityId,
          mode: "metadata_fix",
          parameterOverrides: {},
          requestedStageKey: checkpoint.resumeFromStageKey,
        },
      }));
    }

    return actions;
  }

  private async findActiveAssetForRefinement(workOrderId: string): Promise<FactoryOutputRecord | null> {
    const assetOutputs = await this.deps.factory.listOutputsForWorkOrder(workOrderId, "asset");
    const supersededIds = new Set(assetOutputs.flatMap((output) => output.supersedesEntityId ? [output.supersedesEntityId] : []));
    return assetOutputs.filter((output) => !supersededIds.has(output.entityId)).at(-1) ?? null;
  }

  private async advanceOperation(operationId: string, targetStatus: OperationStatus): Promise<OperationSnapshot> {
    let snapshot = await requireOperationSnapshot(this.deps.operations, operationId);
    if (snapshot.operation.status === targetStatus) return snapshot;
    if (snapshot.operation.status === "succeeded" || snapshot.operation.status === "cancelled" || snapshot.operation.status === "expired") {
      return snapshot;
    }

    for (const status of statusPath(snapshot.operation.status, targetStatus)) {
      if (snapshot.operation.status === status) continue;
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
    stage: ProductionStage,
    stageRun: StageRunRecord | undefined,
    sequence: number,
    existing: OperationStep | undefined,
  ): OperationStep {
    const status = stageRun ? mapStageRunStatusToOperationStepStatus(stageRun.status) : "pending";
    return {
      id: factoryWorkOrderOperationStepId(operationId, stage.key),
      operationId,
      sequence,
      kind: `factory.${stage.kind}`,
      status,
      dependsOnStepIds: stage.dependencyKeys.map((dependencyKey) => factoryWorkOrderOperationStepId(operationId, dependencyKey)),
      capabilityName: `factory.${stage.kind}`,
      jobId: null,
      systemCommandId: null,
      resourceRef: stageRun?.resultRef
        ? {
            type: factoryResourceTypeForOutputKind(stageRun.resultRef.entityKind),
            id: stageRun.resultRef.entityId,
            uri: `factory://${stageRun.resultRef.entityKind}/${stageRun.resultRef.entityId}`,
          }
        : { type: "factory_stage", id: stage.key, uri: `factory-stage:${stage.key}` },
      input: {
        stageKey: stage.key,
        stageKind: stage.kind,
        label: stage.label,
        dependencyKeys: [...stage.dependencyKeys],
        config: stage.config ?? null,
      },
      output: stageRun?.resultRef
        ? {
            stageRunId: stageRun.id,
            resultEntityKind: stageRun.resultRef.entityKind,
            resultEntityId: stageRun.resultRef.entityId,
            attemptCount: stageRun.attemptCount,
          }
        : null,
      error: stageRun?.errorCode || stageRun?.errorMessage
        ? {
            code: stageRun.errorCode ?? "FACTORY_STAGE_FAILED",
            message: stageRun.errorMessage ?? "Factory stage failed.",
            details: {
              stageKey: stage.key,
              stageRunId: stageRun.id,
              attemptCount: stageRun.attemptCount,
            },
          }
        : null,
      retryCount: existing?.retryCount ?? Math.max(0, (stageRun?.attemptCount ?? 0) - 1),
      startedAt: existing?.startedAt ?? stageRun?.startedAt ?? null,
      completedAt: terminalStepStatus(status) ? (stageRun?.completedAt ?? this.now()) : null,
    };
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

function latestStageRunForStage(workOrder: WorkOrder, stageKey: string): StageRunRecord | undefined {
  return [...workOrder.stageRuns]
    .filter((stageRun) => stageRun.stageKey === stageKey)
    .sort((left, right) => right.attemptCount - left.attemptCount)
    .at(0);
}

function isSameStepProjection(existing: OperationStep | undefined, projected: OperationStep): boolean {
  return Boolean(existing)
    && existing?.status === projected.status
    && existing.resourceRef?.id === projected.resourceRef?.id
    && existing.output?.resultEntityId === projected.output?.resultEntityId
    && (existing.error?.message ?? null) === (projected.error?.message ?? null);
}

function productBriefFromOperationInput(input: Record<string, unknown>): ProductBrief | null {
  const request = recordValue(input.request);
  const brief = recordValue(request?.brief ?? input.brief);
  return brief ? brief as unknown as ProductBrief : null;
}

function sameAvailableActions(
  left: readonly { actionType: string; payload: Record<string, unknown>; operationRevision: number }[],
  right: readonly { actionType: string; payload: Record<string, unknown> }[],
  currentRevision: number,
): boolean {
  if (left.length !== right.length) return false;
  return left.every((action, index) => {
    const other = right[index];
    return Boolean(other)
      && action.operationRevision === currentRevision
      && action.actionType === other.actionType
      && JSON.stringify(action.payload) === JSON.stringify(other.payload);
  });
}

function terminalStepStatus(status: OperationStepStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "skipped" || status === "cancelled";
}

function statusPath(current: OperationStatus, target: OperationStatus): OperationStatus[] {
  if (current === target) return [];
  if (current === "failed" && target === "queued") return ["queued"];
  if (current === "failed" && target === "running") return ["queued", "running"];
  if (current === "failed" && target === "succeeded") return ["queued", "running", "succeeded"];
  if (current === "failed" && target === "blocked") return ["queued", "running", "blocked"];
  if (target === "succeeded" && current === "draft") return ["queued", "running", "succeeded"];
  if (target === "succeeded" && current === "queued") return ["running", "succeeded"];
  if (target === "succeeded" && current !== "running") return ["running", "succeeded"];
  if (target === "failed" && current === "draft") return ["queued", "failed"];
  if (target === "failed" && current === "awaiting_confirmation") return ["queued", "failed"];
  if (target === "failed") return ["failed"];
  if (target === "running" && current === "draft") return ["queued", "running"];
  if (target === "running" && current === "blocked") return ["running"];
  if (target === "queued" && current === "failed") return ["queued"];
  return [target];
}

function outputArtifact(
  operationId: string,
  output: FactoryOutputRecord,
  stageRun: StageRunRecord | undefined,
): Omit<OperationArtifact, "createdAt"> {
  const uri = outputUri(output);
  return {
    id: `${operationId}:factory_output:${output.entityId}`,
    operationId,
    stepId: stageRun ? factoryWorkOrderOperationStepId(operationId, stageRun.stageKey) : null,
    kind: `factory_${output.entityKind}`,
    uri,
    label: outputLabel(output),
    metadata: {
      resourceRef: {
        type: factoryResourceTypeForOutputKind(output.entityKind),
        id: output.entityId,
        uri,
      },
      workOrderId: output.workOrderId,
      stageRunId: output.stageRunId,
      entityKind: output.entityKind,
      supersedesEntityId: output.supersedesEntityId,
    },
  };
}

function outputUri(output: FactoryOutputRecord): string {
  const record = recordValue(output.payload);
  const uri = stringValue(record?.uri)
    ?? stringValue(record?.archiveUri)
    ?? stringValue(record?.url);
  return uri ?? `factory://${output.entityKind}/${output.entityId}`;
}

function outputLabel(output: FactoryOutputRecord): string {
  const record = recordValue(output.payload);
  return stringValue(record?.title)
    ?? stringValue(record?.label)
    ?? `${output.entityKind} ${output.entityId}`;
}

function factoryEventOperationEventId(operationId: string, event: FactoryEventRecord): string {
  return `${operationId}:factory_event:${event.id}`;
}

function factoryResourceTypeForOutputKind(kind: FactoryOutputRecord["entityKind"]): string {
  switch (kind) {
    case "release":
      return "factory_release";
    case "composition":
      return "factory_composition";
    case "qa_report":
      return "factory_qa_report";
    case "asset":
      return "factory_asset";
    case "research_packet":
      return "factory_evidence";
    case "draft":
      return "factory_draft";
    case "outcome":
      return "factory_outcome";
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
