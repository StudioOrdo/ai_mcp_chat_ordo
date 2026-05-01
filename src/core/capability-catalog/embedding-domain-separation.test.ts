/**
 * Sprint 17 — Embedding Server Domain/Transport Separation Tests
 *
 * Validates:
 * 1. Each domain module exports a get*ToolSchemas() factory function
 * 2. No domain module imports MCP protocol types
 * 3. operations-server.ts keeps transport-only schema factories explicit
 * 4. operations-server.ts is ≤ 350 lines (slimmed from 683)
 * 5. Tool schemas are structurally valid
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const MCP_DIR = path.resolve(__dirname, "../../../mcp");
const SHARED_DIR = path.resolve(__dirname, "../../lib/capabilities/shared");

function readMcpFile(filename: string): string {
  return fs.readFileSync(path.join(MCP_DIR, filename), "utf-8");
}

function readSharedFile(filename: string): string {
  return fs.readFileSync(path.join(SHARED_DIR, filename), "utf-8");
}

function lineCount(source: string): number {
  return source.split("\n").length;
}

describe("Sprint 17 — Embedding Server Domain/Transport Separation", () => {
  describe("embedding-tool.ts (embedding domain)", () => {
    const source = readSharedFile("embedding-tool.ts");

    it("exports getEmbeddingToolSchemas function", () => {
      expect(source).toContain("export function getEmbeddingToolSchemas");
    });

    it("does not import MCP protocol types", () => {
      expect(source).not.toContain("@modelcontextprotocol");
    });

    it("getEmbeddingToolSchemas accepts sourceType parameter", () => {
      expect(source).toContain("getEmbeddingToolSchemas(sourceType: string)");
    });
  });

  describe("librarian-tool.ts (corpus domain)", () => {
    const source = readSharedFile("librarian-tool.ts");

    it("exports getCorpusToolSchemas function", () => {
      expect(source).toContain("export function getCorpusToolSchemas");
    });

    it("does not import MCP protocol types", () => {
      expect(source).not.toContain("@modelcontextprotocol");
    });
  });

  describe("prompt-tool.ts (prompt domain)", () => {
    const source = readSharedFile("prompt-tool.ts");

    it("exports getPromptToolSchemas function", () => {
      expect(source).toContain("export function getPromptToolSchemas");
    });

    it("does not import MCP protocol types", () => {
      expect(source).not.toContain("@modelcontextprotocol");
    });
  });

  describe("analytics-tool.ts (analytics shared adapter)", () => {
    const source = readSharedFile("analytics-tool.ts");

    it("exports getAnalyticsToolSchemas function", () => {
      expect(source).toContain("export function getAnalyticsToolSchemas");
    });

    it("does not import MCP protocol types", () => {
      expect(source).not.toContain("@modelcontextprotocol");
    });
  });

  describe("admin-intelligence-tool.ts (admin shared adapter)", () => {
    const source = readSharedFile("admin-intelligence-tool.ts");

    it("exports getAdminIntelligenceToolSchemas function", () => {
      expect(source).toContain("export function getAdminIntelligenceToolSchemas");
    });

    it("does not import MCP protocol types", () => {
      expect(source).not.toContain("@modelcontextprotocol");
    });
  });

  describe("operations-server.ts (transport shell)", () => {
    const source = readMcpFile("operations-server.ts");

    it("is ≤ 350 lines (slimmed from 683)", () => {
      expect(lineCount(source)).toBeLessThanOrEqual(350);
    });

    it("imports getEmbeddingToolSchemas from embedding-tool", () => {
      expect(source).toContain("getEmbeddingToolSchemas");
    });

    it("imports getCorpusToolSchemas from librarian-tool", () => {
      expect(source).toContain("getCorpusToolSchemas");
    });

    it("imports getPromptToolSchemas from prompt-tool", () => {
      expect(source).toContain("getPromptToolSchemas");
    });

    it("imports getAnalyticsToolSchemas from analytics-tool", () => {
      expect(source).toContain("getAnalyticsToolSchemas");
    });

    it("uses the catalog MCP adapter registry for catalog-owned admin tools", () => {
      expect(source).toContain("createCatalogMcpToolEntries");
      expect(source).not.toContain("getAdminIntelligenceToolSchemas");
    });

    it("does not contain inline tool schema definitions", () => {
      // The old inline schemas had 20+ 'name: "...' entries inside ListToolsRequestSchema.
      // After extraction, only the spread calls remain.
      const schemaNameMatches = source.match(/name: "embed_text"|name: "corpus_list"|name: "prompt_list"|name: "conversation_analytics"/g);
      expect(schemaNameMatches).toBeNull();
    });

    it("still imports MCP protocol types (it IS the transport)", () => {
      expect(source).toContain("@modelcontextprotocol");
    });
  });

  describe("schema structural validity (source-based)", () => {
    it("embedding-tool.ts schema factory returns 6 schemas (by name count)", () => {
      const source = readSharedFile("embedding-tool.ts");
      // Count 'name: "...' inside getEmbeddingToolSchemas
      const schemaSection = source.slice(source.indexOf("getEmbeddingToolSchemas"));
      const nameMatches = schemaSection.match(/name: "/g);
      expect(nameMatches).toHaveLength(6);
    });

    it("librarian-tool.ts schema factory returns 6 schemas (by name count)", () => {
      const source = readSharedFile("librarian-tool.ts");
      const schemaSection = source.slice(source.indexOf("getCorpusToolSchemas"));
      const nameMatches = schemaSection.match(/name: "/g);
      expect(nameMatches).toHaveLength(6);
    });

    it("prompt-tool.ts schema factory returns 6 schemas (by name count)", () => {
      const source = readSharedFile("prompt-tool.ts");
      const schemaSection = source.slice(source.indexOf("getPromptToolSchemas"));
      const nameMatches = schemaSection.match(/name: "/g);
      expect(nameMatches).toHaveLength(6);
    });

    it("analytics-tool.ts schema factory returns 3 schemas (by name count)", () => {
      const source = readSharedFile("analytics-tool.ts");
      const schemaSection = source.slice(source.indexOf("getAnalyticsToolSchemas"));
      const nameMatches = schemaSection.match(/name: "/g);
      expect(nameMatches).toHaveLength(3);
    });

    it("admin-intelligence-tool.ts schema factory returns 4 schemas (by name count)", () => {
      const source = readSharedFile("admin-intelligence-tool.ts");
      const schemaSection = source.slice(source.indexOf("getAdminIntelligenceToolSchemas"));
      const nameMatches = schemaSection.match(/name: "/g);
      expect(nameMatches).toHaveLength(4);
    });

    it("all 25 tool names across domain modules are present", () => {
      const expectedTools = [
        "embed_text", "embed_document", "search_similar",
        "rebuild_index", "get_index_stats", "delete_embeddings",
        "corpus_list", "corpus_get", "corpus_add_document",
        "corpus_add_section", "corpus_remove_document", "corpus_remove_section",
        "prompt_list", "prompt_get", "prompt_set",
        "prompt_rollback", "prompt_diff", "prompt_get_provenance",
        "conversation_analytics", "conversation_inspect", "conversation_cohort",
        "admin_search",
        "admin_prioritize_leads", "admin_prioritize_offer", "admin_triage_routing_risk",
      ];

      const allSources = [
        readSharedFile("embedding-tool.ts"),
        readSharedFile("librarian-tool.ts"),
        readSharedFile("prompt-tool.ts"),
        readSharedFile("analytics-tool.ts"),
        readSharedFile("admin-intelligence-tool.ts"),
      ].join("\n");

      for (const toolName of expectedTools) {
        expect(
          allSources.includes(`name: "${toolName}"`),
          `Tool schema "${toolName}" must exist in a domain module`,
        ).toBe(true);
      }

      expect(expectedTools).toHaveLength(25);
    });
  });
});
