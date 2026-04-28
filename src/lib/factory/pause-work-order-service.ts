import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";

export interface PauseWorkOrderRequest {
  workOrderId: string;
  requestedBy: string;
  reason?: string;
}

export interface PauseWorkOrderResult {
  outcome: "already_paused" | "paused" | "pause_requested";
  resumeFromStageKey: string | null;
  checkpointId?: string;
}

export interface PauseWorkOrderServiceOptions {
  repository: FactoryRepository;
  now?: () => string;
  idGenerator?: () => string;
}

export class PauseWorkOrderService {
  constructor(private readonly options: PauseWorkOrderServiceOptions) {}

  async requestPause(request: PauseWorkOrderRequest): Promise<PauseWorkOrderResult> {
    const workOrder = await this.requireWorkOrder(request.workOrderId);

    if (["succeeded", "failed", "canceled"].includes(workOrder.status)) {
      throw new Error(`Work order ${workOrder.id} is terminal and cannot be paused.`);
    }

    if (workOrder.status === "paused") {
      const checkpoint = await this.options.repository.findLatestActiveCheckpoint(workOrder.id);
      return {
        outcome: "already_paused",
        resumeFromStageKey: workOrder.pausedState?.resumeFromStageKey ?? checkpoint?.resumeFromStageKey ?? null,
        ...(checkpoint ? { checkpointId: checkpoint.checkpointId } : {}),
      };
    }

    const activeStageRun = workOrder.stageRuns.find((stageRun) => stageRun.status === "running");
    if (activeStageRun) {
      await this.options.repository.appendEvent({
        workOrderId: workOrder.id,
        stageRunId: activeStageRun.id,
        eventType: "revision_pause_requested",
        payload: {
          requestedBy: request.requestedBy,
          reason: request.reason ?? "Pause requested by operator.",
          activeStageKey: activeStageRun.stageKey,
        },
        createdAt: this.now(),
      });

      return {
        outcome: "pause_requested",
        resumeFromStageKey: activeStageRun.stageKey,
      };
    }

    const nextStage = this.findNextRunnableStage(workOrder);
    if (!nextStage) {
      throw new Error(`Work order ${workOrder.id} does not have a runnable stage to pause at.`);
    }

    const pausedState = {
      pausedAt: this.now(),
      reason: request.reason ?? "Pause requested by operator.",
      resumeFromStageKey: nextStage.key,
    };
    const checkpointId = `checkpoint_${this.id()}`;

    await this.options.repository.createCheckpoint({
      checkpointId,
      workOrderId: workOrder.id,
      pauseState: pausedState,
      resumeFromStageKey: nextStage.key,
      createdAt: this.now(),
    });
    await this.options.repository.appendEvent({
      workOrderId: workOrder.id,
      eventType: "revision_pause_immediate",
      payload: {
        requestedBy: request.requestedBy,
        reason: pausedState.reason,
        resumeFromStageKey: nextStage.key,
      },
      createdAt: this.now(),
    });

    await this.options.repository.updateWorkOrder({
      ...workOrder,
      revision: workOrder.revision + 1,
      status: "paused",
      pausedState,
      executionLog: [
        ...workOrder.executionLog,
        {
          timestamp: this.now(),
          stageKey: nextStage.key,
          eventType: "paused",
          details: {
            reason: pausedState.reason,
            requestedBy: request.requestedBy,
          },
        },
      ],
    });

    return {
      outcome: "paused",
      resumeFromStageKey: nextStage.key,
      checkpointId,
    };
  }

  private findNextRunnableStage(workOrder: WorkOrder) {
    for (const stage of workOrder.currentDag.stages) {
      const stageRun = workOrder.stageRuns.find((candidate) => candidate.stageKey === stage.key);
      if (stageRun?.status === "succeeded") {
        continue;
      }

      const dependenciesSatisfied = stage.dependencyKeys.every((dependencyKey) =>
        workOrder.stageRuns.some((dependencyRun) => dependencyRun.stageKey === dependencyKey && dependencyRun.status === "succeeded"),
      );

      if (dependenciesSatisfied) {
        return stage;
      }
    }

    return undefined;
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

  private id(): string {
    return this.options.idGenerator?.() ?? crypto.randomUUID();
  }
}