import { randomUUID } from "node:crypto";

import {
  OperationActionRejectedError,
  type Operation,
  type OperationErrorPayload,
  type OperationStep,
} from "@/core/entities/operation";
import { listProductBriefValidationErrors, type ProductBrief } from "@/core/entities/product-brief";
import type { ProductionDAG } from "@/core/entities/production-dag";
import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type {
  OperationActionExecutor,
  OperationActionExecutorInput,
  OperationActionExecutorResult,
} from "@/core/use-cases/operations/OperationActionDispatch";
import {
  FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES,
  isFactoryWorkOrderOperationActionType,
  type FactoryWorkOrderOperationActionType,
  type FactoryWorkOrderOperationIdFactory,
} from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import type {
  OperationRepository,
  OperationSnapshot,
} from "@/core/use-cases/operations/OperationRepository";

import type { DAGPlanner } from "./dag-planner";
import type { AssetRefinementService } from "./asset-refinement-service";
import type { CancelWorkOrderService } from "./cancel-work-order-service";
import type { PauseWorkOrderService } from "./pause-work-order-service";
import type { ProductionOrchestrator } from "./production-orchestrator";
import type { ResumeWorkOrderService } from "./resume-work-order-service";
import type { RetryWorkOrderStageService } from "./retry-work-order-stage-service";

const FACTORY_ACTION_SET = new Set<string>(FACTORY_WORK_ORDER_OPERATION_ACTION_TYPES);

export interface FactoryWorkOrderOperationExecutorDeps {
  repository: FactoryRepository;
  planner: Pick<DAGPlanner, "generateDAG">;
  orchestrator: Pick<ProductionOrchestrator, "execute">;
  pauseWorkOrderService: Pick<PauseWorkOrderService, "requestPause">;
  assetRefinementService: Pick<AssetRefinementService, "refine">;
  resumeWorkOrderService: Pick<ResumeWorkOrderService, "resume">;
  cancelWorkOrderService: Pick<CancelWorkOrderService, "requestCancel">;
  retryWorkOrderStageService: Pick<RetryWorkOrderStageService, "retryStage">;
  reconcile?: (operationId: string) => Promise<void>;
  idFactory?: FactoryWorkOrderOperationIdFactory;
  now?: () => string;
}

export class FactoryWorkOrderOperationExecutor implements OperationActionExecutor {
  private readonly idFactory: FactoryWorkOrderOperationIdFactory;

  constructor(private readonly deps: FactoryWorkOrderOperationExecutorDeps) {
    this.idFactory = deps.idFactory ?? ((prefix) => `${prefix}_${randomUUID()}`);
  }

  canExecute(actionType: string): boolean {
    return FACTORY_ACTION_SET.has(actionType);
  }

  async execute(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    try {
      if (!isFactoryWorkOrderOperationActionType(input.action.actionType)) {
        throw new Error(`Unsupported factory work-order action: ${input.action.actionType}`);
      }

      switch (input.action.actionType as FactoryWorkOrderOperationActionType) {
        case "factory.work_order.create":
          return await this.createWorkOrder(input);
        case "factory.work_order.pause":
          return await this.pauseWorkOrder(input);
        case "factory.work_order.refine_asset":
          return await this.refineAsset(input);
        case "factory.work_order.resume":
          return await this.resumeWorkOrder(input);
        case "factory.work_order.retry_stage":
          return await this.retryStage(input);
        case "factory.work_order.cancel":
          return await this.cancelWorkOrder(input);
        case "factory.work_order.approve_checkpoint":
          return await this.approveCheckpoint(input);
      }
    } catch (error) {
      return { snapshot: await this.blockAfterExecutorError(input, error) };
    }
  }

  private async createWorkOrder(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const operation = input.snapshot.operation;
    const existing = await this.deps.repository.findWorkOrderByOperationId(operation.id);
    if (existing) {
      await this.reconcile(operation.id);
      return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
    }

    const brief = requireProductBrief(input.payload.brief);
    const previousWorkOrderIds = stringArray(input.payload.previousWorkOrderIds);
    const dag = this.deps.planner.generateDAG({
      brief,
      generatedBy: "factory_work_order_operation_executor",
      generationReason: "batch_automation",
      now: () => this.now(),
      idGenerator: () => this.idFactory("dag"),
    });

    const workOrder = await this.deps.repository.createWorkOrder(this.createInitialWorkOrder({
      operation,
      actorUserId: input.actorUserId,
      brief,
      dag,
      previousWorkOrderIds,
    }));
    await this.deps.repository.saveProductionDAG(workOrder.id, dag);

    await this.ensureOperationRunning(input.repository, operation.id, input.actorUserId, input.now);
    await this.deps.orchestrator.execute({
      workOrderId: workOrder.id,
      brief,
    });
    await this.reconcile(operation.id);

    return { snapshot: await requireOperationSnapshot(input.repository, operation.id) };
  }

