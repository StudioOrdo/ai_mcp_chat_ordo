import type { ProductBrief } from "@/core/entities/product-brief";
import type { StageRunRecord } from "@/core/entities/stage-run-record";
import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";

import { ProductionOrchestrator } from "./production-orchestrator";
import { FactoryResumeFrontierPlanner } from "./resume-frontier-planner";

export interface ResumeWorkOrderServiceOptions {
  repository: FactoryRepository;
  orchestrator: ProductionOrchestrator;
  frontierPlanner: FactoryResumeFrontierPlanner;
  now?: () => string;
}

export class ResumeWorkOrderService {
  constructor(private readonly options: ResumeWorkOrderServiceOptions) {}

  async resume(input: {
    workOrderId: string;
    brief: ProductBrief;
    requestedStageKey?: string;
  }): Promise<WorkOrder> {
    const workOrder = await this.requirePausedWorkOrder(input.workOrderId);
    const checkpoint = await this.options.repository.findLatestActiveCheckpoint(workOrder.id);
    if (!checkpoint) {
      throw new Error(`Paused work order ${workOrder.id} does not have an active checkpoint.`);
    }

    const plan = this.options.frontierPlanner.plan({
      workOrder,
      outputs: await this.options.repository.listOutputsForWorkOrder(workOrder.id),
      mode: "none",
      requestedStageKey: input.requestedStageKey,
    });
    await this.prepareForResume(workOrder, checkpoint.stageRunId ?? undefined, plan.stageKey);

    return this.options.orchestrator.execute({
      workOrderId: workOrder.id,
      brief: input.brief,
    });
  }

  private async prepareForResume(
    workOrder: WorkOrder,
    stageRunId: string | undefined,
    resumeFromStageKey: string,
  ): Promise<void> {
    const affectedStageKeys = this.collectAffectedStageKeys(workOrder, resumeFromStageKey);
    const resetStageRuns = workOrder.stageRuns.map((stageRun) => affectedStageKeys.has(stageRun.stageKey)
      ? this.toPending(stageRun)
      : stageRun);

    for (const stageRun of resetStageRuns) {
      if (!affectedStageKeys.has(stageRun.stageKey)) {
        continue;
      }
      await this.options.repository.upsertStageRun(workOrder.id, stageRun);
    }

    const pausedState = {
      pausedAt: this.now(),
      reason: workOrder.pausedState?.reason ?? "Prepared for resume.",
      resumeFromStageKey,
    };

    await this.options.repository.appendEvent({
      workOrderId: workOrder.id,
      stageRunId,
      eventType: "revision_resume_prepared",
      payload: {
        resumeFromStageKey,
        resetStageKeys: [...affectedStageKeys],
      },
      createdAt: this.now(),
    });

    await this.options.repository.updateWorkOrder({
      ...workOrder,
      revision: workOrder.revision + 1,
      stageRuns: resetStageRuns,
      pausedState,
      executionLog: [
        ...workOrder.executionLog,
        {
          timestamp: this.now(),
          stageKey: resumeFromStageKey,
          eventType: "paused",
          details: { reason: "resume_prepared", resetStageKeys: [...affectedStageKeys] },
        },
      ],
    });

    await this.options.repository.createCheckpoint({
      checkpointId: `checkpoint_resume_${workOrder.id}_${Date.parse(this.now())}`,
      workOrderId: workOrder.id,
      stageRunId,
      pauseState: pausedState,
      resumeFromStageKey,
      createdAt: this.now(),
    });
  }

  private collectAffectedStageKeys(workOrder: WorkOrder, resumeFromStageKey: string): Set<string> {
    const reverseDependencies = new Map<string, string[]>();
    for (const stage of workOrder.currentDag.stages) {
      for (const dependencyKey of stage.dependencyKeys) {
        const dependents = reverseDependencies.get(dependencyKey) ?? [];
        dependents.push(stage.key);
        reverseDependencies.set(dependencyKey, dependents);
      }
    }

    const affected = new Set<string>();
    const queue = [resumeFromStageKey];

    while (queue.length > 0) {
      const stageKey = queue.shift();
      if (!stageKey || affected.has(stageKey)) {
        continue;
      }

      affected.add(stageKey);
      for (const dependentKey of reverseDependencies.get(stageKey) ?? []) {
        queue.push(dependentKey);
      }
    }

    return affected;
  }

  private toPending(stageRun: StageRunRecord): StageRunRecord {
    return {
      id: stageRun.id,
      stageKey: stageRun.stageKey,
      status: "pending",
      attemptCount: 0,
    };
  }

  private async requirePausedWorkOrder(workOrderId: string): Promise<WorkOrder> {
    const workOrder = await this.options.repository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error(`Factory work order not found: ${workOrderId}`);
    }
    if (workOrder.status !== "paused") {
      throw new Error(`Work order ${workOrder.id} must be paused before resume.`);
    }
    return workOrder;
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }
}