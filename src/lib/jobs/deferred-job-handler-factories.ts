import {
  getBlogAssetRepository,
  getBlogPostRepository,
  getBlogPostRevisionRepository,
  getJobStatusQuery,
  getUserFileDataMapper,
} from "@/adapters/RepositoryFactory";
import {
} from "@/core/use-cases/tools/blog-production.tool";
import {
  PrepareJournalPostForPublishInteractor,
} from "@/core/use-cases/tools/journal-write.tool";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { getBlogArticleProductionService, getBlogImageGenerationService } from "@/lib/blog/blog-production-root";
import {
  getJobCapability,
  type JobCapabilityName,
} from "@/lib/jobs/job-capability-registry";
import {
  resolveCatalogRuntimeBinding,
  type CatalogToolBindingDeps,
} from "@/core/capability-catalog/runtime-tool-binding";
import type { DeferredJobHandler, DeferredJobHandlerContext } from "@/lib/jobs/deferred-job-worker";

export interface DeferredJobHandlerDependencies {
  blogRepo: ReturnType<typeof getBlogPostRepository>;
  blogAssetRepo: ReturnType<typeof getBlogAssetRepository>;
  blogRevisionRepo: ReturnType<typeof getBlogPostRevisionRepository>;
  jobStatusQuery: ReturnType<typeof getJobStatusQuery>;
  prepareJournalPostForPublishInteractor: PrepareJournalPostForPublishInteractor;
  blogImageService: ReturnType<typeof getBlogImageGenerationService>;
  blogArticleService: ReturnType<typeof getBlogArticleProductionService>;
  userFileRepository: ReturnType<typeof getUserFileDataMapper>;
}

export type DeferredJobHandlerFactory = (
  dependencies: DeferredJobHandlerDependencies,
) => DeferredJobHandler;

function buildExecutionContext(job: {
  conversationId: string;
  toolName: string;
  userId: string | null;
}, reportProgress?: DeferredJobHandlerContext["reportProgress"], abortSignal?: AbortSignal): ToolExecutionContext {
  const capability = getJobCapability(job.toolName);

  if (!capability) {
    throw new Error(`No job capability registered for tool: ${job.toolName}`);
  }

  return {
    userId: job.userId ?? "unknown",
    role: capability.executionAllowedRoles[0] ?? "ADMIN",
    executionPrincipal: capability.executionPrincipal,
    executionAllowedRoles: capability.executionAllowedRoles,
    conversationId: job.conversationId,
    ...(reportProgress ? { reportProgress } : {}),
    ...(abortSignal ? { abortSignal } : {}),
  };
}

export function buildDeferredJobHandlerDependencies(): DeferredJobHandlerDependencies {
  const blogRepo = getBlogPostRepository();
  const blogRevisionRepo = getBlogPostRevisionRepository();
  const blogArticleService = getBlogArticleProductionService();

  return {
    blogRepo,
    blogAssetRepo: getBlogAssetRepository(),
    blogRevisionRepo,
    jobStatusQuery: getJobStatusQuery(),
    prepareJournalPostForPublishInteractor: new PrepareJournalPostForPublishInteractor(
      blogRepo,
      blogRevisionRepo,
      getJobStatusQuery(),
      blogArticleService,
    ),
    blogImageService: getBlogImageGenerationService(),
    blogArticleService,
    userFileRepository: getUserFileDataMapper(),
  };
}

function toCatalogToolBindingDeps(
  dependencies: DeferredJobHandlerDependencies,
): CatalogToolBindingDeps {
  return {
    blogRepo: dependencies.blogRepo,
    blogAssetRepo: dependencies.blogAssetRepo,
    blogRevisionRepo: dependencies.blogRevisionRepo,
    jobStatusQuery: dependencies.jobStatusQuery,
    blogArticleService: dependencies.blogArticleService,
    blogImageService: dependencies.blogImageService,
    userFileRepository: dependencies.userFileRepository,
  };
}

export const DEFERRED_JOB_HANDLER_FACTORIES = {} satisfies Partial<
  Record<JobCapabilityName, DeferredJobHandlerFactory>
>;

export function createCatalogBoundDeferredJobHandler(
  toolName: JobCapabilityName,
  dependencies: DeferredJobHandlerDependencies,
): DeferredJobHandler {
  return async (job, handlerContext) => {
    const runtime = resolveCatalogRuntimeBinding(toolName, toCatalogToolBindingDeps(dependencies), {
      planned: false,
    });
    const parsedInput = runtime.parse(job.requestPayload);
    return runtime.execute(parsedInput, buildExecutionContext(job, handlerContext.reportProgress, handlerContext.abortSignal));
  };
}