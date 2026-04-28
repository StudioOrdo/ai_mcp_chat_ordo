import { isNonNegativeNumber, isNonEmptyTrimmedString, isValidTimestamp, pushError } from "./factory-validation";

export interface OutcomeMetrics {
  viewCount?: number;
  engagementByChannel?: Record<string, number>;
  conversionCount?: number;
}

export interface Outcome {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  releaseId: string;
  observedAt: string;
  metrics: OutcomeMetrics;
  notes?: string;
}

export function listOutcomeValidationErrors(outcome: Outcome): string[] {
  const errors: string[] = [];

  pushError(errors, outcome.schemaVersion !== 1, "Outcome.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(outcome.id), "Outcome.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(outcome.workOrderId), "Outcome.workOrderId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(outcome.releaseId), "Outcome.releaseId must be a non-empty string.");
  pushError(errors, !isValidTimestamp(outcome.observedAt), "Outcome.observedAt must be a valid timestamp.");

  if (outcome.metrics.viewCount !== undefined) {
    pushError(errors, !isNonNegativeNumber(outcome.metrics.viewCount), "Outcome.metrics.viewCount must be non-negative when provided.");
  }

  if (outcome.metrics.conversionCount !== undefined) {
    pushError(errors, !isNonNegativeNumber(outcome.metrics.conversionCount), "Outcome.metrics.conversionCount must be non-negative when provided.");
  }

  for (const [channel, value] of Object.entries(outcome.metrics.engagementByChannel ?? {})) {
    pushError(errors, !isNonEmptyTrimmedString(channel), "Outcome.metrics.engagementByChannel keys must be non-empty strings.");
    pushError(errors, !isNonNegativeNumber(value), `Outcome.metrics.engagementByChannel.${channel} must be non-negative.`);
  }

  return errors;
}