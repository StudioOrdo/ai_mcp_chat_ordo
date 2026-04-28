import type { CapabilityDefinition } from "@/core/capability-catalog/capability-definition";
import type {
  CapabilityExecutionTarget,
  ExecutionPlanningContext,
  ExecutionTargetKind,
} from "@/core/platform/execution/ExecutionPlanner";

export const DEFAULT_ENABLED_TARGET_KINDS = Object.freeze<readonly ExecutionTargetKind[]>([
  "host_ts",
  "deferred_job",
]);

export const DEFAULT_TARGET_PRIORITY: Readonly<Record<CapabilityDefinition["presentation"]["executionMode"], readonly ExecutionTargetKind[]>> = {
  inline: [
    "host_ts",
    "mcp_stdio",
    "deferred_job",
    "browser_wasm",
    "mcp_container",
    "native_process",
    "remote_service",
  ],
  deferred: [
    "deferred_job",
    "host_ts",
    "mcp_stdio",
    "browser_wasm",
    "mcp_container",
    "native_process",
    "remote_service",
  ],
  browser: [
    "browser_wasm",
    "host_ts",
    "mcp_stdio",
    "deferred_job",
    "mcp_container",
    "native_process",
    "remote_service",
  ],
  hybrid: [
    "browser_wasm",
    "deferred_job",
    "host_ts",
    "mcp_stdio",
    "mcp_container",
    "native_process",
    "remote_service",
  ],
};

export function isTargetKindEnabled(kind: ExecutionTargetKind, context: ExecutionPlanningContext): boolean {
  switch (kind) {
    case "host_ts":
      return !context.enabledTargetKinds || context.enabledTargetKinds.includes("host_ts");
    case "deferred_job":
      return context.allowDeferredJob !== false
        && (!context.enabledTargetKinds || context.enabledTargetKinds.includes("deferred_job"));
    case "browser_wasm":
      return context.browserRuntimeAvailable === true;
    case "mcp_stdio":
    case "mcp_container":
    case "native_process":
    case "remote_service":
      return context.enabledTargetKinds?.includes(kind) ?? false;
    default:
      return false;
  }
}

export function sortTargets(
  targets: CapabilityExecutionTarget[],
  preferredTargetKinds: readonly ExecutionTargetKind[],
): CapabilityExecutionTarget[] {
  const priority = new Map(preferredTargetKinds.map((kind, index) => [kind, index]));

  return [...targets].sort((left, right) => {
    const leftPriority = priority.get(left.kind) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = priority.get(right.kind) ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    if (left.readiness !== right.readiness) {
      return left.readiness === "active" ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

export function getDefaultTargetPriority(
  def: CapabilityDefinition,
): readonly ExecutionTargetKind[] {
  return DEFAULT_TARGET_PRIORITY[def.presentation.executionMode];
}
