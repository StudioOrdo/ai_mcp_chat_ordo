import { describe, expect, it } from "vitest";
import { getAllMcpExportableTools, type McpToolRegistration } from "@/core/capability-catalog/mcp-export";
import {
  CATALOG_MCP_ADAPTERS,
  createCatalogMcpToolEntries,
} from "./mcp-export-adapter-registry";

describe("mcp-export-adapter-registry", () => {
  it("resolves every catalog MCP export to exactly one schema and handler", () => {
    const exports = getAllMcpExportableTools();
    const entries = createCatalogMcpToolEntries(exports);

    expect(entries.map(([name]) => name).sort()).toEqual(
      exports.map((entry) => entry.name).sort(),
    );

    for (const [name, entry] of entries) {
      expect(entry.schema.name).toBe(name);
      expect(entry.schema.description).toBeTruthy();
      expect(entry.schema.inputSchema).toEqual(expect.any(Object));
      expect(entry.handler).toEqual(expect.any(Function));
    }
  });

  it("keeps adapter coverage exact for catalog MCP export shared modules", () => {
    const exportedSharedModules = [
      ...new Set(getAllMcpExportableTools().map((registration) => registration.sharedModule)),
    ].sort();

    expect(Object.keys(CATALOG_MCP_ADAPTERS).sort()).toEqual(exportedSharedModules);
  });

  it("fails fast when a catalog export lacks a shared-module adapter", () => {
    const registration: McpToolRegistration = {
      name: "missing_export",
      description: "Missing export",
      sharedModule: "src/lib/capabilities/shared/missing-tool",
      category: "system",
      allowedRoles: ["ADMIN"],
    };

    expect(() => createCatalogMcpToolEntries([registration])).toThrow(
      /Missing MCP adapter for catalog export missing_export/,
    );
  });

  it("fails fast when a known shared module receives an unknown catalog tool", () => {
    const registration: McpToolRegistration = {
      name: "unsupported_admin_export",
      description: "Unsupported export",
      sharedModule: "src/lib/capabilities/shared/admin-intelligence-tool",
      category: "system",
      allowedRoles: ["ADMIN"],
    };

    expect(() => createCatalogMcpToolEntries([registration])).toThrow(
      /Catalog MCP export references unknown capability: unsupported_admin_export/,
    );
  });
});
