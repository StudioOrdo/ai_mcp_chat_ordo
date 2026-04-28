/**
 * Tool Manifest Contract
 *
 * Enforces three guarantees:
 *
 * 1. DYNAMIC MANIFEST — The system prompt for each role is derived entirely
 *    from ToolRegistry.getSchemasForRole(). No static list. Adding a new tool
 *    to the registry automatically flows through to the prompt.
 *
 * 2. NO GHOST TOOLS IN MANIFEST — Every tool name in the built prompt is one
 *    the role can actually execute. Claude will never be told about a tool it
 *    cannot call.
 *
 * 3. NO GHOST TOOLS IN ROLE DIRECTIVES — Every backtick-quoted tool name
 *    mentioned in a role directive falls within that role's allowed tool set.
 *    If a tool is renamed or removed, these tests will catch the stale reference.
 *
 * When you add a new tool:
 *   - Add it to tool-composition-root.ts with the correct `roles` assignment.
 *   - Update the expected sets in core-policy.test.ts (AUTHENTICATED, STAFF, ADMIN).
 *   - These contract tests continue to pass automatically.
 *
 * When you rename a tool:
 *   - Update the tool file and the registry.
 *   - If the old name appears in role-directives.ts, test 3 will catch it.
 */

import { describe, expect, it } from "vitest";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import { SystemPromptBuilder } from "@/core/use-cases/SystemPromptBuilder";
import { ROLE_DIRECTIVES } from "@/core/entities/role-directives";
import type { RoleName } from "@/core/entities/user";

const ROLES: RoleName[] = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Extract all tool names mentioned in the TOOLS AVAILABLE TO YOU block
 * of a built system prompt.
 */
function extractManifestToolNames(prompt: string): string[] {
  const match = prompt.match(/TOOLS AVAILABLE TO YOU:([\s\S]*?)(?:\n\n|\nWhen the user asks)/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/\*\*([a-z_]+)\*\*/g)).map((m) => m[1]);
}

function extractManifestBlock(prompt: string): string {
  const match = prompt.match(/\nTOOLS AVAILABLE TO YOU:[\s\S]*?When the user asks what you can do, list these tools by name with a one-line description of each\./);
  return match?.[0] ?? "";
}

/**
 * Extract all backtick-quoted identifiers (potential tool names) from a string.
 */
function extractBacktickNames(text: string): string[] {
  return Array.from(text.matchAll(/`([a-z_]+)`/g)).map((m) => m[1]);
}

// ── Contract 1 & 2 — Manifest is dynamic and contains only allowed tools ──

describe("Tool manifest contract — dynamic parity with registry", () => {
  const registry = getToolComposition().registry;

  for (const role of ROLES) {
    it(`${role}: manifest contains exactly the tools getSchemasForRole returns`, () => {
      const schemas = registry.getSchemasForRole(role);
      const registryNames = schemas.map((s) => s.name).sort();

      const builder = new SystemPromptBuilder();
      builder.withToolManifest(schemas.map((s) => ({ name: s.name, description: s.description ?? "" })));
      const prompt = builder.build();

      const manifestNames = extractManifestToolNames(prompt).sort();

      expect(manifestNames).toEqual(registryNames);
    });

    it(`${role}: manifest contains no tools the role cannot execute`, () => {
      const schemas = registry.getSchemasForRole(role);
      const builder = new SystemPromptBuilder();
      builder.withToolManifest(schemas.map((s) => ({ name: s.name, description: s.description ?? "" })));
      const prompt = builder.build();

      const manifestNames = extractManifestToolNames(prompt);
      for (const name of manifestNames) {
        expect(
          registry.canExecute(name, role),
          `Tool "${name}" is in the ${role} manifest but cannot be executed by that role`,
        ).toBe(true);
      }
    });
  }
});

describe("Tool manifest contract — manifest formatting", () => {
  const registry = getToolComposition().registry;

  it("starts with a blank line followed by the TOOLS AVAILABLE TO YOU header", () => {
    const schemas = registry.getSchemasForRole("AUTHENTICATED");
    const prompt = new SystemPromptBuilder()
      .withToolManifest(schemas.map((s) => ({ name: s.name, description: s.description ?? "" })))
      .build();

    expect(prompt.startsWith("\nTOOLS AVAILABLE TO YOU:\n")).toBe(true);
  });

  it("renders each tool as a markdown bullet with name and description", () => {
    const prompt = new SystemPromptBuilder()
      .withToolManifest([
        { name: "calculator", description: "Performs arithmetic." },
        { name: "search_corpus", description: "Searches the corpus." },
      ])
      .build();

    expect(prompt).toContain("- **calculator**: Performs arithmetic.");
    expect(prompt).toContain("- **search_corpus**: Searches the corpus.");
  });

  it("preserves graph tool guidance in the manifest description", () => {
    const registry = getToolComposition().registry;
    const graphTool = registry.getSchemasForRole("AUTHENTICATED").find((schema) => schema.name === "generate_graph");

    expect(graphTool?.description).toContain("time-series");
    expect(graphTool?.description).toContain("comparisons");
    expect(graphTool?.description).toContain("trend visualizations");
  });

  it("ends with the user-facing capability instruction", () => {
    const schemas = registry.getSchemasForRole("ANONYMOUS");
    const prompt = new SystemPromptBuilder()
      .withToolManifest(schemas.map((s) => ({ name: s.name, description: s.description ?? "" })))
      .build();

    expect(prompt.endsWith("When the user asks what you can do, list these tools by name with a one-line description of each.")).toBe(true);
  });

  it("preserves registry order instead of re-sorting tool names", () => {
    const schemas = registry.getSchemasForRole("ADMIN");
    const registryNames = schemas.map((s) => s.name);
    const prompt = new SystemPromptBuilder()
      .withToolManifest(schemas.map((s) => ({ name: s.name, description: s.description ?? "" })))
      .build();

    expect(extractManifestToolNames(prompt)).toEqual(registryNames);
  });

  it("does not inject a manifest section for an empty schema array", () => {
    const prompt = new SystemPromptBuilder().withToolManifest([]).build();

    expect(prompt).toBe("");
    expect(extractManifestBlock(prompt)).toBe("");
  });
});

// ── Contract 3 — Role directives only reference real, allowed tools ────────

describe("Tool manifest contract — role directives are free of ghost tool names", () => {
  const registry = getToolComposition().registry;
  const allToolNames = new Set(registry.getToolNames());

  for (const role of ROLES) {
    const directive = ROLE_DIRECTIVES[role];
    if (!directive) continue;

    const referencedNames = extractBacktickNames(directive);
    if (referencedNames.length === 0) continue;

    it(`${role} directive only references tools that exist in the registry`, () => {
      for (const name of referencedNames) {
        expect(
          allToolNames.has(name),
          `Role directive for ${role} references \`${name}\` but no such tool is registered`,
        ).toBe(true);
      }
    });

    it(`${role} directive only references tools the role can execute`, () => {
      for (const name of referencedNames) {
        if (!allToolNames.has(name)) continue; // caught by previous test
        expect(
          registry.canExecute(name, role),
          `Role directive for ${role} references \`${name}\` but that tool is not allowed for ${role}`,
        ).toBe(true);
      }
    });
  }
});
