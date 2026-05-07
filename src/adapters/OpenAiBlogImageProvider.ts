import type OpenAI from "openai";

import type {
  BlogImageGenerationRequest,
  BlogImageGenerationResult,
  BlogImageProvider,
} from "@/core/use-cases/BlogImageProvider";
import {
  classifyProviderError,
  emitProviderEvent,
  toErrorMessage,
} from "@/lib/chat/provider-policy";

function inferDimensions(size: BlogImageGenerationRequest["size"]): {
  width: number | null;
  height: number | null;
} {
  switch (size) {
    case "1024x1024":
      return { width: 1024, height: 1024 };
    case "1536x1024":
      return { width: 1536, height: 1024 };
    case "1024x1536":
      return { width: 1024, height: 1536 };
    case "auto":
      return { width: null, height: null };
  }
}

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string | null;
    revised_prompt?: string | null;
    mime_type?: string | null;
  }>;
};

// ── Prompt enhancement for gpt-image-1 ────────────────────────────────

const DESCRIPTIVE_WORDS = [
  "detailed", "realistic", "cinematic", "professional",
  "high-quality", "artistic", "beautiful", "stunning",
];

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; suffix: string }> = [
  {
    keywords: ["art", "painting", "drawing", "sketch", "illustration"],
    suffix: "masterpiece, fine art, beautiful composition, perfect lighting",
  },
  {
    keywords: ["photo", "photograph", "realistic", "portrait", "headshot"],
    suffix: "photorealistic, sharp focus, perfect lighting, cinematic",
  },
  {
    keywords: ["fantasy", "magical", "dragon", "wizard", "ethereal"],
    suffix: "fantasy art, magical atmosphere, dramatic lighting, ethereal",
  },
  {
    keywords: ["robot", "cyberpunk", "futuristic", "sci-fi", "technology"],
    suffix: "futuristic, sleek design, dynamic lighting, modern",
  },
  {
    keywords: ["editorial", "office", "workspace", "team", "boardroom", "campus", "conference"],
    suffix: "professional editorial photography, natural lighting, sharp focus, warm tones",
  },
];

function enhancePromptForGeneration(prompt: string): string {
  const lower = prompt.toLowerCase();
  const alreadyDetailed =
    prompt.length > 100 && DESCRIPTIVE_WORDS.some((w) => lower.includes(w));
  if (alreadyDetailed) return prompt;

  const qualityBase = "high quality, detailed, professional";

  for (const { keywords, suffix } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return `${prompt}, ${qualityBase}, ${suffix}`;
    }
  }

  return `${prompt}, ${qualityBase}, beautiful, well-composed`;
}

// ── Provider ───────────────────────────────────────────────────────────

export class OpenAiBlogImageProvider implements BlogImageProvider {
  constructor(
    private readonly openai: OpenAI,
    private readonly model = "gpt-image-1",
  ) {}

  async generate(
    request: BlogImageGenerationRequest,
  ): Promise<BlogImageGenerationResult> {
    const finalPrompt = request.enhancePrompt !== false
      ? enhancePromptForGeneration(request.prompt)
      : request.prompt;

    const startedAt = Date.now();
    emitProviderEvent({
      kind: "attempt_start",
      provider: "openai",
      surface: "image_generation",
      model: this.model,
      attempt: 1,
    });

    try {
      const response = await this.openai.images.generate({
        model: this.model,
        prompt: finalPrompt,
        size: request.size === "auto" ? undefined : request.size,
        quality: request.quality === "auto" ? undefined : request.quality,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any, {
        signal: request.abortSignal,
      }) as OpenAiImageResponse;

      const image = response.data?.[0];
      const b64 = image?.b64_json;

      if (!b64) {
        throw new Error("OpenAI image generation returned no image bytes.");
      }

      const dimensions = inferDimensions(request.size);
      const revisedPrompt = request.enhancePrompt !== false
        ? (image?.revised_prompt?.trim() || finalPrompt)
        : request.prompt;

      emitProviderEvent({
        kind: "attempt_success",
        provider: "openai",
        surface: "image_generation",
        model: this.model,
        attempt: 1,
        durationMs: Date.now() - startedAt,
      });

      return {
        bytes: Buffer.from(b64, "base64"),
        mimeType: image?.mime_type?.trim() || "image/png",
        width: dimensions.width,
        height: dimensions.height,
        originalPrompt: request.prompt,
        finalPrompt: revisedPrompt,
        provider: "openai",
        model: this.model,
      };
    } catch (error) {
      emitProviderEvent({
        kind: "attempt_failure",
        provider: "openai",
        surface: "image_generation",
        model: this.model,
        attempt: 1,
        durationMs: Date.now() - startedAt,
        error: toErrorMessage(error),
        errorClassification: classifyProviderError(error),
      });
      throw error;
    }
  }
}
