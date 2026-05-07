import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";

import { getRequestScopedToolSelection } from "./tool-capability-routing";

function createTool(name: string): Anthropic.Tool {
  return {
    name,
    description: "",
    input_schema: { type: "object", properties: {} },
  };
}

function createRegistry(tools: Anthropic.Tool[]): ToolRegistry {
  return {
    getSchemasForRole: () => tools,
    getPromptVisibleSchemasForRole: () => tools,
  } as unknown as ToolRegistry;
}

describe("tool prefilter", () => {
  it("keeps required organization-lane admin tools while removing unrelated ones", () => {
    const selection = getRequestScopedToolSelection(
      createRegistry([
        createTool("admin_search"),
        createTool("generate_audio"),
        createTool("navigate_to_page"),
        createTool("search_corpus"),
      ]),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.95 }),
    );

    expect(selection.prefiltered).toBe(true);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "admin_search",
      "navigate_to_page",
      "search_corpus",
    ]);
  });

  it("does not prefilter ambiguous routing", () => {
    const selection = getRequestScopedToolSelection(
      createRegistry([
        createTool("admin_search"),
        createTool("generate_audio"),
      ]),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "uncertain", confidence: 0.95 }),
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "admin_search",
      "generate_audio",
    ]);
  });

  it("falls back to the full manifest if filtering would remove every tool", () => {
    const selection = getRequestScopedToolSelection(
      createRegistry([
        createTool("generate_audio"),
      ]),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.95 }),
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual(["generate_audio"]);
  });

  it("does not prefilter low-confidence admin turns", () => {
    const selection = getRequestScopedToolSelection(
      createRegistry([
        createTool("admin_search"),
        createTool("generate_audio"),
      ]),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.45 }),
    );

    expect(selection.prefiltered).toBe(false);
  });
});
