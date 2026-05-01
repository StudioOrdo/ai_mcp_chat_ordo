import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vitest";

const {
  executeComposeMediaJobMock,
  generateStoredAudioArtifactMock,
  mockUfsAllocatePending,
  mockUfsStore,
} = vi.hoisted(() => ({
  executeComposeMediaJobMock: vi.fn(),
  generateStoredAudioArtifactMock: vi.fn().mockResolvedValue({
    assetId: "uf_audio_mock",
    durationSec: 1.5,
    mimeType: "audio/mpeg",
    bytes: 1024,
    path: "/tmp/mock"
  }),
  mockUfsAllocatePending: vi.fn().mockResolvedValue({ id: "uf_pending_mock" }),
  mockUfsStore: vi.fn().mockResolvedValue({ id: "uf_mock" }),
}));

vi.mock("@/lib/audio/audio-generation-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audio/audio-generation-service")>();
  return {
    ...actual,
    generateStoredAudioArtifact: generateStoredAudioArtifactMock,
  };
});

vi.mock("@/lib/user-files", () => ({
  UserFileSystem: vi.fn(function MockUserFileSystem() {
    return {
      allocatePending: mockUfsAllocatePending,
      lookup: vi.fn(async () => null),
      store: mockUfsStore,
    };
  }),
}));

vi.mock("@/lib/media/server/media-worker-client", () => ({
  MediaWorkerClient: vi.fn(function MockMediaWorkerClient() {
    return {
      executeComposeMediaJob: executeComposeMediaJobMock,
    };
  }),
}));

import type { BlogPost } from "@/core/entities/blog";
import type { JobEvent, JobEventSeed, JobRequest, JobRequestSeed } from "@/core/entities/job";
import type { UserPreferencesRepository } from "@/core/ports/UserPreferencesRepository";
import type { VectorStore } from "@/core/search/ports/VectorStore";
import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { BlogPostRevisionRepository } from "@/core/use-cases/BlogPostRevisionRepository";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import type { JournalEditorialInteractor } from "@/core/use-cases/JournalEditorialInteractor";
import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";
import {
  createEmptyFleetUserFileStorageSummary,
  createEmptyUserFileStorageSummary,
} from "@/core/entities/user-file-storage";
import type { RelationshipMemoryReader } from "@/core/use-cases/RelationshipMemoryRepository";
import { closeGlobalMcpProcessSessions } from "@/lib/capabilities/mcp-process-runtime";
import type { BlogArticleProductionService } from "@/lib/blog/blog-article-production-service";
import type { BlogImageGenerationService } from "@/lib/blog/blog-image-generation-service";
import type { WebSearchToolDeps } from "@/lib/capabilities/shared/web-search-tool";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { AdminReferralAnalyticsService } from "@/lib/referrals/admin-referral-analytics";
import type { ReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import * as adminSearchToolModule from "@/core/use-cases/tools/admin-search.tool";
import { projectAllCapabilityRuntimeStatics } from "@/core/platform/capability-runtime/CapabilityRuntime";

import { CAPABILITY_CATALOG } from "./catalog";
import {
  CATALOG_BOUND_TOOL_NAMES,
  getCatalogBoundToolNamesForBundle,
  projectCatalogBoundToolDescriptor,
} from "./runtime-tool-binding";
import { projectAnthropicSchema } from "./schema-projection";

const ROOT = path.resolve(__dirname, "../../..");
const ADMIN_WEB_SEARCH_MCP_SERVICE = "admin-web-search-mcp";
const DOCKER_COMPOSE_AVAILABLE = canUseDockerCompose();
const DOCKER_TEST_TIMEOUT_MS = 120_000;
const MCP_PLANNER_TEST_TIMEOUT_MS = 15_000;

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

function canUseDockerCompose(): boolean {
  try {
    execFileSync("docker", ["info"], { cwd: ROOT, stdio: "ignore" });
    execFileSync("docker", ["compose", "version"], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function resetComposeService(serviceName: string): void {
  execFileSync("docker", ["compose", "rm", "-sf", serviceName], {
    cwd: ROOT,
    stdio: "ignore",
  });
}

function createBlogPost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: "post_1",
    slug: "launch-plan",
    title: "Launch Plan",
    description: "desc",
    content: "# Launch Plan",
    standfirst: null,
    section: "essay",
    heroImageAssetId: null,
    status: "draft",
    publishedAt: null,
    createdAt: "2026-04-12T00:00:00.000Z",
    updatedAt: "2026-04-12T00:00:00.000Z",
    createdByUserId: "admin-1",
    publishedByUserId: null,
    ...overrides,
  };
}

function createJobRequest(seed: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_media_1",
    conversationId: "conv_media_1",
    userId: "user-1",
    toolName: "compose_media",
    status: "queued",
    priority: 5,
    dedupeKey: "compose_media:plan_media_1",
    initiatorType: "user",
    requestPayload: {
      plan: {
        id: "plan_media_1",
        conversationId: "conv_media_1",
        visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
        audioClips: [],
        subtitlePolicy: "none",
        waveformPolicy: "none",
        outputFormat: "mp4",
      },
    },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-13T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-13T12:00:00.000Z",
    ...seed,
  };
}

function createJobEvent(seed: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "evt_media_1",
    jobId: "job_media_1",
    conversationId: "conv_media_1",
    sequence: 1,
    eventType: "queued",
    payload: { toolName: "compose_media" },
    createdAt: "2026-04-13T12:00:00.000Z",
    ...seed,
  };
}

function createWebSearchDeps(
  create: ReturnType<typeof vi.fn>,
): () => WebSearchToolDeps {
  return () => ({
    openai: ({
      responses: {
        create,
      },
    } as unknown) as WebSearchToolDeps["openai"],
  });
}

function createBlogRepoMock(overrides: Partial<BlogPostRepository> = {}): BlogPostRepository {
  return {
    create: vi.fn(async () => createBlogPost()),
    findById: vi.fn(async () => null),
    findBySlug: vi.fn(async () => null),
    listPublished: vi.fn(async () => []),
    listForAdmin: vi.fn(async () => []),
    countForAdmin: vi.fn(async () => 0),
    updateDraftContent: vi.fn(async () => { throw new Error("unused"); }),
    updateEditorialMetadata: vi.fn(async () => { throw new Error("unused"); }),
    transitionWorkflow: vi.fn(async () => { throw new Error("unused"); }),
    publishById: vi.fn(async () => createBlogPost({
      status: "published",
      publishedAt: "2026-04-12T00:00:00.000Z",
    })),
    setHeroImageAsset: vi.fn(async () => { throw new Error("unused"); }),
    ...overrides,
  } as unknown as BlogPostRepository;
}

function createBlogAssetRepoMock(overrides: Partial<BlogAssetRepository> = {}): BlogAssetRepository {
  return {
    create: vi.fn(async () => ({ id: "asset_1" })),
    findById: vi.fn(async () => null),
    listByPost: vi.fn(async () => []),
    listHeroCandidates: vi.fn(async () => []),
    attachToPost: vi.fn(async () => ({ id: "asset_1" })),
    detachFromPost: vi.fn(async () => ({ id: "asset_1" })),
    setVisibility: vi.fn(async () => ({ id: "asset_1" })),
    setSelectionState: vi.fn(async () => ({ id: "asset_1" })),
    ...overrides,
  } as unknown as BlogAssetRepository;
}

