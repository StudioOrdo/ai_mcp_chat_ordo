import {
  isTerminalOperationStatus,
  type Operation,
  type OperationStatus,
  type OperationStep,
  type OperationStepStatus,
  OperationTransitionError,
} from "@/core/entities/operation";

export interface OperationTransitionOptions {
  supportsRetry?: boolean;
  now?: string;
}

export interface OperationStepTransitionOptions {
  supportsRetry?: boolean;
  now?: string;
}

export interface OperationStepTransitionResult {
  step: OperationStep;
  steps: OperationStep[];
}

export interface OperationStepMutationResult extends OperationStepTransitionResult {
  operation: Operation;
}

const OPERATION_TRANSITIONS: Record<OperationStatus, readonly OperationStatus[]> = {
  draft: ["awaiting_confirmation", "queued", "blocked", "cancelled"],
  awaiting_confirmation: ["queued", "blocked", "cancelled", "expired"],
  queued: ["running", "blocked", "cancelled", "failed"],
  running: ["blocked", "succeeded", "failed", "cancelled"],
  blocked: ["queued", "running", "cancelled", "failed"],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
};

const STEP_TRANSITIONS: Record<OperationStepStatus, readonly OperationStepStatus[]> = {
  pending: ["ready", "blocked", "skipped", "cancelled"],
  ready: ["running", "blocked", "skipped"],
  running: ["succeeded", "blocked", "failed", "cancelled"],
  blocked: ["pending", "ready", "running", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
};

function nowIso(override?: string): string {
  return override ?? new Date().toISOString();
}

function setCompletedAtForOperation(status: OperationStatus, now: string): string | null {
  return isTerminalOperationStatus(status) || status === "failed" ? now : null;
}

function setStartedAtForStep(step: OperationStep, status: OperationStepStatus, now: string): string | null {
  if (status === "running" && !step.startedAt) return now;
  if (status === "pending" || status === "ready") return null;
  return step.startedAt;
}

function setCompletedAtForStep(status: OperationStepStatus, now: string): string | null {
  if (status === "succeeded" || status === "failed" || status === "skipped" || status === "cancelled") {
    return now;
  }
  return null;
}

export class OperationStateMachine {
  canTransitionOperation(from: OperationStatus, to: OperationStatus, options: OperationTransitionOptions = {}): boolean {
    if (from === "failed" && to === "queued") return options.supportsRetry === true;
    return OPERATION_TRANSITIONS[from].includes(to);
  }

  assertOperationTransition(from: OperationStatus, to: OperationStatus, options: OperationTransitionOptions = {}): void {
    if (!this.canTransitionOperation(from, to, options)) {
      throw new OperationTransitionError(`Invalid operation transition: ${from} -> ${to}`, {
        from,
        to,
        supportsRetry: options.supportsRetry === true,
      });
    }
  }

  transitionOperation(operation: Operation, to: OperationStatus, options: OperationTransitionOptions = {}): Operation {
    this.assertOperationTransition(operation.status, to, options);
    const changedAt = nowIso(options.now);

    return {
      ...operation,
      status: to,
      revision: operation.revision + 1,
      updatedAt: changedAt,
      completedAt: setCompletedAtForOperation(to, changedAt),
    };
  }

  canTransitionStep(from: OperationStepStatus, to: OperationStepStatus, options: OperationStepTransitionOptions = {}): boolean {
    if (from === "failed" && to === "ready") return options.supportsRetry === true;
    return STEP_TRANSITIONS[from].includes(to);
  }

  assertStepTransition(from: OperationStepStatus, to: OperationStepStatus, options: OperationStepTransitionOptions = {}): void {
    if (!this.canTransitionStep(from, to, options)) {
      throw new OperationTransitionError(`Invalid operation step transition: ${from} -> ${to}`, {
        from,
        to,
        supportsRetry: options.supportsRetry === true,
      });
    }
  }

  assertStepDependencies(steps: readonly OperationStep[], step: OperationStep, targetStatus: OperationStepStatus): void {
    if (targetStatus !== "ready" && targetStatus !== "running") return;

    const byId = new Map(steps.map((candidate) => [candidate.id, candidate]));
    for (const dependencyId of step.dependsOnStepIds) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new OperationTransitionError(`Operation step dependency is missing: ${dependencyId}`, {
          stepId: step.id,
          dependencyId,
          targetStatus,
        });
      }

      if (dependency.status === "succeeded" || dependency.status === "skipped") continue;

      throw new OperationTransitionError(`Operation step dependency is not satisfied: ${dependencyId}`, {
        stepId: step.id,
        dependencyId,
        dependencyStatus: dependency.status,
        targetStatus,
      });
    }
  }

  transitionStep(
    steps: readonly OperationStep[],
    stepId: string,
    to: OperationStepStatus,
    options: OperationStepTransitionOptions = {},
  ): OperationStepTransitionResult {
    const step = steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      throw new OperationTransitionError(`Operation step not found: ${stepId}`, { stepId });
    }

    this.assertStepTransition(step.status, to, options);
    this.assertStepDependencies(steps, step, to);

    const changedAt = nowIso(options.now);
    const nextStep: OperationStep = {
      ...step,
      status: to,
      retryCount: step.status === "failed" && to === "ready" ? step.retryCount + 1 : step.retryCount,
      startedAt: setStartedAtForStep(step, to, changedAt),
      completedAt: setCompletedAtForStep(to, changedAt),
    };
    const nextSteps = steps.map((candidate) => candidate.id === stepId ? nextStep : candidate);

    return { step: nextStep, steps: nextSteps };
  }

  transitionOperationStep(
    operation: Operation,
    steps: readonly OperationStep[],
    stepId: string,
    to: OperationStepStatus,
    options: OperationStepTransitionOptions = {},
  ): OperationStepMutationResult {
    const result = this.transitionStep(steps, stepId, to, options);
    const changedAt = nowIso(options.now);

    return {
      ...result,
      operation: {
        ...operation,
        revision: operation.revision + 1,
        currentStepId: result.step.id,
        updatedAt: changedAt,
      },
    };
  }
}

export const operationStateMachine = new OperationStateMachine();
