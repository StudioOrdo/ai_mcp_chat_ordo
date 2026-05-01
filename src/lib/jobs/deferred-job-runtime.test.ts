import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeferredJobHandlers } from "@/lib/jobs/deferred-job-handlers";
import { JOB_CAPABILITY_REGISTRY } from "@/lib/jobs/job-capability-registry";
import {
  COMPOSE_MEDIA_COMPLETE_LABEL,
  getComposeMediaProgressLabel,
} from "@/lib/media/compose-media-progress";

const {
  executeDraftContentMock,
  executePublishContentMock,
  executeGenerateBlogImageMock,
  executeProduceProductMock,
  executeQaBlogArticleMock,
  executeResolveBlogArticleQaMock,
  executeProduceBlogArticleMock,
  executeComposeMediaJobMock,
} = vi.hoisted(() => ({
  executeDraftContentMock: vi.fn(),
  executePublishContentMock: vi.fn(),
  executeGenerateBlogImageMock: vi.fn(),
  executeProduceProductMock: vi.fn(),
  executeQaBlogArticleMock: vi.fn(),
  executeResolveBlogArticleQaMock: vi.fn(),
  executeProduceBlogArticleMock: vi.fn(),
  executeComposeMediaJobMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/adapters/RepositoryFactory", () => ({
  getBlogAssetRepository: () => ({}),
  getBlogPostRepository: () => ({}),
  getBlogPostRevisionRepository: () => ({}),
  getJobQueueRepository: () => ({}),
  getJobStatusQuery: () => ({}),
  getUserFileDataMapper: () => ({}),
}));

vi.mock("@/lib/blog/blog-production-root", () => ({
  getBlogArticleProductionService: () => ({}),
  getBlogImageGenerationService: () => ({}),
}));

vi.mock("@/lib/media/server/media-worker-client", () => ({
  MediaWorkerClient: class MediaWorkerClient {
    executeComposeMediaJob = executeComposeMediaJobMock;
  },
}));

vi.mock("@/core/use-cases/tools/admin-content.tool", () => ({
  executeDraftContent: executeDraftContentMock,
  executePublishContent: executePublishContentMock,
  parseDraftContentInput: (value: Record<string, unknown>) => value,
  parsePublishContentInput: (value: Record<string, unknown>) => value,
}));

vi.mock("@/core/use-cases/tools/blog-image.tool", () => ({
  createGenerateBlogImageTool: (service: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>, context: unknown) =>
        executeGenerateBlogImageMock(service, input, context),
    },
  }),
  executeGenerateBlogImage: executeGenerateBlogImageMock,
  parseGenerateBlogImageInput: (value: Record<string, unknown>) => value,
}));

vi.mock("@/core/use-cases/tools/blog-production.tool", () => ({
  createProduceBlogArticleTool: (service: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>, context: { reportProgress?: unknown } | undefined) =>
        executeProduceBlogArticleMock(service, input, context, context?.reportProgress),
    },
  }),
  createComposeBlogArticleTool: (service: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>) => vi.fn()(service, input),
    },
  }),
  createGenerateBlogImagePromptTool: (service: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>) => vi.fn()(service, input),
    },
  }),
  createQaBlogArticleTool: (service: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>, context: unknown) =>
        executeQaBlogArticleMock(service, input, context),
    },
  }),
  createResolveBlogArticleQaTool: (service: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>, context: unknown) =>
        executeResolveBlogArticleQaMock(service, input, context),
    },
  }),
  executeProduceBlogArticle: executeProduceBlogArticleMock,
  executeComposeBlogArticle: vi.fn(),
  executeGenerateBlogImagePrompt: vi.fn(),
  executeQaBlogArticle: executeQaBlogArticleMock,
  executeResolveBlogArticleQa: executeResolveBlogArticleQaMock,
  parseComposeBlogArticleInput: (value: Record<string, unknown>) => value,
  parseGenerateBlogImagePromptInput: (value: Record<string, unknown>) => value,
  parseProduceBlogArticleInput: (value: Record<string, unknown>) => value,
  parseQaBlogArticleInput: (value: Record<string, unknown>) => value,
  parseResolveBlogArticleQaInput: (value: Record<string, unknown>) => value,
}));

vi.mock("@/core/use-cases/tools/factory-production.tool", () => ({
  createProduceProductTool: (_handler: unknown) => ({
    command: {
      execute: (input: Record<string, unknown>, context: { reportProgress?: unknown } | undefined) =>
        executeProduceProductMock(input, context, context?.reportProgress),
    },
  }),
  parseProduceProductInput: (value: Record<string, unknown>) => value,
}));

vi.mock("@/lib/factory/factory-production-root", () => ({
  createProduceProductDeferredJobHandler: () => ({ mocked: true }),
}));

