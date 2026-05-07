import { describe, expect, it } from "vitest";

import {
  type OperationEvent,
  isDestructiveOperation,
  isOperationActorType,
  isOperationConfirmPolicy,
  isOperationEventType,
  isOperationKind,
  isOperationRiskLevel,
  isOperationStepStatus,
  isOperationStatus,
  isOperationVisibility,
  isTerminalOperationStatus,
  isTerminalOperationStepStatus,
  OperationActionStaleError,
  OperationAuthorizationError,
  OperationKindNotRegisteredError,
  OperationPayloadValidationError,
  OperationTransitionError,
  OPERATION_KINDS,
  OPERATION_STEP_STATUSES,
  OPERATION_STATUSES,
} from "./operation";

describe("operation entity contract", () => {
  it("defines the required initial operation kinds", () => {
    expect(OPERATION_KINDS).toEqual([
      "backup_create",
      "restore_execute",
      "media_workflow",
      "factory_work_order",
      "system_diagnostic",
      "tool_task",
      "content_publish",
      "onboarding_flow",
      "help_flow",
    ]);
    expect(isOperationKind("restore_execute")).toBe(true);
    expect(isOperationKind("unknown_kind")).toBe(false);
  });

  it("defines operation and step status guards", () => {
    expect(OPERATION_STATUSES).toContain("awaiting_confirmation");
    expect(OPERATION_STEP_STATUSES).toContain("blocked");
    expect(isOperationStatus("running")).toBe(true);
    expect(isOperationStatus("ready")).toBe(false);
    expect(isOperationStepStatus("ready")).toBe(true);
    expect(isOperationStepStatus("queued")).toBe(false);
  });

  it("defines storage-facing operation enum guards", () => {
    expect(isOperationRiskLevel("destructive")).toBe(true);
    expect(isOperationRiskLevel("urgent")).toBe(false);
    expect(isOperationVisibility("admin")).toBe(true);
    expect(isOperationVisibility("private")).toBe(false);
    expect(isOperationConfirmPolicy("single_click")).toBe(true);
    expect(isOperationConfirmPolicy("click")).toBe(false);
    expect(isOperationEventType("operation_created")).toBe(true);
    expect(isOperationEventType("created")).toBe(false);
    expect(isOperationActorType("worker")).toBe(true);
    expect(isOperationActorType("assistant")).toBe(false);
  });

  it("marks only default terminal operation statuses as terminal", () => {
    expect(isTerminalOperationStatus("succeeded")).toBe(true);
    expect(isTerminalOperationStatus("cancelled")).toBe(true);
    expect(isTerminalOperationStatus("expired")).toBe(true);
    expect(isTerminalOperationStatus("failed")).toBe(false);
  });

  it("marks terminal step statuses", () => {
    expect(isTerminalOperationStepStatus("succeeded")).toBe(true);
    expect(isTerminalOperationStepStatus("failed")).toBe(true);
    expect(isTerminalOperationStepStatus("skipped")).toBe(true);
    expect(isTerminalOperationStepStatus("cancelled")).toBe(true);
    expect(isTerminalOperationStepStatus("blocked")).toBe(false);
  });

  it("identifies destructive operations by risk level or object", () => {
    expect(isDestructiveOperation("destructive")).toBe(true);
    expect(isDestructiveOperation("high")).toBe(false);
    expect(isDestructiveOperation({ riskLevel: "destructive" })).toBe(true);
  });

  it("uses stable machine-readable domain error codes", () => {
    expect(new OperationTransitionError("bad").code).toBe("OPERATION_TRANSITION_INVALID");
    expect(new OperationActionStaleError("stale").code).toBe("OPERATION_ACTION_STALE");
    expect(new OperationAuthorizationError("denied").code).toBe("OPERATION_AUTHORIZATION_DENIED");
    expect(new OperationPayloadValidationError("invalid").code).toBe("OPERATION_PAYLOAD_INVALID");
    expect(new OperationKindNotRegisteredError("missing").code).toBe("OPERATION_KIND_NOT_REGISTERED");
  });

  it("exposes durable event sequence on operation events", () => {
    const event = {
      id: "evt_1",
      operationId: "op_1",
      stepId: null,
      sequence: 1,
      type: "operation_created",
      actorType: "system",
      actorId: null,
      payload: {},
      createdAt: "2026-05-03T00:00:00.000Z",
    } satisfies OperationEvent;

    expect(event.sequence).toBe(1);
  });
});
