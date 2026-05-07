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

function createPromptAwareRegistry(tools: Anthropic.Tool[]): ToolRegistry {
  return {
    getSchemasForRole: () => tools,
    getPromptVisibleSchemasForRole: () =>
      tools.filter((tool) => ![
        "get_current_page",
        "inspect_runtime_context",
        "list_available_pages",
        "navigate_to_page",
      ].includes(tool.name)),
  } as unknown as ToolRegistry;
}

describe("getRequestScopedToolSelection", () => {
  it("keeps the full manifest for non-admin roles", () => {
    const tools = [
      createTool("navigate_to_page"),
      createTool("search_corpus"),
      createTool("generate_audio"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "AUTHENTICATED",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.95 }),
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "navigate_to_page",
      "search_corpus",
      "generate_audio",
    ]);
    expect(selection.allowedToolNames).toEqual([
      "navigate_to_page",
      "search_corpus",
      "generate_audio",
    ]);
  });

  it("uses the prompt-visible projection for non-admin chat turns", () => {
    const selection = getRequestScopedToolSelection(
      createPromptAwareRegistry([
        createTool("inspect_runtime_context"),
        createTool("navigate_to_page"),
        createTool("search_corpus"),
      ]),
      "AUTHENTICATED",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.95 }),
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual(["search_corpus"]);
    expect(selection.allowedToolNames).toEqual(["search_corpus"]);
  });

  it("removes operation-backed backup and restore tools from normal chat exposure", () => {
    const selection = getRequestScopedToolSelection(
      createRegistry([
        createTool("create_appliance_backup"),
        createTool("list_appliance_backups"),
        createTool("execute_appliance_restore"),
        createTool("search_corpus"),
      ]),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.95 }),
    );

    expect(selection.tools.map((tool) => tool.name)).toEqual(["search_corpus"]);
    expect(selection.allowedToolNames).toEqual(["search_corpus"]);
  });

  it("narrows high-confidence admin organization turns to the scoped allowlist", () => {
    const tools = [
      createTool("navigate_to_page"),
      createTool("search_corpus"),
      createTool("admin_search"),
      createTool("list_deferred_jobs"),
      createTool("generate_audio"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.95 }),
    );

    expect(selection.prefiltered).toBe(true);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "navigate_to_page",
      "search_corpus",
      "admin_search",
      "list_deferred_jobs",
    ]);
    expect(selection.allowedToolNames).toEqual([
      "navigate_to_page",
      "search_corpus",
      "admin_search",
      "list_deferred_jobs",
    ]);
  });

  it("does not prefilter low-confidence admin turns", () => {
    const tools = [
      createTool("navigate_to_page"),
      createTool("search_corpus"),
      createTool("generate_audio"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "organization", confidence: 0.45 }),
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "navigate_to_page",
      "search_corpus",
      "generate_audio",
    ]);
  });

  it("prefers compose_media for video intent by removing blog image tools", () => {
    const tools = [
      createTool("compose_media"),
      createTool("generate_blog_image"),
      createTool("generate_blog_image_prompt"),
      createTool("search_corpus"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "uncertain", confidence: 0.35 }),
      "can you make a short video from this?",
    );

    expect(selection.prefiltered).toBe(true);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "compose_media",
      "search_corpus",
    ]);
    expect(selection.allowedToolNames).toEqual([
      "compose_media",
      "search_corpus",
    ]);
  });

  it("does not remove image tools when image intent is explicit", () => {
    const tools = [
      createTool("compose_media"),
      createTool("generate_blog_image"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "uncertain", confidence: 0.4 }),
      "make a video and also generate a hero image",
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "compose_media",
      "generate_blog_image",
    ]);
  });

  it("keeps conversation media discovery available in the admin development lane", () => {
    const tools = [
      createTool("navigate_to_page"),
      createTool("search_corpus"),
      createTool("generate_audio"),
      createTool("generate_chart"),
      createTool("list_conversation_media_assets"),
      createTool("compose_media"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "development", confidence: 0.95 }),
      "combine the chart and audio into a video",
    );

    expect(selection.prefiltered).toBe(false);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "navigate_to_page",
      "search_corpus",
      "generate_audio",
      "generate_chart",
      "list_conversation_media_assets",
      "compose_media",
    ]);
  });

  it("filters fresh media generators when reuse-ready audio and visuals already exist", () => {
    const tools = [
      createTool("generate_audio"),
      createTool("generate_chart"),
      createTool("generate_graph"),
      createTool("list_conversation_media_assets"),
      createTool("compose_media"),
    ];

    const selection = getRequestScopedToolSelection(
      createRegistry(tools),
      "ADMIN",
      createConversationRoutingSnapshot({ lane: "uncertain", confidence: 0.35 }),
      "combine the chart and narration into a video",
      {
        assets: [
          { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
          { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
        ],
      },
    );

    expect(selection.prefiltered).toBe(true);
    expect(selection.tools.map((tool) => tool.name)).toEqual([
      "list_conversation_media_assets",
      "compose_media",
    ]);
  });
});
