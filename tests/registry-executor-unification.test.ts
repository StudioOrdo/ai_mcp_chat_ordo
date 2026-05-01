import { describe, it, expect, beforeEach, vi } from "vitest";

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/observability/logger", () => ({
  logEvent: vi.fn(),
  logFailure: vi.fn(),
  logDegradation: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getCorpusRepository: vi.fn(() => ({
    getSections: vi.fn(() => []),
    getSection: vi.fn(),
    getSummary: vi.fn(),
    getChecklist: vi.fn(),
    getPractitioners: vi.fn(),
  })),
  getBlogAssetRepository: vi.fn(() => ({})),
  getBlogPostRepository: vi.fn(() => ({})),
  getJobStatusQuery: vi.fn(() => ({
    getJobSnapshot: vi.fn(),
    getUserJobSnapshot: vi.fn(),
    listUserJobSnapshots: vi.fn(() => []),
    listConversationJobSnapshots: vi.fn(() => []),
  })),
  getJobQueueRepository: vi.fn(() => ({
    createJob: vi.fn(),
    appendEvent: vi.fn(),
    findJobById: vi.fn(),
    findActiveJobByDedupeKey: vi.fn(),
    updateJobStatus: vi.fn(),
    listEventsForJob: vi.fn(() => []),
    findLatestRenderableEventForJob: vi.fn(),
    cancelJob: vi.fn(),
  })),
  getUserFileDataMapper: vi.fn(() => ({
    findById: vi.fn(),
    listForUser: vi.fn(() => []),
    create: vi.fn(),
  })),
  getAssetCatalogReader: vi.fn(() => ({
    listConversationMediaAssets: vi.fn(() => []),
  })),
  getUserPreferencesDataMapper: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
  getFactoryRepository: vi.fn(() => ({})),
  getBlogPostRevisionRepository: vi.fn(() => ({})),
  getJournalEditorialMutationRepository: vi.fn(() => ({})),
  getRelationshipMemoryRepository: vi.fn(() => ({
    search: vi.fn(() => []),
  })),
  getVectorStore: vi.fn(() => ({ search: vi.fn(() => []) })),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
  })),
}));

vi.mock("@/lib/chat/search-pipeline", () => ({
  getSearchHandler: vi.fn(() => ({
    search: vi.fn(() => []),
  })),
}));

vi.mock("@/lib/chat/embedding-module", () => ({
  getEmbeddingPipelineFactory: vi.fn(),
  getBookPipeline: vi.fn(),
  getCorpusPipeline: vi.fn(),
}));

vi.mock("@/adapters/LocalEmbedder", () => ({
  localEmbedder: {
    embed: vi.fn(() => [0]),
  },
}));

vi.mock("@/adapters/SQLiteVectorStore", () => ({
  SQLiteVectorStore: class MockSQLiteVectorStore {
    search = vi.fn(() => []);
  },
}));

vi.mock("@/adapters/UserPreferencesDataMapper", () => ({
  UserPreferencesDataMapper: class MockUserPreferencesDataMapper {
    get = vi.fn();
    set = vi.fn();
    getAll = vi.fn(() => []);
  },
}));

vi.mock("@/lib/config/instance", () => ({
  getInstanceTools: vi.fn(() => ({})),
}));

vi.mock("@/lib/profile/profile-service", () => ({
  createProfileService: vi.fn(() => ({})),
}));

vi.mock("@/lib/operator/operator-signal-loaders", () => ({
  loadOperatorLeadQueue: vi.fn(),
  loadOperatorFunnelRecommendations: vi.fn(),
  loadOperatorAnonymousOpportunities: vi.fn(),
  loadOperatorRecentConversations: vi.fn(),
  loadOperatorRoutingReview: vi.fn(),
}));

vi.mock("@/lib/blog/blog-production-root", () => ({
  getBlogArticleProductionService: vi.fn(() => ({})),
  getBlogImageGenerationService: vi.fn(() => ({})),
}));

import {
  getToolComposition,
  _resetToolComposition,
} from "@/lib/chat/tool-composition-root";

describe("Spec 01: Registry/Executor Unification", () => {
  beforeEach(() => {
    _resetToolComposition();
  });

  it("getToolComposition returns same registry and executor on repeated calls", () => {
    const first = getToolComposition();
    const second = getToolComposition();

    expect(first.registry).toBe(second.registry);
    expect(first.executor).toBe(second.executor);
    expect(first).toBe(second);
  });

  it("executor operates on the same registry used for descriptor lookup", async () => {
    const { registry, executor } = getToolComposition();
    const calcDescriptor = registry.getDescriptor("calculator");

    expect(calcDescriptor).toBeDefined();
    expect(calcDescriptor!.name).toBe("calculator");

    // Execute the calculator tool — it should succeed because the executor
    // wraps the same registry instance.
    const result = await executor(
      "calculator",
      { operation: "add", a: 2, b: 2 },
      { role: "ANONYMOUS", userId: "test-user" },
    );

    expect(result).toBeDefined();
  });

  it("_resetToolComposition causes fresh instances on next call", () => {
    const first = getToolComposition();
    _resetToolComposition();
    const second = getToolComposition();

    expect(first.registry).not.toBe(second.registry);
    expect(first.executor).not.toBe(second.executor);
    expect(first).not.toBe(second);
  });

  it("executor respects RBAC — denies unauthorized roles", async () => {
    const { registry, executor } = getToolComposition();

    // Find an ADMIN-only tool
    const adminToolName = "admin_web_search";
    const descriptor = registry.getDescriptor(adminToolName);

    if (!descriptor) {
      // If the tool isn't registered (filtered by instance config), skip
      return;
    }

    // ANONYMOUS should not be able to execute an admin tool
    const canExecute = registry.canExecute(adminToolName, "ANONYMOUS");
    expect(canExecute).toBe(false);

    const result = await executor(adminToolName, {}, { role: "ANONYMOUS", userId: "test-user" });

    expect(result).toMatchObject({
      ok: false,
      action: "tool_permission_denied",
      toolName: adminToolName,
      role: "ANONYMOUS",
      reason: "role_denied",
    });
  });

  it("executor short-circuits tools removed from the request-scoped manifest", async () => {
    const { registry, executor } = getToolComposition();

    if (!registry.getDescriptor("calculator")) {
      return;
    }

    const onToolDenied = vi.fn();
    const result = await executor(
      "calculator",
      { operation: "add", a: 2, b: 2 },
      {
        role: "ADMIN",
        userId: "test-user",
        conversationId: "conv_1",
        conversationLane: "organization",
        allowedToolNames: ["search_corpus"],
        onToolDenied,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      action: "tool_permission_denied",
      toolName: "calculator",
      role: "ADMIN",
      reason: "manifest_prefiltered",
      lane: "organization",
    });
    expect(onToolDenied).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "calculator",
      reason: "manifest_prefiltered",
      conversationId: "conv_1",
      lane: "organization",
      allowedToolCount: 1,
    }));
  });

  it("composition result is frozen", () => {
    const result = getToolComposition();

    expect(Object.isFrozen(result)).toBe(true);

    // Attempting to mutate should throw in strict mode or silently fail
    expect(() => {
      (result as unknown as Record<string, unknown>).registry = null;
    }).toThrow();
  });
});