vi.mock("@/core/use-cases/tools/journal-write.tool", () => ({
  parsePrepareJournalPostForPublishInput: (value: Record<string, unknown>) => value,
  PrepareJournalPostForPublishInteractor: class PrepareJournalPostForPublishInteractor {
    execute = vi.fn();
  },
}));

function makeJob(toolName: keyof typeof JOB_CAPABILITY_REGISTRY, requestPayload: Record<string, unknown>) {
  return {
    id: `job_${toolName}`,
    conversationId: "conv_jobs",
    userId: "usr_admin",
    toolName,
    status: "queued" as const,
    priority: 100,
    dedupeKey: null,
    initiatorType: "user" as const,
    requestPayload,
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: null,
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-03-25T03:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-03-25T03:00:00.000Z",
  };
}

function expectWorkerContext(toolName: keyof typeof JOB_CAPABILITY_REGISTRY, context: unknown) {
  expect(context).toMatchObject({
    userId: "usr_admin",
    role: JOB_CAPABILITY_REGISTRY[toolName].executionAllowedRoles[0],
    executionPrincipal: JOB_CAPABILITY_REGISTRY[toolName].executionPrincipal,
    executionAllowedRoles: JOB_CAPABILITY_REGISTRY[toolName].executionAllowedRoles,
    conversationId: "conv_jobs",
  });
}

