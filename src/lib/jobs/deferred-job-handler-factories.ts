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
import { parseGenerateAudioInput } from "@/core/use-cases/tools/generate-audio.tool";
import {
  buildGenerateAudioRuntimePayload,
} from "@/lib/audio/audio-generation-service";
import {
  defaultAudioGenerationProvider,
  type AudioGenerationProvider,
} from "@/lib/audio/audio-generation-provider";
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
import { assertProviderBackedToolAvailable } from "@/lib/tools/tool-provider-capability-policy";

export interface DeferredJobHandlerDependencies {
  blogRepo: ReturnType<typeof getBlogPostRepository>;
  blogAssetRepo: ReturnType<typeof getBlogAssetRepository>;
  blogRevisionRepo: ReturnType<typeof getBlogPostRevisionRepository>;
  jobStatusQuery: ReturnType<typeof getJobStatusQuery>;
  prepareJournalPostForPublishInteractor: PrepareJournalPostForPublishInteractor;
  blogImageService: ReturnType<typeof getBlogImageGenerationService>;
  blogArticleService: ReturnType<typeof getBlogArticleProductionService>;
  userFileRepository: ReturnType<typeof getUserFileDataMapper>;
  audioGenerationProvider: AudioGenerationProvider;
}

export type DeferredJobHandlerFactory = (
  dependencies: DeferredJobHandlerDependencies,
) => DeferredJobHandler;

function buildExecutionContext(job: {
  id: string;
  conversationId: string;
  toolName: string;
  userId: string | null;
  requestPayload: Record<string, unknown>;
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
    jobId: job.id,
    ...(typeof job.requestPayload.materializationKey === "string"
      ? { materializationKey: job.requestPayload.materializationKey }
      : {}),
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
    audioGenerationProvider: defaultAudioGenerationProvider,
  };
}

export function createGenerateAudioDeferredJobHandler(
  dependencies: Pick<DeferredJobHandlerDependencies, "audioGenerationProvider">,
): DeferredJobHandler {
  return async (job, handlerContext) => {
    const input = parseGenerateAudioInput(job.requestPayload);

    await handlerContext.reportProgress({
      progressPercent: 10,
      progressLabel: "Preparing audio generation",
    });

    const resolved = await dependencies.audioGenerationProvider.generate({
      userId: job.userId ?? "anonymous",
      text: input.text,
      assetId: input.assetId,
      conversationId: job.conversationId,
      toolInvocationId: job.toolInvocationId ?? undefined,
      voice: input.voice,
      format: input.format,
    });

    if (handlerContext.abortSignal.aborted) {
      const error = new Error("deferred_job_canceled");
      error.name = "AbortError";
      throw error;
    }

    const payload = buildGenerateAudioRuntimePayload({
      title: input.title,
      text: input.text,
      assetId: input.assetId,
      toolInvocationId: job.toolInvocationId ?? undefined,
      voice: input.voice,
      format: input.format,
    }, resolved);

    await handlerContext.reportProgress({
      progressPercent: 100,
      progressLabel: "Audio generation complete",
      resultEnvelope: {
        schemaVersion: 1,
        toolName: "generate_audio",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "deferred",
        inputSnapshot: {
          title: input.title,
          text: input.text,
        },
        summary: {
          title: input.title,
          subtitle: "MP3 audio",
          statusLine: "succeeded",
          message: "Audio generated successfully.",
        },
        replaySnapshot: {
          route: "deferred_remote",
          assetId: resolved.assetId,
        },
        progress: {
          percent: 100,
          label: "Audio generation complete",
        },
        artifacts: [
          {
            kind: "audio",
            label: input.title,
            assetId: resolved.assetId,
            uri: `/api/user-files/${resolved.assetId}`,
            mimeType: "audio/mpeg",
            retentionClass: job.conversationId ? "conversation" : "ephemeral",
            durationSeconds: resolved.estimatedDurationSeconds,
            source: "generated",
          },
        ],
        payload,
      },
    });

    return {
      schemaVersion: 1,
      toolName: "generate_audio",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "deferred",
      inputSnapshot: {
        title: input.title,
        text: input.text,
      },
      summary: {
        title: input.title,
        subtitle: "MP3 audio",
        statusLine: "succeeded",
        message: "Audio generated successfully.",
      },
      replaySnapshot: {
        route: "deferred_remote",
        assetId: resolved.assetId,
      },
      progress: {
        percent: 100,
        label: "Audio generation complete",
      },
      artifacts: [
        {
          kind: "audio",
          label: input.title,
          assetId: resolved.assetId,
          uri: `/api/user-files/${resolved.assetId}`,
          mimeType: "audio/mpeg",
          retentionClass: job.conversationId ? "conversation" : "ephemeral",
          durationSeconds: resolved.estimatedDurationSeconds,
          source: "generated",
        },
      ],
      payload,
    };
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

export const DEFERRED_JOB_HANDLER_FACTORIES = {
  generate_audio: createGenerateAudioDeferredJobHandler,
} satisfies Partial<
  Record<JobCapabilityName, DeferredJobHandlerFactory>
>;

export function createCatalogBoundDeferredJobHandler(
  toolName: JobCapabilityName,
  dependencies: DeferredJobHandlerDependencies,
): DeferredJobHandler {
  return async (job, handlerContext) => {
    assertProviderBackedToolAvailable(toolName);
    const runtime = resolveCatalogRuntimeBinding(toolName, toCatalogToolBindingDeps(dependencies), {
      planned: false,
    });
    const parsedInput = runtime.parse(job.requestPayload);
    return runtime.execute(parsedInput, buildExecutionContext(job, handlerContext.reportProgress, handlerContext.abortSignal));
  };
}
