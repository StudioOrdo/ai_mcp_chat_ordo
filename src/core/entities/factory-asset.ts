import type { FactoryAssetKind, QACriterion } from "./factory-constants";
import { isNonEmptyTrimmedString, isPositiveInteger, isValidTimestamp, pushError } from "./factory-validation";

export interface AssetProvenance {
  stageKey: string;
  previousAssetId?: string;
  sourceAssetIds?: readonly string[];
}

export interface QAFinding {
  id: string;
  criterion: QACriterion;
  severity: "error" | "warning" | "info";
  message: string;
  suggestedFix?: string;
  code?: string;
}

export interface FactoryAsset {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  kind: FactoryAssetKind;
  label?: string;
  uri?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  generationParams: Record<string, unknown>;
  generatedAt: string;
  generationDurationMs?: number;
  provenance: AssetProvenance;
  qaStatus: "pending" | "passed" | "failed";
  qaFindings: readonly QAFinding[];
  revision: number;
}

export function hasBlockingQAFindings(findings: readonly QAFinding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}

export function listFactoryAssetValidationErrors(asset: FactoryAsset): string[] {
  const errors: string[] = [];

  pushError(errors, asset.schemaVersion !== 1, "FactoryAsset.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(asset.id), "FactoryAsset.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(asset.workOrderId), "FactoryAsset.workOrderId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(asset.provenance.stageKey), "FactoryAsset.provenance.stageKey must be a non-empty string.");
  pushError(errors, !isValidTimestamp(asset.generatedAt), "FactoryAsset.generatedAt must be a valid timestamp.");
  pushError(errors, !isPositiveInteger(asset.revision), "FactoryAsset.revision must be a positive integer.");
  pushError(
    errors,
    asset.provenance.previousAssetId === asset.id,
    "FactoryAsset.provenance.previousAssetId cannot equal the current asset id.",
  );
  pushError(
    errors,
    asset.qaStatus === "pending" && asset.qaFindings.length > 0,
    "FactoryAsset.qaFindings must be empty while qaStatus is pending.",
  );
  pushError(
    errors,
    asset.qaStatus === "failed" && !hasBlockingQAFindings(asset.qaFindings),
    "FactoryAsset.qaStatus cannot be failed without an error-severity QA finding.",
  );

  if (asset.fileSizeBytes !== undefined) {
    pushError(errors, !Number.isInteger(asset.fileSizeBytes) || asset.fileSizeBytes < 0, "FactoryAsset.fileSizeBytes must be a non-negative integer when provided.");
  }

  if (asset.generationDurationMs !== undefined) {
    pushError(errors, !Number.isFinite(asset.generationDurationMs) || asset.generationDurationMs < 0, "FactoryAsset.generationDurationMs must be a non-negative number when provided.");
  }

  for (const finding of asset.qaFindings) {
    pushError(errors, !isNonEmptyTrimmedString(finding.id), "QAFinding.id must be a non-empty string.");
    pushError(errors, !isNonEmptyTrimmedString(finding.message), `QAFinding ${finding.id} message must be non-empty.`);
  }

  return errors;
}