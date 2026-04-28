import type {
  CapabilityDefinition,
  CapabilityExecutionSurface,
} from "@/core/capability-catalog/capability-definition";
import type { BrowserCapabilityDescriptor } from "@/core/entities/browser-capability";
import type { RoleName } from "@/core/entities/user";
import type { CapabilityRuntimeStatic } from "@/core/platform/capability-runtime/CapabilityRuntime";
import { projectCapabilityRuntimeDefinition } from "@/core/platform/capability-runtime/CapabilityRuntime";
import type { JobCapabilityDefinition } from "@/lib/jobs/job-capability-registry";
import {
  DEFAULT_ENABLED_TARGET_KINDS,
  getDefaultTargetPriority,
  isTargetKindEnabled,
  sortTargets,
} from "@/core/platform/execution/ExecutionTargetStrategy";

export type ExecutionTargetKind =
  | "host_ts"
  | "deferred_job"
  | "browser_wasm"
  | "mcp_stdio"
  | "mcp_container"
  | "native_process"
  | "remote_service";

export type ExecutionTargetSourceFacet =
  | "executor_binding"
  | "job"
  | "browser"
  | "mcp_export"
  | "target_override";

export type ExecutionTargetReadiness = "active" | "declared";

export type ExecutionPlanBlockReason = "no_declared_targets" | "no_active_targets";

export interface DeclaredMcpContainerTarget {
  serviceName: string;
  label?: string;
  sharedModule?: string;
}

export interface DeclaredNativeProcessTarget {
  processId: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  label?: string;
}

export interface DeclaredRemoteServiceTarget {
  serviceId: string;
  endpoint: string;
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  timeoutMs?: number;
  bridgeExecutionContext?: boolean;
  label?: string;
}

interface BaseExecutionTarget {
  capabilityName: string;
  label: string;
  kind: ExecutionTargetKind;
  sourceFacet: ExecutionTargetSourceFacet;
  readiness: ExecutionTargetReadiness;
}

export interface HostTsExecutionTarget extends BaseExecutionTarget {
  kind: "host_ts";
  sourceFacet: "executor_binding";
  bundleId: string;
  executorId: string;
  executionSurface: Extract<CapabilityExecutionSurface, "internal" | "shared">;
}

export interface DeferredJobExecutionTarget extends BaseExecutionTarget {
  kind: "deferred_job";
  sourceFacet: "job";
  executionMode: CapabilityDefinition["runtime"]["executionMode"];
  executionPrincipal: JobCapabilityDefinition["executionPrincipal"];
  recoveryMode: JobCapabilityDefinition["recoveryMode"];
  retryMode: JobCapabilityDefinition["retryPolicy"]["mode"];
  defaultSurface: JobCapabilityDefinition["defaultSurface"];
  allowedRoles: readonly RoleName[];
}

export interface BrowserWasmExecutionTarget extends BaseExecutionTarget {
  kind: "browser_wasm";
  sourceFacet: "browser";
  runtimeKind: BrowserCapabilityDescriptor["runtimeKind"];
  moduleId: string;
  fallbackPolicy: BrowserCapabilityDescriptor["fallbackPolicy"];
  recoveryPolicy: BrowserCapabilityDescriptor["recoveryPolicy"];
  requiresCrossOriginIsolation?: boolean;
  maxConcurrentExecutions?: number;
  supportedAssetKinds: BrowserCapabilityDescriptor["supportedAssetKinds"];
}

export interface McpStdioExecutionTarget extends BaseExecutionTarget {
  kind: "mcp_stdio";
  sourceFacet: "mcp_export";
  sharedModule: string;
  description: string;
  allowedRoles: RoleName[] | "ALL";
}

export interface McpContainerExecutionTarget extends BaseExecutionTarget {
  kind: "mcp_container";
  sourceFacet: "target_override" | "mcp_export";
  serviceName: string;
  sharedModule?: string;
}

