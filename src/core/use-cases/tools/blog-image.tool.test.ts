import { describe, expect, it, vi } from "vitest";

import {
  executeGenerateBlogImage,
  preflightBlogImagePrompt,
  type GenerateBlogImageInput,
} from "./blog-image.tool";

describe("preflightBlogImagePrompt", () => {
  it("rewrites graphic image prompts into provider-safer symbolic language", () => {
    const prompt = preflightBlogImagePrompt(
      "A visceral image representing desire for flesh with raw flesh, bone, skin and sinew.",
    );

    expect(prompt).toContain("desire for embodiment");
    expect(prompt).toContain("symbolic");
    expect(prompt).toContain("crimson organic forms");
    expect(prompt).toContain("ivory sculptural forms");
    expect(prompt).toContain("Non-graphic, non-sexual, non-violent");
    expect(prompt.toLowerCase()).not.toContain("raw flesh");
    expect(prompt.toLowerCase()).not.toContain("sinew");
  });
});

describe("executeGenerateBlogImage", () => {
  it("sends the preflighted prompt to the image generation service", async () => {
    const service = {
      generate: vi.fn().mockResolvedValue({ id: "blogasset_1" }),
    };
    const input: GenerateBlogImageInput = {
      prompt: "A visceral still life about desire for flesh and bone.",
      alt_text: "Symbolic still life",
    };

    await executeGenerateBlogImage(service as never, input, { userId: "usr_1", role: "ADMIN" });

    expect(service.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Non-graphic, non-sexual, non-violent"),
      altText: "Symbolic still life",
      createdByUserId: "usr_1",
    }));
    expect(service.generate.mock.calls[0]?.[0].prompt).not.toContain("flesh");
  });
});