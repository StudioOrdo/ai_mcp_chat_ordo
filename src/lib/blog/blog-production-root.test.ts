import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getBlogPostRepository = vi.fn();
const getBlogAssetRepository = vi.fn();
const getBlogPostArtifactRepository = vi.fn();
const getOpenaiApiKey = vi.fn();
const createSelectedIntelligenceRuntime = vi.fn();

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBlogPostRepository,
  getBlogAssetRepository,
  getBlogPostArtifactRepository,
}));

vi.mock("@/lib/config/env", () => ({
  getOpenaiApiKey,
}));

vi.mock("@/lib/ai/providers/selected-intelligence-runtime", () => ({
  createSelectedIntelligenceRuntime,
}));

describe("blog-production-root", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: "sk-test",
      IMAGE_PROVIDER: "openai",
    };
    vi.resetModules();
    vi.clearAllMocks();

    getBlogPostRepository.mockReturnValue({
      findById: vi.fn(),
      setHeroImageAsset: vi.fn(),
    });
    getBlogAssetRepository.mockReturnValue({
      create: vi.fn(),
      setVisibility: vi.fn(),
    });
    getBlogPostArtifactRepository.mockReturnValue({
      create: vi.fn(),
    });
    createSelectedIntelligenceRuntime.mockReturnValue({
      client: { messages: { create: vi.fn() } },
      provider: "anthropic",
      model: "claude-haiku-4-5",
      policy: {
        provider: "anthropic",
        timeoutMs: 45_000,
        retryAttempts: 1,
        retryDelayMs: 0,
        modelCandidates: ["claude-haiku-4-5"],
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("constructs the image-generation service without requiring the OpenAI API key eagerly", async () => {
    getOpenaiApiKey.mockImplementation(() => {
      throw new Error("OPENAI_API_KEY must be set to a non-empty value.");
    });

    const { getBlogImageGenerationService } = await import("./blog-production-root");

    expect(() => getBlogImageGenerationService()).not.toThrow();
    expect(getOpenaiApiKey).not.toHaveBeenCalled();
  });

  it("fails before OpenAI construction when image generation capability is disabled", async () => {
    process.env.IMAGE_PROVIDER = "disabled";

    const { getBlogImageGenerationService } = await import("./blog-production-root");
    const service = getBlogImageGenerationService();

    await expect(service.generate({
      prompt: "Editorial office scene",
      altText: "Office scene",
      size: "1536x1024",
      quality: "high",
      enhancePrompt: true,
      createdByUserId: "usr_admin",
    })).rejects.toThrow(/image capability is disabled/i);
    expect(getOpenaiApiKey).not.toHaveBeenCalled();
  });
});
