import { projectAllCapabilityRuntimes } from "@/core/platform/capability-runtime/CapabilityRuntime";
import type { CapabilityLocalNativeProcessTargetFacet } from "@/core/capability-catalog/capability-definition";

import type {
  DeclaredNativeProcessTarget,
  ExecutionTargetKind,
} from "./execution-targets";

export interface LocalNativeProcessTargetConfig extends DeclaredNativeProcessTarget {
  capabilityName: string;
  entrypoint: string;
  runtimeKind: Extract<ExecutionTargetKind, "native_process">;
}

function projectLocalNativeProcessTarget(
  capabilityName: string,
  target: CapabilityLocalNativeProcessTargetFacet,
): LocalNativeProcessTargetConfig {
  return {
    capabilityName,
    runtimeKind: "native_process",
    processId: target.processId,
    command: target.command,
    args: [...target.args],
    cwd: target.cwd,
    env: target.env,
    timeoutMs: target.timeoutMs,
    entrypoint: target.entrypoint ?? target.args[0] ?? target.command,
    label: target.label,
  };
}

const LOCAL_NATIVE_PROCESS_TARGETS = Object.freeze(
  Object.fromEntries(
    projectAllCapabilityRuntimes().flatMap((runtime) => {
      const target = runtime.localExecutionTargets?.nativeProcess;
      return target
        ? [[runtime.capabilityName, projectLocalNativeProcessTarget(runtime.capabilityName, target)] as const]
        : [];
    }),
  ) as Readonly<Record<string, LocalNativeProcessTargetConfig>>,
);

export function getLocalNativeProcessTarget(capabilityName: string): LocalNativeProcessTargetConfig | null {
  return LOCAL_NATIVE_PROCESS_TARGETS[capabilityName] ?? null;
}

export function getCanonicalLocalExternalTargetInventory(): LocalNativeProcessTargetConfig[] {
  return Object.values(LOCAL_NATIVE_PROCESS_TARGETS).sort((left, right) => {
    return left.capabilityName.localeCompare(right.capabilityName);
  });
}