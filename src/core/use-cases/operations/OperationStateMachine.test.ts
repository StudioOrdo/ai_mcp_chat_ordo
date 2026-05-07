import { describe, expect, it } from "vitest";

import type { Operation, OperationStep } from "@/core/entities/operation";
import { OperationTransitionError } from "@/core/entities/operation";

import { OperationStateMachine } from "./OperationStateMachine";

const NOW = "2026-05-03T12:00:00.000Z";

function operation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: "op_1",
    kind: "backup_create",
    revision: 1,
    title: "Create backup",
    status: "draft",
    riskLevel: "medium",
    conversationId: "conv_1",
    originMessageId: "msg_1",
    createdByUserId: "usr_1",
    createdByRole: "ADMIN",
    visibility: "admin",
    currentStepId: null,
    createdAt: "2026-05-03T11:00:00.000Z",
    updatedAt: "2026-05-03T11:00:00.000Z",
    completedAt: null,
    summary: null,
    input: {},
    result: null,
    error: null,
    ...overrides,
  };
}

function step(overrides: Partial<OperationStep> = {}): OperationStep {
  return {
    id: "step_1",
    operationId: "op_1",
    sequence: 1,
    kind: "backup.create",
    status: "pending",
    dependsOnStepIds: [],
    capabilityName: null,
    jobId: null,
    systemCommandId: null,
    resourceRef: null,
    input: {},
    output: null,
    error: null,
    retryCount: 0,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe("OperationStateMachine", () => {
  const stateMachine = new OperationStateMachine();

  it("transitions an operation and increments revision", () => {
    const next = stateMachine.transitionOperation(operation(), "queued", { now: NOW });

    expect(next).toMatchObject({
      status: "queued",
      revision: 2,
      updatedAt: NOW,
      completedAt: null,
    });
  });

  it("sets completedAt when an operation succeeds", () => {
    const next = stateMachine.transitionOperation(operation({ status: "running" }), "succeeded", { now: NOW });

    expect(next.completedAt).toBe(NOW);
  });

  it("rejects invalid operation transitions", () => {
    expect(() => stateMachine.transitionOperation(operation({ status: "running" }), "draft")).toThrow(OperationTransitionError);
    expect(() => stateMachine.transitionOperation(operation({ status: "succeeded" }), "running")).toThrow(OperationTransitionError);
  });

  it("allows failed operation retry only when kind policy permits it", () => {
    expect(() => stateMachine.transitionOperation(operation({ status: "failed" }), "queued")).toThrow(OperationTransitionError);

    const next = stateMachine.transitionOperation(operation({ status: "failed" }), "queued", {
      supportsRetry: true,
      now: NOW,
    });
    expect(next.status).toBe("queued");
    expect(next.revision).toBe(2);
  });

  it("transitions steps and updates timing fields", () => {
    const result = stateMachine.transitionStep([step({ status: "ready" })], "step_1", "running", { now: NOW });

    expect(result.step).toMatchObject({
      status: "running",
      startedAt: NOW,
      completedAt: null,
    });
  });

  it("allows a dependency-satisfied compose step to become ready", () => {
    const dependency = step({ id: "step_chart", sequence: 1, status: "succeeded" });
    const skippedDependency = step({ id: "step_optional", sequence: 2, status: "skipped" });
    const compose = step({
      id: "step_compose",
      sequence: 3,
      status: "pending",
      dependsOnStepIds: ["step_chart", "step_optional"],
    });

    const result = stateMachine.transitionStep([dependency, skippedDependency, compose], "step_compose", "ready", { now: NOW });

    expect(result.step.status).toBe("ready");
  });

  it("returns an operation revision increment for operation-scoped step mutations", () => {
    const result = stateMachine.transitionOperationStep(
      operation({ revision: 8, currentStepId: "step_0" }),
      [step({ status: "ready" })],
      "step_1",
      "running",
      { now: NOW },
    );

    expect(result.operation).toMatchObject({
      revision: 9,
      currentStepId: "step_1",
      updatedAt: NOW,
    });
    expect(result.step.status).toBe("running");
  });

  it("rejects ready/running transitions while dependencies are incomplete", () => {
    const dependency = step({ id: "step_audio", status: "running" });
    const compose = step({ id: "step_compose", dependsOnStepIds: ["step_audio"] });

    expect(() => stateMachine.transitionStep([dependency, compose], "step_compose", "ready")).toThrow(OperationTransitionError);
  });

  it("rejects missing dependency ids as invalid operation shape", () => {
    const compose = step({ id: "step_compose", dependsOnStepIds: ["missing_step"] });

    expect(() => stateMachine.transitionStep([compose], "step_compose", "ready")).toThrow(/missing/);
  });

  it("allows failed step retry only when retry is enabled", () => {
    const failed = step({ status: "failed", retryCount: 1, completedAt: NOW });

    expect(() => stateMachine.transitionStep([failed], "step_1", "ready")).toThrow(OperationTransitionError);

    const result = stateMachine.transitionStep([failed], "step_1", "ready", { supportsRetry: true });
    expect(result.step.status).toBe("ready");
    expect(result.step.retryCount).toBe(2);
    expect(result.step.startedAt).toBeNull();
    expect(result.step.completedAt).toBeNull();
  });
});
