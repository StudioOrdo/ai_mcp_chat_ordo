import { isNonEmptyTrimmedString, isValidTimestamp, pushError } from "./factory-validation";

export const STAGE_RUN_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
  "paused",
  "canceled",
] as const;

export type StageRunStatus = (typeof STAGE_RUN_STATUSES)[number];

export const STAGE_RESULT_ENTITY_KINDS = [
  "research_packet",
  "draft",
  "asset",
  "composition",
  "qa_report",
  "release",
  "outcome",
] as const;

export type StageResultEntityKind = (typeof STAGE_RESULT_ENTITY_KINDS)[number];

export interface StageResultRef {
  entityKind: StageResultEntityKind;
  entityId: string;
}

export interface StageRunRecord {
  id: string;
  stageKey: string;
  status: StageRunStatus;
  startedAt?: string;
  completedAt?: string;
  resultRef?: StageResultRef;
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
}

export function isTerminalStageRunStatus(status: StageRunStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "skipped" || status === "canceled";
}

export function listStageRunRecordValidationErrors(record: StageRunRecord): string[] {
  const errors: string[] = [];

  pushError(errors, !isNonEmptyTrimmedString(record.id), "StageRunRecord.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(record.stageKey), "StageRunRecord.stageKey must be a non-empty string.");
  pushError(errors, !Number.isInteger(record.attemptCount) || record.attemptCount < 0, "StageRunRecord.attemptCount must be a non-negative integer.");

  if (record.status === "pending") {
    pushError(errors, record.startedAt !== undefined, "Pending StageRunRecord cannot have startedAt.");
    pushError(errors, record.completedAt !== undefined, "Pending StageRunRecord cannot have completedAt.");
    pushError(errors, record.attemptCount !== 0, "Pending StageRunRecord attemptCount must be 0.");
  }

  if (record.status === "running") {
    pushError(errors, record.startedAt === undefined, "Running StageRunRecord must have startedAt.");
    pushError(errors, record.completedAt !== undefined, "Running StageRunRecord cannot have completedAt.");
    pushError(errors, record.attemptCount < 1, "Running StageRunRecord attemptCount must be at least 1.");
  }

  if (record.status === "succeeded") {
    pushError(errors, record.startedAt === undefined, "Succeeded StageRunRecord must have startedAt.");
    pushError(errors, record.completedAt === undefined, "Succeeded StageRunRecord must have completedAt.");
    pushError(errors, record.resultRef === undefined, "Succeeded StageRunRecord must have resultRef.");
  }

  if (record.status === "failed") {
    pushError(errors, record.attemptCount < 1, "Failed StageRunRecord attemptCount must be at least 1.");
  }

  if (record.resultRef) {
    pushError(errors, !isNonEmptyTrimmedString(record.resultRef.entityId), "StageRunRecord.resultRef.entityId must be a non-empty string.");
  }

  if (record.startedAt !== undefined) {
    pushError(errors, !isValidTimestamp(record.startedAt), "StageRunRecord.startedAt must be a valid timestamp when provided.");
  }

  if (record.completedAt !== undefined) {
    pushError(errors, !isValidTimestamp(record.completedAt), "StageRunRecord.completedAt must be a valid timestamp when provided.");
  }

  if (record.startedAt && record.completedAt) {
    const startedAt = Date.parse(record.startedAt);
    const completedAt = Date.parse(record.completedAt);
    pushError(
      errors,
      !Number.isNaN(startedAt) && !Number.isNaN(completedAt) && completedAt < startedAt,
      "StageRunRecord.completedAt cannot be earlier than startedAt.",
    );
  }

  return errors;
}