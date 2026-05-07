import type { ProductBrief } from "@/core/entities/product-brief";
import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";

import { ResumeWorkOrderService } from "./resume-work-order-service";

export interface RetryWorkOrderStageRequest {
  workOrderId: string;
  stageKey: string;
  brief: ProductBrief;
  requestedBy: string;
}

export interface RetryWorkOrderStageServiceOptions {
  repository: FactoryRepository;
  resumeWorkOrderService: ResumeWorkOrderService;
  now?: () => string;
}

export class RetryWorkOrderStageService {
  constructor(private readonly options: RetryWorkOrderStageServiceOptions) {}

  async retryStage(request: RetryWorkOrderStageRequest): Promise<WorkOrder> {
    let workOrder = await this.requireWorkOrder(request.workOrderId);
    if (["succeeded", "canceled"].includes(workOrder.status)) {
      throw new Error(`Work order ${workOrder.id} is terminal and cannot retry a stage.`);
    }
    if (!workOrder.currentDag.stages.some((stage) => stage.key === request.stageKey)) {
      throw new Error(`Stage ${request.stageKey} is not part of work order ${workOrder.id}.`);
    }

    if (workOrder.status === "failed") {
      workOrder = await this.convertFailedWorkOrderToPausedCheckpoint(workOrder, request);
    }
    if (workOrder.status !== "paused") {
      throw new Error(`Work order ${workOrder.id} must be paused or failed before retry.`);
    }

    return this.options.resumeWorkOrderService.resume({
      workOrderId: workOrder.id,
      brief: request.brief,
      requestedStageKey: request.stageKey,
    });
  }

  private async convertFailedWorkOrderToPausedCheckpoint(
    workOrder: WorkOrder,
    request: RetryWorkOrderStageRequest,
  ): Promise<WorkOrder> {
    const failedRun = workOrder.stageRuns.find((stageRun) => stageRun.stageKey === request.stageKey && stageRun.status === "failed");
    const pausedState = {
      pausedAt: this.now(),
      reason: `Retry requested by ${request.requestedBy}.`,
      resumeFromStageKey: request.stageKey,
    };
    const next = await this.options.repository.updateWorkOrder({
      ...workOrder,
      revision: workOrder.revision + 1,
      status: "paused",
      completedAt: undefined,
      pausedState,
      executionLog: [
        ...workOrder.executionLog,
        {
          timestamp: this.now(),
          stageKey: request.stageKey,
          eventType: "paused",
          details: {
            reason: "retry_prepared",
            requestedBy: request.requestedBy,
          },
        },
      ],
    });

    await this.options.repository.createCheckpoint({
      checkpointId: `checkpoint_retry_${workOrder.id}_${Date.parse(this.now())}`,
      workOrderId: workOrder.id,
      stageRunId: failedRun?.id,
      pauseState: pausedState,
      resumeFromStageKey: request.stageKey,
      createdAt: this.now(),
    });

    await this.options.repository.appendEvent({
      workOrderId: workOrder.id,
      stageRunId: failedRun?.id,
      eventType: "revision_retry_prepared",
      payload: {
        requestedBy: request.requestedBy,
        resumeFromStageKey: request.stageKey,
      },
      createdAt: this.now(),
    });

    return next;
  }

  private async requireWorkOrder(workOrderId: string): Promise<WorkOrder> {
    const workOrder = await this.options.repository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error(`Factory work order not found: ${workOrderId}`);
    }

    return workOrder;
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}
