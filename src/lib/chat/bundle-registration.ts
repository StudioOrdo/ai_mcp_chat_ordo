import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";

export interface ToolBundleRegistration<
  ToolName extends string = string,
  Deps extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly toolName: ToolName;
  readonly createTool: (deps: Deps) => ToolDescriptor;
}

export function createRegisteredToolBundle<
  const ToolName extends string,
  const Deps extends Record<string, unknown>,
>(
  id: string,
  displayName: string,
  registrations: readonly ToolBundleRegistration<ToolName, Deps>[],
): ToolBundleDescriptor {
  return {
    id,
    displayName,
    toolNames: registrations.map((registration) => registration.toolName),
  };
}

export function registerToolBundle<
  const ToolName extends string,
  const Deps extends Record<string, unknown>,
>(
  registry: ToolRegistry,
  registrations: readonly ToolBundleRegistration<ToolName, Deps>[],
  deps: Deps,
): void {
  for (const registration of registrations) {
    registry.register(registration.createTool(deps));
  }
}