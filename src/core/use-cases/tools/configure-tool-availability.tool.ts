import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import { buildCatalogBoundToolDescriptor } from "@/core/capability-catalog/runtime-tool-projection";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  PROTECTED_TOOL_NAMES,
  isKnownToolName,
  isProtectedTool,
} from "@/lib/tools/tool-default-profile";
import { getToolAvailabilityService } from "@/lib/tools/tool-availability-service";
import { getToolSettingsService } from "@/lib/tools/tool-settings-service";

type ConfigureToolAvailabilityAction =
  | "enable_tool"
  | "disable_tool"
  | "enable_bundle"
  | "disable_bundle"
  | "explain_tool"
  | "list_protected_tools"
  | "summarize_manifest";

export interface ConfigureToolAvailabilityInput {
  action: ConfigureToolAvailabilityAction;
  tool_name?: string;
  bundle_id?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseConfigureToolAvailabilityInput(value: unknown): ConfigureToolAvailabilityInput {
  if (!isRecord(value)) {
    throw new Error("configure_tool_availability input must be an object.");
  }

  const action = value.action;
  const actions: ConfigureToolAvailabilityAction[] = [
    "enable_tool",
    "disable_tool",
    "enable_bundle",
    "disable_bundle",
    "explain_tool",
    "list_protected_tools",
    "summarize_manifest",
  ];

  if (typeof action !== "string" || !actions.includes(action as ConfigureToolAvailabilityAction)) {
    throw new Error(`configure_tool_availability action must be one of: ${actions.join(", ")}.`);
  }

  return {
    action: action as ConfigureToolAvailabilityAction,
    ...(typeof value.tool_name === "string" && value.tool_name.trim().length > 0
      ? { tool_name: value.tool_name.trim() }
      : {}),
    ...(typeof value.bundle_id === "string" && value.bundle_id.trim().length > 0
      ? { bundle_id: value.bundle_id.trim() }
      : {}),
  };
}

function requireAdmin(context?: ToolExecutionContext): void {
  if (context?.role !== "ADMIN") {
    throw new Error("configure_tool_availability is admin-only.");
  }
}

function summarizeManifest() {
  const service = getToolAvailabilityService();
  const manifest = service.getEffectiveManifestSync();
  return {
    version: manifest.version,
    countsByState: service.summarizeByState(manifest),
    warnings: manifest.warnings,
  };
}

function explainTool(toolName: string) {
  const manifest = getToolAvailabilityService().getEffectiveManifestSync();
  const tool = manifest.tools.find((entry) => entry.name === toolName);
  if (!tool) {
    return {
      state: "unknown_tool",
      reason: "unknown_tool_name",
      message: `Unknown tool "${toolName}".`,
    };
  }

  return tool;
}

function getToolStaticLock(toolName: string): { locked: boolean; message?: string } {
  const tool = explainTool(toolName);
  if ("staticLocked" in tool && tool.staticLocked) {
    return {
      locked: true,
      message: `Tool "${toolName}" is locked by static config and cannot be changed through runtime controls.`,
    };
  }

  return { locked: false };
}

function getBundleToolNames(registry: ToolRegistry, bundleId: string): string[] {
  const bundle = registry.getBundles().find((candidate) => candidate.id === bundleId);
  if (!bundle) {
    throw new Error(`Unknown tool bundle "${bundleId}".`);
  }

  return [...bundle.toolNames].filter((toolName) => isKnownToolName(toolName));
}

export async function executeConfigureToolAvailability(
  registry: ToolRegistry,
  input: ConfigureToolAvailabilityInput,
  context?: ToolExecutionContext,
) {
  requireAdmin(context);

  if (input.action === "list_protected_tools") {
    return {
      action: input.action,
      protectedTools: [...PROTECTED_TOOL_NAMES],
      manifest: summarizeManifest(),
    };
  }

  if (input.action === "summarize_manifest") {
    return {
      action: input.action,
      manifest: summarizeManifest(),
    };
  }

  if (input.action === "explain_tool") {
    if (!input.tool_name) {
      throw new Error("tool_name is required for explain_tool.");
    }

    return {
      action: input.action,
      tool: explainTool(input.tool_name),
      manifest: summarizeManifest(),
    };
  }

  const settings = getToolSettingsService();

  if (input.action === "enable_tool" || input.action === "disable_tool") {
    if (!input.tool_name) {
      throw new Error("tool_name is required for tool-level actions.");
    }

    if (!isKnownToolName(input.tool_name)) {
      return {
        action: input.action,
        changed: false,
        warnings: [{
          code: "unknown_tool",
          toolName: input.tool_name,
          message: `Unknown tool "${input.tool_name}".`,
        }],
        manifest: summarizeManifest(),
      };
    }

    if (input.action === "disable_tool" && isProtectedTool(input.tool_name)) {
      return {
        action: input.action,
        changed: false,
        warnings: [{
          code: "protected_tool_not_disabled",
          toolName: input.tool_name,
          message: `Protected tool "${input.tool_name}" cannot be disabled through normal runtime controls.`,
        }],
        manifest: summarizeManifest(),
      };
    }

    const staticLock = getToolStaticLock(input.tool_name);
    if (staticLock.locked) {
      return {
        action: input.action,
        changed: false,
        warnings: [{
          code: "static_config_locked",
          toolName: input.tool_name,
          message: staticLock.message ?? `Tool "${input.tool_name}" is locked by static config.`,
        }],
        tool: explainTool(input.tool_name),
        manifest: summarizeManifest(),
      };
    }

    const result = await settings.updateTool(input.tool_name, input.action === "enable_tool");

    return {
      action: input.action,
      changed: true,
      settings: result.overrides,
      warnings: result.warnings,
      tool: explainTool(input.tool_name),
      manifest: summarizeManifest(),
    };
  }

  if (!input.bundle_id) {
    throw new Error("bundle_id is required for bundle-level actions.");
  }

  const requestedToolNames = getBundleToolNames(registry, input.bundle_id);
  const protectedToolNames = requestedToolNames.filter(isProtectedTool);
  const staticLockedToolNames = requestedToolNames
    .filter((toolName) => getToolStaticLock(toolName).locked);
  const toolNames = requestedToolNames
    .filter((toolName) => input.action === "enable_bundle" || !isProtectedTool(toolName))
    .filter((toolName) => !staticLockedToolNames.includes(toolName));

  const result = await settings.updateTools(toolNames, input.action === "enable_bundle");

  return {
    action: input.action,
    changed: toolNames.length > 0,
    bundleId: input.bundle_id,
    affectedTools: toolNames,
    skippedProtectedTools: protectedToolNames,
    skippedStaticLockedTools: staticLockedToolNames,
    settings: result.overrides,
    warnings: [
      ...result.warnings,
      ...staticLockedToolNames.map((toolName) => ({
        code: "static_config_locked" as const,
        toolName,
        message: `Tool "${toolName}" is locked by static config and cannot be changed through runtime controls.`,
      })),
    ],
    manifest: summarizeManifest(),
  };
}

export function createConfigureToolAvailabilityTool(registry: ToolRegistry) {
  return buildCatalogBoundToolDescriptor(CAPABILITY_CATALOG.configure_tool_availability, {
    parse: parseConfigureToolAvailabilityInput,
    execute: (input, context) => executeConfigureToolAvailability(registry, input, context),
  });
}
