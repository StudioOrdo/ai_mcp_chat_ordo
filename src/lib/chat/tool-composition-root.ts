import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { createToolExecutionHookRunner, type ToolExecuteFn } from "@/core/tool-registry/ToolMiddleware";
import { LoggingMiddleware } from "@/core/tool-registry/LoggingMiddleware";
import { RbacGuardMiddleware } from "@/core/tool-registry/RbacGuardMiddleware";
import { ToolCapabilityMiddleware } from "@/core/tool-registry/ToolCapabilityMiddleware";
import { RoleAwareSearchFormatter } from "@/core/tool-registry/ToolResultFormatter";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import { getSearchHandler } from "./search-pipeline";
import { getInstanceTools } from "@/lib/config/instance";
import { getEmbeddingPipelineFactory, getBookPipeline, getCorpusPipeline } from "./embedding-module";
import {
  TOOL_BUNDLE_COMPOSITIONS,
  type ToolBundleCompositionDeps,
} from "./tool-bundle-composition";

/** Sorted registry of all tool bundles. Add new bundles here. */
export const TOOL_BUNDLE_REGISTRY: readonly ToolBundleDescriptor[] = Object.freeze(
  TOOL_BUNDLE_COMPOSITIONS.map(({ bundle }) => bundle),
);

function registerToolBundles(
  registry: ToolRegistry,
  deps: ToolBundleCompositionDeps,
): void {
  for (const registration of TOOL_BUNDLE_COMPOSITIONS) {
    registration.register(registry, deps);
  }
}

export function createToolRegistry(corpusRepo: CorpusRepository, handler?: SearchHandler): ToolRegistry {
  const reg = new ToolRegistry(new RoleAwareSearchFormatter());
  reg.setBundles(TOOL_BUNDLE_REGISTRY);
  registerToolBundles(reg, { corpusRepo, handler });
  const toolConfig = getInstanceTools();
  const allNames = reg.getToolNames();
  if (toolConfig.enabled) for (const n of allNames) { if (!toolConfig.enabled.includes(n)) reg.unregister(n); }
  if (toolConfig.disabled) for (const n of toolConfig.disabled) reg.unregister(n);
  return reg;
}

export interface ToolCompositionResult { readonly registry: ToolRegistry; readonly executor: ToolExecuteFn }
let cached: ToolCompositionResult | null = null;

export function getToolComposition(): ToolCompositionResult {
  if (!cached) {
    const registry = createToolRegistry(getCorpusRepository(), getSearchHandler());
    const hooks = [new LoggingMiddleware(), new ToolCapabilityMiddleware(registry), new RbacGuardMiddleware(registry)];
    const executor = createToolExecutionHookRunner(hooks, registry.execute.bind(registry));
    cached = Object.freeze({ registry, executor });
  }
  return cached;
}

/** @internal — test-only. */
export function _resetToolComposition(): void { cached = null; }

export { applyPolicyLayers } from "@/core/tool-registry/ToolPolicyPipeline";
export type { ToolPolicy, ToolPolicyLayer, ToolPolicyPrecedence } from "@/core/tool-registry/ToolPolicyPipeline";
export { getEmbeddingPipelineFactory, getBookPipeline, getCorpusPipeline, getSearchHandler };
