import type { GenerationReason } from "./factory-constants";
import { hasDuplicateStrings, isNonEmptyTrimmedString, isPositiveInteger, isValidTimestamp, pushError } from "./factory-validation";
import { listProductionStageValidationErrors, type ProductionStage } from "./production-stage";

export interface ProductionDAG {
  id: string;
  schemaVersion: 1;
  briefId: string;
  version: number;
  stages: readonly ProductionStage[];
  autoParallelize: boolean;
  generatedAt: string;
  generatedBy: string;
  generationReason: GenerationReason;
}

export function getStageByKey(dag: ProductionDAG, key: string): ProductionStage | undefined {
  return dag.stages.find((stage) => stage.key === key);
}

export function listProductionDAGValidationErrors(dag: ProductionDAG): string[] {
  const errors: string[] = [];
  const stageKeys = dag.stages.map((stage) => stage.key);

  pushError(errors, dag.schemaVersion !== 1, "ProductionDAG.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(dag.id), "ProductionDAG.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(dag.briefId), "ProductionDAG.briefId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(dag.generatedBy), "ProductionDAG.generatedBy must be a non-empty string.");
  pushError(errors, !isValidTimestamp(dag.generatedAt), "ProductionDAG.generatedAt must be a valid timestamp.");
  pushError(errors, dag.stages.length === 0, "ProductionDAG.stages must contain at least one stage.");
  pushError(errors, !isPositiveInteger(dag.version), "ProductionDAG.version must be a positive integer.");
  pushError(errors, hasDuplicateStrings(stageKeys), "ProductionDAG stage keys must be unique.");

  for (const stage of dag.stages) {
    errors.push(...listProductionStageValidationErrors(stage));
    for (const dependencyKey of stage.dependencyKeys) {
      if (!stageKeys.includes(dependencyKey)) {
        errors.push(`ProductionDAG stage ${stage.key} depends on missing stage ${dependencyKey}.`);
      }
    }
  }

  if (hasCycle(dag)) {
    errors.push("ProductionDAG cannot contain cyclic dependencies.");
  }

  return errors;
}

export function isValidProductionDAG(dag: ProductionDAG): boolean {
  return listProductionDAGValidationErrors(dag).length === 0;
}

function hasCycle(dag: ProductionDAG): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(stage: ProductionStage): boolean {
    if (visiting.has(stage.key)) {
      return true;
    }

    if (visited.has(stage.key)) {
      return false;
    }

    visiting.add(stage.key);
    for (const dependencyKey of stage.dependencyKeys) {
      const dependency = getStageByKey(dag, dependencyKey);
      if (dependency && dfs(dependency)) {
        return true;
      }
    }
    visiting.delete(stage.key);
    visited.add(stage.key);
    return false;
  }

  return dag.stages.some((stage) => dfs(stage));
}