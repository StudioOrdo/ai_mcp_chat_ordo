import { describe, expect, it, vi } from "vitest";

import {
  createGenerateBlogImageTool,
  executeGenerateBlogImage,
  parseGenerateBlogImageInput,
  resolveBlogImageStrategy,
} from "@/core/use-cases/tools/blog-image.tool";

describe("generate_blog_image tool", () => {
  it("validates payloads and passes defaults into the service", async () => {
    const service = {
      generate: vi.fn().mockResolvedValue({
        assetId: "asset_1",
        postId: "post_1",
        postSlug: "hero-post",
        title: "Hero Post",
        heroImageAssetId: "asset_1",
        visibility: "draft",
        imageUrl: "/api/blog/assets/asset_1",
        mimeType: "image/png",
        width: 1536,
        height: 1024,
        originalPrompt: "Prompt",
        finalPrompt: "Prompt",
        summary: "Generated hero image.",
      }),
    };

    const result = await executeGenerateBlogImage(
      service as never,
      parseGenerateBlogImageInput({
        post_id: "post_1",
        prompt: "Prompt",
        alt_text: "Hero alt text",
      }),
      { userId: "usr_admin", role: "ADMIN", conversationId: "conv_1" },
    );

    expect(service.generate).toHaveBeenCalledWith({
      postId: "post_1",
      prompt: "Prompt. Non-graphic, non-sexual, non-violent, no gore, no exposed anatomy.",
      altText: "Hero alt text",
      preset: undefined,
      size: "1024x1024",
      quality: "high",
      enhancePrompt: true,
      setAsHero: true,
      variationGroupId: null,
      createdByUserId: "usr_admin",
    });
    expect(result.assetId).toBe("asset_1");
  });

  it("uses portrait heuristics for person-centric prompts when size is omitted", async () => {
    const service = {
      generate: vi.fn().mockResolvedValue({
        assetId: "asset_heuristic",
        postId: null,
        postSlug: null,
        title: null,
        heroImageAssetId: "asset_heuristic",
        visibility: "draft",
        imageUrl: "/api/blog/assets/asset_heuristic",
        mimeType: "image/png",
        width: 1024,
        height: 1536,
        originalPrompt: "Portrait of a founder in a consulting office",
        finalPrompt: "Portrait of a founder in a consulting office",
        summary: "Generated hero image.",
      }),
    };

    await executeGenerateBlogImage(
      service as never,
      parseGenerateBlogImageInput({
        prompt: "Portrait of a founder in a consulting office",
        alt_text: "Founder portrait",
      }),
      { userId: "usr_admin", role: "ADMIN", conversationId: "conv_1" },
    );

    expect(service.generate).toHaveBeenCalledWith(expect.objectContaining({
      size: "1024x1536",
      quality: "high",
    }));
  });

  it("supports candidate generation without replacing the canonical hero image", async () => {
    const service = {
      generate: vi.fn().mockResolvedValue({
        assetId: "asset_candidate",
        postId: "post_1",
        postSlug: "hero-post",
        title: "Hero Post",
        heroImageAssetId: "asset_current",
        visibility: "draft",
        imageUrl: "/api/blog/assets/asset_candidate",
        mimeType: "image/png",
        width: 1536,
        height: 1024,
        originalPrompt: "Prompt",
        finalPrompt: "Prompt",
        selectionState: "candidate",
        variationGroupId: "group_1",
        summary: "Generated candidate hero image.",
      }),
    };

    await executeGenerateBlogImage(
      service as never,
      parseGenerateBlogImageInput({
        post_id: "post_1",
        prompt: "Prompt",
        alt_text: "Hero alt text",
        set_as_hero: false,
        variation_group_id: "group_1",
      }),
      { userId: "usr_admin", role: "ADMIN", conversationId: "conv_1" },
    );

    expect(service.generate).toHaveBeenCalledWith(expect.objectContaining({
      setAsHero: false,
      variationGroupId: "group_1",
    }));
  });

  it("applies explicit presets when size is omitted", () => {
    expect(resolveBlogImageStrategy({
      prompt: "A consulting team in a workspace",
      preset: "landscape",
    })).toEqual({
      size: "1536x1024",
      quality: "high",
    });

    expect(resolveBlogImageStrategy({
      prompt: "A consultant profile image",
      preset: "square",
    })).toEqual({
      size: "1024x1024",
      quality: "high",
    });
  });

  it("parses a valid preset", () => {
    expect(parseGenerateBlogImageInput({
      prompt: "Prompt",
      alt_text: "Alt text",
      preset: "artistic",
    })).toMatchObject({
      preset: "artistic",
    });
  });

  it("rejects invalid size values", () => {
    expect(() => parseGenerateBlogImageInput({
      prompt: "Prompt",
      alt_text: "Alt text",
      size: "100x100",
    })).toThrow(/invalid size/i);
  });

  it("rejects invalid preset values", () => {
    expect(() => parseGenerateBlogImageInput({
      prompt: "Prompt",
      alt_text: "Alt text",
      preset: "cinematic",
    })).toThrow(/invalid preset/i);
  });

  it("rejects invalid quality values", () => {
    expect(() => parseGenerateBlogImageInput({
      prompt: "Prompt",
      alt_text: "Alt text",
      quality: "ultra",
    })).toThrow(/invalid quality/i);
  });

  it("describes an ADMIN deferred tool", () => {
    const tool = createGenerateBlogImageTool({ generate: vi.fn() } as never);

    expect(tool.name).toBe("generate_blog_image");
    expect(tool.roles).toEqual(["ADMIN"]);
    expect(tool.executionMode).toBe("deferred");
    expect(tool.deferred).toMatchObject({
      dedupeStrategy: "per-conversation-payload",
      retryable: true,
    });
  });
});
