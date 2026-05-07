import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";

export interface CancelWorkOrderRequest {
  workOrderId: string;
  requestedBy: string;
  reason?: string;
}

export interface CancelWorkOrderResult {
  outcome: "canceled" | "cancel_requested";
  workOrder: WorkOrder;
}

export interface CancelWorkOrderServiceOptions {
  repository: FactoryRepository;
  now?: () => string;
}

export class CancelWorkOrderService {
  constructor(private readonly options: CancelWorkOrderServiceOptions) {}

  async requestCancel(request: CancelWorkOrderRequest): Promise<CancelWorkOrderResult> {
    const workOrder = await this.requireWorkOrder(request.workOrderId);
    if (["succeeded", "failed", "canceled"].includes(workOrder.status)) {
      throw new Error(`Work order ${workOrder.id} is terminal and cannot be canceled.`);
    }

    const activeStageRun = workOrder.stageRuns.find((stageRun) => stageRun.status === "running");
    if (workOrder.status === "running") {
      await this.options.repository.appendEvent({
        workOrderId: workOrder.id,
        stageRunId: activeStageRun?.id,
        eventType: "revision_cancel_requested",
        payload: {
          requestedBy: request.requestedBy,
          reason: request.reason ?? "Cancel requested by operator.",
          activeStageKey: activeStageRun?.stageKey ?? null,
        },
        createdAt: this.now(),
      });

      return { outcome: "cancel_requested", workOrder };
    }

    const canceled = await this.cancelImmediately(workOrder, request);
    return { outcome: "canceled", workOrder: canceled };
  }

  private async cancelImmediately(
    workOrder: WorkOrder,
    request: CancelWorkOrderRequest,
  ): Promise<WorkOrder> {
    const next = await this.options.repository.updateWorkOrder({
      ...workOrder,
      revision: workOrder.revision + 1,
      status: "canceled",
      pausedState: undefined,
      completedAt: this.now(),
      executionLog: [
        ...workOrder.executionLog,
        {
          timestamp: this.now(),
          eventType: "canceled",
          details: {
            requestedBy: request.requestedBy,
            reason: request.reason ?? "Cancel requested by operator.",
          },
        },
      ],
    });

    await this.options.repository.appendEvent({
      workOrderId: workOrder.id,
      eventType: "revision_cancelled",
      payload: {
        requestedBy: request.requestedBy,
        reason: request.reason ?? "Cancel requested by operator.",
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