describe("deferred job runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeDraftContentMock.mockResolvedValue({ id: "post_1" });
    executePublishContentMock.mockResolvedValue({ id: "post_1" });
    executeGenerateBlogImageMock.mockResolvedValue({ id: "asset_1" });
    executeProduceProductMock.mockResolvedValue({
      workOrderId: "wo_1",
      releaseId: "release_1",
      compositionId: "composition_1",
      outputIds: ["research_1", "draft_1", "release_1"],
    });
    executeQaBlogArticleMock.mockResolvedValue({ ok: true });
    executeResolveBlogArticleQaMock.mockResolvedValue({ ok: true });
    executeProduceBlogArticleMock.mockResolvedValue({ id: "post_2" });
    executeComposeMediaJobMock.mockResolvedValue({
      schemaVersion: 1,
      toolName: "compose_media",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "hybrid",
      summary: { title: "Media Composition", statusLine: "succeeded" },
      progress: { percent: 100, label: COMPOSE_MEDIA_COMPLETE_LABEL },
      payload: {
        route: "deferred_remote",
        planId: "plan_media_1",
        primaryAssetId: "uf_media_1",
        outputFormat: "mp4",
      },
    });
  });

  it("builds worker execution context from the capability registry for contextual handlers", async () => {
    const handlers = createDeferredJobHandlers();
    const handlerContext = {
      abortSignal: new AbortController().signal,
      reportProgress: vi.fn().mockResolvedValue(undefined),
    };

    await handlers.draft_content(makeJob("draft_content", { title: "Launch", content: "# Launch" }), handlerContext);
    await handlers.publish_content(makeJob("publish_content", { post_id: "post_1" }), handlerContext);
    await handlers.generate_blog_image(makeJob("generate_blog_image", { prompt: "Prompt", alt_text: "Alt" }), handlerContext);
    await handlers.qa_blog_article(makeJob("qa_blog_article", { title: "Launch" }), handlerContext);
    await handlers.resolve_blog_article_qa(makeJob("resolve_blog_article_qa", { title: "Launch" }), handlerContext);
    await handlers.produce_blog_article(makeJob("produce_blog_article", { brief: "Launch" }), handlerContext);
    await handlers.produce_product(makeJob("produce_product", {
      brief: {
        id: "brief_1",
        schemaVersion: 1,
        title: "Launch",
        topic: "Phase 3",
        assetKinds: ["image"],
        qaCriteria: ["accuracy"],
        targetChannels: ["web"],
        executionPreferences: { autoRetryOnFailure: true, parallelizeAssets: false },
        createdAt: "2026-04-27T00:00:00.000Z",
        createdBy: "usr_admin",
      },
    }), handlerContext);

    expectWorkerContext("draft_content", executeDraftContentMock.mock.calls[0]?.[2]);
    expectWorkerContext("publish_content", executePublishContentMock.mock.calls[0]?.[2]);
    expectWorkerContext("generate_blog_image", executeGenerateBlogImageMock.mock.calls[0]?.[2]);
    expectWorkerContext("qa_blog_article", executeQaBlogArticleMock.mock.calls[0]?.[2]);
    expectWorkerContext("resolve_blog_article_qa", executeResolveBlogArticleQaMock.mock.calls[0]?.[2]);
    expectWorkerContext("produce_blog_article", executeProduceBlogArticleMock.mock.calls[0]?.[2]);
    expectWorkerContext("produce_product", executeProduceProductMock.mock.calls[0]?.[1]);
  });

  it("forwards structured phased progress updates from produce_blog_article handlers", async () => {
    const handlers = createDeferredJobHandlers();
    const reportProgress = vi.fn().mockResolvedValue(undefined);

    executeProduceBlogArticleMock.mockImplementationOnce(async (_service, _input, _context, progress) => {
      await progress?.({
        activePhaseKey: "qa_blog_article",
        phases: [
          { key: "compose_blog_article", label: "Composing article", status: "succeeded" },
          { key: "qa_blog_article", label: "Reviewing article", status: "active" },
        ],
      });
      return { id: "post_2" };
    });

    await handlers.produce_blog_article(
      makeJob("produce_blog_article", { brief: "Launch" }),
      { abortSignal: new AbortController().signal, reportProgress },
    );

    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      activePhaseKey: "qa_blog_article",
      phases: expect.arrayContaining([
        expect.objectContaining({ key: "compose_blog_article", status: "succeeded" }),
        expect.objectContaining({ key: "qa_blog_article", status: "active" }),
      ]),
    }));
  });

  it("forwards abort signals into contextual deferred handlers", async () => {
    const handlers = createDeferredJobHandlers();
    const abortController = new AbortController();

    await handlers.produce_blog_article(
      makeJob("produce_blog_article", { brief: "Launch" }),
      {
        abortSignal: abortController.signal,
        reportProgress: vi.fn().mockResolvedValue(undefined),
      },
    );

    expect(executeProduceBlogArticleMock.mock.calls[0]?.[2]).toMatchObject({
      abortSignal: abortController.signal,
    });
  });

  it("forwards structured progress updates from produce_product handlers", async () => {
    const handlers = createDeferredJobHandlers();
    const reportProgress = vi.fn().mockResolvedValue(undefined);

    executeProduceProductMock.mockImplementationOnce(async (_input, _context, progress) => {
      await progress?.({
        activePhaseKey: "qa_resolution",
        progressPercent: 93,
        progressLabel: "Resolving QA status",
      });
      return {
        workOrderId: "wo_1",
        releaseId: "release_1",
        compositionId: "composition_1",
        outputIds: ["release_1"],
      };
    });

    await handlers.produce_product(
      makeJob("produce_product", {
        brief: {
          id: "brief_1",
          schemaVersion: 1,
          title: "Launch",
          topic: "Phase 3",
          assetKinds: ["image"],
          qaCriteria: ["accuracy"],
          targetChannels: ["web"],
          executionPreferences: { autoRetryOnFailure: true, parallelizeAssets: false },
          createdAt: "2026-04-27T00:00:00.000Z",
          createdBy: "usr_admin",
        },
      }),
      { abortSignal: new AbortController().signal, reportProgress },
    );

    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      activePhaseKey: "qa_resolution",
      progressPercent: 93,
      progressLabel: "Resolving QA status",
    }));
  });

  it("routes compose_media through the generic catalog-bound handler and reports shared progress", async () => {
    const handlers = createDeferredJobHandlers();
    const reportProgress = vi.fn().mockResolvedValue(undefined);
    executeComposeMediaJobMock.mockImplementation(async (_request, onProgress) => {
      await onProgress?.({
        activePhaseKey: "staging_assets",
        progressPercent: 5,
        progressLabel: getComposeMediaProgressLabel("staging_assets", {
          plan: {
            visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
            audioClips: [],
          },
          progressPercent: 5,
        }),
      });

      return {
        schemaVersion: 1,
        toolName: "compose_media",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "hybrid",
        inputSnapshot: { planId: "plan_media_1" },
        summary: { statusLine: "succeeded" },
        payload: { route: "deferred_remote", primaryAssetId: "uf_media_1", outputFormat: "mp4" },
      };
    });

    const result = await handlers.compose_media(
      makeJob("compose_media", {
        plan: {
          id: "plan_media_1",
          conversationId: "conv_jobs",
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        },
      }),
      { abortSignal: new AbortController().signal, reportProgress },
    );

    expect(executeComposeMediaJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ id: "plan_media_1", conversationId: "conv_jobs" }),
        userId: "usr_admin",
        conversationId: "conv_jobs",
        jobId: "job_compose_media",
      }),
      expect.any(Function),
    );
    expect(reportProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({
      activePhaseKey: "staging_assets",
      progressPercent: 5,
      progressLabel: getComposeMediaProgressLabel("staging_assets", {
        plan: {
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
        },
        progressPercent: 5,
      }),
    }));
    expect(reportProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({
      activePhaseKey: null,
      progressPercent: 100,
      progressLabel: COMPOSE_MEDIA_COMPLETE_LABEL,
      resultEnvelope: expect.objectContaining({ toolName: "compose_media" }),
    }));
    expect(result).toMatchObject({
      toolName: "compose_media",
      payload: expect.objectContaining({ route: "deferred_remote" }),
    });
  });
});
