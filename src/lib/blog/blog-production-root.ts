import OpenAI from "openai";

import {
  getBlogAssetRepository,
  getBlogPostArtifactRepository,
  getBlogPostRepository,
} from "@/adapters/RepositoryFactory";
import { AnthropicBlogArticlePipelineModel as SelectedProviderBlogArticlePipelineModel } from "@/adapters/AnthropicBlogArticlePipelineModel";
import { OpenAiBlogImageProvider } from "@/adapters/OpenAiBlogImageProvider";
import type { BlogArticlePipelineModel } from "@/core/use-cases/BlogArticlePipelineModel";
import type {
  BlogImageGenerationRequest,
  BlogImageProvider,
} from "@/core/use-cases/BlogImageProvider";
import { createSelectedIntelligenceRuntime } from "@/lib/ai/providers/selected-intelligence-runtime";
import { BlogArticleProductionService } from "@/lib/blog/blog-article-production-service";
import { getOpenaiApiKey } from "@/lib/config/env";
import { BlogImageGenerationService } from "@/lib/blog/blog-image-generation-service";
import { assertProviderBackedToolAvailable } from "@/lib/tools/tool-provider-capability-policy";

let blogImageGenerationService: BlogImageGenerationService | null = null;
let blogArticleProductionService: BlogArticleProductionService | null = null;

const lazyOpenAiBlogImageProvider: BlogImageProvider = {
  async generate(request: BlogImageGenerationRequest) {
    assertProviderBackedToolAvailable("generate_blog_image");
    const provider = new OpenAiBlogImageProvider(
      new OpenAI({ apiKey: getOpenaiApiKey() }),
    );
    return provider.generate(request);
  },
};

const lazyAnthropicBlogArticlePipelineModel: BlogArticlePipelineModel = {
  composeArticle(input, options) {
    return createAnthropicBlogArticlePipelineModel().composeArticle(input, options);
  },
  reviewArticle(article, options) {
    return createAnthropicBlogArticlePipelineModel().reviewArticle(article, options);
  },
  resolveQa(article, report, options) {
    return createAnthropicBlogArticlePipelineModel().resolveQa(article, report, options);
  },
  designHeroImagePrompt(article, options) {
    return createAnthropicBlogArticlePipelineModel().designHeroImagePrompt(article, options);
  },
};

function createAnthropicBlogArticlePipelineModel(): BlogArticlePipelineModel {
  const runtime = createSelectedIntelligenceRuntime();
  return new SelectedProviderBlogArticlePipelineModel(
    runtime.client,
    runtime.provider,
    runtime.model,
  );
}

export function getBlogImageGenerationService(): BlogImageGenerationService {
  if (!blogImageGenerationService) {
    blogImageGenerationService = new BlogImageGenerationService(
      getBlogPostRepository(),
      getBlogAssetRepository(),
      lazyOpenAiBlogImageProvider,
      getBlogPostArtifactRepository(),
    );
  }

  return blogImageGenerationService;
}

export function getBlogArticleProductionService(): BlogArticleProductionService {
  if (!blogArticleProductionService) {
    blogArticleProductionService = new BlogArticleProductionService(
      lazyAnthropicBlogArticlePipelineModel,
      getBlogPostRepository(),
      getBlogAssetRepository(),
      getBlogPostArtifactRepository(),
      getBlogImageGenerationService(),
    );
  }

  return blogArticleProductionService;
}
