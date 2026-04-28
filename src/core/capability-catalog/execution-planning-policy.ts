import type { CapabilityDefinition } from "./capability-definition";
import { getDefaultExecutionPlanningForCapability } from "./capability-ownership";
import {
  planCapabilityExecution,
  type CapabilityExecutionPlan,
  type ExecutionPlanningContext,
} from "@/core/platform/execution/ExecutionPlanner";

function shouldReplacePlanningArray(
  defaults: readonly unknown[] | undefined,
  overrides: readonly unknown[] | undefined,
): boolean {
  return defaults !== undefined || overrides !== undefined;
}

export function resolveExecutionPlanningContextForCapability(
  def: Pick<CapabilityDefinition, "core" | "browser">,
  overrides?: ExecutionPlanningContext,
): ExecutionPlanningContext {
  const defaultPlanning = getDefaultExecutionPlanningForCapability(def.core.name) ?? {};
  const planning: ExecutionPlanningContext = {
    ...defaultPlanning,
    ...overrides,
  };

  if (shouldReplacePlanningArray(defaultPlanning.enabledTargetKinds, overrides?.enabledTargetKinds)) {
    planning.enabledTargetKinds = overrides?.enabledTargetKinds ?? defaultPlanning.enabledTargetKinds;
  }

  if (shouldReplacePlanningArray(defaultPlanning.preferredTargetKinds, overrides?.preferredTargetKinds)) {
    planning.preferredTargetKinds = overrides?.preferredTargetKinds ?? defaultPlanning.preferredTargetKinds;
  }

  if (def.browser && planning.browserRuntimeAvailable === undefined) {
    planning.browserRuntimeAvailable = true;
  }

  return planning;
}

export function planCapabilityExecutionWithDefaults(
  def: CapabilityDefinition,
  overrides?: ExecutionPlanningContext,
): CapabilityExecutionPlan {
  return planCapabilityExecution(def, resolveExecutionPlanningContextForCapability(def, overrides));
}