import type { FactoryAssetKind, StageKind } from "./factory-constants";
import { hasDuplicateStrings, isNonEmptyTrimmedString, pushError } from "./factory-validation";

export interface ResearchStageConfig {
  kind: "research";
  queryHint?: string;
}

export interface DraftStageConfig {
  kind: "draft";
  outlineHint?: string;
}

export interface AssetGenerationStageConfig {
  kind: "asset_generation";
  assetKind: FactoryAssetKind;
  assetSlot: string;
}

export interface CompositionStageConfig {
  kind: "composition";
  template?: string;
}

export interface QAStageConfig {
  kind: "qa";
  scope: "asset" | "page";
}

export interface QAResolutionStageConfig {
  kind: "qa_resolution";
  strategy: "auto" | "manual";
}

export interface ReleaseStageConfig {
  kind: "release";
  channels: readonly string[];
}

export interface OutcomeStageConfig {
  kind: "outcome";
  observationWindowDays?: number;
}

export type ProductionStageConfig =
  | ResearchStageConfig
  | DraftStageConfig
  | AssetGenerationStageConfig
  | CompositionStageConfig
  | QAStageConfig
  | QAResolutionStageConfig
  | ReleaseStageConfig
  | OutcomeStageConfig;

export interface ProductionStage {
  key: string;
  kind: StageKind;
  label: string;
  description?: string;
  dependencyKeys: readonly string[];
  parallelizable: boolean;
  timeoutMs?: number;
  config?: ProductionStageConfig;
}

export function listProductionStageValidationErrors(stage: ProductionStage): string[] {
  const errors: string[] = [];

  pushError(errors, !isNonEmptyTrimmedString(stage.key), "ProductionStage.key must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(stage.label), "ProductionStage.label must be a non-empty string.");
  pushError(
    errors,
    hasDuplicateStrings(stage.dependencyKeys),
    `ProductionStage ${stage.key} cannot contain duplicate dependency keys.`,
  );
  pushError(
    errors,
    stage.dependencyKeys.includes(stage.key),
    `ProductionStage ${stage.key} cannot depend on itself.`,
  );
  pushError(
    errors,
    stage.timeoutMs !== undefined && (!Number.isFinite(stage.timeoutMs) || stage.timeoutMs <= 0),
    `ProductionStage ${stage.key} timeoutMs must be a positive number when provided.`,
  );
  pushError(
    errors,
    stage.config !== undefined && stage.config.kind !== stage.kind,
    `ProductionStage ${stage.key} config.kind must match stage.kind.`,
  );

  if (stage.config?.kind === "asset_generation") {
    pushError(
      errors,
      !isNonEmptyTrimmedString(stage.config.assetSlot),
      `ProductionStage ${stage.key} asset_generation config requires a non-empty assetSlot.`,
    );
  }

  if (stage.config?.kind === "release") {
    pushError(
      errors,
      hasDuplicateStrings(stage.config.channels),
      `ProductionStage ${stage.key} release channels cannot contain duplicates.`,
    );
  }

  if (stage.config?.kind === "outcome" && stage.config.observationWindowDays !== undefined) {
    pushError(
      errors,
      !Number.isInteger(stage.config.observationWindowDays) || stage.config.observationWindowDays <= 0,
      `ProductionStage ${stage.key} outcome observationWindowDays must be a positive integer when provided.`,
    );
  }

  return errors;
}

export function isValidProductionStage(stage: ProductionStage): boolean {
  return listProductionStageValidationErrors(stage).length === 0;
}