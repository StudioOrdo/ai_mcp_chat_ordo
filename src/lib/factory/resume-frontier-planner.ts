import { getStageByKey } from "@/core/entities/production-dag";
import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryOutputRecord } from "@/core/use-cases/FactoryRepository";

export type RevisionFrontierMode = "none" | "regenerate" | "replace_with_upload" | "metadata_fix";

export interface ResumeFrontierPlanInput {
  workOrder: WorkOrder;
  outputs: readonly FactoryOutputRecord[];
  mode: RevisionFrontierMode;
  requestedStageKey?: string;
}

export interface ResumeFrontierPlan {
  stageKey: string;
  rationale: string;
}

export class FactoryResumeFrontierPlanner {
  plan(input: ResumeFrontierPlanInput): ResumeFrontierPlan {
    const checkpointStageKey = input.workOrder.pausedState?.resumeFromStageKey;
    if (!checkpointStageKey) {
      throw new Error(`Work order ${input.workOrder.id} is missing pausedState.resumeFromStageKey.`);
    }

    const latestComposition = this.findLatestActiveOutput(input.outputs, "composition");
    const safeStageKey = input.mode === "none" || !latestComposition
      ? checkpointStageKey
      : "composition";

    if (!getStageByKey(input.workOrder.currentDag, safeStageKey)) {
      throw new Error(`Resume stage ${safeStageKey} is not part of the current DAG.`);
    }

    if (input.requestedStageKey) {
      const requestedIndex = this.getStageIndex(input.workOrder, input.requestedStageKey);
      const safeIndex = this.getStageIndex(input.workOrder, safeStageKey);
      if (requestedIndex > safeIndex) {
        throw new Error(`Requested resume stage ${input.requestedStageKey} is later than the safe frontier ${safeStageKey}.`);
      }
      if (requestedIndex < safeIndex) {
        return {
          stageKey: input.requestedStageKey,
          rationale: `Resume from ${input.requestedStageKey} because the operator selected an earlier frontier than the safe minimum ${safeStageKey}.`,
        };
      }
    }

    return {
      stageKey: safeStageKey,
      rationale: safeStageKey === checkpointStageKey
        ? "Resume from the existing checkpoint frontier."
        : "Resume from composition because a refinement superseded an existing downstream asset.",
    };
  }

  private findLatestActiveOutput(
    outputs: readonly FactoryOutputRecord[],
    entityKind: FactoryOutputRecord["entityKind"],
  ): FactoryOutputRecord | null {
    const records = outputs.filter((output) => output.entityKind === entityKind);
    const supersededIds = new Set(records.flatMap((record) => record.supersedesEntityId ? [record.supersedesEntityId] : []));

    return records.filter((record) => !supersededIds.has(record.entityId)).at(-1) ?? null;
  }

  private getStageIndex(workOrder: WorkOrder, stageKey: string): number {
    const index = workOrder.currentDag.stages.findIndex((stage) => stage.key === stageKey);
    if (index < 0) {
      throw new Error(`Stage ${stageKey} is not part of work order ${workOrder.id}.`);
    }
    return index;
  }
}