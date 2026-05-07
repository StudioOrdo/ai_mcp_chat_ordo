import {
  CAPABILITY_CATALOG,
  getCatalogDefinition,
  projectBrowserCapability,
  projectJobCapability,
  projectMcpExportIntent,
  projectPresentationDescriptor,
  projectPromptExposure,
} from "@/core/capability-catalog/catalog";
import type {
  CapabilityDefinition,
  CapabilityExecutionSurface,
} from "@/core/capability-catalog/capability-definition";
import { planCapabilityExecutionWithDefaults } from "@/core/capability-catalog/execution-planning-policy";
import { projectAnthropicSchema } from "@/core/capability-catalog/schema-projection";
import type { CapabilityExecutionPlan, ExecutionPlanningContext } from "@/core/platform/execution/ExecutionPlanner";
import {
  explainCapabilityExecutionPlan,
  type CapabilityExecutionExplanation,
} from "./CapabilityExecutionExplanation";

const CAPABILITY_NAMES = Object.freeze(
  Object.keys(CAPABILITY_CATALOG) as Array<keyof typeof CAPABILITY_CATALOG>,
);

export const CAPABILITY_RUNTIME_NAMES = CAPABILITY_NAMES;

export type CapabilityRuntimeName = (typeof CAPABILITY_NAMES)[number];

export interface CapabilityRuntimeDescriptor {
  name: string;
  label: string;
  description: string;
  category: CapabilityDefinition["core"]["category"];
  roles: CapabilityDefinition["core"]["roles"];
  schema: ReturnType<typeof projectAnthropicSchema>;
  executionMode: CapabilityDefinition["runtime"]["executionMode"];
  deferred: CapabilityDefinition["runtime"]["deferred"];
}

export interface CapabilityRuntimeBindingSummary {
  bundleId: string;
  executorId: string;
  executionSurface: CapabilityExecutionSurface;
  validatorId: string | null;
  validationMode: "parse" | "sanitize";
}

export interface CapabilityRuntime {
  capabilityName: CapabilityRuntimeName;
  descriptor: CapabilityRuntimeDescriptor;
  schema: CapabilityDefinition["schema"];
  presentation: ReturnType<typeof projectPresentationDescriptor>;
  executionPlan: CapabilityExecutionPlan;
  executionExplanation: CapabilityExecutionExplanation;
  job: ReturnType<typeof projectJobCapability>;
  browser: ReturnType<typeof projectBrowserCapability>;
  mcpExport: ReturnType<typeof projectMcpExportIntent>;
  binding: CapabilityRuntimeBindingSummary | null;
  localExecutionTargets: CapabilityDefinition["localExecutionTargets"] | null;
  promptHintsByRole: NonNullable<CapabilityDefinition["promptHint"]>["roleDirectiveLines"] | null;
  promptExposure: NonNullable<CapabilityDefinition["promptExposure"]>;
}

export type CapabilityRuntimeStatic = Omit<CapabilityRuntime, "executionPlan" | "executionExplanation">;

export function projectCapabilityRuntimeDescriptorDefinition(
  def: CapabilityDefinition,
): CapabilityRuntimeDescriptor {
  return {
    name: def.core.name,
    label: def.core.label,
    description: def.core.description,
    category: def.core.category,
    roles: def.core.roles,
    schema: projectAnthropicSchema(def),
    executionMode: def.runtime.executionMode,
    deferred: def.runtime.deferred,
  };
}

function buildCapabilityRuntimeBindingSummary(
  def: CapabilityDefinition,
): CapabilityRuntimeBindingSummary | null {
  if (!def.executorBinding) {
    return null;
  }

  return {
    bundleId: def.executorBinding.bundleId,
    executorId: def.executorBinding.executorId,
    executionSurface: def.executorBinding.executionSurface,
    validatorId: def.validationBinding?.validatorId ?? null,
    validationMode: def.validationBinding?.mode ?? "parse",
  };
}

export function projectCapabilityRuntimeDefinition(
  def: CapabilityDefinition,
): CapabilityRuntimeStatic {
  return {
    capabilityName: def.core.name as CapabilityRuntimeName,
    descriptor: projectCapabilityRuntimeDescriptorDefinition(def),
    schema: def.schema,
    presentation: projectPresentationDescriptor(def),
    job: projectJobCapability(def),
    browser: projectBrowserCapability(def),
    mcpExport: projectMcpExportIntent(def),
    binding: buildCapabilityRuntimeBindingSummary(def),
    localExecutionTargets: def.localExecutionTargets ?? null,
    promptHintsByRole: def.promptHint?.roleDirectiveLines ?? null,
    promptExposure: projectPromptExposure(def),
  };
}

export function projectCapabilityRuntimeWithPlanningDefinition(
  def: CapabilityDefinition,
  planning?: ExecutionPlanningContext,
): CapabilityRuntime {
  const executionPlan = planCapabilityExecutionWithDefaults(def, planning);

  return {
    ...projectCapabilityRuntimeDefinition(def),
    executionPlan,
    executionExplanation: explainCapabilityExecutionPlan(executionPlan),
  };
}

export function projectCapabilityRuntime(
  capabilityName: CapabilityRuntimeName,
  planning?: ExecutionPlanningContext,
): CapabilityRuntime {
  return projectCapabilityRuntimeWithPlanningDefinition(getCatalogDefinition(capabilityName)!, planning);
}

export function projectCapabilityRuntimeByName(
  capabilityName: string,
  planning?: ExecutionPlanningContext,
): CapabilityRuntime | null {
  const definition = getCatalogDefinition(capabilityName);
  if (!definition) {
    return null;
  }

  return projectCapabilityRuntimeWithPlanningDefinition(definition, planning);
}

export function projectCapabilityRuntimeStaticByName(capabilityName: string): CapabilityRuntimeStatic | null {
  const definition = getCatalogDefinition(capabilityName);
  if (!definition) {
    return null;
  }

  return projectCapabilityRuntimeDefinition(definition);
}

export function projectAllCapabilityRuntimeStatics(): CapabilityRuntimeStatic[] {
  return CAPABILITY_NAMES.map((capabilityName) => projectCapabilityRuntimeDefinition(
    getCatalogDefinition(capabilityName)!,
  ));
}

export function projectAllCapabilityRuntimes(
  planningByCapabilityName: Partial<Record<CapabilityRuntimeName, ExecutionPlanningContext>> = {},
): CapabilityRuntime[] {
  return CAPABILITY_NAMES.map((capabilityName) => projectCapabilityRuntime(
    capabilityName,
    planningByCapabilityName[capabilityName],
  ));
}

export function projectCapabilityRuntimeNamesForBundle(bundleId: string): CapabilityRuntimeName[] {
  return projectAllCapabilityRuntimeStatics()
    .filter((runtime) => runtime.binding?.bundleId === bundleId)
    .map((runtime) => runtime.capabilityName);
}