  private async pauseWorkOrder(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    await this.requireOwnedWorkOrder(input);
    await this.deps.pauseWorkOrderService.requestPause({
      workOrderId: requirePayloadString(input.payload, "workOrderId"),
      requestedBy: input.actorUserId ?? input.actorRole,
      reason: payloadString(input.payload, "reason") ?? "Pause requested from operation action.",
    });
    await this.reconcile(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async refineAsset(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const workOrder = await this.requireOwnedWorkOrder(input);
    await this.assertCheckpointCurrent(workOrder.id, requirePayloadString(input.payload, "checkpointId"));
    await this.deps.assetRefinementService.refine({
      workOrderId: workOrder.id,
      assetId: requirePayloadString(input.payload, "assetId"),
      mode: requireRefineMode(input.payload.mode),
      requestedBy: input.actorUserId ?? input.actorRole,
      brief: optionalProductBrief(input.payload.brief),
      parameterOverrides: recordValue(input.payload.parameterOverrides) ?? undefined,
      requestedStageKey: payloadString(input.payload, "requestedStageKey") ?? undefined,
      userFileId: payloadString(input.payload, "userFileId") ?? undefined,
    });
    await this.reconcile(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async resumeWorkOrder(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const workOrder = await this.requireOwnedWorkOrder(input);
    await this.assertCheckpointCurrent(workOrder.id, requirePayloadString(input.payload, "checkpointId"));
    await this.ensureOperationRunning(input.repository, input.snapshot.operation.id, input.actorUserId, input.now);
    await this.deps.resumeWorkOrderService.resume({
      workOrderId: workOrder.id,
      brief: requireProductBrief(input.payload.brief),
      requestedStageKey: payloadString(input.payload, "requestedStageKey") ?? undefined,
    });
    await this.reconcile(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async retryStage(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const workOrder = await this.requireOwnedWorkOrder(input);
    const checkpointId = payloadString(input.payload, "checkpointId");
    if (checkpointId) {
      await this.assertCheckpointCurrent(workOrder.id, checkpointId);
    }

    await this.ensureOperationRunning(input.repository, input.snapshot.operation.id, input.actorUserId, input.now);
    await this.deps.retryWorkOrderStageService.retryStage({
      workOrderId: workOrder.id,
      stageKey: requirePayloadString(input.payload, "stageKey"),
      brief: requireProductBrief(input.payload.brief),
      requestedBy: input.actorUserId ?? input.actorRole,
    });
    await this.reconcile(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async cancelWorkOrder(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const workOrder = await this.requireOwnedWorkOrder(input);
    await this.deps.cancelWorkOrderService.requestCancel({
      workOrderId: workOrder.id,
      requestedBy: input.actorUserId ?? input.actorRole,
      reason: payloadString(input.payload, "reason") ?? "Cancel requested from operation action.",
    });
    await this.reconcile(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async approveCheckpoint(input: OperationActionExecutorInput): Promise<OperationActionExecutorResult> {
    const workOrder = await this.requireOwnedWorkOrder(input);
    const checkpoint = await this.assertCheckpointCurrent(workOrder.id, requirePayloadString(input.payload, "checkpointId"));
    await this.deps.repository.appendEvent({
      workOrderId: workOrder.id,
      stageRunId: checkpoint.stageRunId ?? undefined,
      eventType: "revision_checkpoint_approved",
      payload: {
        requestedBy: input.actorUserId ?? input.actorRole,
        checkpointId: checkpoint.checkpointId,
        resumeFromStageKey: checkpoint.resumeFromStageKey,
      },
      createdAt: this.now(),
    });
    await this.reconcile(input.snapshot.operation.id);
    return { snapshot: await requireOperationSnapshot(input.repository, input.snapshot.operation.id) };
  }

  private async requireOwnedWorkOrder(input: OperationActionExecutorInput): Promise<WorkOrder> {
    const workOrderId = requirePayloadString(input.payload, "workOrderId");
    const workOrder = await this.deps.repository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error(`Factory work order not found: ${workOrderId}`);
    }
    if (workOrder.operationId !== input.snapshot.operation.id) {
      throw new OperationActionRejectedError("Factory work order does not belong to this operation.", {
        operationId: input.snapshot.operation.id,
        workOrderOperationId: workOrder.operationId,
        workOrderId,
      });
    }
    return workOrder;
  }

  private async assertCheckpointCurrent(workOrderId: string, checkpointId: string) {
    const checkpoint = await this.deps.repository.findLatestActiveCheckpoint(workOrderId);
    if (!checkpoint) {
      throw new Error(`Work order ${workOrderId} does not have an active checkpoint.`);
    }
    if (checkpoint.checkpointId !== checkpointId) {
      throw new Error(`Checkpoint ${checkpointId} is stale for work order ${workOrderId}.`);
    }
    return checkpoint;
  }

  private createInitialWorkOrder(input: {
    operation: Operation;
    actorUserId: string | null;
    brief: ProductBrief;
    dag: ProductionDAG;
    previousWorkOrderIds: readonly string[];
  }): WorkOrder {
    return {
      id: this.idFactory("wo"),
      schemaVersion: 1,
      operationId: input.operation.id,
      briefId: input.brief.id,
      status: "planned",
      currentDag: input.dag,
      stageRuns: [],
      executionLog: [{
        timestamp: this.now(),
        eventType: "planned",
        details: {
          operationId: input.operation.id,
          source: "factory_work_order_operation_executor",
        },
      }],
      revision: 1,
      previousWorkOrderIds: input.previousWorkOrderIds,
      createdAt: this.now(),
      userId: input.operation.createdByUserId ?? input.actorUserId ?? "factory_user",
      conversationId: input.operation.conversationId ?? undefined,
      initiatedBy: "batch_automation",
    };
  }

  private async ensureOperationRunning(
    repository: OperationRepository,
    operationId: string,
    actorUserId: string | null,
    now?: string,
  ): Promise<void> {
    let snapshot = await requireOperationSnapshot(repository, operationId);
    if (snapshot.operation.status === "draft" || snapshot.operation.status === "blocked" || snapshot.operation.status === "failed") {
      snapshot = await repository.updateOperationStatus({
        operationId,
        status: "queued",
        supportsRetry: true,
        actorType: "system",
        actorId: actorUserId,
        now,
      });
    }
    if (snapshot.operation.status === "queued") {
      await repository.updateOperationStatus({
        operationId,
        status: "running",
        supportsRetry: true,
        actorType: "system",
        actorId: actorUserId,
        now,
      });
    }
  }

  private async blockAfterExecutorError(
    input: OperationActionExecutorInput,
    error: unknown,
  ): Promise<OperationSnapshot> {
    const message = error instanceof Error ? error.message : "Factory work-order operation failed.";
    await this.blockOperation(input.repository, input.snapshot.operation, {
      code: "FACTORY_WORK_ORDER_EXECUTOR_BLOCKED",
      message,
      details: { payload: input.payload },
    }, input.actorUserId, input.now);
    return requireOperationSnapshot(input.repository, input.snapshot.operation.id);
  }

  private async blockOperation(
    repository: OperationRepository,
    operation: Operation,
    error: OperationErrorPayload,
    actorUserId: string | null,
    now?: string,
  ): Promise<void> {
    const blocker: OperationStep = {
      id: `${operation.id}:factory_work_order:blocker`,
      operationId: operation.id,
      sequence: 999,
      kind: "factory.blocker",
      status: "blocked",
      dependsOnStepIds: [],
      capabilityName: "factory_work_order",
      jobId: null,
      systemCommandId: null,
      resourceRef: null,
      input: error.details ?? {},
      output: null,
      error,
      retryCount: 0,
      startedAt: null,
      completedAt: null,
    };
    await repository.upsertStep({
      step: blocker,
      actorType: "system",
      actorId: actorUserId,
      now,
    });

    const current = await requireOperationSnapshot(repository, operation.id);
    if (current.operation.status !== "blocked" && !["succeeded", "failed", "cancelled", "expired"].includes(current.operation.status)) {
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

  private async reconcile(operationId: string): Promise<void> {
    await this.deps.reconcile?.(operationId);
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

function requireProductBrief(value: unknown): ProductBrief {
  if (!recordValue(value)) {
    throw new Error("ProductBrief is required.");
  }
  const brief = value as ProductBrief;
  const errors = listProductBriefValidationErrors(brief);
  if (errors.length > 0) {
    throw new Error(`ProductBrief is invalid: ${errors.join(" ")}`);
  }
  return brief;
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requireRefineMode(value: unknown) {
  if (value === "metadata_fix" || value === "replace_with_upload" || value === "regenerate") {
    return value;
  }
  throw new Error("mode must be one of metadata_fix, replace_with_upload, or regenerate.");
}

function optionalProductBrief(value: unknown): ProductBrief | undefined {
  if (value == null) return undefined;
  return requireProductBrief(value);
}