function createBlogRevisionRepoMock(
  overrides: Partial<BlogPostRevisionRepository> = {},
): BlogPostRevisionRepository {
  return {
    create: vi.fn(async () => ({ id: "revision_1", postId: "post_1" })),
    findById: vi.fn(async () => null),
    listByPostId: vi.fn(async () => []),
    ...overrides,
  } as unknown as BlogPostRevisionRepository;
}

function createCorpusRepoMock(overrides: Partial<CorpusRepository> = {}): CorpusRepository {
  return {
    getAllDocuments: vi.fn(async () => []),
    getAllSections: vi.fn(async () => []),
    getSectionsByDocument: vi.fn(async () => []),
    getSection: vi.fn(async () => { throw new Error("unused"); }),
    getDocument: vi.fn(async () => null),
    ...overrides,
  };
}

function createUserPreferencesRepoMock(
  overrides: Partial<UserPreferencesRepository> = {},
): UserPreferencesRepository {
  return {
    getAll: vi.fn(async () => []),
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createJobStatusQueryMock(overrides: Partial<JobStatusQuery> = {}): JobStatusQuery {
  return {
    getJobSnapshot: vi.fn(async () => null),
    getUserJobSnapshot: vi.fn(async () => null),
    listConversationJobSnapshots: vi.fn(async () => []),
    listUserJobSnapshots: vi.fn(async () => []),
    ...overrides,
  };
}

function createJobQueueRepositoryMock(overrides: Partial<JobQueueRepository> = {}): JobQueueRepository {
  return {
    createJob: vi.fn(async () => createJobRequest()),
    findJobById: vi.fn(async () => null),
    findLatestEventForJob: vi.fn(async () => null),
    findLatestRenderableEventForJob: vi.fn(async () => null),
    findActiveJobByDedupeKey: vi.fn(async () => null),
    listJobsByConversation: vi.fn(async () => []),
    listJobsByUser: vi.fn(async () => []),
    appendEvent: vi.fn(async () => createJobEvent()),
    requeueExpiredRunningJobs: vi.fn(async () => []),
    listConversationEvents: vi.fn(async () => []),
    listUserEvents: vi.fn(async () => []),
    listEventsForUserJob: vi.fn(async () => []),
    claimNextQueuedJob: vi.fn(async () => null),
    transferJobsToUser: vi.fn(async () => []),
    updateJobStatus: vi.fn(async () => { throw new Error("unused"); }),
    cancelJob: vi.fn(async () => { throw new Error("unused"); }),
    ...overrides,
  } as unknown as JobQueueRepository;
}

function createMaterializationRepositoryMock(
  overrides: Partial<MaterializationRepository> = {},
): MaterializationRepository {
  return {
    findById: vi.fn(async () => null),
    findByMaterializationKey: vi.fn(async () => null),
    listByConversation: vi.fn(async () => []),
    findLatestByOutputRef: vi.fn(async () => null),
    findReusableSuccess: vi.fn(async () => null),
    upsert: vi.fn(async (record) => record),
    markSuperseded: vi.fn(async () => null),
    ...overrides,
  };
}

function createProfileViewModel(overrides: Partial<UserProfileViewModel> = {}): UserProfileViewModel {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User One",
    credential: "RN",
    pushNotificationsEnabled: false,
    affiliateEnabled: true,
    referralCode: "ref-user-1",
    referralUrl: "https://example.com/r/ref-user-1",
    qrCodeUrl: "/api/qr/ref-user-1",
    roles: ["AUTHENTICATED"],
    ...overrides,
  };
}

function createProfileServiceMock(overrides?: {
  getProfile?: (userId: string) => Promise<UserProfileViewModel>;
  updateProfile?: (
    userId: string,
    patch: { name?: string; email?: string; credential?: string | null },
  ) => Promise<UserProfileViewModel>;
}) {
  return {
    getProfile: vi.fn(overrides?.getProfile ?? (async () => createProfileViewModel())),
    updateProfile: vi.fn(
      overrides?.updateProfile
        ?? (async (_userId, patch) =>
          createProfileViewModel({
            name: patch.name ?? "User One",
            email: patch.email ?? "user@example.com",
            credential: patch.credential ?? "RN",
          })),
    ),
  };
}

function createVectorStoreMock(overrides: Partial<VectorStore> = {}): VectorStore {
  return {
    upsert: vi.fn(() => undefined),
    delete: vi.fn(() => undefined),
    getAll: vi.fn(() => []),
    getBySourceId: vi.fn(() => []),
    searchSimilar: vi.fn(() => []),
    searchKeyword: vi.fn(() => []),
    hydrateByIds: vi.fn(() => []),
    listSourceIds: vi.fn(() => []),
    getContentHash: vi.fn(() => null),
    getModelVersion: vi.fn(() => null),
    count: vi.fn(() => 0),
    ...overrides,
  };
}

function createUserFileRepositoryMock(
  overrides: Partial<UserFileRepository> = {},
): UserFileRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByHash: vi.fn(),
    listByConversation: vi.fn(async () => []),
    listByUser: vi.fn(async () => []),
    listForUser: vi.fn(async () => ({ items: [], nextCursor: null })),
    getUserStorageSummary: vi.fn(async () => createEmptyUserFileStorageSummary()),
    listForAdmin: vi.fn(async () => []),
    countForAdmin: vi.fn(async () => 0),
    getFleetStorageSummary: vi.fn(async () => createEmptyFleetUserFileStorageSummary()),
    listLargestUsersByStorage: vi.fn(async () => []),
    listUnattachedCreatedBefore: vi.fn(async () => []),
    assignConversation: vi.fn(async () => undefined),
    deleteIfUnattached: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createRelationshipMemoryReaderMock(
  overrides: Partial<RelationshipMemoryReader> = {},
): RelationshipMemoryReader {
  return {
    findById: vi.fn(async () => null),
    listActiveByConversation: vi.fn(async () => []),
    listActiveByUser: vi.fn(async () => []),
    ...overrides,
  };
}

function createAssetCatalogReaderMock(
  overrides: Partial<AssetCatalogReader> = {},
): AssetCatalogReader {
  return {
    listConversationAssets: vi.fn(async () => []),
    listReusableMediaAssets: vi.fn(async () => []),
    findByAssetId: vi.fn(async () => null),
    ...overrides,
  };
}

function createSharedDeps(registry = new ToolRegistry()) {
  return {
    blogRepo: createBlogRepoMock(),
    blogAssetRepo: createBlogAssetRepoMock(),
    blogRevisionRepo: createBlogRevisionRepoMock(),
    blogArticleService: {} as unknown as BlogArticleProductionService,
    blogImageService: {} as unknown as BlogImageGenerationService,
    jobQueueRepository: createJobQueueRepositoryMock(),
    jobStatusQuery: createJobStatusQueryMock(),
    journalEditorialInteractor: {} as unknown as JournalEditorialInteractor,
    corpusRepo: createCorpusRepoMock(),
    registry,
    userPreferencesRepo: createUserPreferencesRepoMock(),
    profileService: createProfileServiceMock(),
    analyticsService: {} as unknown as ReferralAnalyticsService,
    adminAnalyticsService: {} as unknown as AdminReferralAnalyticsService,
    vectorStore: createVectorStoreMock(),
    relationshipMemoryReader: createRelationshipMemoryReaderMock(),
    assetCatalogReader: createAssetCatalogReaderMock(),
    userFileRepository: createUserFileRepositoryMock(),
  };
}

afterEach(async () => {
  executeComposeMediaJobMock.mockReset();
  generateStoredAudioArtifactMock.mockClear();
  mockUfsAllocatePending.mockClear();
  mockUfsStore.mockClear();
  await closeGlobalMcpProcessSessions();
});

describe("Sprint 23 — Catalog runtime binding", () => {
  it("projects every catalog-bound descriptor with runtime facets and schema coverage", () => {
    const registry = new ToolRegistry();
    const sharedDeps = createSharedDeps(registry);

    for (const toolName of CATALOG_BOUND_TOOL_NAMES) {
      const descriptor = projectCatalogBoundToolDescriptor(toolName, sharedDeps);
      const def = CAPABILITY_CATALOG[toolName];

      expect(descriptor.name).toBe(toolName);
      expect(descriptor.schema).toEqual(projectAnthropicSchema(def));
      expect(descriptor.roles).toEqual(def.core.roles);
      expect(descriptor.category).toBe(def.core.category);
      expect(descriptor.executionMode).toBe(
        "executionMode" in def.runtime ? def.runtime.executionMode : undefined,
      );
      expect(descriptor.deferred).toEqual(
        "deferred" in def.runtime ? def.runtime.deferred : undefined,
      );
      expect(def.executorBinding?.bundleId).toBeTruthy();
      expect(def.validationBinding?.validatorId).toBeTruthy();
    }
  });

  it("validates draft_content before touching repository deps", async () => {
    const blogRepo = createBlogRepoMock();
    const descriptor = projectCatalogBoundToolDescriptor("draft_content", { blogRepo });

    await expect(
      descriptor.command.execute({ title: "Launch" }, { role: "ADMIN", userId: "admin-1" }),
    ).rejects.toThrow("Draft content job payload is invalid.");

    expect(blogRepo.create).not.toHaveBeenCalled();
  });

  it("uses the catalog-backed publish_content parser and executor for slug publishes", async () => {
    const blogRepo = createBlogRepoMock({
      findBySlug: vi.fn(async () => createBlogPost()),
      publishById: vi.fn(async () => createBlogPost({
        heroImageAssetId: "asset_1",
        status: "published",
        publishedAt: "2026-04-12T00:00:00.000Z",
        publishedByUserId: "admin-1",
      })),
    });
    const blogAssetRepo = createBlogAssetRepoMock();
    const descriptor = projectCatalogBoundToolDescriptor("publish_content", {
      blogRepo,
      blogAssetRepo,
    });

    const result = await descriptor.command.execute(
      { slug: "launch-plan" },
      {
        role: "ADMIN",
        userId: "admin-1",
        executionPlanning: {
          enabledTargetKinds: ["host_ts"],
          preferredTargetKinds: ["host_ts"],
        },
      },
    ) as Record<string, unknown>;

    expect(blogRepo.findBySlug).toHaveBeenCalledWith("launch-plan");
    expect(blogRepo.publishById).toHaveBeenCalledWith("post_1", "admin-1");
    expect(blogAssetRepo.setVisibility).toHaveBeenCalledWith("asset_1", "published");
    expect(result).toMatchObject({
      id: "post_1",
      slug: "launch-plan",
      status: "published",
    });
  });

  it("routes draft_content through deferred_job by default and leaves direct execution to the worker", async () => {
    const blogRepo = createBlogRepoMock();
    const jobQueueRepository = createJobQueueRepositoryMock({
      createJob: vi.fn(async (seed: JobRequestSeed) => createJobRequest({
        id: "job_draft_1",
        conversationId: seed.conversationId,
        userId: seed.userId ?? null,
        toolName: seed.toolName,
        priority: seed.priority ?? 0,
        dedupeKey: seed.dedupeKey ?? null,
        initiatorType: seed.initiatorType ?? "user",
        requestPayload: seed.requestPayload,
      })),
      appendEvent: vi.fn(async (seed: JobEventSeed) => createJobEvent({
        id: "evt_draft_1",
        jobId: seed.jobId,
        conversationId: seed.conversationId,
        eventType: seed.eventType,
        payload: seed.payload ?? {},
      })),
    });
    const descriptor = projectCatalogBoundToolDescriptor("draft_content", {
      blogRepo,
      jobQueueRepository,
    });

    const result = await descriptor.command.execute(
      {
        title: "Launch Plan",
        content: "# Launch Plan\n\n- Step 1",
      },
      {
        role: "ADMIN",
        userId: "admin-1",
        conversationId: "conv_blog_1",
      },
    ) as Record<string, unknown>;

    expect(jobQueueRepository.createJob).toHaveBeenCalledTimes(1);
    expect(blogRepo.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deferred_job: {
        jobId: "job_draft_1",
        toolName: "draft_content",
        status: "queued",
        resultEnvelope: expect.objectContaining({
          toolName: "draft_content",
          executionMode: "deferred",
        }),
      },
    });
  });

  it("sanitizes admin_web_search input and returns structured validation errors before deps are built", async () => {
    const depsFactory = vi.fn(() => {
      throw new Error("deps should not be constructed for invalid input");
    });
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: depsFactory,
    });

    const result = await descriptor.command.execute(
      {},
      { role: "ADMIN", userId: "admin-1" },
    ) as Record<string, unknown>;

    expect(depsFactory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      action: "admin_web_search",
      query: "",
      error: "query is required and must be non-empty",
      model: "gpt-5",
    });
  });

  it("routes admin_web_search through the mcp_stdio planner path by default", async () => {
    const fixtureResult = {
      answer: "Fresh answer",
      citations: [
        {
          url: "https://example.com/story",
          title: "Example Story",
          start_index: 0,
          end_index: 12,
        },
      ],
      sources: ["https://example.com/story"],
      model: "gpt-5",
    };
    const create = vi.fn(async () => ({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Fresh answer",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.com/story",
                  title: "Example Story",
                  start_index: 0,
                  end_index: 12,
                },
              ],
            },
          ],
        },
        {
          type: "web_search_call",
          action: {
            sources: [{ url: "https://example.com/story" }],
          },
        },
      ],
    }));
    const depsFactory = vi.fn(createWebSearchDeps(create));
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: depsFactory,
    });
    const previousFixture = process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE;
    process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE = JSON.stringify(fixtureResult);

    try {
      const result = await descriptor.command.execute(
        { query: "latest referral guidance", allowed_domains: ["example.com"] },
        { role: "ADMIN", userId: "admin-1" },
      ) as Record<string, unknown>;

      expect(depsFactory).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        action: "admin_web_search",
        query: "latest referral guidance",
        answer: "Fresh answer",
        sources: ["https://example.com/story"],
        model: "gpt-5",
      });
    } finally {
      if (previousFixture === undefined) {
        delete process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE;
      } else {
        process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE = previousFixture;
      }
    }
  });

  it("keeps an explicit host_ts override for admin_web_search", async () => {
    const create = vi.fn(async () => ({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Fresh answer",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.com/story",
                  title: "Example Story",
                  start_index: 0,
                  end_index: 12,
                },
              ],
            },
          ],
        },
        {
          type: "web_search_call",
          action: {
            sources: [{ url: "https://example.com/story" }],
          },
        },
      ],
    }));
    const depsFactory = vi.fn(createWebSearchDeps(create));
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: depsFactory,
    });
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    try {
      const result = await descriptor.command.execute(
        { query: "latest referral guidance", allowed_domains: ["example.com"] },
        {
          role: "ADMIN",
          userId: "admin-1",
          executionPlanning: {
            enabledTargetKinds: ["host_ts"],
            preferredTargetKinds: ["host_ts"],
          },
        },
      ) as Record<string, unknown>;

      expect(depsFactory).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        action: "admin_web_search",
        query: "latest referral guidance",
        answer: "Fresh answer",
        sources: ["https://example.com/story"],
        model: "gpt-5",
      });
    } finally {
      if (previousOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousOpenAiKey;
      }
    }
  });

  it("keeps admin_web_search output parity between host_ts and mcp_stdio targets", async () => {
    const fixtureResult = {
      answer: "Fresh answer",
      citations: [
        {
          url: "https://example.com/story",
          title: "Example Story",
          start_index: 0,
          end_index: 12,
        },
      ],
      sources: ["https://example.com/story"],
      model: "gpt-5",
    };
    const create = vi.fn(async () => ({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: fixtureResult.answer,
              annotations: fixtureResult.citations.map((citation) => ({
                type: "url_citation",
                ...citation,
              })),
            },
          ],
        },
        {
          type: "web_search_call",
          action: {
            sources: fixtureResult.sources.map((url) => ({ url })),
          },
        },
      ],
    }));
    const depsFactory = vi.fn(createWebSearchDeps(create));
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: depsFactory,
    });
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    const previousFixture = process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE;
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE = JSON.stringify(fixtureResult);

    try {
      const input = {
        query: "latest referral guidance",
        allowed_domains: ["example.com"],
      };
      const hostResult = await descriptor.command.execute(
        input,
        {
          role: "ADMIN",
          userId: "admin-1",
          executionPlanning: {
            enabledTargetKinds: ["host_ts"],
            preferredTargetKinds: ["host_ts"],
          },
        },
      );
      const mcpResult = await descriptor.command.execute(
        input,
        {
          role: "ADMIN",
          userId: "admin-1",
          executionPlanning: {
            enabledTargetKinds: ["host_ts", "mcp_stdio"],
            preferredTargetKinds: ["mcp_stdio", "host_ts"],
          },
        },
      );

      const { assetId: _hostAssetId, ...hostParityResult } = hostResult as any;
      const { assetId: _mcpAssetId, ...mcpParityResult } = mcpResult as any;
      expect(hostParityResult).toEqual(mcpParityResult);
      expect(hostResult).toMatchObject({
        action: "admin_web_search",
        query: "latest referral guidance",
        allowed_domains: ["example.com"],
        answer: "Fresh answer",
        sources: ["https://example.com/story"],
        model: "gpt-5",
      });
      expect(depsFactory).toHaveBeenCalledTimes(1);
    } finally {
      if (previousOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousOpenAiKey;
      }

      if (previousFixture === undefined) {
        delete process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE;
      } else {
        process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE = previousFixture;
      }
    }
  });

  it("routes admin_web_search through a native_process target override", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: vi.fn(() => {
        throw new Error("host executor should not run for native_process override");
      }),
    });

    const result = await descriptor.command.execute(
      {
        query: "latest referral guidance",
        allowed_domains: ["example.com"],
      },
      {
        role: "ADMIN",
        userId: "admin-1",
        executionPlanning: {
          enabledTargetKinds: ["host_ts", "native_process"],
          preferredTargetKinds: ["native_process", "host_ts"],
          nativeProcessTargets: {
            admin_web_search: {
              processId: "native-admin-web-search",
              command: process.execPath,
              args: [
                "-e",
                [
                  "let data = '';",
                  "process.stdin.setEncoding('utf8');",
                  "process.stdin.on('data', (chunk) => { data += chunk; });",
                  "process.stdin.on('end', () => {",
                  "  const input = JSON.parse(data);",
                  "  process.stdout.write(JSON.stringify({",
                  "    action: 'admin_web_search',",
                  "    query: input.query,",
                  "    allowed_domains: input.allowed_domains ?? [],",
                  "    answer: 'Native process answer',",
                  "    sources: ['https://example.com/story'],",
                  "    model: 'gpt-5'",
                  "  }));",
                  "});",
                ].join("\n"),
              ],
            },
          },
        },
      },
    ) as Record<string, unknown>;

    expect(result).toEqual({
      action: "admin_web_search",
      query: "latest referral guidance",
      allowed_domains: ["example.com"],
      answer: "Native process answer",
      sources: ["https://example.com/story"],
      model: "gpt-5",
    });
  });

  it("routes admin_web_search through a remote_service target override", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: vi.fn(() => {
        throw new Error("host executor should not run for remote_service override");
      }),
    });
    const previousFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input).toBe("https://example.test/admin-web-search");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual(expect.objectContaining({
        "content-type": "application/json",
        authorization: "Bearer remote-token",
      }));
      expect(init?.body).toBe(JSON.stringify({
        query: "latest referral guidance",
        allowed_domains: ["example.com"],
      }));

      return new Response(JSON.stringify({
        action: "admin_web_search",
        query: "latest referral guidance",
        allowed_domains: ["example.com"],
        answer: "Remote service answer",
        sources: ["https://example.com/story"],
        model: "gpt-5",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await descriptor.command.execute(
        {
          query: "latest referral guidance",
          allowed_domains: ["example.com"],
        },
        {
          role: "ADMIN",
          userId: "admin-1",
          executionPlanning: {
            enabledTargetKinds: ["host_ts", "remote_service"],
            preferredTargetKinds: ["remote_service", "host_ts"],
            remoteServiceTargets: {
              admin_web_search: {
                serviceId: "remote-admin-web-search",
                endpoint: "https://example.test/admin-web-search",
                headers: { authorization: "Bearer remote-token" },
              },
            },
          },
        },
      ) as Record<string, unknown>;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        action: "admin_web_search",
        query: "latest referral guidance",
        allowed_domains: ["example.com"],
        answer: "Remote service answer",
        sources: ["https://example.com/story"],
        model: "gpt-5",
      });
    } finally {
      vi.unstubAllGlobals();
      if (previousFetch) {
        globalThis.fetch = previousFetch;
      }
    }
  });

  it("can opt a remote_service target override into execution-context bridging", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
      userFileRepository: {} as any, adminWebSearchDepsFactory: vi.fn(() => {
        throw new Error("host executor should not run for remote_service override");
      }),
    });
    const previousFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.body).toBe(JSON.stringify({
        query: "latest referral guidance",
        __executionContext: {
          userId: "admin-1",
          role: "ADMIN",
        },
      }));

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await descriptor.command.execute(
        {
          query: "latest referral guidance",
        },
        {
          role: "ADMIN",
          userId: "admin-1",
          executionPlanning: {
            enabledTargetKinds: ["host_ts", "remote_service"],
            preferredTargetKinds: ["remote_service", "host_ts"],
            remoteServiceTargets: {
              admin_web_search: {
                serviceId: "remote-admin-web-search",
                endpoint: "https://example.test/admin-web-search",
                bridgeExecutionContext: true,
              },
            },
          },
        },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      if (previousFetch) {
        globalThis.fetch = previousFetch;
      }
    }
  });

  const maybeDockerIt = DOCKER_COMPOSE_AVAILABLE ? it : it.skip;

  maybeDockerIt(
    "keeps admin_web_search output parity between host_ts and mcp_container targets",
    async () => {
      const fixtureResult = {
        answer: "Fresh answer",
        citations: [
          {
            url: "https://example.com/story",
            title: "Example Story",
            start_index: 0,
            end_index: 12,
          },
        ],
        sources: ["https://example.com/story"],
        model: "gpt-5",
      };
      const create = vi.fn(async () => ({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: fixtureResult.answer,
                annotations: fixtureResult.citations.map((citation) => ({
                  type: "url_citation",
                  ...citation,
                })),
              },
            ],
          },
          {
            type: "web_search_call",
            action: {
              sources: fixtureResult.sources.map((url) => ({ url })),
            },
          },
        ],
      }));
      const depsFactory = vi.fn(createWebSearchDeps(create));
      const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
        userFileRepository: {} as any, adminWebSearchDepsFactory: depsFactory,
      });
      const previousOpenAiKey = process.env.OPENAI_API_KEY;
      const previousFixture = process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE;
      process.env.OPENAI_API_KEY = "test-key";
      process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE = JSON.stringify(fixtureResult);

      try {
        resetComposeService(ADMIN_WEB_SEARCH_MCP_SERVICE);

        const input = {
          query: "latest referral guidance",
          allowed_domains: ["example.com"],
        };
        const hostResult = await descriptor.command.execute(
          input,
          {
            role: "ADMIN",
            userId: "admin-1",
            executionPlanning: {
              enabledTargetKinds: ["host_ts"],
              preferredTargetKinds: ["host_ts"],
            },
          },
        );
        const mcpContainerResult = await descriptor.command.execute(
          input,
          {
            role: "ADMIN",
            userId: "admin-1",
            executionPlanning: {
              enabledTargetKinds: ["host_ts", "mcp_container"],
              preferredTargetKinds: ["mcp_container", "host_ts"],
            },
          },
        );

        const { assetId: _hostAssetId, ...hostParityResult } = hostResult as any;
        const { assetId: _mcpAssetId, ...mcpParityResult } = mcpContainerResult as any;
        expect(hostParityResult).toEqual(mcpParityResult);
        expect(hostResult).toMatchObject({
          action: "admin_web_search",
          query: "latest referral guidance",
          allowed_domains: ["example.com"],
          answer: "Fresh answer",
          sources: ["https://example.com/story"],
          model: "gpt-5",
        });
        expect(depsFactory).toHaveBeenCalledTimes(1);
      } finally {
        await closeGlobalMcpProcessSessions();
        resetComposeService(ADMIN_WEB_SEARCH_MCP_SERVICE);

        if (previousOpenAiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = previousOpenAiKey;
        }

        if (previousFixture === undefined) {
          delete process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE;
        } else {
          process.env.ORDO_MCP_ADMIN_WEB_SEARCH_RESULT_FIXTURE = previousFixture;
        }
      }
    },
    DOCKER_TEST_TIMEOUT_MS,
  );

  maybeDockerIt(
    "keeps admin_web_search validation parity between host_ts and mcp_container targets",
    async () => {
      const depsFactory = vi.fn(createWebSearchDeps(vi.fn()));
      const descriptor = projectCatalogBoundToolDescriptor("admin_web_search", {
        userFileRepository: {} as any, adminWebSearchDepsFactory: depsFactory,
      });

      try {
        resetComposeService(ADMIN_WEB_SEARCH_MCP_SERVICE);

        const hostResult = await descriptor.command.execute(
          {},
          { role: "ADMIN", userId: "admin-1" },
        );
        const mcpContainerResult = await descriptor.command.execute(
          {},
          {
            role: "ADMIN",
            userId: "admin-1",
            executionPlanning: {
              enabledTargetKinds: ["host_ts", "mcp_container"],
              preferredTargetKinds: ["mcp_container", "host_ts"],
            },
          },
        );

        expect(hostResult).toEqual(mcpContainerResult);
        expect(hostResult).toEqual({
          action: "admin_web_search",
          query: "",
          error: "query is required and must be non-empty",
          model: "gpt-5",
        });
        expect(depsFactory).not.toHaveBeenCalled();
      } finally {
        await closeGlobalMcpProcessSessions();
        resetComposeService(ADMIN_WEB_SEARCH_MCP_SERVICE);
      }
    },
    DOCKER_TEST_TIMEOUT_MS,
  );

  it("routes compose_media through deferred_job when browser execution is unavailable", async () => {
    const jobQueueRepository = createJobQueueRepositoryMock();
    const descriptor = projectCatalogBoundToolDescriptor("compose_media", {
      jobQueueRepository,
      materializationRepository: createMaterializationRepositoryMock(),
      userFileRepository: createUserFileRepositoryMock(),
    });

    const result = await descriptor.command.execute(
      {
        plan: {
          id: "plan_media_1",
          conversationId: "conv_media_1",
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        },
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_media_1",
        executionPlanning: {
          enabledTargetKinds: ["deferred_job", "host_ts"],
          preferredTargetKinds: ["deferred_job", "host_ts"],
          browserRuntimeAvailable: false,
        },
      },
    ) as Record<string, unknown>;

    expect(jobQueueRepository.createJob).toHaveBeenCalledTimes(1);
    expect(jobQueueRepository.appendEvent).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      deferred_job: {
        jobId: "job_media_1",
        toolName: "compose_media",
        status: "queued",
        resultEnvelope: expect.objectContaining({
          toolName: "compose_media",
          executionMode: "deferred",
        }),
      },
    });
  });

  it("returns a renderable exact reuse payload for completed compose materializations", async () => {
    const jobQueueRepository = createJobQueueRepositoryMock();
    const materializationRepository = createMaterializationRepositoryMock({
      findReusableSuccess: vi.fn(async () => ({
        id: "mat_compose_1",
        userId: "user-1",
        conversationId: "conv_media_1",
        materializationKey: "compose_media:reusable",
        toolName: "compose_media",
        pipelineVersion: null,
        status: "ready" as const,
        reusePolicy: "same_conversation" as const,
        inputSourceRefs: [],
        outputRefs: [{
          kind: "asset" as const,
          id: "uf_video_reused_1",
          userId: "user-1",
          conversationId: "conv_media_1",
        }],
        evidenceRefs: [],
        producedByJobId: "job_completed_1",
        supersededByRecordId: null,
        createdAt: "2026-04-13T12:00:00.000Z",
        updatedAt: "2026-04-13T12:00:00.000Z",
      })),
    });
    const descriptor = projectCatalogBoundToolDescriptor("compose_media", {
      jobQueueRepository,
      materializationRepository,
      userFileRepository: createUserFileRepositoryMock(),
    });

    const result = await descriptor.command.execute(
      {
        plan: {
          id: "plan_media_1",
          conversationId: "conv_media_1",
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        },
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_media_1",
      },
    ) as Record<string, unknown>;

    expect(jobQueueRepository.createJob).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      action: "compose_media",
      outcome: "exact_reuse",
      materializationId: "mat_compose_1",
      producedByJobId: "job_completed_1",
      primaryAssetId: "uf_video_reused_1",
      mimeType: "video/mp4",
      retentionClass: "conversation",
    });
  });

  it("ignores direct native_process overrides for user compose_media requests", async () => {
    const jobQueueRepository = createJobQueueRepositoryMock();
    const descriptor = projectCatalogBoundToolDescriptor("compose_media", {
      jobQueueRepository,
      materializationRepository: createMaterializationRepositoryMock(),
      userFileRepository: createUserFileRepositoryMock(),
    });
    const previousFixture = process.env.ORDO_NATIVE_COMPOSE_MEDIA_RESULT_FIXTURE;
    process.env.ORDO_NATIVE_COMPOSE_MEDIA_RESULT_FIXTURE = JSON.stringify({
      schemaVersion: 1,
      toolName: "compose_media",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "hybrid",
      inputSnapshot: { planId: "plan_media_1" },
      summary: {
        title: "Media Composition",
        subtitle: "MP4 · Native Worker",
        statusLine: "succeeded",
      },
      replaySnapshot: {
        route: "native_process",
        planId: "plan_media_1",
      },
      progress: { percent: 100, label: "Composition complete" },
      artifacts: [
        {
          kind: "video",
          label: "Composed Video",
          mimeType: "video/mp4",
          assetId: "uf_media_native_1",
          uri: "/api/user-files/uf_media_native_1",
          retentionClass: "conversation",
          source: "generated",
        },
      ],
      payload: {
        route: "native_process",
        planId: "plan_media_1",
        primaryAssetId: "uf_media_native_1",
        outputFormat: "mp4",
        outputBytes: 1024,
        mimeType: "video/mp4",
      },
    });

    try {
      const result = await descriptor.command.execute(
        {
          plan: {
            id: "plan_media_1",
            conversationId: "conv_media_1",
            visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
            audioClips: [],
            subtitlePolicy: "none",
            waveformPolicy: "none",
            outputFormat: "mp4",
          },
        },
        {
          role: "AUTHENTICATED",
          userId: "user-1",
          conversationId: "conv_media_1",
          executionPlanning: {
            enabledTargetKinds: ["native_process", "deferred_job", "host_ts"],
            preferredTargetKinds: ["native_process", "deferred_job", "host_ts"],
            browserRuntimeAvailable: false,
          },
        },
      ) as Record<string, unknown>;

      expect(jobQueueRepository.createJob).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        deferred_job: {
          jobId: "job_media_1",
          toolName: "compose_media",
          status: "queued",
        },
      });
      expect(executeComposeMediaJobMock).not.toHaveBeenCalled();
    } finally {
      if (previousFixture === undefined) {
        delete process.env.ORDO_NATIVE_COMPOSE_MEDIA_RESULT_FIXTURE;
      } else {
        process.env.ORDO_NATIVE_COMPOSE_MEDIA_RESULT_FIXTURE = previousFixture;
      }
    }
  });

  it("routes compose_media worker execution through the media worker and preserves canonical envelope shape", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("compose_media", {
      jobQueueRepository: createJobQueueRepositoryMock(),
      materializationRepository: createMaterializationRepositoryMock(),
      userFileRepository: createUserFileRepositoryMock(),
    });
    executeComposeMediaJobMock.mockImplementation(async (_request, onProgress) => {
      await onProgress?.({
        activePhaseKey: "rendering_media",
        progressPercent: 42,
        progressLabel: "Encoding narration video · about 8s left",
      });

      return {
        schemaVersion: 1,
        toolName: "compose_media",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "hybrid",
        inputSnapshot: { planId: "plan_media_worker_1" },
        summary: {
          title: "Media Composition",
          subtitle: "MP4 · Media Worker",
          statusLine: "succeeded",
        },
        replaySnapshot: {
          route: "deferred_remote",
          planId: "plan_media_worker_1",
        },
        progress: { percent: 100, label: "Composition complete" },
        artifacts: [
          {
            kind: "video",
            label: "Composed Video",
            mimeType: "video/mp4",
            assetId: "uf_media_worker_1",
            uri: "/api/user-files/uf_media_worker_1",
            retentionClass: "conversation",
            source: "generated",
          },
        ],
        payload: {
          route: "deferred_remote",
          planId: "plan_media_worker_1",
          primaryAssetId: "uf_media_worker_1",
          outputFormat: "mp4",
        },
      };
    });
    const reportProgress = vi.fn(async () => undefined);

    const result = await descriptor.command.execute(
      {
        plan: {
          id: "plan_media_worker_1",
          conversationId: "conv_media_1",
          visualClips: [{ assetId: "asset_visual_1", kind: "video" }],
          audioClips: [],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
        },
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_media_1",
        executionPrincipal: "system_worker",
        toolInvocationId: "toolu_compose_1",
        reportProgress,
      },
    ) as Record<string, unknown>;

    expect(executeComposeMediaJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        conversationId: "conv_media_1",
        toolInvocationId: "toolu_compose_1",
        plan: expect.objectContaining({
          id: "plan_media_worker_1",
          outputFormat: "mp4",
        }),
      }),
      expect.any(Function),
    );
    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      activePhaseKey: "rendering_media",
      progressPercent: 42,
    }));
    expect(reportProgress).toHaveBeenCalledWith(expect.objectContaining({
      activePhaseKey: null,
      progressPercent: 100,
      progressLabel: "Composition complete",
      resultEnvelope: expect.objectContaining({
        toolName: "compose_media",
        replaySnapshot: expect.objectContaining({ route: "deferred_remote" }),
      }),
    }));
    expect(result).toMatchObject({
      schemaVersion: 1,
      toolName: "compose_media",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "hybrid",
      replaySnapshot: expect.objectContaining({
        route: "deferred_remote",
        planId: "plan_media_worker_1",
      }),
      artifacts: [expect.objectContaining({
        kind: "video",
        assetId: "uf_media_worker_1",
        mimeType: "video/mp4",
      })],
      payload: expect.objectContaining({
        route: "deferred_remote",
        primaryAssetId: "uf_media_worker_1",
        outputFormat: "mp4",
      }),
    });
  });

  it("routes generate_audio through the canonical deferred job path", async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      createJob: vi.fn(async (seed: JobRequestSeed) => createJobRequest({
        id: "job_audio_1",
        toolName: "generate_audio",
        requestPayload: seed.requestPayload,
        toolInvocationId: seed.toolInvocationId ?? null,
      })),
      appendEvent: vi.fn(async (seed: JobEventSeed) => createJobEvent({
        id: "evt_audio_1",
        jobId: seed.jobId,
        conversationId: seed.conversationId,
        payload: seed.payload,
      })),
    });
    const descriptor = projectCatalogBoundToolDescriptor("generate_audio", {
      jobQueueRepository,
      materializationRepository: createMaterializationRepositoryMock(),
      userFileRepository: createUserFileRepositoryMock(),
    });

    const result = await descriptor.command.execute(
      {
        title: "Founder memo",
        text: "This is the founder memo for the weekly review.",
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_audio_1",
        toolInvocationId: "toolu_audio_1",
      },
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      deferred_job: {
        jobId: "job_audio_1",
        toolName: "generate_audio",
        toolInvocationId: "toolu_audio_1",
        status: "queued",
      },
    });
    expect(jobQueueRepository.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "generate_audio",
        conversationId: "conv_audio_1",
        toolInvocationId: "toolu_audio_1",
        requestPayload: expect.objectContaining({
          title: "Founder memo",
          text: "This is the founder memo for the weekly review.",
          materializationKey: expect.stringContaining("generate_audio:"),
        }),
      }),
    );
    expect(generateStoredAudioArtifactMock).not.toHaveBeenCalled();
  });

  it("routes chart and graph generation with tool invocation provenance", async () => {
    const chartDescriptor = projectCatalogBoundToolDescriptor("generate_chart");
    const graphDescriptor = projectCatalogBoundToolDescriptor("generate_graph");

    const chartResult = await chartDescriptor.command.execute(
      {
        code: "flowchart TD\n  A[Start] --> B[Finish]",
        title: "Flow",
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_1",
        toolInvocationId: "toolu_chart_1",
      },
    ) as Record<string, unknown>;
    const graphResult = await graphDescriptor.command.execute(
      {
        title: "Revenue",
        data: { rows: [{ month: "Jan", revenue: 42 }] },
        spec: {
          graphType: "bar",
          xField: "month",
          yField: "revenue",
        },
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_1",
        toolInvocationId: "toolu_graph_1",
      },
    ) as Record<string, unknown>;

    expect(chartResult).toMatchObject({
      assetKind: "chart",
      toolInvocationId: "toolu_chart_1",
    });
    expect(graphResult).toMatchObject({
      assetKind: "graph",
      toolInvocationId: "toolu_graph_1",
    });
    expect(mockUfsStore).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          toolName: "generate_chart",
          toolInvocationId: "toolu_chart_1",
        }),
      }),
    );
    expect(mockUfsStore).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          toolName: "generate_graph",
          toolInvocationId: "toolu_graph_1",
        }),
      }),
    );
  });

  it("keeps generate_audio on deferred_job when browser planner availability is explicitly disabled", async () => {
    const jobQueueRepository = createJobQueueRepositoryMock({
      createJob: vi.fn(async (seed: JobRequestSeed) => createJobRequest({
        id: "job_audio_2",
        toolName: "generate_audio",
        requestPayload: seed.requestPayload,
      })),
      appendEvent: vi.fn(async (seed: JobEventSeed) => createJobEvent({
        id: "evt_audio_2",
        jobId: seed.jobId,
        conversationId: seed.conversationId,
        payload: seed.payload,
      })),
    });
    const descriptor = projectCatalogBoundToolDescriptor("generate_audio", {
      jobQueueRepository,
      materializationRepository: createMaterializationRepositoryMock(),
      userFileRepository: createUserFileRepositoryMock(),
    });

    const result = await descriptor.command.execute(
      {
        title: "Founder memo",
        text: "This is the founder memo for the weekly review.",
      },
      {
        role: "AUTHENTICATED",
        userId: "user-1",
        conversationId: "conv_audio_1",
        executionPlanning: {
          browserRuntimeAvailable: false,
        },
      },
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      deferred_job: {
        jobId: "job_audio_2",
        toolName: "generate_audio",
        status: "queued",
      },
    });
    expect(jobQueueRepository.createJob).toHaveBeenCalledTimes(1);
    expect(generateStoredAudioArtifactMock).not.toHaveBeenCalled();
  });

  it("uses the catalog-backed search_corpus validator before repository work", async () => {
    const corpusRepo = createCorpusRepoMock();
    const descriptor = projectCatalogBoundToolDescriptor("search_corpus", { corpusRepo });

    await expect(
      descriptor.command.execute(
        { query: "clarity", max_results: "bad" },
        { role: "AUTHENTICATED", userId: "user-1" },
      ),
    ).rejects.toThrow("search_corpus max_results must be a positive number.");

    expect(corpusRepo.getAllSections).not.toHaveBeenCalled();
    expect(corpusRepo.getAllDocuments).not.toHaveBeenCalled();
  });

  it("uses the catalog-backed calculator parser and executor", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("calculator");

    const result = await descriptor.command.execute(
      { operation: "multiply", a: 6, b: 7 },
      { role: "ANONYMOUS", userId: "anonymous" },
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      operation: "multiply",
      a: 6,
      b: 7,
      result: 42,
    });
  });

  it("uses the catalog-backed get_current_page executor with authoritative context", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("get_current_page");

    const result = await descriptor.command.execute(
      {},
      { role: "AUTHENTICATED", userId: "user-1", currentPathname: "/journal" },
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      pathname: "/journal",
      label: "Journal",
    });
  });

  it("sanitizes admin_search input and preserves the empty-results contract", async () => {
    const descriptor = projectCatalogBoundToolDescriptor("admin_search");

    const result = await descriptor.command.execute(
      {},
      { role: "ADMIN", userId: "admin-1" },
    ) as Record<string, unknown>;

    expect(result).toEqual({
      results: [],
      totalCount: 0,
    });
  });

  it("routes admin_search through the mcp_stdio planner path by default", async () => {
    const executeSpy = vi.spyOn(adminSearchToolModule, "executeAdminSearch");
    const descriptor = projectCatalogBoundToolDescriptor("admin_search");

    try {
      const result = await descriptor.command.execute(
        {},
        { role: "ADMIN", userId: "admin-1" },
      ) as Record<string, unknown>;

      expect(executeSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        results: [],
        totalCount: 0,
      });
    } finally {
      executeSpy.mockRestore();
    }
  }, MCP_PLANNER_TEST_TIMEOUT_MS);

  it("uses the catalog-backed inspect_runtime_context executor with registry deps", async () => {
    const registry = new ToolRegistry();
    const descriptor = projectCatalogBoundToolDescriptor("inspect_runtime_context", { registry });
    registry.register(descriptor);

    const result = await descriptor.command.execute(
      {},
      {
        role: "ANONYMOUS",
        userId: "anonymous",
        currentPathname: "/library",
        currentPageSnapshot: {
          pathname: "/library",
          title: "Library",
          mainHeading: "Library",
          sectionHeadings: ["Featured"],
          selectedText: null,
          contentExcerpt: "Browse the library.",
        },
      },
    ) as Record<string, unknown>;

    expect(result).toMatchObject({
      action: "inspect_runtime_context",
      role: "ANONYMOUS",
      currentPathname: "/library",
      toolCount: 1,
    });
    expect((result.availableTools as Array<{ name: string }>).map((entry) => entry.name)).toContain(
      "inspect_runtime_context",
    );
  });

  it("uses the catalog-backed set_preference executor with repository deps", async () => {
    const userPreferencesRepo = createUserPreferencesRepoMock();
    const descriptor = projectCatalogBoundToolDescriptor("set_preference", { userPreferencesRepo });

    const rawResult = await descriptor.command.execute(
      { key: "preferred_name", value: "Keith" },
      { role: "AUTHENTICATED", userId: "user-1" },
    ) as string;

    expect(userPreferencesRepo.set).toHaveBeenCalledWith("user-1", "preferred_name", "Keith");
    expect(JSON.parse(rawResult)).toMatchObject({
      action: "set_preference",
      key: "preferred_name",
      value: "Keith",
    });
  });

  it("uses legacy-wrapped profile service deps for fully catalog-bound profile tools", async () => {
    const profileService = createProfileServiceMock();
    const descriptor = projectCatalogBoundToolDescriptor("get_my_profile", { profileService });

    const result = await descriptor.command.execute(
      {},
      { role: "AUTHENTICATED", userId: "user-1" },
    ) as Record<string, unknown>;

    expect(profileService.getProfile).toHaveBeenCalledWith("user-1");
    expect(result).toMatchObject({
      action: "get_my_profile",
      profile: {
        id: "user-1",
        name: "User One",
      },
    });
  });

  it("derives full tool membership from catalog bundle ids", () => {
    const runtimeCatalogBoundToolNames = projectAllCapabilityRuntimeStatics()
      .filter((runtime) => runtime.binding !== null && runtime.binding.validatorId !== null)
      .map((runtime) => runtime.capabilityName)
      .sort((left, right) => left.localeCompare(right));

    expect(CATALOG_BOUND_TOOL_NAMES).toEqual(
      runtimeCatalogBoundToolNames,
    );
    expect(CATALOG_BOUND_TOOL_NAMES).toHaveLength(59);

    expect(getCatalogBoundToolNamesForBundle("admin")).toEqual([
      "admin_prioritize_leads",
      "admin_prioritize_offer",
      "admin_triage_routing_risk",
      "admin_web_search",
      "inspect_runtime_logs",
      "produce_product",
    ]);
    expect(getCatalogBoundToolNamesForBundle("affiliate")).toEqual([
      "get_admin_affiliate_summary",
      "get_my_affiliate_summary",
      "list_admin_referral_exceptions",
      "list_my_referral_activity",
    ]);
    expect(getCatalogBoundToolNamesForBundle("blog")).toEqual([
      "approve_journal_post",
      "compose_blog_article",
      "draft_content",
      "generate_blog_image",
      "generate_blog_image_prompt",
      "get_journal_post",
      "get_journal_workflow_summary",
      "list_journal_posts",
      "list_journal_revisions",
      "prepare_journal_post_for_publish",
      "produce_blog_article",
      "publish_content",
      "publish_journal_post",
      "qa_blog_article",
      "resolve_blog_article_qa",
      "restore_journal_revision",
      "select_journal_hero_image",
      "submit_journal_review",
      "update_journal_draft",
      "update_journal_metadata",
    ]);
    expect(getCatalogBoundToolNamesForBundle("calculator")).toEqual([
      "calculator",
    ]);
    expect(getCatalogBoundToolNamesForBundle("conversation")).toEqual([
      "search_my_conversations",
      "search_relationship_memory",
    ]);
    expect(getCatalogBoundToolNamesForBundle("corpus")).toEqual([
      "get_checklist",
      "get_corpus_summary",
      "get_section",
      "list_practitioners",
      "search_corpus",
    ]);
    expect(getCatalogBoundToolNamesForBundle("job")).toEqual([
      "get_deferred_job_status",
      "list_deferred_jobs",
    ]);
    expect(getCatalogBoundToolNamesForBundle("media")).toEqual([
      "compose_media",
      "generate_audio",
      "generate_chart",
      "generate_graph",
      "list_conversation_media_assets",
    ]);
    expect(getCatalogBoundToolNamesForBundle("navigation")).toEqual([
      "admin_search",
      "get_current_page",
      "inspect_runtime_context",
      "list_available_pages",
      "navigate_to_page",
    ]);
    expect(getCatalogBoundToolNamesForBundle("profile")).toEqual([
      "get_my_job_status",
      "get_my_profile",
      "get_my_referral_qr",
      "list_my_jobs",
      "update_my_profile",
    ]);
    expect(getCatalogBoundToolNamesForBundle("theme")).toEqual([
      "adjust_ui",
      "inspect_theme",
      "set_preference",
      "set_theme",
    ]);
  });

  it("removes bundle-local manual registration for the fully catalog-bound surface", () => {
    const adminBundle = readSource("src/lib/chat/tool-bundles/admin-tools.ts");
    const affiliateBundle = readSource("src/lib/chat/tool-bundles/affiliate-tools.ts");
    const blogBundle = readSource("src/lib/chat/tool-bundles/blog-tools.ts");
    const calculatorBundle = readSource("src/lib/chat/tool-bundles/calculator-tools.ts");
    const conversationBundle = readSource("src/lib/chat/tool-bundles/conversation-tools.ts");
    const corpusBundle = readSource("src/lib/chat/tool-bundles/corpus-tools.ts");
    const jobBundle = readSource("src/lib/chat/tool-bundles/job-tools.ts");
    const mediaBundle = readSource("src/lib/chat/tool-bundles/media-tools.ts");
    const navigationBundle = readSource("src/lib/chat/tool-bundles/navigation-tools.ts");
    const profileBundle = readSource("src/lib/chat/tool-bundles/profile-tools.ts");
    const themeBundle = readSource("src/lib/chat/tool-bundles/theme-tools.ts");
    const compositionRoot = readSource("src/lib/chat/tool-composition-root.ts");

    expect(adminBundle).not.toContain("createAdminWebSearchTool");
    expect(adminBundle).not.toContain("createAdminPrioritizeLeadsTool");
    expect(adminBundle).not.toContain("registerCatalogBoundToolsForBundle(registry, ADMIN_BUNDLE.id)");
    expect(adminBundle).toContain("createCatalogBoundToolBundle(");
    expect(adminBundle).toContain('registerCatalogBoundToolBundle(registry, "admin"');
    expect(affiliateBundle).not.toContain("createGetMyAffiliateSummaryTool");
    expect(affiliateBundle).toContain('registerCatalogBoundToolBundle(registry, "affiliate"');
    expect(blogBundle).not.toContain("createDraftContentTool");
    expect(blogBundle).not.toContain("createPublishContentTool");
    expect(blogBundle).not.toContain("createGetJournalPostTool");
    expect(blogBundle).toContain('registerCatalogBoundToolBundle(registry, "blog"');
    expect(calculatorBundle).not.toContain("calculatorTool");
    expect(calculatorBundle).not.toContain("generateAudioTool");
    expect(calculatorBundle).toContain('registerCatalogBoundToolBundle(registry, "calculator"');
    expect(conversationBundle).not.toContain("createSearchMyConversationsTool");
    expect(conversationBundle).toContain('registerCatalogBoundToolBundle(registry, "conversation"');
    expect(corpusBundle).not.toContain("createSearchCorpusTool");
    expect(corpusBundle).not.toContain("createGetSectionTool");
    expect(corpusBundle).not.toContain("registerCatalogBoundToolsForBundle(registry, CORPUS_BUNDLE.id");
    expect(corpusBundle).toContain('registerCatalogBoundToolBundle(registry, "corpus"');
    expect(jobBundle).not.toContain("createGetDeferredJobStatusTool");
    expect(jobBundle).toContain('registerCatalogBoundToolBundle(registry, "job"');
    expect(mediaBundle).not.toContain("composeMediaTool");
    expect(mediaBundle).toContain('registerCatalogBoundToolBundle(registry, "media"');
    expect(navigationBundle).not.toContain("adminSearchTool");
    expect(navigationBundle).not.toContain("getCurrentPageTool");
    expect(navigationBundle).not.toContain("createInspectRuntimeContextTool");
    expect(navigationBundle).not.toContain("listAvailablePagesTool");
    expect(navigationBundle).not.toContain("navigateToPageTool");
    expect(profileBundle).not.toContain("createGetMyProfileTool");
    expect(profileBundle).toContain('registerCatalogBoundToolBundle(registry, "profile"');
    expect(themeBundle).not.toContain("createAdjustUiTool");
    expect(themeBundle).not.toContain("createInspectThemeTool");
    expect(themeBundle).not.toContain("createSetPreferenceTool");
    expect(themeBundle).not.toContain("setThemeTool");
    expect(blogBundle).not.toContain("registerCatalogBoundToolsForBundle(registry, BLOG_BUNDLE.id");
    expect(blogBundle).toContain("createCatalogBoundToolBundle(");
    expect(navigationBundle).toContain('registerCatalogBoundToolBundle(registry, "navigation"');
    expect(themeBundle).toContain('registerCatalogBoundToolBundle(registry, "theme"');
    expect(compositionRoot).not.toContain("createAdminWebSearchTool");
    expect(compositionRoot).not.toContain("createDraftContentTool");
    expect(compositionRoot).not.toContain("createPublishContentTool");
    expect(compositionRoot).not.toContain("createSearchCorpusTool");
    expect(compositionRoot).not.toContain("composeMediaTool");
  });
});
