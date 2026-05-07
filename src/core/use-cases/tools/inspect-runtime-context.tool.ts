import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  resolveCurrentPageDetails,
  type CurrentPageDetails,
} from "@/lib/chat/current-page-context";
import {
  getEffectiveToolAvailabilityForRole,
  getRuntimeToolManifestForRole,
} from "@/lib/chat/runtime-manifest";
import { compactProvenance } from "@/lib/prompts/prompt-provenance-store";

interface PromptRuntimeInspectionResult {
  surface: string;
  effectiveHash: string;
  slotRefs: ReturnType<typeof compactProvenance>["slotRefs"];
  sections: ReturnType<typeof compactProvenance>["sections"];
  warnings: ReturnType<typeof compactProvenance>["warnings"];
  redacted: true;
}

interface InspectRuntimeContextInput {
  includeTools?: boolean;
  includePrompt?: boolean;
}

interface InspectRuntimeContextOutput {
  action: "inspect_runtime_context";
  role: ToolExecutionContext["role"];
  currentPathname: string | null;
  currentPage: CurrentPageDetails | null;
  availableTools: Array<{
    name: string;
    description: string;
    category: string;
  }>;
  effectiveTools?: ReturnType<typeof getEffectiveToolAvailabilityForRole>;
  toolCount: number;
  promptRuntime?: PromptRuntimeInspectionResult | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseInspectRuntimeContextInput(value: unknown): InspectRuntimeContextInput {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error("inspect_runtime_context input must be an object.");
  }

  if (value.includeTools !== undefined && typeof value.includeTools !== "boolean") {
    throw new Error("inspect_runtime_context includeTools must be a boolean when provided.");
  }

  if (value.includePrompt !== undefined && typeof value.includePrompt !== "boolean") {
    throw new Error("inspect_runtime_context includePrompt must be a boolean when provided.");
  }

  return {
    ...(value.includeTools === undefined ? {} : { includeTools: value.includeTools }),
    ...(value.includePrompt === undefined ? {} : { includePrompt: value.includePrompt }),
  };
}

export async function executeInspectRuntimeContext(
  registry: ToolRegistry,
  input: InspectRuntimeContextInput,
  context?: ToolExecutionContext,
): Promise<InspectRuntimeContextOutput> {
  const role = context?.role ?? "ANONYMOUS";
  const currentPathname = context?.currentPageSnapshot?.pathname ?? context?.currentPathname ?? null;
  const currentPage = currentPathname
    ? resolveCurrentPageDetails(currentPathname, context?.currentPageSnapshot)
    : null;
  const availableTools = input.includeTools === false
    ? []
    : getRuntimeToolManifestForRole(registry, role, {
      allowedToolNames: context?.allowedToolNames,
    });
  const effectiveTools = input.includeTools === false
    ? undefined
    : getEffectiveToolAvailabilityForRole(role, {
      allowedToolNames: context?.allowedToolNames,
    });

  return {
    action: "inspect_runtime_context",
    role,
    currentPathname,
    currentPage,
    availableTools,
    ...(effectiveTools ? { effectiveTools } : {}),
    toolCount: availableTools.length,
    ...(input.includePrompt === true
      ? {
          promptRuntime: context?.promptRuntime
            ? {
                ...compactProvenance(context.promptRuntime),
                redacted: true as const,
              }
            : null,
        }
      : {}),
  };
}

export function createInspectRuntimeContextTool(registry: ToolRegistry) {
  return buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.inspect_runtime_context, {
    parse: parseInspectRuntimeContextInput,
    execute: (input, context) => executeInspectRuntimeContext(registry, input, context),
  });
}
