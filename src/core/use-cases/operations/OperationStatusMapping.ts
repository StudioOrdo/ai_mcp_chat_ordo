import type { JobStatus } from "@/core/entities/job";
import type { WorkOrderStatus } from "@/core/entities/factory-constants";
import type { StageRunStatus } from "@/core/entities/stage-run-record";
import type {
  BackupCommandStatus,
  RestoreStatus,
} from "@/lib/appliance/backup/types";
import type {
  MediaWorkflowStatus,
  MediaWorkflowStepStatus,
} from "@/lib/media/workflows/types";
import type {
  OperationStatus,
  OperationStepStatus,
} from "@/core/entities/operation";

export interface RestoreStatusMappingOptions {
  safetyBackupSatisfied?: boolean;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled status mapping value: ${String(value)}`);
}

export function mapJobStatusToOperationStatus(status: JobStatus): OperationStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "dead_letter":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return assertNever(status);
  }
}

export function mapMediaWorkflowStatusToOperationStatus(status: MediaWorkflowStatus): OperationStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "cancelled";
    default:
      return assertNever(status);
  }
}

export function mapWorkOrderStatusToOperationStatus(status: WorkOrderStatus): OperationStatus {
  switch (status) {
    case "planned":
      return "draft";
    case "running":
      return "running";
    case "paused":
      return "blocked";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return assertNever(status);
  }
}

export function mapRestoreStatusToOperationStatus(
  status: RestoreStatus,
  options: RestoreStatusMappingOptions = {},
): OperationStatus {
  switch (status) {
    case "draft":
    case "validated":
      return "draft";
    case "confirmation_required":
      return "awaiting_confirmation";
    case "confirmed":
      return options.safetyBackupSatisfied === true ? "queued" : "blocked";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return assertNever(status);
  }
}

export function mapBackupCommandStatusToOperationStatus(status: BackupCommandStatus): OperationStatus {
  switch (status) {
    case "pending":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
    case "superseded":
      return "cancelled";
    default:
      return assertNever(status);
  }
}

export function mapMediaWorkflowStepStatusToOperationStepStatus(status: MediaWorkflowStepStatus): OperationStepStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "queued":
      return "ready";
    case "running":
      return "running";
    case "ready":
      return "succeeded";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return assertNever(status);
  }
}

export function mapStageRunStatusToOperationStepStatus(status: StageRunStatus): OperationStepStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "paused":
      return "blocked";
    case "canceled":
      return "cancelled";
    default:
      return assertNever(status);
  }
}
