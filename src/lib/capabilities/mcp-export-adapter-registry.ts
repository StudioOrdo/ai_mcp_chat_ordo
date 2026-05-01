import type { McpToolRegistration } from "@/core/capability-catalog/mcp-export";
import { getCatalogDefinition } from "@/core/capability-catalog/catalog";
import { createAdminWebSearchTool } from "@/core/use-cases/tools/admin-web-search.tool";
import {
  executeInspectRuntimeLogs,
  sanitizeInspectRuntimeLogsInput,
} from "@/core/use-cases/tools/inspect-runtime-logs.tool";
import {
  adminPrioritizeLeads,
  adminPrioritizeOffer,
  adminSearch,
  adminTriageRoutingRisk,
  type AdminIntelligenceToolDeps,
} from "@/lib/capabilities/shared/admin-intelligence-tool";

export type McpToolArgs = Record<string, unknown>;

export type McpToolSchema = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export interface McpExportAdapterDeps {
  adminIntelligence: AdminIntelligenceToolDeps;
}

export type McpExportToolHandler = (
  deps: McpExportAdapterDeps,
  args: McpToolArgs,
) => Promise<unknown> | unknown;

export interface McpExportToolEntry {
  readonly schema: McpToolSchema;
  readonly handler: McpExportToolHandler;
}

type CatalogMcpAdapterFactory = (registration: McpToolRegistration) => McpExportToolEntry;

function schemaFromCatalogTool(name: string, description: string): McpToolSchema {
  const def = getCatalogDefinition(name);
  if (!def) {
    throw new Error(`Catalog MCP export references unknown capability: ${name}`);
  }

  return {
    name,
    description,
    inputSchema: def.schema.inputSchema,
  };
}

export const CATALOG_MCP_ADAPTERS: Readonly<Record<string, CatalogMcpAdapterFactory>> = {
  "src/lib/capabilities/shared/web-search-tool": (registration) => {
    if (registration.name !== "admin_web_search") {
      throw new Error(`Unsupported web-search MCP export: ${registration.name}`);
    }

    const descriptor = createAdminWebSearchTool();
    return {
      schema: schemaFromCatalogTool(registration.name, registration.description),
      handler: (_deps, args) => descriptor.command.execute(args),
    };
  },
  "src/lib/capabilities/shared/admin-intelligence-tool": (registration) => {
    const schema = schemaFromCatalogTool(registration.name, registration.description);
    switch (registration.name) {
      case "admin_search":
        return { schema, handler: (deps, args) => adminSearch(deps.adminIntelligence, args) };
      case "admin_prioritize_leads":
        return { schema, handler: (deps, args) => adminPrioritizeLeads(deps.adminIntelligence, args) };
      case "admin_prioritize_offer":
        return { schema, handler: (deps, args) => adminPrioritizeOffer(deps.adminIntelligence, args) };
      case "admin_triage_routing_risk":
        return { schema, handler: (deps, args) => adminTriageRoutingRisk(deps.adminIntelligence, args) };
      case "inspect_runtime_logs":
        return {
          schema,
          handler: (_deps, args) => executeInspectRuntimeLogs(sanitizeInspectRuntimeLogsInput(args)),
        };
      default:
        throw new Error(`Unsupported admin-intelligence MCP export: ${registration.name}`);
    }
  },
};

export function createCatalogMcpToolEntries(
  registrations: readonly McpToolRegistration[],
): Array<readonly [string, McpExportToolEntry]> {
  return registrations.map((registration) => {
    const factory = CATALOG_MCP_ADAPTERS[registration.sharedModule];
    if (!factory) {
      throw new Error(
        `Missing MCP adapter for catalog export ${registration.name} (${registration.sharedModule})`,
      );
    }

    const entry = factory(registration);
    if (entry.schema.name !== registration.name) {
      throw new Error(
        `MCP adapter for ${registration.name} returned schema for ${entry.schema.name}`,
      );
    }

    return [entry.schema.name, entry] as const;
  });
}
