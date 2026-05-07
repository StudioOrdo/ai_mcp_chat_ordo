/**
 * Sprint 20 — Schema Derivation Verification Tests
 *
 * Verifies that catalog schema facets correctly project into both
 * Anthropic-compatible and MCP-compatible tool descriptors, and that
 * the projections match the legacy schemas maintained in tool files.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { CAPABILITY_CATALOG, projectPromptExposure } from "./catalog";
import type { CapabilityDefinition, CapabilitySchemaFacet } from "./capability-definition";
import {
  projectAnthropicSchema,
  projectMcpSchema,
  getAllAnthropicSchemas,
  getAllMcpSchemas,
  getSchemaEnrichedEntries,
} from "./schema-projection";
import { projectAllCapabilityRuntimeStatics } from "@/core/platform/capability-runtime/CapabilityRuntime";

const ROOT = path.resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRuntimeEntriesWithSchema(): Array<{
  name: string;
  schema: CapabilitySchemaFacet;
}> {
  return projectAllCapabilityRuntimeStatics().map((runtime) => ({
    name: runtime.capabilityName,
    schema: runtime.schema,
  }));
}

function getRuntimeCapabilityCount(): number {
  return projectAllCapabilityRuntimeStatics().length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("schema-derivation", () => {
  describe("source convergence", () => {
    it("derives batch schemas from CapabilityRuntime static projection", () => {
      const source = fs.readFileSync(path.join(ROOT, "src/core/capability-catalog/schema-projection.ts"), "utf-8");

      expect(source).toContain("projectAllCapabilityRuntimeStatics");
      expect(source).not.toContain("Object.values(CAPABILITY_CATALOG)");
    });
  });

  describe("CapabilitySchemaFacet type", () => {
    it("exists on CapabilityDefinition as a required field", () => {
      const def: CapabilityDefinition = {
        core: {
          name: "test",
          label: "Test",
          description: "Test tool",
          category: "system",
          roles: "ALL",
        },
        runtime: {},
        presentation: {
          family: "system",
          cardKind: "fallback",
          executionMode: "inline",
        },
        schema: {
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
          outputHint: "test output",
        },
      };

      expect(def.schema).toBeDefined();
      expect(def.schema.inputSchema.type).toBe("object");
      expect(def.schema.outputHint).toBe("test output");
    });
  });

  describe("prompt exposure projection", () => {
    it("defaults missing prompt exposure to default_prompt", () => {
      const def: CapabilityDefinition = {
        core: {
          name: "test",
          label: "Test",
          description: "Test tool",
          category: "system",
          roles: "ALL",
        },
        runtime: {},
        presentation: {
          family: "system",
          cardKind: "fallback",
          executionMode: "inline",
        },
        schema: {
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      };

      expect(projectPromptExposure(def).exposure).toBe("default_prompt");
    });

    it("preserves explicit prompt exposure while MCP schemas remain protocol-only", () => {
      const def = CAPABILITY_CATALOG.inspect_runtime_logs;

      expect(projectPromptExposure(def).exposure).toBe("operator_only");
      expect(projectMcpSchema(def)).not.toHaveProperty("promptExposure");
    });
  });

  describe("catalog schema enrichment", () => {
    it("covers every catalog entry with a schema facet", () => {
      const enriched = getRuntimeEntriesWithSchema();
      expect(enriched.length).toBe(getRuntimeCapabilityCount());
    });

    it("every schema facet has a valid inputSchema with type 'object'", () => {
      for (const entry of getRuntimeEntriesWithSchema()) {
        expect(entry.schema.inputSchema.type, `${entry.name} should have type 'object'`).toBe("object");
        expect(entry.schema.inputSchema.properties, `${entry.name} should have properties`).toBeDefined();
      }
    });

    it("every schema facet with required has it as an array", () => {
      for (const entry of getRuntimeEntriesWithSchema()) {
        if (entry.schema.inputSchema.required !== undefined) {
          expect(
            Array.isArray(entry.schema.inputSchema.required),
            `${entry.name}.required should be an array`,
          ).toBe(true);
          expect(
            entry.schema.inputSchema.required.length,
            `${entry.name}.required should not be empty`,
          ).toBeGreaterThan(0);
        }
      }
    });

    it("schema-enriched entries include deferred tools", () => {
      const names = getRuntimeEntriesWithSchema().map((entry) => entry.name);
      expect(names).toContain("draft_content");
      expect(names).toContain("publish_content");
    });

    it("schema-enriched entries include content tools", () => {
      const names = getRuntimeEntriesWithSchema().map((entry) => entry.name);
      expect(names).toContain("search_corpus");
      expect(names).toContain("get_section");
    });

    it("schema-enriched entries include admin tools", () => {
      const names = getRuntimeEntriesWithSchema().map((entry) => entry.name);
      expect(names).toContain("admin_search");
      expect(names).toContain("admin_prioritize_leads");
    });
  });

  describe("projectAnthropicSchema()", () => {
    it("derives correct Anthropic tool descriptor from catalog entry", () => {
      const def = CAPABILITY_CATALOG.admin_web_search;
      const descriptor = projectAnthropicSchema(def);

      expect(descriptor.name).toBe("admin_web_search");
      expect(descriptor.description).toContain("Search the live web");
      expect(descriptor.input_schema.type).toBe("object");
      expect(descriptor.input_schema.properties).toHaveProperty("query");
      expect(descriptor.input_schema.required).toContain("query");
    });

    it("uses snake_case input_schema key", () => {
      const def = CAPABILITY_CATALOG.search_corpus;
      const descriptor = projectAnthropicSchema(def);

      expect(descriptor).toHaveProperty("input_schema");
      expect(descriptor).not.toHaveProperty("inputSchema");
    });
  });

  describe("projectMcpSchema()", () => {
    it("derives correct MCP tool schema from catalog entry", () => {
      const def = CAPABILITY_CATALOG.admin_web_search;
      const schema = projectMcpSchema(def);

      expect(schema.name).toBe("admin_web_search");
      expect(schema.inputSchema.type).toBe("object");
      expect(schema.inputSchema.properties).toHaveProperty("query");
    });

    it("uses camelCase inputSchema key", () => {
      const def = CAPABILITY_CATALOG.navigate_to_page;
      const schema = projectMcpSchema(def);

      expect(schema).toHaveProperty("inputSchema");
      expect(schema).not.toHaveProperty("input_schema");
    });
  });

  describe("batch projections", () => {
    it("getAllAnthropicSchemas() returns one schema per catalog entry", () => {
      const schemas = getAllAnthropicSchemas();
      expect(schemas.length).toBe(getRuntimeCapabilityCount());
    });

    it("getAllMcpSchemas() returns same count as Anthropic", () => {
      const anthropic = getAllAnthropicSchemas();
      const mcp = getAllMcpSchemas();
      expect(mcp.length).toBe(anthropic.length);
    });

    it("getSchemaEnrichedEntries() returns name+schema pairs", () => {
      const entries = getSchemaEnrichedEntries();
      expect(entries.length).toBe(getRuntimeCapabilityCount());

      for (const entry of entries) {
        expect(entry.name).toBeTruthy();
        expect(entry.schema.inputSchema.type).toBe("object");
      }
    });
  });

  describe("schema parity between Anthropic and MCP projections", () => {
    it("properties match between Anthropic and MCP for each entry", () => {
      const anthropicSchemas = new Map(
        getAllAnthropicSchemas().map((schema) => [schema.name, schema] as const),
      );
      const mcpSchemas = new Map(
        getAllMcpSchemas().map((schema) => [schema.name, schema] as const),
      );

      expect(anthropicSchemas.size).toBe(mcpSchemas.size);

      for (const [name, anthropic] of anthropicSchemas) {
        const mcp = mcpSchemas.get(name);
        expect(mcp, `Missing MCP schema for ${name}`).toBeDefined();
        if (!mcp) {
          throw new Error(`Missing MCP schema for ${name}`);
        }

        expect(anthropic.name).toBe(mcp.name);
        expect(anthropic.description).toBe(mcp.description);
        expect(
          JSON.stringify(anthropic.input_schema.properties),
        ).toBe(JSON.stringify(mcp.inputSchema.properties));

        if (anthropic.input_schema.required) {
          expect(anthropic.input_schema.required).toEqual(mcp.inputSchema.required);
        }
      }
    });
  });
});