export interface NativeProcessExecutionTarget extends BaseExecutionTarget {
  kind: "native_process";
  sourceFacet: "target_override";
  processId: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface RemoteServiceExecutionTarget extends BaseExecutionTarget {
  kind: "remote_service";
  sourceFacet: "target_override";
  serviceId: string;
  endpoint: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
  timeoutMs?: number;
  bridgeExecutionContext: boolean;
}

export type CapabilityExecutionTarget =
  | HostTsExecutionTarget
  | DeferredJobExecutionTarget
  | BrowserWasmExecutionTarget
  | McpStdioExecutionTarget
  | McpContainerExecutionTarget
  | NativeProcessExecutionTarget
  | RemoteServiceExecutionTarget;

export interface ExecutionPlanningContext {
  preferredTargetKinds?: readonly ExecutionTargetKind[];
  enabledTargetKinds?: readonly ExecutionTargetKind[];
  browserRuntimeAvailable?: boolean;
  allowDeferredJob?: boolean;
  mcpContainerTargets?: Partial<Record<string, DeclaredMcpContainerTarget>>;
  nativeProcessTargets?: Partial<Record<string, DeclaredNativeProcessTarget>>;
  remoteServiceTargets?: Partial<Record<string, DeclaredRemoteServiceTarget>>;
}

export interface CapabilityExecutionPlan {
  capabilityName: string;
  requestedExecutionMode: CapabilityDefinition["presentation"]["executionMode"];
  preferredTargetKinds: readonly ExecutionTargetKind[];
  candidates: CapabilityExecutionTarget[];
  primaryTarget: CapabilityExecutionTarget | null;
  fallbackTargets: CapabilityExecutionTarget[];
  blockReason: ExecutionPlanBlockReason | null;
}

function buildHostTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): HostTsExecutionTarget | null {
  const binding = runtime.binding;
  if (!binding || (binding.executionSurface !== "internal" && binding.executionSurface !== "shared")) {
    return null;
  }

  return {
    capabilityName: runtime.capabilityName,
    label: runtime.descriptor.label,
    kind: "host_ts",
    sourceFacet: "executor_binding",
    readiness: isTargetKindEnabled("host_ts", context) ? "active" : "declared",
    bundleId: binding.bundleId,
    executorId: binding.executorId,
    executionSurface: binding.executionSurface,
  };
}

function buildDeferredTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): DeferredJobExecutionTarget | null {
  const job = runtime.job;
  if (!job) {
    return null;
  }

  return {
    capabilityName: runtime.capabilityName,
    label: job.label,
    kind: "deferred_job",
    sourceFacet: "job",
    readiness: isTargetKindEnabled("deferred_job", context) ? "active" : "declared",
    executionMode: runtime.descriptor.executionMode,
    executionPrincipal: job.executionPrincipal,
    recoveryMode: job.recoveryMode,
    retryMode: job.retryPolicy.mode,
    defaultSurface: job.defaultSurface,
    allowedRoles: job.executionAllowedRoles,
  };
}

function buildBrowserTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): BrowserWasmExecutionTarget | null {
  const browser = runtime.browser;
  if (!browser) {
    return null;
  }

  return {
    capabilityName: runtime.capabilityName,
    label: runtime.descriptor.label,
    kind: "browser_wasm",
    sourceFacet: "browser",
    readiness: isTargetKindEnabled("browser_wasm", context) ? "active" : "declared",
    runtimeKind: browser.runtimeKind,
    moduleId: browser.moduleId,
    fallbackPolicy: browser.fallbackPolicy,
    recoveryPolicy: browser.recoveryPolicy,
    requiresCrossOriginIsolation: browser.requiresCrossOriginIsolation,
    maxConcurrentExecutions: browser.maxConcurrentExecutions,
    supportedAssetKinds: browser.supportedAssetKinds,
  };
}

function buildMcpStdioTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): McpStdioExecutionTarget | null {
  const mcpExport = runtime.mcpExport;
  if (!mcpExport) {
    return null;
  }

  return {
    capabilityName: runtime.capabilityName,
    label: runtime.descriptor.label,
    kind: "mcp_stdio",
    sourceFacet: "mcp_export",
    readiness: isTargetKindEnabled("mcp_stdio", context) ? "active" : "declared",
    sharedModule: mcpExport.sharedModule,
    description: mcpExport.mcpDescription ?? runtime.descriptor.description,
    allowedRoles: runtime.descriptor.roles,
  };
}

function buildMcpContainerTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): McpContainerExecutionTarget | null {
  const target = context.mcpContainerTargets?.[runtime.capabilityName] ?? (
    runtime.localExecutionTargets?.mcpContainer
      ? {
          serviceName: runtime.localExecutionTargets.mcpContainer.serviceName,
          label: runtime.localExecutionTargets.mcpContainer.label,
          sharedModule: runtime.localExecutionTargets.mcpContainer.sharedModule,
        }
      : undefined
  );
  if (!target) {
    return null;
  }

  const mcpExport = runtime.mcpExport;

  return {
    capabilityName: runtime.capabilityName,
    label: target.label ?? runtime.descriptor.label,
    kind: "mcp_container",
    sourceFacet: mcpExport ? "mcp_export" : "target_override",
    readiness: isTargetKindEnabled("mcp_container", context) ? "active" : "declared",
    serviceName: target.serviceName,
    sharedModule: target.sharedModule ?? mcpExport?.sharedModule,
  };
}

function buildNativeProcessTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): NativeProcessExecutionTarget | null {
  const target = context.nativeProcessTargets?.[runtime.capabilityName] ?? runtime.localExecutionTargets?.nativeProcess;
  if (!target) {
    return null;
  }

  return {
    capabilityName: runtime.capabilityName,
    label: target.label ?? runtime.descriptor.label,
    kind: "native_process",
    sourceFacet: "target_override",
    readiness: isTargetKindEnabled("native_process", context) ? "active" : "declared",
    processId: target.processId,
    command: target.command,
    args: [...target.args],
    cwd: target.cwd,
    env: target.env,
    timeoutMs: target.timeoutMs,
  };
}

function buildRemoteServiceTarget(
  runtime: CapabilityRuntimeStatic,
  context: ExecutionPlanningContext,
): RemoteServiceExecutionTarget | null {
  const target = context.remoteServiceTargets?.[runtime.capabilityName] ?? runtime.localExecutionTargets?.remoteService;
  if (!target) {
    return null;
  }

  return {
    capabilityName: runtime.capabilityName,
    label: target.label ?? runtime.descriptor.label,
    kind: "remote_service",
    sourceFacet: "target_override",
    readiness: isTargetKindEnabled("remote_service", context) ? "active" : "declared",
    serviceId: target.serviceId,
    endpoint: target.endpoint,
    method: target.method ?? "POST",
    headers: target.headers,
    timeoutMs: target.timeoutMs,
    bridgeExecutionContext: target.bridgeExecutionContext === true,
  };
}

export { getDefaultTargetPriority } from "@/core/platform/execution/ExecutionTargetStrategy";

export function projectCapabilityExecutionTargets(
  def: CapabilityDefinition,
  context: ExecutionPlanningContext = {},
): CapabilityExecutionTarget[] {
  const runtime = projectCapabilityRuntimeDefinition(def);
  const candidates = [
    buildHostTarget(runtime, context),
    buildDeferredTarget(runtime, context),
    buildBrowserTarget(runtime, context),
    buildMcpStdioTarget(runtime, context),
    buildMcpContainerTarget(runtime, context),
    buildNativeProcessTarget(runtime, context),
    buildRemoteServiceTarget(runtime, context),
  ].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  return sortTargets(candidates, context.preferredTargetKinds ?? getDefaultTargetPriority(def));
}

export function planCapabilityExecution(
  def: CapabilityDefinition,
  context: ExecutionPlanningContext = {},
): CapabilityExecutionPlan {
  const runtime = projectCapabilityRuntimeDefinition(def);
  const preferredTargetKinds = context.preferredTargetKinds ?? getDefaultTargetPriority(def);
  const candidates = projectCapabilityExecutionTargets(def, {
    ...context,
    enabledTargetKinds: context.enabledTargetKinds ?? DEFAULT_ENABLED_TARGET_KINDS,
  });
  const activeTargets = candidates.filter((candidate) => candidate.readiness === "active");

  return {
    capabilityName: runtime.capabilityName,
    requestedExecutionMode: runtime.presentation.executionMode,
    preferredTargetKinds,
    candidates,
    primaryTarget: activeTargets[0] ?? null,
    fallbackTargets: activeTargets.slice(1),
    blockReason:
      candidates.length === 0
        ? "no_declared_targets"
        : activeTargets.length === 0
          ? "no_active_targets"
          : null,
  };
}
