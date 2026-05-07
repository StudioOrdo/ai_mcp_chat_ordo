import { describe, expect, it } from "vitest";
import { SystemPromptBuilder } from "@/core/use-cases/SystemPromptBuilder";
import { ROLE_DIRECTIVES } from "@/core/entities/role-directives";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { RoleName } from "@/core/entities/user";
import type { UserPreference } from "@/core/ports/UserPreferencesRepository";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import { buildCorpusBasePrompt } from "@/lib/corpus-vocabulary";
import { EXPECTED_ROLE_TOOL_SETS } from "./helpers/role-tool-sets";

const TOOL_MANIFEST_HEADER = "TOOLS AVAILABLE TO YOU:";
const MANIFEST_FOOTER = "When the user asks what you can do, list these tools by name with a one-line description of each.";
const SUMMARY_HEADER = "[Server summary of earlier conversation]";
const ROUTING_HEADER = "[Server routing metadata]";
const USER_PREFERENCES_HEADER = "[Server user preferences]";

function extractManifestToolNames(prompt: string): string[] {
  const match = prompt.match(/TOOLS AVAILABLE TO YOU:([\s\S]*?)(?:\n\n|\nWhen the user asks)/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/\*\*([a-z_]+)\*\*/g)).map((m) => m[1]);
}

function extractIdentitySection(prompt: string): string {
  const manifestIndex = prompt.indexOf(TOOL_MANIFEST_HEADER);
  if (manifestIndex === -1) {
    return prompt;
  }

  return prompt.slice(0, manifestIndex);
}

function buildPrompt(role: RoleName): string {
  const tools = getToolComposition().registry.getSchemasForRole(role);
  const snapshot = createConversationRoutingSnapshot({
    lane: "development",
    confidence: 0.84,
    detectedNeedSummary: "Technical implementation request",
  });
  const prefs: UserPreference[] = [
    { key: "response_style", value: "bullets", updatedAt: "2026-03-24T12:00:00.000Z" },
    { key: "tone", value: "professional", updatedAt: "2026-03-24T12:00:01.000Z" },
  ];

  return new SystemPromptBuilder()
    .withSection({ key: "identity", content: buildCorpusBasePrompt(), priority: 10 })
    .withToolManifest(tools.map((tool) => ({ name: tool.name, description: tool.description ?? "" })))
    .withSection({ key: "role_directive", content: ROLE_DIRECTIVES[role], priority: 20 })
    .withUserPreferences(prefs)
    .withConversationSummary("User previously asked about implementation sequencing.")
    .withRoutingContext(snapshot)
    .build();
}

function buildPromptWithManifestEntries(entries: Array<{ name: string; description: string }>): string {
  return new SystemPromptBuilder()
    .withSection({ key: "identity", content: buildCorpusBasePrompt(), priority: 10 })
    .withToolManifest(entries)
    .withSection({ key: "role_directive", content: ROLE_DIRECTIVES.ADMIN, priority: 20 })
    .build();
}

