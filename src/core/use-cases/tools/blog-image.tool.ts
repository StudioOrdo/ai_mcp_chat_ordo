import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type {
  BlogImagePreset,
  BlogImageQuality,
  BlogImageSize,
} from "@/core/use-cases/BlogImageProvider";
import type { BlogImageGenerationService } from "@/lib/blog/blog-image-generation-service";

const VALID_SIZES: readonly BlogImageSize[] = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "auto",
];
const VALID_QUALITIES: readonly BlogImageQuality[] = [
  "low",
  "medium",
  "high",
  "auto",
];
const VALID_PRESETS: readonly BlogImagePreset[] = [
  "portrait",
  "landscape",
  "square",
  "hd",
  "artistic",
];

const PORTRAIT_PROMPT_PATTERN = /\b(portrait|headshot|founder|ceo|executive|leader|person|people|woman|man|individual|speaker|consultant)\b/i;
const LANDSCAPE_PROMPT_PATTERN = /\b(editorial|office|workspace|team|boardroom|campus|skyline|interior|exterior|scene|lobby|conference|landscape)\b/i;
const GRAPHIC_IMAGE_PROMPT_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bdesire for flesh\b/gi, "desire for embodiment"],
  [/\braw\s+organic\s+matter\b/gi, "abstract organic forms"],
  [/\braw\s+human\s+longing\b/gi, "human longing"],
  [/\braw\s+flesh\b/gi, "crimson organic forms"],
  [/\bflesh\b/gi, "the physical world"],
  [/\bbone(s)?\b/gi, "ivory sculptural forms"],
  [/\bskin\b/gi, "warm natural texture"],
  [/\bsinew\b/gi, "flowing fiber"],
  [/\bvisceral\b/gi, "symbolic"],
  [/\bprimal\s+hunger\b/gi, "primal longing"],
];

const IMAGE_SAFETY_SUFFIX = "Non-graphic, non-sexual, non-violent, no gore, no exposed anatomy.";

export interface GenerateBlogImageInput {
  post_id?: string;
  prompt: string;
  alt_text: string;
  preset?: BlogImagePreset;
  size?: BlogImageSize;
  quality?: BlogImageQuality;
  enhance_prompt?: boolean;
  set_as_hero?: boolean;
  variation_group_id?: string;
}

export type GenerateBlogImageOutput = Awaited<
  ReturnType<BlogImageGenerationService["generate"]>
>;

export interface ResolvedBlogImageStrategy {
  size: BlogImageSize;
  quality: BlogImageQuality;
}

function validateEnum<T extends string>(
  value: unknown,
  validValues: readonly T[],
  label: string,
): T | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string" || !validValues.includes(value as T)) {
    throw new Error(`Invalid ${label}. Expected one of: ${validValues.join(", ")}.`);
  }

  return value as T;
}

const DETAIL_KEYWORDS = /\b(detailed|intricate|complex|fine|precise|sharp|portrait|headshot|face|person|people|professional|commercial)\b/i;
const SIMPLE_KEYWORDS = /\b(simple|minimal|abstract|basic|plain|icon|logo)\b/i;

export function resolveBlogImageStrategy(
  input: Pick<GenerateBlogImageInput, "prompt" | "preset" | "size" | "quality">,
): ResolvedBlogImageStrategy {
  const prompt = input.prompt.trim();

  let size = input.size;
  if (!size) {
    switch (input.preset) {
      case "portrait":
        size = "1024x1536";
        break;
      case "landscape":
        size = "1536x1024";
        break;
      case "square":
        size = "1024x1024";
        break;
      case "hd":
      case "artistic":
      case undefined:
        if (PORTRAIT_PROMPT_PATTERN.test(prompt)) {
          size = "1024x1536";
        } else if (LANDSCAPE_PROMPT_PATTERN.test(prompt)) {
          size = "1536x1024";
        } else {
          size = "1024x1024";
        }
        break;
    }
  }

  let quality = input.quality;
  if (!quality) {
    if (input.preset === "artistic" || input.preset === "hd") {
      quality = "high";
    } else if (SIMPLE_KEYWORDS.test(prompt)) {
      quality = "medium";
    } else if (DETAIL_KEYWORDS.test(prompt)) {
      quality = "high";
    } else {
      quality = "high";
    }
  }

  return { size, quality };
}

