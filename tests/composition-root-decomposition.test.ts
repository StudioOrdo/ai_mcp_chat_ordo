import { describe, it, expect, vi } from "vitest";

// Mock all heavy dependencies so bundles can register without real DB/services
// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({ prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })) })) }));
vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return createMockRepositoryFactory({
    getCorpusRepository: () => ({ search: vi.fn(), getSection: vi.fn(), getSummary: vi.fn() }),
    getBackupSystemCommandDataMapper: () => ({
      findById: vi.fn(),
      listRecentBackupRestore: vi.fn(() => []),
      listBySnapshotId: vi.fn(() => []),
      listByRestorePlanId: vi.fn(() => []),
      countByStatusForRustDaemon: vi.fn(() => ({})),
      hasActiveBackupOrRestoreCommand: vi.fn(() => false),
      findLatestScheduledCommand: vi.fn(() => null),
      listSucceededScheduledBackupCommands: vi.fn(() => []),
    }),
  });
});
vi.mock("@/adapters/LocalEmbedder", () => ({ localEmbedder: { embed: vi.fn(() => [0]) } }));
vi.mock("@/adapters/SQLiteVectorStore", () => ({
  SQLiteVectorStore: class { search = vi.fn() },
}));
vi.mock("@/adapters/UserPreferencesDataMapper", () => ({
  UserPreferencesDataMapper: class { get = vi.fn(); set = vi.fn() },
}));
vi.mock("@/lib/profile/profile-service", () => ({
  createProfileService: vi.fn(() => ({ getProfile: vi.fn(), updateProfile: vi.fn(), getReferralQr: vi.fn() })),
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
vi.mock("@/core/use-cases/JournalEditorialInteractor", () => ({
  JournalEditorialInteractor: class {},
}));
vi.mock("@/lib/chat/search-pipeline", () => ({ getSearchHandler: vi.fn() }));
vi.mock("@/lib/config/instance", () => ({ getInstanceTools: vi.fn(() => ({})) }));
vi.mock("@/lib/chat/embedding-module", () => ({
  getEmbeddingPipelineFactory: vi.fn(),
  getBookPipeline: vi.fn(),
  getCorpusPipeline: vi.fn(),
}));

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { RoleAwareSearchFormatter } from "@/core/tool-registry/ToolResultFormatter";
import { registerCalculatorTools } from "@/lib/chat/tool-bundles/calculator-tools";
import { registerThemeTools } from "@/lib/chat/tool-bundles/theme-tools";
import { registerCorpusTools } from "@/lib/chat/tool-bundles/corpus-tools";
import { registerBlogTools } from "@/lib/chat/tool-bundles/blog-tools";
import { createToolRegistry } from "@/lib/chat/tool-composition-root";
import { getCorpusRepository } from "@/adapters/RepositoryFactory";

function freshRegistry() {
  return new ToolRegistry(new RoleAwareSearchFormatter());
}

describe("Spec 14: Composition Root Decomposition", () => {
  describe("Bundle registration", () => {
    it("registerCalculatorTools adds expected tool names", () => {
      const reg = freshRegistry();
      registerCalculatorTools(reg);
      const names = reg.getToolNames();
      expect(names).toEqual(expect.arrayContaining(["calculator"]));
      expect(names).toHaveLength(1);
    });

    it("registerThemeTools adds expected tool names", () => {
      const reg = freshRegistry();
      registerThemeTools(reg);
      const names = reg.getToolNames();
      expect(names).toEqual(expect.arrayContaining(["set_theme", "inspect_theme", "adjust_ui", "set_preference"]));
      expect(names).toHaveLength(4);
    });

    it("registerCorpusTools adds expected tool names", () => {
      const reg = freshRegistry();
      const corpusRepo = getCorpusRepository();
      registerCorpusTools(reg, { corpusRepo });
      const names = reg.getToolNames();
      expect(names).toEqual(expect.arrayContaining(["search_corpus", "get_section", "get_corpus_summary", "get_checklist", "list_practitioners"]));
      expect(names).toHaveLength(5);
    });

    it("registerBlogTools adds expected tool names", () => {
      const reg = freshRegistry();
      registerBlogTools(reg);
      const names = reg.getToolNames();
      expect(names.length).toBeGreaterThanOrEqual(20);
      expect(names).toEqual(expect.arrayContaining([
        "list_journal_posts", "get_journal_post", "draft_content", "publish_content",
        "compose_blog_article", "produce_blog_article",
      ]));
    });

    it("createToolRegistry produces registry with all tools", () => {
      const corpusRepo = getCorpusRepository();
      const reg = createToolRegistry(corpusRepo);
      const names = reg.getToolNames();
      expect(names.length).toBeGreaterThanOrEqual(46);
    });

    it("no duplicate tool names across bundles", () => {
      const corpusRepo = getCorpusRepository();
      const reg = createToolRegistry(corpusRepo);
      const names = reg.getToolNames();
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});
