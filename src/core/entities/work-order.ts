import type { CapabilityProgressPhase, CapabilityProgressPhaseStatus } from "./capability-result";
import type { WorkOrderInitiatedBy, WorkOrderStatus } from "./factory-constants";
import { hasDuplicateStrings, isNonEmptyTrimmedString, isPositiveInteger, isValidTimestamp, pushError } from "./factory-validation";
import { getStageByKey, listProductionDAGValidationErrors, type ProductionDAG } from "./production-dag";
import {
  isTerminalStageRunStatus,
  listStageRunRecordValidationErrors,
  type StageRunRecord,
} from "./stage-run-record";

export type { WorkOrderInitiatedBy, WorkOrderStatus } from "./factory-constants";

export interface WorkOrderPauseState {
  pausedAt: string;
  reason: string;
  resumeFromStageKey: string;
}

export interface ExecutionLogEntry {
  timestamp: string;
  stageKey?: string;
  eventType:
    | "planned"
    | "started"
    | "progress"
    | "succeeded"
    | "failed"
    | "skipped"
    | "paused"
    | "resumed"
    | "canceled";
  details?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface WorkOrder {
  id: string;
  schemaVersion: 1;
  briefId: string;
  status: WorkOrderStatus;
  currentDag: ProductionDAG;
  stageRuns: readonly StageRunRecord[];
  executionLog: readonly ExecutionLogEntry[];
  revision: number;
  previousWorkOrderIds: readonly string[];
  pausedState?: WorkOrderPauseState;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  userId: string;
  conversationId?: string;
  initiatedBy: WorkOrderInitiatedBy;
}

export interface WorkOrderProgressSnapshot {
  totalStages: number;
  completedStages: number;
  activeStageKey: string | null;
  percent: number;
  phases: CapabilityProgressPhase[];
}

export function getActiveStageRun(workOrder: WorkOrder): StageRunRecord | undefined {
  return workOrder.stageRuns.find((stageRun) => stageRun.status === "running");
}

export function getTerminalStageRuns(workOrder: WorkOrder): StageRunRecord[] {
  return workOrder.stageRuns.filter((stageRun) => isTerminalStageRunStatus(stageRun.status));
}

export function deriveWorkOrderProgress(workOrder: WorkOrder): WorkOrderProgressSnapshot {
  const completedStages = getTerminalStageRuns(workOrder).filter((stageRun) => stageRun.status === "succeeded").length;
  const activeStageRun = getActiveStageRun(workOrder);
  const totalStages = workOrder.currentDag.stages.length;

  return {
    totalStages,
    completedStages,
    activeStageKey: activeStageRun?.stageKey ?? null,
    percent: totalStages === 0 ? 0 : Math.round((completedStages / totalStages) * 100),
    phases: workOrder.currentDag.stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      status: toCapabilityProgressStatus(
        workOrder.stageRuns.find((stageRun) => stageRun.stageKey === stage.key)?.status,
      ),
    })),
  };
}

export function listWorkOrderValidationErrors(workOrder: WorkOrder): string[] {
  const errors: string[] = [];
  const stageKeys = workOrder.currentDag.stages.map((stage) => stage.key);
  const stageRunKeys = workOrder.stageRuns.map((stageRun) => stageRun.stageKey);

  pushError(errors, workOrder.schemaVersion !== 1, "WorkOrder.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(workOrder.id), "WorkOrder.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(workOrder.briefId), "WorkOrder.briefId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(workOrder.userId), "WorkOrder.userId must be a non-empty string.");
  pushError(errors, !isValidTimestamp(workOrder.createdAt), "WorkOrder.createdAt must be a valid timestamp.");
  pushError(errors, workOrder.briefId !== workOrder.currentDag.briefId, "WorkOrder.briefId must match currentDag.briefId.");
  pushError(errors, !isPositiveInteger(workOrder.revision), "WorkOrder.revision must be a positive integer.");
  pushError(errors, hasDuplicateStrings(workOrder.previousWorkOrderIds), "WorkOrder.previousWorkOrderIds cannot contain duplicates.");
  pushError(errors, hasDuplicateStrings(stageRunKeys), "WorkOrder.stageRuns cannot contain duplicate stage keys in one revision.");
  pushError(errors, workOrder.status === "paused" && workOrder.pausedState === undefined, "WorkOrder.pausedState is required when status is paused.");
  pushError(errors, workOrder.status !== "paused" && workOrder.pausedState !== undefined, "WorkOrder.pausedState is only allowed when status is paused.");
  pushError(
    errors,
    workOrder.completedAt !== undefined && !["succeeded", "failed", "canceled"].includes(workOrder.status),
    "WorkOrder.completedAt is only allowed for terminal statuses.",
  );

  if (workOrder.startedAt !== undefined) {
    pushError(errors, !isValidTimestamp(workOrder.startedAt), "WorkOrder.startedAt must be a valid timestamp when provided.");
  }

  if (workOrder.completedAt !== undefined) {
    pushError(errors, !isValidTimestamp(workOrder.completedAt), "WorkOrder.completedAt must be a valid timestamp when provided.");
  }

  errors.push(...listProductionDAGValidationErrors(workOrder.currentDag));

  for (const stageRun of workOrder.stageRuns) {
    errors.push(...listStageRunRecordValidationErrors(stageRun));
    pushError(
      errors,
      !stageKeys.includes(stageRun.stageKey),
      `WorkOrder.stageRuns contains unknown stage key ${stageRun.stageKey}.`,
    );
  }

  if (workOrder.pausedState) {
    pushError(errors, !isValidTimestamp(workOrder.pausedState.pausedAt), "WorkOrder.pausedState.pausedAt must be a valid timestamp.");
    pushError(errors, !isNonEmptyTrimmedString(workOrder.pausedState.reason), "WorkOrder.pausedState.reason must be a non-empty string.");
    pushError(
      errors,
      getStageByKey(workOrder.currentDag, workOrder.pausedState.resumeFromStageKey) === undefined,
      "WorkOrder.pausedState.resumeFromStageKey must reference an existing stage.",
    );
  }

  return errors;
}

function toCapabilityProgressStatus(status: StageRunRecord["status"] | undefined): CapabilityProgressPhaseStatus {
  switch (status) {
    case "running":
      return "active";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return "pending";
  }
}