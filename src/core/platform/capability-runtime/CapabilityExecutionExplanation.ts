import type {
  CapabilityExecutionPlan,
  CapabilityExecutionTarget,
  ExecutionPlanBlockReason,
} from "@/core/platform/execution/ExecutionPlanner";

export interface CapabilityExecutionTargetExplanation {
  kind: CapabilityExecutionTarget["kind"];
  label: string;
  readiness: CapabilityExecutionTarget["readiness"];
  sourceFacet: CapabilityExecutionTarget["sourceFacet"];
  isPrimary: boolean;
  isFallback: boolean;
}

export interface CapabilityExecutionExplanation {
  capabilityName: string;
  requestedExecutionMode: CapabilityExecutionPlan["requestedExecutionMode"];
  status: "ready" | "blocked";
  blockReason: ExecutionPlanBlockReason | null;
  summary: string;
  primaryTargetKind: CapabilityExecutionTarget["kind"] | null;
  fallbackTargetKinds: CapabilityExecutionTarget["kind"][];
  targets: CapabilityExecutionTargetExplanation[];
}

function getBlockedSummary(blockReason: ExecutionPlanBlockReason | null): string {
  switch (blockReason) {
    case "no_declared_targets":
      return "No declared execution targets are available.";
    case "no_active_targets":
      return "Declared execution targets exist, but none are currently active.";
    default:
      return "Execution is blocked.";
  }
}

export function explainCapabilityExecutionPlan(
  plan: CapabilityExecutionPlan,
): CapabilityExecutionExplanation {
  const targets = plan.candidates.map((target) => ({
    kind: target.kind,
    label: target.label,
    readiness: target.readiness,
    sourceFacet: target.sourceFacet,
    isPrimary: plan.primaryTarget?.kind === target.kind && plan.primaryTarget.label === target.label,
    isFallback: plan.fallbackTargets.some(
      (fallback) => fallback.kind === target.kind && fallback.label === target.label,
    ),
  }));

  if (plan.primaryTarget) {
    const fallbackCount = plan.fallbackTargets.length;
    const fallbackSummary = fallbackCount === 0
      ? "No fallback targets."
      : `${fallbackCount} fallback target${fallbackCount === 1 ? "" : "s"} available.`;

    return {
      capabilityName: plan.capabilityName,
      requestedExecutionMode: plan.requestedExecutionMode,
      status: "ready",
      blockReason: null,
      summary: `Primary target ${plan.primaryTarget.kind} selected. ${fallbackSummary}`,
      primaryTargetKind: plan.primaryTarget.kind,
      fallbackTargetKinds: plan.fallbackTargets.map((target) => target.kind),
      targets,
    };
  }

  return {
    capabilityName: plan.capabilityName,
    requestedExecutionMode: plan.requestedExecutionMode,
    status: "blocked",
    blockReason: plan.blockReason,
    summary: getBlockedSummary(plan.blockReason),
    primaryTargetKind: null,
    fallbackTargetKinds: [],
    targets,
  };
}