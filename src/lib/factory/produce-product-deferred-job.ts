import { randomUUID } from "node:crypto";

import type { JobRequest } from "@/core/entities/job";
import { listProductBriefValidationErrors, type ProductBrief } from "@/core/entities/product-brief";
import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { DeferredJobHandler, DeferredJobHandlerContext } from "@/lib/jobs/deferred-job-worker";

import type { DAGPlanner } from "./dag-planner";
import type { ProductionOrchestrator } from "./production-orchestrator";

export interface ProduceProductRequestPayload {
  brief: ProductBrief;
  previousWorkOrderIds?: readonly string[];
}

export interface ProduceProductDeferredJobResult {
  workOrderId: string;
  releaseId: string;
  compositionId: string;
  outputIds: string[];
}

export interface ProduceProductDeferredJobDependencies {
  planner: Pick<DAGPlanner, "generateDAG">;
  orchestrator: Pick<ProductionOrchestrator, "execute">;
  repository: FactoryRepository;
  now?: () => string;
  idGenerator?: () => string;
}

export class ProduceProductDeferredJobHandler {
  constructor(private readonly dependencies: ProduceProductDeferredJobDependencies) {}

  createHandler(): DeferredJobHandler {
    return async (job, context) => this.handle(job, context);
  }

  async handle(job: JobRequest, context: DeferredJobHandlerContext): Promise<ProduceProductDeferredJobResult> {
    const payload = this.parsePayload(job.requestPayload);
    const dag = this.dependencies.planner.generateDAG({
      brief: payload.brief,
      generatedBy: "produce_product_deferred_job",
      generationReason: "batch_automation",
      now: this.dependencies.now,
      idGenerator: () => `dag_${this.id()}`,
    });

    const workOrder = await this.dependencies.repository.createWorkOrder(this.createWorkOrder(job, payload.brief, dag, payload.previousWorkOrderIds ?? []));
    await this.dependencies.repository.saveProductionDAG(workOrder.id, dag);

    const finalWorkOrder = await this.dependencies.orchestrator.execute({
      workOrderId: workOrder.id,
      brief: payload.brief,
      abortSignal: context.abortSignal,
    });

    if (finalWorkOrder.status !== "succeeded") {
      const pauseDetails = finalWorkOrder.status === "paused" && finalWorkOrder.pausedState
        ? ` at ${finalWorkOrder.pausedState.resumeFromStageKey}: ${finalWorkOrder.pausedState.reason}`
        : "";
      throw new Error(`Factory orchestration ended in ${finalWorkOrder.status}${pauseDetails}.`);
    }

    const outputs = await this.dependencies.repository.listOutputsForWorkOrder(workOrder.id);
    const release = outputs.filter((output) => output.entityKind === "release").at(-1);
    const composition = outputs.filter((output) => output.entityKind === "composition").at(-1);

    if (!release || !composition) {
      throw new Error("Factory orchestration did not produce composition and release outputs.");
    }

    await context.reportProgress({
      progressPercent: 100,
      progressLabel: "Factory job completed",
      activePhaseKey: null,
      summary: `Released ${payload.brief.title}`,
      payload: { workOrderId: workOrder.id, releaseId: release.entityId },
    });

    return {
      workOrderId: workOrder.id,
      releaseId: release.entityId,
      compositionId: composition.entityId,
      outputIds: outputs.map((output) => output.entityId),
    };
  }

  private parsePayload(payload: Record<string, unknown>): ProduceProductRequestPayload {
    const brief = payload.brief as ProductBrief | undefined;
    if (!brief || typeof brief !== "object") {
      throw new Error("ProduceProduct request payload must include a brief object.");
    }

    const errors = listProductBriefValidationErrors(brief);
    if (errors.length > 0) {
      throw new Error(`ProduceProduct brief is invalid: ${errors.join(" ")}`);
    }

    return {
      brief,
      previousWorkOrderIds: Array.isArray(payload.previousWorkOrderIds)
        ? payload.previousWorkOrderIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [],
    };
  }

  private createWorkOrder(
    job: JobRequest,
    brief: ProductBrief,
    dag: WorkOrder["currentDag"],
    previousWorkOrderIds: readonly string[],
  ): WorkOrder {
    return {
      id: `wo_${this.id()}`,
      schemaVersion: 1,
      briefId: brief.id,
      status: "planned",
      currentDag: dag,
      stageRuns: [],
      executionLog: [
        {
          timestamp: this.now(),
          eventType: "planned",
          details: { toolName: job.toolName },
        },
      ],
      revision: 1,
      previousWorkOrderIds,
      createdAt: this.now(),
      userId: job.userId ?? "anonymous_factory_user",
      conversationId: job.conversationId,
      initiatedBy: "batch_automation",
    };
  }

  private now(): string {
    return this.dependencies.now?.() ?? new Date().toISOString();
  }

  private id(): string {
    return this.dependencies.idGenerator?.() ?? randomUUID();
  }
}