export function parseGenerateBlogImageInput(
  value: Record<string, unknown>,
): GenerateBlogImageInput {
  if (typeof value.prompt !== "string" || typeof value.alt_text !== "string") {
    throw new Error("Generate blog image job payload is invalid.");
  }

  return {
    post_id: typeof value.post_id === "string" ? value.post_id : undefined,
    prompt: value.prompt,
    alt_text: value.alt_text,
    preset: validateEnum(value.preset, VALID_PRESETS, "preset"),
    size: validateEnum(value.size, VALID_SIZES, "size"),
    quality: validateEnum(value.quality, VALID_QUALITIES, "quality"),
    enhance_prompt:
      typeof value.enhance_prompt === "boolean" ? value.enhance_prompt : undefined,
    set_as_hero:
      typeof value.set_as_hero === "boolean" ? value.set_as_hero : undefined,
    variation_group_id:
      typeof value.variation_group_id === "string" ? value.variation_group_id : undefined,
  };
}

export function preflightBlogImagePrompt(prompt: string): string {
  const trimmed = prompt.trim();
  const rewritten = GRAPHIC_IMAGE_PROMPT_REWRITES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    trimmed,
  ).replace(/\s+/g, " ").replace(/\.\./g, ".").trim();

  if (rewritten.length === 0) {
    return rewritten;
  }

  return rewritten.toLowerCase().includes("non-graphic")
    ? rewritten
    : `${rewritten}. ${IMAGE_SAFETY_SUFFIX}`;
}

export async function executeGenerateBlogImage(
  service: BlogImageGenerationService,
  input: GenerateBlogImageInput,
  context?: ToolExecutionContext,
): Promise<GenerateBlogImageOutput> {
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new Error("Prompt is required.");
  }

  if (!input.alt_text || input.alt_text.trim().length === 0) {
    throw new Error("Alt text is required.");
  }

  const strategy = resolveBlogImageStrategy(input);
  const prompt = preflightBlogImagePrompt(input.prompt);

  return service.generate({
    postId: input.post_id,
    prompt,
    altText: input.alt_text.trim(),
    preset: input.preset,
    size: strategy.size,
    quality: strategy.quality,
    enhancePrompt: input.enhance_prompt ?? true,
    setAsHero: input.set_as_hero ?? true,
    variationGroupId: input.variation_group_id ?? null,
    createdByUserId: context?.userId ?? "unknown",
  });
}

class GenerateBlogImageCommand
implements ToolCommand<GenerateBlogImageInput, GenerateBlogImageOutput> {
  constructor(private readonly service: BlogImageGenerationService) {}

  async execute(
    input: GenerateBlogImageInput,
    context?: ToolExecutionContext,
  ): Promise<GenerateBlogImageOutput> {
    return executeGenerateBlogImage(this.service, input, context);
  }
}

export function createGenerateBlogImageTool(
  service: BlogImageGenerationService,
): ToolDescriptor<GenerateBlogImageInput, GenerateBlogImageOutput> {
  return {
    name: "generate_blog_image",
    schema: {
      description:
        "Generate a blog hero image, persist it as a blog asset, and optionally attach it to a post as the canonical hero image. Admin only.",
      input_schema: {
        type: "object",
        properties: {
          post_id: {
            type: "string",
            description: "Optional blog post ID to attach and link as the hero image.",
          },
          prompt: {
            type: "string",
            description: "The image-generation prompt to send to the provider.",
          },
          alt_text: {
            type: "string",
            description: "Accessible alt text stored on the blog asset.",
          },
          preset: {
            type: "string",
            enum: [...VALID_PRESETS],
            description: "Optional generation preset that guides size and strategy selection.",
          },
          size: {
            type: "string",
            enum: [...VALID_SIZES],
            description: "Requested output size. If omitted, the system applies preset-aware and prompt-aware heuristics.",
          },
          quality: {
            type: "string",
            enum: [...VALID_QUALITIES],
            description: "Requested output quality. Default: high.",
          },
          enhance_prompt: {
            type: "boolean",
            description: "Whether provider-side prompt enhancement is allowed. Default: true.",
          },
          set_as_hero: {
            type: "boolean",
            description: "When true, the generated asset becomes the canonical hero image for the target post. When false, it is stored as an admin-only candidate.",
          },
          variation_group_id: {
            type: "string",
            description: "Optional editorial grouping identifier for related hero-image candidates.",
          },
        },
        required: ["prompt", "alt_text"],
      },
    },
    command: new GenerateBlogImageCommand(service),
    roles: ["ADMIN"],
    category: "content",
    executionMode: "deferred",
    deferred: {
      dedupeStrategy: "per-conversation-payload",
      retryable: true,
      notificationPolicy: "completion-and-failure",
    },
  };
}