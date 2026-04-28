import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type {
  CatalogBoundToolName,
  CatalogToolBindingDeps,
} from "@/core/capability-catalog/runtime-tool-binding";
import { registerCatalogBoundToolsForBundleWithDepsResolver } from "@/core/capability-catalog/runtime-tool-binding";
import { projectCapabilityRuntimeNamesForBundle } from "@/core/platform/capability-runtime/CapabilityRuntime";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";

export interface ToolBundleRegistration<TToolName extends string, TDeps> {
  readonly toolName: TToolName;
  readonly createTool: (deps: TDeps) => ToolDescriptor;
}

export function createRegisteredToolBundle<TToolName extends string, TDeps>(
  id: string,
  displayName: string,
  registrations: readonly ToolBundleRegistration<TToolName, TDeps>[],
  additionalToolNames: readonly string[] = [],
): ToolBundleDescriptor {
  return {
    id,
    displayName,
    toolNames: Object.freeze([...registrations.map(({ toolName }) => toolName), ...additionalToolNames]),
  };
}

export function registerToolBundle<TToolName extends string, TDeps>(
  registry: ToolRegistry,
  registrations: readonly ToolBundleRegistration<TToolName, TDeps>[],
  deps: TDeps,
): void {
  for (const registration of registrations) {
    registry.register(registration.createTool(deps));
  }
}

export function createCatalogBoundToolBundle(
  id: string,
  displayName: string,
  additionalToolNames: readonly string[] = [],
): ToolBundleDescriptor {
  return {
    id,
    displayName,
    toolNames: Object.freeze([
      ...projectCapabilityRuntimeNamesForBundle(id),
      ...additionalToolNames,
    ]),
  };
}

export function registerCatalogBoundToolBundle<TDeps>(
  registry: ToolRegistry,
  bundleId: string,
  deps: TDeps,
  resolveBindingDeps?: (
    toolName: CatalogBoundToolName,
    deps: TDeps,
  ) => CatalogToolBindingDeps,
): void {
  registerCatalogBoundToolsForBundleWithDepsResolver(registry, bundleId, (toolName) =>
    resolveBindingDeps?.(toolName, deps) ?? {},
  );
}