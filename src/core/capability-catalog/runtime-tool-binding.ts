import { getJobQueueRepository } from "@/adapters/RepositoryFactory";
import { localEmbedder } from "@/adapters/LocalEmbedder";
import type { UserPreferencesRepository } from "@/core/ports/UserPreferencesRepository";
import type { VectorStore } from "@/core/search/ports/VectorStore";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { BlogPostRevisionRepository } from "@/core/use-cases/BlogPostRevisionRepository";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { JournalEditorialInteractor } from "@/core/use-cases/JournalEditorialInteractor";
import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";
import { SearchCorpusCommand } from "@/core/use-cases/tools/CorpusTools";
import {
  executeAdminSearch,
  sanitizeAdminSearchInput,
} from "@/core/use-cases/tools/admin-search.tool";
import {
  executeCalculator,
  parseCalculatorInput,
} from "@/core/use-cases/tools/calculator.tool";
import {
  executeAdjustUi,
  parseAdjustUiInput,
} from "@/core/use-cases/tools/adjust-ui.tool";
import {
  executeDraftContent,
  executePublishContent,
  parseDraftContentInput,
  parsePublishContentInput,
} from "@/core/use-cases/tools/admin-content.tool";
import { createAdminPrioritizeLeadsTool } from "@/core/use-cases/tools/admin-prioritize-leads.tool";
import { createAdminPrioritizeOfferTool } from "@/core/use-cases/tools/admin-prioritize-offer.tool";
import { createAdminTriageRoutingRiskTool } from "@/core/use-cases/tools/admin-triage-routing-risk.tool";
import { executeAdminWebSearch } from "@/core/use-cases/tools/admin-web-search.tool";
import {
  createGetAdminAffiliateSummaryTool,
  createGetMyAffiliateSummaryTool,
  createListAdminReferralExceptionsTool,
  createListMyReferralActivityTool,
} from "@/core/use-cases/tools/affiliate-analytics.tool";
import { executeComposeMedia, parseComposeMediaInput } from "@/core/use-cases/tools/compose-media.tool";
import { createGenerateBlogImageTool } from "@/core/use-cases/tools/blog-image.tool";
import {
  createComposeBlogArticleTool,
  createGenerateBlogImagePromptTool,
  createProduceBlogArticleTool,
  createQaBlogArticleTool,
  createResolveBlogArticleQaTool,
} from "@/core/use-cases/tools/blog-production.tool";
import {
  createProduceProductTool,
  parseProduceProductInput,
} from "@/core/use-cases/tools/factory-production.tool";
import {
  createGetDeferredJobStatusTool,
  createGetMyJobStatusTool,
  createListDeferredJobsTool,
  createListMyJobsTool,
} from "@/core/use-cases/tools/deferred-job-status.tool";
import {
  executeGetCurrentPage,
  parseGetCurrentPageInput,
} from "@/core/use-cases/tools/get-current-page.tool";
import { createGetChecklistTool } from "@/core/use-cases/tools/get-checklist.tool";
import { createGetCorpusSummaryTool } from "@/core/use-cases/tools/get-corpus-summary.tool";
import { createGetSectionTool } from "@/core/use-cases/tools/get-section.tool";
import {
  executeInspectRuntimeContext,
  parseInspectRuntimeContextInput,
} from "@/core/use-cases/tools/inspect-runtime-context.tool";
import {
  executeInspectRuntimeLogs,
  sanitizeInspectRuntimeLogsInput,
} from "@/core/use-cases/tools/inspect-runtime-logs.tool";
import { createInspectThemeTool } from "@/core/use-cases/tools/inspect-theme.tool";
import {
  createGetJournalPostTool,
  createGetJournalWorkflowSummaryTool,
  createListJournalPostsTool,
  createListJournalRevisionsTool,
  GetJournalPostInteractor,
  GetJournalWorkflowSummaryInteractor,
  ListJournalPostsInteractor,
  ListJournalRevisionsInteractor,
} from "@/core/use-cases/tools/journal-query.tool";
import {
  ApproveJournalPostInteractor,
  createApproveJournalPostTool,
  createPrepareJournalPostForPublishTool,
  createPublishJournalPostTool,
  createRestoreJournalRevisionTool,
  createSelectJournalHeroImageTool,
  createSubmitJournalReviewTool,
  createUpdateJournalDraftTool,
  createUpdateJournalMetadataTool,
  PrepareJournalPostForPublishInteractor,
  PublishJournalPostInteractor,
  RestoreJournalRevisionInteractor,
  SelectJournalHeroImageInteractor,
  SubmitJournalReviewInteractor,
  UpdateJournalDraftInteractor,
  UpdateJournalMetadataInteractor,
} from "@/core/use-cases/tools/journal-write.tool";
import { createListPractitionersTool } from "@/core/use-cases/tools/list-practitioners.tool";
import {
  executeListAvailablePages,
  parseListAvailablePagesInput,
} from "@/core/use-cases/tools/list-available-pages.tool";
import {
  executeNavigateToPage,
  parseNavigateToPageInput,
} from "@/core/use-cases/tools/navigate-to-page.tool";
import { parseSearchCorpusInput } from "@/core/use-cases/tools/search-corpus.tool";
import { createSearchMyConversationsTool } from "@/core/use-cases/tools/search-my-conversations.tool";
import {
  createListConversationMediaAssetsTool,
  parseListConversationMediaAssetsInput,
} from "@/core/use-cases/tools/list-conversation-media-assets.tool";
import {
  executeSetTheme,
  parseSetThemeInput,
} from "@/core/use-cases/tools/set-theme.tool";
import { createProduceProductDeferredJobHandler } from "@/lib/factory/factory-production-root";
import {
  executeSetPreference,
  parseSetPreferenceInput,
} from "@/core/use-cases/tools/set-preference.tool";
import { parseGenerateAudioInput } from "@/core/use-cases/tools/generate-audio.tool";
import { parseGenerateChartInput } from "@/core/use-cases/tools/generate-chart.tool";
import { parseGenerateGraphInput } from "@/core/use-cases/tools/generate-graph.tool";
import { buildGenerateAudioRuntimePayload, generateStoredAudioArtifact } from "@/lib/audio/audio-generation-service";
import { buildGenerateChartRuntimePayload, generateStoredChartArtifact } from "@/lib/media/server/chart-generation-service";
import { buildGenerateGraphRuntimePayload, generateStoredGraphArtifact } from "@/lib/media/server/graph-generation-service";
import {
  createGetMyProfileTool,
  createGetMyReferralQrTool,
  createUpdateMyProfileTool,
} from "@/core/use-cases/tools/user-profile.tool";
import type { CapabilityDefinition } from "./capability-definition";
import { CAPABILITY_CATALOG, getCatalogDefinition } from "./catalog";
import { resolveExecutionPlanningContextForCapability } from "./execution-planning-policy";
import { getMcpProcessMetadata } from "./mcp-process-metadata";
import { UserFileSystem } from "@/lib/user-files";
import {
  buildCatalogBoundToolDescriptor,
  type CatalogExecutor,
  type CatalogInputParser,
} from "./runtime-tool-projection";
import type { BlogArticleProductionService } from "@/lib/blog/blog-article-production-service";
import type { BlogImageGenerationService } from "@/lib/blog/blog-image-generation-service";
import {
  type AnyExecutionTargetAdapter,
  createExecutionTargetAdapterRegistry,
  dispatchExecutionPlan,
  type ExecutionTargetAdapter,
} from "@/lib/capabilities/executor-dispatch";
import {
  createComposeBackedMcpContainerExecutionTargetAdapter,
  createLocalMcpStdioExecutionTargetAdapter,
} from "@/lib/capabilities/mcp-stdio-adapter";
import {
  createNativeProcessExecutionTargetAdapter,
  createRemoteServiceExecutionTargetAdapter,
} from "@/lib/capabilities/external-target-adapters";
import { enqueueComposeMediaDeferredJob } from "@/lib/jobs/compose-media-deferred-job";
import { enqueueDeferredToolJob } from "@/lib/jobs/enqueue-deferred-tool-job";
import {
  COMPOSE_MEDIA_COMPLETE_LABEL,
} from "@/lib/media/compose-media-progress";
import { MediaWorkerClient } from "@/lib/media/server/media-worker-client";
import {
  planCapabilityExecution,
  type ExecutionPlanningContext,
} from "@/core/platform/execution/ExecutionPlanner";
import type { WebSearchToolDeps } from "@/lib/capabilities/shared/web-search-tool";
import {
  loadOperatorAnonymousOpportunities,
  loadOperatorFunnelRecommendations,
  loadOperatorLeadQueue,
  loadOperatorRoutingReview,
} from "@/lib/operator/operator-signal-loaders";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { AdminReferralAnalyticsService } from "@/lib/referrals/admin-referral-analytics";
import type { ReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import { sanitizeAdminWebSearchInput } from "@/lib/web-search/admin-web-search-payload";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";

export interface CatalogToolBindingDeps {
  blogRepo?: BlogPostRepository;
  blogAssetRepo?: BlogAssetRepository;
  blogRevisionRepo?: BlogPostRevisionRepository;
  blogArticleService?: BlogArticleProductionService;
  blogImageService?: BlogImageGenerationService;
  jobQueueRepository?: JobQueueRepository;
  jobStatusQuery?: JobStatusQuery;
  journalEditorialInteractor?: JournalEditorialInteractor;
  corpusRepo?: CorpusRepository;
  searchHandler?: SearchHandler;
  registry?: ToolRegistry;
  userPreferencesRepo?: UserPreferencesRepository;
  profileService?: CatalogProfileService;
  analyticsService?: ReferralAnalyticsService;
  adminAnalyticsService?: AdminReferralAnalyticsService;
  vectorStore?: VectorStore;
  userFileRepository?: UserFileRepository;
  adminWebSearchDepsFactory?: () => WebSearchToolDeps;
}

interface CatalogProfileService {
  getProfile(userId: string): Promise<UserProfileViewModel>;
  updateProfile(
    userId: string,
    patch: { name?: string; email?: string; credential?: string | null },
  ): Promise<UserProfileViewModel>;
}

type CatalogBoundDefinition = CapabilityDefinition & {
  executorBinding: NonNullable<CapabilityDefinition["executorBinding"]>;
  validationBinding: NonNullable<CapabilityDefinition["validationBinding"]>;
};

interface CatalogRuntimeBinding<T = unknown> {
  parse: CatalogInputParser<T>;
  createExecutor: (deps: CatalogToolBindingDeps) => CatalogExecutor<T>;
}

type AnyCatalogRuntimeBinding = CatalogRuntimeBinding<any>;

function requireBlogRepo(deps: CatalogToolBindingDeps): BlogPostRepository {
  if (!deps.blogRepo) {
    throw new Error("Catalog runtime binding for blog tools requires a BlogPostRepository.");
  }

  return deps.blogRepo;
}

function requireBlogAssetRepo(deps: CatalogToolBindingDeps): BlogAssetRepository {
  if (!deps.blogAssetRepo) {
    throw new Error("Catalog runtime binding for blog publish tools requires a BlogAssetRepository.");
  }

  return deps.blogAssetRepo;
}

function requireBlogRevisionRepo(deps: CatalogToolBindingDeps): BlogPostRevisionRepository {
  if (!deps.blogRevisionRepo) {
    throw new Error("Catalog runtime binding for journal tools requires a BlogPostRevisionRepository.");
  }

  return deps.blogRevisionRepo;
}

function requireBlogArticleService(deps: CatalogToolBindingDeps): BlogArticleProductionService {
  if (!deps.blogArticleService) {
    throw new Error("Catalog runtime binding for blog production tools requires a BlogArticleProductionService.");
  }

  return deps.blogArticleService;
}

function requireBlogImageService(deps: CatalogToolBindingDeps): BlogImageGenerationService {
  if (!deps.blogImageService) {
    throw new Error("Catalog runtime binding for blog image tools requires a BlogImageGenerationService.");
  }

  return deps.blogImageService;
}

function requireCorpusRepo(deps: CatalogToolBindingDeps): CorpusRepository {
  if (!deps.corpusRepo) {
    throw new Error("Catalog runtime binding for corpus tools requires a CorpusRepository.");
  }

  return deps.corpusRepo;
}

function requireRegistry(deps: CatalogToolBindingDeps): ToolRegistry {
  if (!deps.registry) {
    throw new Error("Catalog runtime binding for inspect tools requires a ToolRegistry.");
  }

  return deps.registry;
}

function requireUserPreferencesRepo(deps: CatalogToolBindingDeps): UserPreferencesRepository {
  if (!deps.userPreferencesRepo) {
    throw new Error("Catalog runtime binding for theme preference tools requires a UserPreferencesRepository.");
  }

  return deps.userPreferencesRepo;
}

function resolveJobQueueRepository(deps: CatalogToolBindingDeps): JobQueueRepository {
  return deps.jobQueueRepository ?? getJobQueueRepository();
}

function requireJobStatusQuery(deps: CatalogToolBindingDeps): JobStatusQuery {
  if (!deps.jobStatusQuery) {
    throw new Error("Catalog runtime binding for job tools requires a JobStatusQuery.");
  }

  return deps.jobStatusQuery;
}

function requireJournalEditorialInteractor(deps: CatalogToolBindingDeps): JournalEditorialInteractor {
  if (!deps.journalEditorialInteractor) {
    throw new Error("Catalog runtime binding for journal mutation tools requires a JournalEditorialInteractor.");
  }

  return deps.journalEditorialInteractor;
}

function requireProfileService(deps: CatalogToolBindingDeps): CatalogProfileService {
  if (!deps.profileService) {
    throw new Error("Catalog runtime binding for profile tools requires a profile service.");
  }

  return deps.profileService;
}

function requireAnalyticsService(deps: CatalogToolBindingDeps): ReferralAnalyticsService {
  if (!deps.analyticsService) {
    throw new Error("Catalog runtime binding for affiliate tools requires a referral analytics service.");
  }

  return deps.analyticsService;
}

function requireAdminAnalyticsService(deps: CatalogToolBindingDeps): AdminReferralAnalyticsService {
  if (!deps.adminAnalyticsService) {
    throw new Error("Catalog runtime binding for admin affiliate tools requires an admin analytics service.");
  }

  return deps.adminAnalyticsService;
}

function requireVectorStore(deps: CatalogToolBindingDeps): VectorStore {
  if (!deps.vectorStore) {
    throw new Error("Catalog runtime binding for conversation tools requires a VectorStore.");
  }

  return deps.vectorStore;
}

function requireUserFileRepository(deps: CatalogToolBindingDeps): UserFileRepository {
  if (!deps.userFileRepository) {
    throw new Error("Catalog runtime binding for media discovery tools requires a UserFileRepository.");
  }

  return deps.userFileRepository;
}

async function executeComposeMediaForSystemWorker(
  input: ReturnType<typeof parseComposeMediaInput>,
  context?: ToolExecutionContext,
): Promise<unknown> {
  if (!context?.userId) {
    throw new Error("compose_media worker execution requires a userId.");
  }

  const conversationId = context.conversationId ?? input.plan.conversationId;

  const client = new MediaWorkerClient();
  const result = await client.executeComposeMediaJob({
    plan: input.plan,
    userId: context.userId,
    conversationId,
    toolInvocationId: context.toolInvocationId,
  }, async (update) => {
    await context.reportProgress?.(update);
  });

  await context.reportProgress?.({
    activePhaseKey: null,
    progressPercent: 100,
    progressLabel: COMPOSE_MEDIA_COMPLETE_LABEL,
    resultEnvelope: result,
  });

  return result;
}

const passthroughInput: CatalogInputParser = (input) => input;
type CatalogDescriptorFactory = (deps: CatalogToolBindingDeps) => ToolDescriptor;

function createDescriptorBackedRuntimeBinding(
  createDescriptor: CatalogDescriptorFactory,
  parse: CatalogInputParser = passthroughInput,
): CatalogRuntimeBinding {
  return {
    parse,
    createExecutor: (deps) => {
      const descriptor = createDescriptor(deps);
      return async (input, context) => descriptor.command.execute(input, context);
    },
  };
}

const DESCRIPTOR_BACKED_RUNTIME_BINDINGS = {
  admin_prioritize_leads: createDescriptorBackedRuntimeBinding(
    () => createAdminPrioritizeLeadsTool(loadOperatorLeadQueue),
  ),
  admin_prioritize_offer: createDescriptorBackedRuntimeBinding(
    () => createAdminPrioritizeOfferTool(
      loadOperatorFunnelRecommendations,
      loadOperatorAnonymousOpportunities,
      loadOperatorLeadQueue,
    ),
  ),
  admin_triage_routing_risk: createDescriptorBackedRuntimeBinding(
    () => createAdminTriageRoutingRiskTool(loadOperatorRoutingReview),
  ),
  approve_journal_post: createDescriptorBackedRuntimeBinding(
    (deps) => createApproveJournalPostTool(
      new ApproveJournalPostInteractor(requireJournalEditorialInteractor(deps)),
    ),
  ),
  compose_blog_article: createDescriptorBackedRuntimeBinding(
    (deps) => createComposeBlogArticleTool(requireBlogArticleService(deps)),
  ),
  // generate_audio is bound manually in RUNTIME_BINDINGS below to enable synchronous backend generation
  generate_blog_image: createDescriptorBackedRuntimeBinding(
    (deps) => createGenerateBlogImageTool(requireBlogImageService(deps)),
  ),
  generate_blog_image_prompt: createDescriptorBackedRuntimeBinding(
    (deps) => createGenerateBlogImagePromptTool(requireBlogArticleService(deps)),
  ),
  // generate_chart is bound manually in RUNTIME_BINDINGS below to enable synchronous backend generation
  // generate_graph is bound manually in RUNTIME_BINDINGS below to enable synchronous backend generation
  get_admin_affiliate_summary: createDescriptorBackedRuntimeBinding(
    (deps) => createGetAdminAffiliateSummaryTool(requireAdminAnalyticsService(deps)),
  ),
  get_checklist: createDescriptorBackedRuntimeBinding(
    (deps) => createGetChecklistTool(requireCorpusRepo(deps)),
  ),
  get_corpus_summary: createDescriptorBackedRuntimeBinding(
    (deps) => createGetCorpusSummaryTool(requireCorpusRepo(deps)),
  ),
  get_deferred_job_status: createDescriptorBackedRuntimeBinding(
    (deps) => createGetDeferredJobStatusTool(requireJobStatusQuery(deps)),
  ),
  get_journal_post: createDescriptorBackedRuntimeBinding(
    (deps) => createGetJournalPostTool(new GetJournalPostInteractor(requireBlogRepo(deps))),
  ),
  get_journal_workflow_summary: createDescriptorBackedRuntimeBinding(
    (deps) => createGetJournalWorkflowSummaryTool(
      new GetJournalWorkflowSummaryInteractor(
        requireBlogRepo(deps),
        requireJobStatusQuery(deps),
      ),
    ),
  ),
  get_my_affiliate_summary: createDescriptorBackedRuntimeBinding(
    (deps) => createGetMyAffiliateSummaryTool(
      requireProfileService(deps),
      requireAnalyticsService(deps),
    ),
  ),
  get_my_job_status: createDescriptorBackedRuntimeBinding(
    (deps) => createGetMyJobStatusTool(requireJobStatusQuery(deps)),
  ),
  get_my_profile: createDescriptorBackedRuntimeBinding(
    (deps) => createGetMyProfileTool(requireProfileService(deps)),
  ),
  get_my_referral_qr: createDescriptorBackedRuntimeBinding(
    (deps) => createGetMyReferralQrTool(requireProfileService(deps)),
  ),
  get_section: createDescriptorBackedRuntimeBinding(
    (deps) => createGetSectionTool(requireCorpusRepo(deps)),
  ),
  inspect_theme: createDescriptorBackedRuntimeBinding(() => createInspectThemeTool()),
  list_admin_referral_exceptions: createDescriptorBackedRuntimeBinding(
    (deps) => createListAdminReferralExceptionsTool(requireAdminAnalyticsService(deps)),
  ),
  list_deferred_jobs: createDescriptorBackedRuntimeBinding(
    (deps) => createListDeferredJobsTool(requireJobStatusQuery(deps)),
  ),
  list_conversation_media_assets: createDescriptorBackedRuntimeBinding(
    (deps) => createListConversationMediaAssetsTool(requireUserFileRepository(deps), deps.blogAssetRepo),
    parseListConversationMediaAssetsInput,
  ),
  list_journal_posts: createDescriptorBackedRuntimeBinding(
    (deps) => createListJournalPostsTool(new ListJournalPostsInteractor(requireBlogRepo(deps))),
  ),
  list_journal_revisions: createDescriptorBackedRuntimeBinding(
    (deps) => createListJournalRevisionsTool(
      new ListJournalRevisionsInteractor(
        requireBlogRepo(deps),
        requireBlogRevisionRepo(deps),
      ),
    ),
  ),
  list_my_jobs: createDescriptorBackedRuntimeBinding(
    (deps) => createListMyJobsTool(requireJobStatusQuery(deps)),
  ),
  list_my_referral_activity: createDescriptorBackedRuntimeBinding(
    (deps) => createListMyReferralActivityTool(
      requireProfileService(deps),
      requireAnalyticsService(deps),
    ),
  ),
  list_practitioners: createDescriptorBackedRuntimeBinding(
    (deps) => createListPractitionersTool(requireCorpusRepo(deps)),
  ),
  prepare_journal_post_for_publish: createDescriptorBackedRuntimeBinding(
    (deps) => createPrepareJournalPostForPublishTool(
      new PrepareJournalPostForPublishInteractor(
        requireBlogRepo(deps),
        requireBlogRevisionRepo(deps),
        requireJobStatusQuery(deps),
        requireBlogArticleService(deps),
      ),
    ),
  ),
  produce_product: createDescriptorBackedRuntimeBinding(
    () => createProduceProductTool(createProduceProductDeferredJobHandler()),
    parseProduceProductInput,
  ),
  produce_blog_article: createDescriptorBackedRuntimeBinding(
    (deps) => createProduceBlogArticleTool(requireBlogArticleService(deps)),
  ),
  publish_journal_post: createDescriptorBackedRuntimeBinding(
    (deps) => createPublishJournalPostTool(
      new PublishJournalPostInteractor(
        requireBlogRepo(deps),
        requireBlogRevisionRepo(deps),
        requireBlogAssetRepo(deps),
      ),
    ),
  ),
  qa_blog_article: createDescriptorBackedRuntimeBinding(
    (deps) => createQaBlogArticleTool(requireBlogArticleService(deps)),
  ),
  resolve_blog_article_qa: createDescriptorBackedRuntimeBinding(
    (deps) => createResolveBlogArticleQaTool(requireBlogArticleService(deps)),
  ),
  restore_journal_revision: createDescriptorBackedRuntimeBinding(
    (deps) => createRestoreJournalRevisionTool(
      new RestoreJournalRevisionInteractor(requireJournalEditorialInteractor(deps)),
    ),
  ),
  search_my_conversations: createDescriptorBackedRuntimeBinding(
    (deps) => createSearchMyConversationsTool(requireVectorStore(deps), localEmbedder),
  ),
  select_journal_hero_image: createDescriptorBackedRuntimeBinding(
    (deps) => createSelectJournalHeroImageTool(
      new SelectJournalHeroImageInteractor(requireBlogImageService(deps)),
    ),
  ),
  submit_journal_review: createDescriptorBackedRuntimeBinding(
    (deps) => createSubmitJournalReviewTool(
      new SubmitJournalReviewInteractor(requireJournalEditorialInteractor(deps)),
    ),
  ),
  update_journal_draft: createDescriptorBackedRuntimeBinding(
    (deps) => createUpdateJournalDraftTool(
      new UpdateJournalDraftInteractor(requireJournalEditorialInteractor(deps)),
    ),
  ),
  update_journal_metadata: createDescriptorBackedRuntimeBinding(
    (deps) => createUpdateJournalMetadataTool(
      new UpdateJournalMetadataInteractor(requireJournalEditorialInteractor(deps)),
    ),
  ),
  update_my_profile: createDescriptorBackedRuntimeBinding(
    (deps) => createUpdateMyProfileTool(requireProfileService(deps)),
  ),
} as const satisfies Record<string, AnyCatalogRuntimeBinding>;

const RUNTIME_BINDINGS = {
  admin_web_search: {
    parse: sanitizeAdminWebSearchInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof sanitizeAdminWebSearchInput>> => {
      return async (input, context) => {
        const payload = await executeAdminWebSearch(input, deps.adminWebSearchDepsFactory);

        if (!("error" in payload)) {
          const userFileRepo = requireUserFileRepository(deps);
          const ufs = new UserFileSystem(userFileRepo);

          // Serialize to markdown
          const markdownContent = [
            `# Web Search Results`,
            `**Query:** ${payload.query}`,
            payload.allowed_domains ? `**Domains:** ${payload.allowed_domains.join(", ")}` : null,
            `\n## Answer\n\n${payload.answer}`,
            payload.citations.length > 0 ? `\n## Citations\n` : null,
            ...payload.citations.map((c, i) => `[${i + 1}] [${c.title}](${c.url})`),
          ].filter(Boolean).join("\n");

          const fileContent = Buffer.from(markdownContent, "utf-8");
          const created = await ufs.store({
            userId: context?.userId ?? "anonymous",
            conversationId: context?.conversationId ?? null,
            input: markdownContent,
            fileType: "document",
            mimeType: "text/markdown",
            extension: "md",
            data: fileContent,
          });

          return { ...payload, assetId: created.id };
        }

        return payload;
      };
    },
  },
  admin_search: {
    parse: sanitizeAdminSearchInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof sanitizeAdminSearchInput>> => {
      return async (input) => executeAdminSearch(input);
    },
  },
  adjust_ui: {
    parse: parseAdjustUiInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof parseAdjustUiInput>> => {
      const userPreferencesRepo = requireUserPreferencesRepo(deps);
      return async (input, context) => executeAdjustUi(userPreferencesRepo, input, context);
    },
  },
  calculator: {
    parse: parseCalculatorInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseCalculatorInput>> => {
      return async (input, context) => executeCalculator(input, context);
    },
  },
  compose_media: {
    parse: parseComposeMediaInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseComposeMediaInput>> => {
      return async (input, context) => {
        if (context?.executionPrincipal === "system_worker") {
          return executeComposeMediaForSystemWorker(input, context);
        }

        return executeComposeMedia(input);
      };
    },
  },
  draft_content: {
    parse: parseDraftContentInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof parseDraftContentInput>> => {
      const blogRepo = requireBlogRepo(deps);
      return async (input, context) => executeDraftContent(blogRepo, input, context);
    },
  },
  get_current_page: {
    parse: parseGetCurrentPageInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseGetCurrentPageInput>> => {
      return async (input, context) => executeGetCurrentPage(input, context);
    },
  },
  inspect_runtime_context: {
    parse: parseInspectRuntimeContextInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof parseInspectRuntimeContextInput>> => {
      const registry = requireRegistry(deps);
      return async (input, context) => executeInspectRuntimeContext(registry, input, context);
    },
  },
  inspect_runtime_logs: {
    parse: sanitizeInspectRuntimeLogsInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof sanitizeInspectRuntimeLogsInput>> => {
      return async (input) => executeInspectRuntimeLogs(input);
    },
  },
  list_available_pages: {
    parse: parseListAvailablePagesInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseListAvailablePagesInput>> => {
      return async (input, context) => executeListAvailablePages(input, context);
    },
  },
  navigate_to_page: {
    parse: parseNavigateToPageInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseNavigateToPageInput>> => {
      return async (input) => executeNavigateToPage(input);
    },
  },
  publish_content: {
    parse: parsePublishContentInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof parsePublishContentInput>> => {
      const blogRepo = requireBlogRepo(deps);
      return async (input, context) => executePublishContent(blogRepo, input, context, deps.blogAssetRepo);
    },
  },
  search_corpus: {
    parse: parseSearchCorpusInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof parseSearchCorpusInput>> => {
      const command = new SearchCorpusCommand(requireCorpusRepo(deps), deps.searchHandler);
      return async (input, context) => command.execute(input, context);
    },
  },
  generate_audio: {
    parse: parseGenerateAudioInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseGenerateAudioInput>> => {
      return async (input, context) => {
        const resolved = await generateStoredAudioArtifact({
          userId: context?.userId ?? "anonymous",
          text: input.text,
          conversationId: context?.conversationId ?? null,
          toolInvocationId: context?.toolInvocationId,
        });

        return buildGenerateAudioRuntimePayload(
          { title: input.title, text: input.text, toolInvocationId: context?.toolInvocationId },
          resolved
        );
      };
    },
  },
  generate_chart: {
    parse: parseGenerateChartInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseGenerateChartInput>> => {
      return async (input, context) => {
        const resolved = await generateStoredChartArtifact({
          ...input,
          userId: context?.userId ?? "anonymous",
          conversationId: context?.conversationId ?? null,
          toolInvocationId: context?.toolInvocationId,
        });

        return buildGenerateChartRuntimePayload({
          ...input,
          userId: context?.userId ?? "anonymous",
          conversationId: context?.conversationId ?? null,
          toolInvocationId: context?.toolInvocationId,
        }, resolved);
      };
    },
  },
  generate_graph: {
    parse: parseGenerateGraphInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseGenerateGraphInput>> => {
      return async (input, context) => {
        const resolved = await generateStoredGraphArtifact({
          ...input,
          userId: context?.userId ?? "anonymous",
          conversationId: context?.conversationId ?? null,
          toolInvocationId: context?.toolInvocationId,
        });

        return buildGenerateGraphRuntimePayload({
          ...input,
          userId: context?.userId ?? "anonymous",
          conversationId: context?.conversationId ?? null,
          toolInvocationId: context?.toolInvocationId,
        }, resolved);
      };
    },
  },
  set_preference: {
    parse: parseSetPreferenceInput,
    createExecutor: (deps): CatalogExecutor<ReturnType<typeof parseSetPreferenceInput>> => {
      const userPreferencesRepo = requireUserPreferencesRepo(deps);
      return async (input, context) => executeSetPreference(userPreferencesRepo, input, context);
    },
  },
  set_theme: {
    parse: parseSetThemeInput,
    createExecutor: (): CatalogExecutor<ReturnType<typeof parseSetThemeInput>> => {
      return async (input, context) => executeSetTheme(input, context);
    },
  },
  ...DESCRIPTOR_BACKED_RUNTIME_BINDINGS,
} as const satisfies Record<string, AnyCatalogRuntimeBinding>;

export type CatalogBoundToolName = keyof typeof RUNTIME_BINDINGS;

function isCatalogBoundToolName(toolName: string): toolName is CatalogBoundToolName {
  return toolName in RUNTIME_BINDINGS;
}

export const CATALOG_BOUND_TOOL_NAMES = Object.freeze(
  Object.values(CAPABILITY_CATALOG)
    .filter((def) => Boolean(def.executorBinding && def.validationBinding))
    .map((def) => {
      const toolName = def.core.name;
      if (!isCatalogBoundToolName(toolName)) {
        throw new Error(
          `Capability "${toolName}" declares runtime binding facets but has no runtime binding implementation.`,
        );
      }

      return toolName;
    })
    .sort((left, right) => left.localeCompare(right)),
) as readonly CatalogBoundToolName[];

function getCatalogBoundDefinition(toolName: CatalogBoundToolName): CatalogBoundDefinition {
  const def = getCatalogDefinition(toolName);
  if (!def) {
    throw new Error(`Catalog runtime binding requested unknown capability: ${toolName}`);
  }

  if (!def.executorBinding || !def.validationBinding) {
    throw new Error(`Capability "${toolName}" is missing Sprint 23 runtime binding facets.`);
  }

  return def as CatalogBoundDefinition;
}

function resolveValidator(def: CatalogBoundDefinition): CatalogInputParser {
  const binding = RUNTIME_BINDINGS[
    def.validationBinding.validatorId as keyof typeof RUNTIME_BINDINGS
  ];
  if (!binding) {
    throw new Error(
      `Capability "${def.core.name}" references unknown validator binding "${def.validationBinding.validatorId}".`,
    );
  }

  return binding.parse;
}

function resolveExecutor(
  def: CatalogBoundDefinition,
  deps: CatalogToolBindingDeps,
): CatalogExecutor {
  const binding = RUNTIME_BINDINGS[
    def.executorBinding.executorId as keyof typeof RUNTIME_BINDINGS
  ];
  if (!binding) {
    throw new Error(
      `Capability "${def.core.name}" references unknown executor binding "${def.executorBinding.executorId}".`,
    );
  }

  return binding.createExecutor(deps) as CatalogExecutor;
}

function supportsPlannedDeferredJob(def: CatalogBoundDefinition): boolean {
  return Boolean(
    def.job
      && (def.presentation.executionMode === "deferred" || def.presentation.executionMode === "hybrid"),
  );
}

function shouldUsePlannedDispatch(
  def: CatalogBoundDefinition,
  planning: ExecutionPlanningContext,
): boolean {
  return Boolean(
    def.mcpExport
      || def.browser
      || supportsPlannedDeferredJob(def)
      || def.localExecutionTargets?.mcpContainer
      || def.localExecutionTargets?.nativeProcess
      || def.localExecutionTargets?.remoteService
      || planning.mcpContainerTargets?.[def.core.name]
      || planning.nativeProcessTargets?.[def.core.name]
      || planning.remoteServiceTargets?.[def.core.name],
  );
}

function toExecutionPlanningContext(
  def: CatalogBoundDefinition,
  context?: ToolExecutionContext,
): ExecutionPlanningContext {
  return resolveExecutionPlanningContextForCapability(def, context?.executionPlanning);
}

export interface ResolvedCatalogRuntimeBinding {
  parse: CatalogInputParser;
  execute: CatalogExecutor;
}

export function resolveCatalogRuntimeBinding(
  toolName: CatalogBoundToolName,
  deps: CatalogToolBindingDeps = {},
  options: { planned?: boolean } = {},
): ResolvedCatalogRuntimeBinding {
  const def = getCatalogBoundDefinition(toolName);

  return {
    parse: resolveValidator(def),
    execute: options.planned === false
      ? resolveExecutor(def, deps)
      : resolvePlannedExecutor(def, deps),
  };
}

function createHostTsExecutionTargetAdapter(
  execute: CatalogExecutor,
): ExecutionTargetAdapter<"host_ts"> {
  return {
    kind: "host_ts",
    invoke: async (request) => execute(request.input, request.context),
  };
}

function createBrowserWasmCompatibilityAdapter(
  execute: CatalogExecutor,
): ExecutionTargetAdapter<"browser_wasm"> {
  return {
    kind: "browser_wasm",
    invoke: async (request) => execute(request.input, request.context),
  };
}

function createDeferredJobExecutionTargetAdapter(
  def: CatalogBoundDefinition,
  deps: CatalogToolBindingDeps,
): ExecutionTargetAdapter<"deferred_job"> {
  if (!supportsPlannedDeferredJob(def)) {
    throw new Error(`Capability "${def.core.name}" does not define a planner-backed deferred job target.`);
  }

  return {
    kind: "deferred_job",
    invoke: async (request) => {
      const conversationId = request.context?.conversationId ?? (
        def.core.name === "compose_media"
          ? (request.input as ReturnType<typeof parseComposeMediaInput>).plan.conversationId
          : undefined
      );
      if (!conversationId) {
        throw new Error(`Capability "${def.core.name}" requires a conversationId to queue deferred execution.`);
      }

      const userId = request.context?.userId;
      if (!userId) {
        throw new Error(`Capability "${def.core.name}" requires a userId to queue deferred execution.`);
      }

      const initiatorType = request.context?.role === "ANONYMOUS" ? "anonymous_session" : "user";
      
      let preAllocatedAssetId: string | undefined = undefined;
      const requestPayload = request.input as Record<string, unknown>;

      if (def.presentation.artifactKinds?.length) {
        const primaryKind = def.presentation.artifactKinds[0];
        if (primaryKind === "audio" || primaryKind === "chart" || primaryKind === "graph" || primaryKind === "video") {
          const userFileRepo = requireUserFileRepository(deps);
          const ufs = new UserFileSystem(userFileRepo);
          const pending = await ufs.allocatePending({
            userId,
            conversationId,
            fileType: primaryKind,
            metadata: { toolName: def.core.name },
          });
          preAllocatedAssetId = pending.id;
          requestPayload.assetId = pending.id;
        }
      }

      if (def.core.name === "compose_media") {
        const input = request.input as ReturnType<typeof parseComposeMediaInput>;
        const result = await enqueueComposeMediaDeferredJob({
          repository: resolveJobQueueRepository(deps),
          conversationId,
          userId,
          plan: input.plan,
          initiatorType,
        });

        const payload = result.payload;
        if (preAllocatedAssetId) {
          payload.deferred_job.assetId = preAllocatedAssetId;
        }
        return payload;
      }

      const result = await enqueueDeferredToolJob({
        repository: resolveJobQueueRepository(deps),
        conversationId,
        userId,
        toolName: def.core.name,
        requestPayload,
        initiatorType,
        deferred: def.runtime.deferred,
      });

      const payload = result.payload;
      if (preAllocatedAssetId) {
        payload.deferred_job.assetId = preAllocatedAssetId;
      }
      return payload;
    },
  };
}

function createMcpStdioExecutionTargetAdapter(
  def: CatalogBoundDefinition,
): ExecutionTargetAdapter<"mcp_stdio"> {
  const target = def.localExecutionTargets?.mcpStdio;
  if (!target) {
    throw new Error(`Capability "${def.core.name}" does not define a local MCP stdio target.`);
  }

  const process = getMcpProcessMetadata(target.processId);

  return createLocalMcpStdioExecutionTargetAdapter({
    entrypoint: target.entrypoint ?? process.entrypoint,
    toolName: target.toolName,
  });
}

function createMcpContainerExecutionTargetAdapter(
  def: CatalogBoundDefinition,
): ExecutionTargetAdapter<"mcp_container"> {
  const target = def.localExecutionTargets?.mcpContainer;
  if (!target) {
    throw new Error(`Capability "${def.core.name}" does not define a local MCP container target.`);
  }

  const process = getMcpProcessMetadata(target.processId);

  return createComposeBackedMcpContainerExecutionTargetAdapter({
    serviceName: target.serviceName,
    entrypoint: target.entrypoint ?? process.entrypoint,
    toolName: target.toolName ?? def.core.name,
  });
}

function resolvePlannedExecutor(
  def: CatalogBoundDefinition,
  deps: CatalogToolBindingDeps,
): CatalogExecutor {
  const execute = resolveExecutor(def, deps);
  const adapters: AnyExecutionTargetAdapter[] = [
    createHostTsExecutionTargetAdapter(execute),
    createNativeProcessExecutionTargetAdapter(),
    createRemoteServiceExecutionTargetAdapter(),
  ];

  if (def.localExecutionTargets?.mcpStdio) {
    adapters.push(createMcpStdioExecutionTargetAdapter(def));
  }

  if (def.localExecutionTargets?.mcpContainer) {
    adapters.push(createMcpContainerExecutionTargetAdapter(def));
  }

  if (def.browser) {
    adapters.push(createBrowserWasmCompatibilityAdapter(execute));
  }

  if (supportsPlannedDeferredJob(def)) {
    adapters.push(createDeferredJobExecutionTargetAdapter(def, deps));
  }

  const registry = createExecutionTargetAdapterRegistry(adapters);

  return async (input, context) => {
    const planning = toExecutionPlanningContext(def, context);
    if (!shouldUsePlannedDispatch(def, planning)) {
      return execute(input, context);
    }

    const plan = planCapabilityExecution(def, planning);
    return dispatchExecutionPlan({
      capability: def,
      input,
      context,
      plan,
      registry,
    });
  };
}

export function projectCatalogBoundToolDescriptor(
  toolName: CatalogBoundToolName,
  deps: CatalogToolBindingDeps = {},
) {
  const def = getCatalogBoundDefinition(toolName);
  const runtime = resolveCatalogRuntimeBinding(toolName, deps);

  return buildCatalogBoundToolDescriptor(def, runtime);
}

export function registerCatalogBoundTools(
  registry: ToolRegistry,
  toolNames: readonly CatalogBoundToolName[],
  deps: CatalogToolBindingDeps = {},
): void {
  for (const toolName of toolNames) {
    registry.register(projectCatalogBoundToolDescriptor(toolName, deps));
  }
}

export function registerCatalogBoundToolsWithDepsResolver(
  registry: ToolRegistry,
  toolNames: readonly CatalogBoundToolName[],
  resolveDeps?: (toolName: CatalogBoundToolName) => CatalogToolBindingDeps,
): void {
  for (const toolName of toolNames) {
    registry.register(projectCatalogBoundToolDescriptor(toolName, resolveDeps?.(toolName) ?? {}));
  }
}

export function getCatalogBoundToolNamesForBundle(bundleId: string): readonly CatalogBoundToolName[] {
  return CATALOG_BOUND_TOOL_NAMES.filter(
    (toolName) => getCatalogBoundDefinition(toolName).executorBinding.bundleId === bundleId,
  );
}

export function registerCatalogBoundToolsForBundleWithDepsResolver(
  registry: ToolRegistry,
  bundleId: string,
  resolveDeps?: (toolName: CatalogBoundToolName) => CatalogToolBindingDeps,
): void {
  registerCatalogBoundToolsWithDepsResolver(
    registry,
    getCatalogBoundToolNamesForBundle(bundleId),
    resolveDeps,
  );
}

export function registerCatalogBoundToolsForBundle(
  registry: ToolRegistry,
  bundleId: string,
  deps: CatalogToolBindingDeps = {},
): void {
  registerCatalogBoundTools(registry, getCatalogBoundToolNamesForBundle(bundleId), deps);
}