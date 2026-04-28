import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";

import { registerAdminTools, ADMIN_BUNDLE } from "./tool-bundles/admin-tools";
import { registerAffiliateAnalyticsTools, AFFILIATE_BUNDLE } from "./tool-bundles/affiliate-tools";
import { registerBlogTools, BLOG_BUNDLE } from "./tool-bundles/blog-tools";
import { registerCalculatorTools, CALCULATOR_BUNDLE } from "./tool-bundles/calculator-tools";
import { registerConversationTools, CONVERSATION_BUNDLE } from "./tool-bundles/conversation-tools";
import { registerCorpusTools, CORPUS_BUNDLE } from "./tool-bundles/corpus-tools";
import { registerJobTools, JOB_BUNDLE } from "./tool-bundles/job-tools";
import { registerMediaTools, MEDIA_BUNDLE } from "./tool-bundles/media-tools";
import { registerNavigationTools, NAVIGATION_BUNDLE } from "./tool-bundles/navigation-tools";
import { registerProfileTools, PROFILE_BUNDLE } from "./tool-bundles/profile-tools";
import { registerThemeTools, THEME_BUNDLE } from "./tool-bundles/theme-tools";

export interface ToolBundleCompositionDeps {
  readonly corpusRepo: CorpusRepository;
  readonly handler?: SearchHandler;
}

export interface ToolBundleCompositionRegistration {
  readonly bundle: ToolBundleDescriptor;
  readonly register: (registry: ToolRegistry, deps: ToolBundleCompositionDeps) => void;
}

export const TOOL_BUNDLE_COMPOSITIONS = [
  { bundle: ADMIN_BUNDLE, register: (registry) => registerAdminTools(registry) },
  { bundle: AFFILIATE_BUNDLE, register: (registry) => registerAffiliateAnalyticsTools(registry) },
  { bundle: BLOG_BUNDLE, register: (registry) => registerBlogTools(registry) },
  { bundle: CALCULATOR_BUNDLE, register: (registry) => registerCalculatorTools(registry) },
  { bundle: CONVERSATION_BUNDLE, register: (registry) => registerConversationTools(registry) },
  {
    bundle: CORPUS_BUNDLE,
    register: (registry, deps) =>
      registerCorpusTools(registry, { corpusRepo: deps.corpusRepo, handler: deps.handler }),
  },
  { bundle: JOB_BUNDLE, register: (registry) => registerJobTools(registry) },
  { bundle: MEDIA_BUNDLE, register: (registry) => registerMediaTools(registry) },
  { bundle: NAVIGATION_BUNDLE, register: (registry) => registerNavigationTools(registry) },
  { bundle: PROFILE_BUNDLE, register: (registry) => registerProfileTools(registry) },
  { bundle: THEME_BUNDLE, register: (registry) => registerThemeTools(registry) },
] as const satisfies readonly ToolBundleCompositionRegistration[];