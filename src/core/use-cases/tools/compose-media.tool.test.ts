import { describe, expect, it } from "vitest";
import { parseComposeMediaInput, composeMediaTool } from "./compose-media.tool";

describe("composeMediaTool descriptor", () => {
  it("has the correct name and runs inline for browser-first hybrid execution", () => {
    expect(composeMediaTool.name).toBe("compose_media");
    expect(composeMediaTool.executionMode).toBeUndefined();
  });

  it("has a valid Anthropic schema with description and input_schema", () => {
    expect(typeof composeMediaTool.schema.description).toBe("string");
    expect(composeMediaTool.schema.description.length).toBeGreaterThan(10);
    expect(composeMediaTool.schema.input_schema).toMatchObject({
      type: "object",
      required: ["plan"],
    });
  });

  it("has a command that can be invoked", () => {
    expect(typeof composeMediaTool.command.execute).toBe("function");
  });

  it("has roles that include AUTHENTICATED", () => {
    expect(composeMediaTool.roles).not.toBe("ALL");
    expect(Array.isArray(composeMediaTool.roles)).toBe(true);
    expect(composeMediaTool.roles).toContain("AUTHENTICATED");
    expect(composeMediaTool.roles).toContain("ADMIN");
  });

  it("has a category", () => {
    expect(composeMediaTool.category).toBe("content");
  });

  it("does not carry deferred config since execution is browser-first", () => {
    expect(composeMediaTool.deferred).toBeUndefined();
  });
});

describe("parseComposeMediaInput", () => {
  it("parses a valid compose_media input", () => {
    const input = {
      plan: {
        id: "p-parse-1",
        conversationId: "conv-1",
        visualClips: [{ assetId: "asset_v1", kind: "video" }],
        audioClips: [],
        subtitlePolicy: "none",
      },
    };
    const result = parseComposeMediaInput(input);
    expect(result.plan.id).toBe("p-parse-1");
    expect(result.plan.visualClips[0].assetId).toBe("asset_v1");
  });

  it("throws when clip assetIds are prompt-like instead of stored IDs", () => {
    const input = {
      plan: {
        id: "p-bad-asset",
        conversationId: "conv-1",
        visualClips: [{ assetId: "generate:a plate of cheese", kind: "image" }],
        audioClips: [{ assetId: "uf_audio_1", kind: "audio" }],
        subtitlePolicy: "none",
      },
    };

    expect(() => parseComposeMediaInput(input)).toThrow(/Invalid visual clip assetId/);
  });

  it("throws on invalid input missing the plan field", () => {
    expect(() => parseComposeMediaInput({})).toThrow();
  });

  it("throws on a plan with empty clips and invalid subtitle policy", () => {
    const input = {
      plan: {
        id: "p-bad",
        conversationId: "conv-1",
        visualClips: [],
        audioClips: [],
        subtitlePolicy: "invalid",
      },
    };
    expect(() => parseComposeMediaInput(input)).toThrow();
  });
});

describe("ComposeMediaCommand.execute", () => {
  it("returns the plan shape with action and generationStatus fields", async () => {
    const input = {
      plan: {
        id: "p-exec-1",
        conversationId: "conv-1",
        visualClips: [{ assetId: "asset_v1", kind: "video" as const }],
        audioClips: [],
        subtitlePolicy: "none" as const,
        waveformPolicy: "none" as const,
        outputFormat: "mp4" as const,
      },
    };
    const result = await composeMediaTool.command.execute(input) as Record<string, unknown>;
    expect(result.action).toBe("compose_media");
    expect(result.planId).toBe("p-exec-1");
    expect(result.generationStatus).toBe("client_fetch_pending");
  });
});
