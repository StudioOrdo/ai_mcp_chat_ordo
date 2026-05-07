import { describe, expect, it } from "vitest";

import {
  mapBackupCommandStatusToOperationStatus,
  mapJobStatusToOperationStatus,
  mapMediaWorkflowStatusToOperationStatus,
  mapMediaWorkflowStepStatusToOperationStepStatus,
  mapRestoreStatusToOperationStatus,
  mapStageRunStatusToOperationStepStatus,
  mapWorkOrderStatusToOperationStatus,
} from "./OperationStatusMapping";

describe("OperationStatusMapping", () => {
  it("maps job statuses to canonical operation statuses", () => {
    expect(mapJobStatusToOperationStatus("queued")).toBe("queued");
    expect(mapJobStatusToOperationStatus("running")).toBe("running");
    expect(mapJobStatusToOperationStatus("succeeded")).toBe("succeeded");
    expect(mapJobStatusToOperationStatus("failed")).toBe("failed");
    expect(mapJobStatusToOperationStatus("dead_letter")).toBe("failed");
    expect(mapJobStatusToOperationStatus("canceled")).toBe("cancelled");
  });

  it("maps media workflow statuses to canonical operation statuses", () => {
    expect(mapMediaWorkflowStatusToOperationStatus("queued")).toBe("queued");
    expect(mapMediaWorkflowStatusToOperationStatus("running")).toBe("running");
    expect(mapMediaWorkflowStatusToOperationStatus("blocked")).toBe("blocked");
    expect(mapMediaWorkflowStatusToOperationStatus("failed")).toBe("failed");
    expect(mapMediaWorkflowStatusToOperationStatus("succeeded")).toBe("succeeded");
    expect(mapMediaWorkflowStatusToOperationStatus("canceled")).toBe("cancelled");
  });

  it("maps factory work order statuses to canonical operation statuses", () => {
    expect(mapWorkOrderStatusToOperationStatus("planned")).toBe("draft");
    expect(mapWorkOrderStatusToOperationStatus("running")).toBe("running");
    expect(mapWorkOrderStatusToOperationStatus("paused")).toBe("blocked");
    expect(mapWorkOrderStatusToOperationStatus("succeeded")).toBe("succeeded");
    expect(mapWorkOrderStatusToOperationStatus("failed")).toBe("failed");
    expect(mapWorkOrderStatusToOperationStatus("canceled")).toBe("cancelled");
  });

  it("maps restore statuses with safety-backup context", () => {
    expect(mapRestoreStatusToOperationStatus("draft")).toBe("draft");
    expect(mapRestoreStatusToOperationStatus("validated")).toBe("draft");
    expect(mapRestoreStatusToOperationStatus("confirmation_required")).toBe("awaiting_confirmation");
    expect(mapRestoreStatusToOperationStatus("confirmed")).toBe("blocked");
    expect(mapRestoreStatusToOperationStatus("confirmed", { safetyBackupSatisfied: true })).toBe("queued");
    expect(mapRestoreStatusToOperationStatus("running")).toBe("running");
    expect(mapRestoreStatusToOperationStatus("succeeded")).toBe("succeeded");
    expect(mapRestoreStatusToOperationStatus("failed")).toBe("failed");
    expect(mapRestoreStatusToOperationStatus("cancelled")).toBe("cancelled");
  });

  it("maps backup command statuses to canonical operation statuses", () => {
    expect(mapBackupCommandStatusToOperationStatus("pending")).toBe("queued");
    expect(mapBackupCommandStatusToOperationStatus("running")).toBe("running");
    expect(mapBackupCommandStatusToOperationStatus("succeeded")).toBe("succeeded");
    expect(mapBackupCommandStatusToOperationStatus("failed")).toBe("failed");
    expect(mapBackupCommandStatusToOperationStatus("cancelled")).toBe("cancelled");
    expect(mapBackupCommandStatusToOperationStatus("superseded")).toBe("cancelled");
  });

  it("maps media step ready as canonical succeeded because local ready means artifact-ready", () => {
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("pending")).toBe("pending");
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("queued")).toBe("ready");
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("running")).toBe("running");
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("ready")).toBe("succeeded");
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("blocked")).toBe("blocked");
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("failed")).toBe("failed");
    expect(mapMediaWorkflowStepStatusToOperationStepStatus("skipped")).toBe("skipped");
  });

  it("maps factory stage statuses to canonical operation step statuses", () => {
    expect(mapStageRunStatusToOperationStepStatus("pending")).toBe("pending");
    expect(mapStageRunStatusToOperationStepStatus("running")).toBe("running");
    expect(mapStageRunStatusToOperationStepStatus("succeeded")).toBe("succeeded");
    expect(mapStageRunStatusToOperationStepStatus("failed")).toBe("failed");
    expect(mapStageRunStatusToOperationStepStatus("skipped")).toBe("skipped");
    expect(mapStageRunStatusToOperationStepStatus("paused")).toBe("blocked");
    expect(mapStageRunStatusToOperationStepStatus("canceled")).toBe("cancelled");
  });
});
