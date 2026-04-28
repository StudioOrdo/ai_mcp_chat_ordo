/**
 * Catalog-Driven MCP Tool Registration
 *
 * Sprint 7: Projects a catalog definition's mcpExport facet into a standard
 * MCP tool schema that can be used for tool registration in MCP servers.
 *
 * Sprint 11: Updated getAllMcpExportableTools() to dynamically iterate the
 * full catalog instead of hardcoding pilot tool names.
 */

import type { CapabilityDefinition } from "./capability-definition";
import {
  projectAllCapabilityRuntimeStatics,
  projectCapabilityRuntimeDefinition,
  projectCapabilityRuntimeStaticByName,
} from "@/core/platform/capability-runtime/CapabilityRuntime";

// ---------------------------------------------------------------------------
// MCP registration schema
// ---------------------------------------------------------------------------

export interface McpToolRegistration {
  /** Tool name as it appears in the MCP protocol */
  name: string;
  /** Human-readable description for the MCP tool listing */
  description: string;
  /** The shared module that contains the core execution logic */
  sharedModule: string;
  /** The capability category from the catalog */
  category: string;
  /** Roles that can use this tool, or "ALL" for unrestricted */
  allowedRoles: readonly string[] | "ALL";
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Project a catalog definition into an MCP tool registration.
 * Returns null if the capability has no mcpExport facet or is not exportable.
 */
export function projectMcpToolRegistration(
  def: CapabilityDefinition,
): McpToolRegistration | null {
  const runtime = projectCapabilityRuntimeDefinition(def);
  if (!runtime.mcpExport) return null;

  return {
    name: runtime.capabilityName,
    description: runtime.mcpExport.mcpDescription ?? runtime.descriptor.description,
    sharedModule: runtime.mcpExport.sharedModule,
    category: runtime.descriptor.category,
    allowedRoles: runtime.descriptor.roles,
  };
}

/**
 * Project an MCP tool registration by tool name.
 * Convenience wrapper that looks up the catalog first.
 */
export function projectMcpToolRegistrationByName(
  toolName: string,
): McpToolRegistration | null {
  const runtime = projectCapabilityRuntimeStaticByName(toolName);
  if (!runtime || !runtime.mcpExport) return null;

  return {
    name: runtime.capabilityName,
    description: runtime.mcpExport.mcpDescription ?? runtime.descriptor.description,
    sharedModule: runtime.mcpExport.sharedModule,
    category: runtime.descriptor.category,
    allowedRoles: runtime.descriptor.roles,
  };
}

/**
 * Get all catalog capabilities that are MCP-exportable.
 *
 * Iterates the static CapabilityRuntime projection and filters for entries
 * with an exportable MCP facet.
 */
export function getAllMcpExportableTools(): McpToolRegistration[] {
  return projectAllCapabilityRuntimeStatics()
    .flatMap((runtime) => runtime.mcpExport
      ? [{
          name: runtime.capabilityName,
          description: runtime.mcpExport.mcpDescription ?? runtime.descriptor.description,
          sharedModule: runtime.mcpExport.sharedModule,
          category: runtime.descriptor.category,
          allowedRoles: runtime.descriptor.roles,
        }]
      : []);
}
