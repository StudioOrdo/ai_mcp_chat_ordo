import type { FactoryAssetKind, QACriterion } from "./factory-constants";
import {
  hasDuplicateStrings,
  isNonEmptyTrimmedString,
  isPositiveInteger,
  isValidTimestamp,
  pushError,
} from "./factory-validation";

export interface ProductBriefExecutionPreferences {
  autoRetryOnFailure: boolean;
  parallelizeAssets: boolean;
  maxAssetCount?: number;
}

export interface ProductBrief {
  id: string;
  schemaVersion: 1;
  title: string;
  topic: string;
  description?: string;
  audience?: string;
  tone?: string;
  assetKinds: readonly FactoryAssetKind[];
  qaCriteria: readonly QACriterion[];
  targetChannels: readonly string[];
  executionPreferences: ProductBriefExecutionPreferences;
  createdAt: string;
  createdBy: string;
  sourceConversationId?: string;
}

export function listProductBriefValidationErrors(brief: ProductBrief): string[] {
  const errors: string[] = [];

  pushError(errors, brief.schemaVersion !== 1, "ProductBrief.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(brief.id), "ProductBrief.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(brief.title), "ProductBrief.title must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(brief.topic), "ProductBrief.topic must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(brief.createdBy), "ProductBrief.createdBy must be a non-empty string.");
  pushError(errors, !isValidTimestamp(brief.createdAt), "ProductBrief.createdAt must be a valid timestamp.");
  pushError(errors, brief.assetKinds.length === 0, "ProductBrief.assetKinds must include at least one asset kind.");
  pushError(errors, hasDuplicateStrings(brief.assetKinds), "ProductBrief.assetKinds cannot contain duplicates.");
  pushError(errors, hasDuplicateStrings(brief.qaCriteria), "ProductBrief.qaCriteria cannot contain duplicates.");
  pushError(errors, hasDuplicateStrings(brief.targetChannels), "ProductBrief.targetChannels cannot contain duplicates.");

  if (brief.executionPreferences.maxAssetCount !== undefined) {
    pushError(
      errors,
      !isPositiveInteger(brief.executionPreferences.maxAssetCount),
      "ProductBrief.executionPreferences.maxAssetCount must be a positive integer when provided.",
    );
  }

  return errors;
}

export function isValidProductBrief(brief: ProductBrief): boolean {
  return listProductBriefValidationErrors(brief).length === 0;
}