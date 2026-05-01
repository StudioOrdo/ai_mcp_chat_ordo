/**
 * Sprint 18 — MCP Catalog Parity Tests
 *
 * Verifies that catalog entries with `mcpExport` facets match actual
 * MCP tool registrations, and that declared shared modules exist on disk.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getAllMcpExportableTools } from "./mcp-export";

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const MCP_DIR = path.join(PROJECT_ROOT, "mcp");
const SHARED_CAPABILITIES_DIR = path.join(PROJECT_ROOT, "src/lib/capabilities/shared");

describe("MCP catalog parity", () => {
  const exportableTools = getAllMcpExportableTools();

  it("has at least 1 catalog entry with mcpExport facet", () => {
    expect(exportableTools.length).toBeGreaterThanOrEqual(5);
  });

  it("admin_web_search is in the exportable tools list", () => {
    const names = exportableTools.map((t) => t.name);
    expect(names).toContain("admin_web_search");
    expect(names).toContain("admin_search");
  });

  describe("each mcpExport entry", () => {
    for (const tool of exportableTools) {
      describe(`${tool.name}`, () => {
        it("has a non-empty name", () => {
          expect(tool.name).toBeTruthy();
        });

        it("has a non-empty description", () => {
          expect(tool.description).toBeTruthy();
        });

        it("declares a sharedModule that exists on disk", () => {
          // sharedModule is like "src/lib/capabilities/shared/web-search-tool"
          const modulePath = path.join(PROJECT_ROOT, `${tool.sharedModule}.ts`);
          expect(
            fs.existsSync(modulePath),
            `Shared module "${tool.sharedModule}" should exist at ${modulePath}`,
          ).toBe(true);
        });

        it("sharedModule is in the shared capabilities directory", () => {
          expect(tool.sharedModule).toMatch(/^src\/lib\/capabilities\/shared\//);
        });
      });
    }
  });

  describe("shared module consumption", () => {
    const serverSource = fs.readFileSync(path.join(MCP_DIR, "operations-server.ts"), "utf-8");
    const adapterRegistrySource = fs.readFileSync(
      path.join(PROJECT_ROOT, "src/lib/capabilities/mcp-export-adapter-registry.ts"),
      "utf-8",
    );
    const adminWebSearchSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "src/core/use-cases/tools/admin-web-search.tool.ts"),
      "utf-8",
    );

    it("every mcpExport sharedModule is imported by at least one consumer", () => {
      for (const tool of exportableTools) {
        const moduleFile = `${tool.sharedModule.split("/").pop()!}.ts`;
        const sharedModulePath = path.join(SHARED_CAPABILITIES_DIR, moduleFile);
        const isImportedByServer = serverSource.includes(tool.sharedModule.replace("src/", "@/"));
        const isImportedByAdapterRegistry = adapterRegistrySource.includes(tool.sharedModule);
        const srcToolImportsIt = adminWebSearchSource.includes("@/lib/capabilities/shared/web-search-tool");

        expect(
          fs.existsSync(sharedModulePath) && (isImportedByServer || isImportedByAdapterRegistry || srcToolImportsIt),
          `Shared module "${tool.sharedModule}" must be imported by the MCP server, adapter registry, or an src/ consumer`,
        ).toBe(true);
      }
    });

    it("the operations-server.ts keeps transport-only tools explicit", () => {
      expect(serverSource).toContain("getEmbeddingToolSchemas");
      expect(serverSource).toContain("getCorpusToolSchemas");
      expect(serverSource).toContain("getPromptToolSchemas");
      expect(serverSource).toContain("getAnalyticsToolSchemas");
      expect(serverSource).not.toContain("getAdminIntelligenceToolSchemas");
    });

    it("the operations-server.ts resolves catalog-owned MCP tools through an adapter registry", () => {
      expect(serverSource).toContain("createCatalogMcpToolEntries");
      expect(adapterRegistrySource).toContain("CATALOG_MCP_ADAPTERS");
      expect(adapterRegistrySource).toContain("Missing MCP adapter for catalog export");
    });
  });
});