function getRoleToolDescription(role: RoleName, toolName: string): string {
  const tool = getToolComposition().registry.getSchemasForRole(role).find((schema) => schema.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found for role ${role}`);
  }

  return tool.description ?? "";
}

describe("system prompt assembly", () => {
  it("keeps the AUTHENTICATED prompt byte-stable across repeated assembly", () => {
    expect(buildPrompt("AUTHENTICATED")).toBe(buildPrompt("AUTHENTICATED"));
  });

  it("orders sections as identity, tool manifest, role directive, user preferences, summary, then routing", () => {
    const prompt = buildPrompt("AUTHENTICATED");

    const identityIndex = prompt.indexOf("You are Studio Ordo");
    const manifestIndex = prompt.indexOf(TOOL_MANIFEST_HEADER);
    const directiveIndex = prompt.indexOf("ROLE CONTEXT — REGISTERED USER:");
    const preferencesIndex = prompt.indexOf(USER_PREFERENCES_HEADER);
    const summaryIndex = prompt.indexOf(SUMMARY_HEADER);
    const routingIndex = prompt.indexOf(ROUTING_HEADER);

    expect(identityIndex).toBeGreaterThan(-1);
    expect(manifestIndex).toBeGreaterThan(identityIndex);
    expect(directiveIndex).toBeGreaterThan(manifestIndex);
    expect(preferencesIndex).toBeGreaterThan(directiveIndex);
    expect(summaryIndex).toBeGreaterThan(preferencesIndex);
    expect(routingIndex).toBeGreaterThan(summaryIndex);
  });

  it("contains exactly one tool manifest block", () => {
    const prompt = buildPrompt("AUTHENTICATED");

    expect(prompt.split(TOOL_MANIFEST_HEADER)).toHaveLength(2);
    expect(prompt.split(MANIFEST_FOOTER)).toHaveLength(2);
  });

  it("renders the AUTHENTICATED manifest in alphabetical order", () => {
    const manifestNames = extractManifestToolNames(buildPrompt("AUTHENTICATED"));

    expect(manifestNames).toEqual([...manifestNames].sort((left, right) => left.localeCompare(right)));
  });

  it("renders the ADMIN manifest in alphabetical order", () => {
    const manifestNames = extractManifestToolNames(buildPrompt("ADMIN"));

    expect(manifestNames).toEqual([...manifestNames].sort((left, right) => left.localeCompare(right)));
  });

  it("ANONYMOUS assembled prompt contains exactly the anonymous tool set", () => {
    const prompt = buildPrompt("ANONYMOUS");

    expect(extractManifestToolNames(prompt).sort()).toEqual(EXPECTED_ROLE_TOOL_SETS.ANONYMOUS);
  });

  it("ADMIN assembled prompt contains exactly the admin tool set including configured admin-only tools", () => {
    const prompt = buildPrompt("ADMIN");

    expect(extractManifestToolNames(prompt).sort()).toEqual(EXPECTED_ROLE_TOOL_SETS.ADMIN);
    expect(prompt).toContain("**draft_content**");
    expect(prompt).toContain("**publish_content**");
  });

  it("APPRENTICE assembled prompt includes the full member tool subset expected by the role", () => {
    const prompt = buildPrompt("APPRENTICE");
    const manifestNames = extractManifestToolNames(prompt);

    expect(manifestNames.slice().sort()).toEqual(EXPECTED_ROLE_TOOL_SETS.APPRENTICE);
    expect(manifestNames).toEqual(expect.arrayContaining([
      "search_my_conversations",
      "generate_chart",
      "generate_graph",
      "get_section",
      "get_checklist",
      "list_practitioners",
      "set_preference",
    ]));
  });

  it("includes graph usage guidance in the assembled manifest for member roles", () => {
    const prompt = buildPrompt("AUTHENTICATED");
    const generateGraphDescription = getRoleToolDescription("AUTHENTICATED", "generate_graph");

    expect(generateGraphDescription.length).toBeGreaterThan(0);
    expect(prompt).toContain(`**generate_graph**: ${generateGraphDescription}`);
  });

  it("identity section does not leak raw tool names outside the manifest block", () => {
    const prompt = buildPrompt("ADMIN");
    const identitySection = extractIdentitySection(prompt);
    const toolNames = getToolComposition().registry.getToolNames();

    for (const toolName of toolNames) {
      expect(identitySection).not.toContain(`**${toolName}**`);
      expect(identitySection).not.toContain(`\`${toolName}\``);
      expect(identitySection).not.toMatch(new RegExp(`\\b${toolName}\\b`));
    }
  });

  it("assembles a reduced admin manifest without breaking manifest structure or ordering", () => {
    const prompt = buildPromptWithManifestEntries([
      { name: "admin_search", description: "" },
      { name: "navigate_to_page", description: "" },
      { name: "search_corpus", description: "" },
    ]);

    expect(extractManifestToolNames(prompt)).toEqual([
      "admin_search",
      "navigate_to_page",
      "search_corpus",
    ]);
    expect(prompt.split(TOOL_MANIFEST_HEADER)).toHaveLength(2);
    expect(prompt).not.toContain("**generate_audio**");
  });
});
