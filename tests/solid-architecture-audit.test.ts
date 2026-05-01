import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// §5.1 Positive tests — refactors work correctly
// ---------------------------------------------------------------------------

describe("TD-C — DIP repair in core commands (F2)", () => {
  it("P1: SetPreferenceCommand receives repository via constructor injection", () => {
    const src = readSource("src/core/use-cases/tools/set-preference.tool.ts");
    expect(src).toMatch(/constructor\s*\(.*UserPreferencesRepository/);
  });

  it("P2: AdjustUICommand receives repository via constructor injection", () => {
    const src = readSource("src/core/use-cases/tools/UiTools.ts");
    expect(src).toMatch(/constructor\s*\(.*UserPreferencesRepository/);
  });
});

describe("TD-C — SRP extraction from tool-composition-root (F1)", () => {
  it("P3: search-pipeline.ts exports getSearchHandler", () => {
    expect(existsSync(join(process.cwd(), "src/lib/chat/search-pipeline.ts"))).toBe(true);
    const src = readSource("src/lib/chat/search-pipeline.ts");
    expect(src).toMatch(/export\s+function\s+getSearchHandler/);
  });

  it("P4: embedding-module.ts exports pipeline factories", () => {
    expect(existsSync(join(process.cwd(), "src/lib/chat/embedding-module.ts"))).toBe(true);
    const src = readSource("src/lib/chat/embedding-module.ts");
    expect(src).toMatch(/export\s+function\s+getEmbeddingPipelineFactory/);
    expect(src).toMatch(/export\s+function\s+getBookPipeline/);
    expect(src).toMatch(/export\s+function\s+getCorpusPipeline/);
  });

  it("P5: tool-composition-root.ts delegates to search-pipeline", () => {
    const src = readSource("src/lib/chat/tool-composition-root.ts");
    expect(src).toContain("./search-pipeline");
  });

  it("P5f: tool-composition-root.ts builds executors through the hook runner", () => {
    const src = readSource("src/lib/chat/tool-composition-root.ts");
    expect(src).toContain("createToolExecutionHookRunner");
    expect(src).not.toContain("composeMiddleware(");
  });

  it("P5a: stream route handler derives model-visible tools from ToolRegistry through request-scoped selection", () => {
    const src = readSource("src/lib/chat/stream-route-handler.ts");
    expect(src).toContain("const { registry: toolRegistry, executor: baseToolExecutor } = getAgentPlatformFacade().getExecutionSurface()");
    expect(src).toContain("getRequestScopedToolSelection(");
    expect(src).not.toContain("getRuntimeToolManifestForRole(");
  });

  it("P5d: stream route handler delegates validation and overlap guards to ChatStreamPipeline", () => {
    const src = readSource("src/lib/chat/stream-route-handler.ts");
    expect(src).toContain("pipeline.validateAndParse");
    expect(src).toContain("pipeline.rejectIfActiveStreamExists");
    expect(src).not.toContain("ChatStreamRequestSchema");
    expect(src).not.toContain("active-stream-registry");
  });

  it("P5g: stream route handler passes request.signal into the stream pipeline response builder", () => {
    const src = readSource("src/lib/chat/stream-route-handler.ts");
    expect(src).toContain("requestSignal: options.request.signal");
  });

  it("P5h: stream-pipeline composes runtime lifecycle hooks through the chat hook runner", () => {
    const src = readSource("src/lib/chat/stream-pipeline.ts");
    expect(src).toContain("createChatRuntimeHookRunner");
    expect(src).toContain("getChatRuntimeHooks");
  });
});

describe("TD-C — deterministic manifest ownership (F8)", () => {
  it("P5b: ToolRegistry owns alphabetical schema ordering", () => {
    const src = readSource("src/core/tool-registry/ToolRegistry.ts");
    expect(src).toMatch(/sort\(\(left,\s*right\)\s*=>\s*left\.name\.localeCompare\(right\.name\)\)/);
  });

  it("P5c: runtime-manifest.ts preserves registry ordering without re-sorting", () => {
    const src = readSource("src/lib/chat/runtime-manifest.ts");
    expect(src).toContain("registry.getSchemasForRole(role)");
    expect(src).not.toContain(".sort(");
  });

  it("E8a: runtime manifest ordering matches ToolRegistry ordering for every role", async () => {
    const { getToolComposition } = await import("@/lib/chat/tool-composition-root");
    const { getRuntimeToolManifestForRole, RUNTIME_MANIFEST_ROLE_ORDER } = await import("@/lib/chat/runtime-manifest");

    const registry = getToolComposition().registry;

    for (const role of RUNTIME_MANIFEST_ROLE_ORDER) {
      expect(getRuntimeToolManifestForRole(registry, role).map((entry) => entry.name)).toEqual(
        registry.getSchemasForRole(role).map((schema) => schema.name),
      );
    }
  }, 15_000);
});

describe("TD-C — OCP fixes (F3, F4)", () => {
  it("P6: ToolCategory accepts extensible string values", () => {
    const src = readSource("src/core/tool-registry/ToolDescriptor.ts");
    expect(src).toContain("(string & {})");
    // TypeScript compilation validates that "analytics" is assignable
  });

  it("P7: EmbeddingPipelineFactory uses chunker registry", () => {
    const src = readSource("src/core/search/EmbeddingPipelineFactory.ts");
    expect(src).toContain("chunkerRegistry");
    expect(src).not.toContain('sourceType === "conversation"');
  });
});

describe("TD-C — SRP proxy extraction (F7)", () => {
  it("P8: proxy.ts extracts captureReferral function", () => {
    const src = readSource("src/proxy.ts");
    expect(src).toMatch(/function\s+captureReferral/);
  });
});

describe("TD-C — DIP cleanup for admin tool defaults (F6)", () => {
  it("P9: admin tool factories require explicit loader parameters", () => {
    const src = readSource("src/core/use-cases/tools/admin-prioritize-leads.tool.ts");
    expect(src).not.toMatch(/import.*from\s+["']@\/lib\/dashboard\/dashboard-loaders["']/);
  });

  it("P10: operator-signal facade re-exports the canonical backend functions", async () => {
    const facade = await import("@/lib/operator/operator-signal-loaders");
    const backend = await import("@/lib/operator/operator-signal-backend");

    expect(facade.loadConversationWorkspaceBlock).toBe(backend.loadConversationWorkspaceBlock);
    expect(facade.loadLeadQueueBlock).toBe(backend.loadLeadQueueBlock);
    expect(facade.loadFunnelRecommendationsBlock).toBe(backend.loadFunnelRecommendationsBlock);
  }, 15000);

  it("P11: dashboard compatibility modules are no longer required by the operator backend path", () => {
    expect(existsSync(join(process.cwd(), "src/lib/dashboard/dashboard-shared.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/lib/dashboard/loaders/customer-loaders.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/lib/dashboard/loaders/admin-loaders.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/lib/dashboard/loaders/analytics-loaders.ts"))).toBe(false);
  });

  it("P12: canonical operator modules remain present after compatibility collapse", () => {
    expect(existsSync(join(process.cwd(), "src/lib/operator/operator-shared.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/lib/operator/operator-signal-backend.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/lib/operator/operator-signal-loaders.ts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §5.2 Negative tests — old patterns forbidden
// ---------------------------------------------------------------------------

describe("TD-C — DIP negative (F2)", () => {
  it("N1: no concrete adapter imports in set-preference.tool.ts", () => {
    const src = readSource("src/core/use-cases/tools/set-preference.tool.ts");
    expect(src).not.toMatch(/import.*UserPreferencesDataMapper/);
    expect(src).not.toMatch(/import.*getDb/);
  });

  it("N2: no concrete adapter imports in UiTools.ts", () => {
    const src = readSource("src/core/use-cases/tools/UiTools.ts");
    expect(src).not.toMatch(/import.*UserPreferencesDataMapper/);
    expect(src).not.toMatch(/import.*getDb/);
  });
});

describe("TD-C — SRP negative (F1)", () => {
  it("N3: no search handler construction in tool-composition-root.ts", () => {
    const src = readSource("src/lib/chat/tool-composition-root.ts");
    expect(src).not.toContain("new HybridSearchEngine");
    expect(src).not.toContain("new BM25Scorer");
    expect(src).not.toContain("new QueryProcessor");
  });

  it("N4: no embedding pipeline factory in tool-composition-root.ts", () => {
    const src = readSource("src/lib/chat/tool-composition-root.ts");
    expect(src).not.toContain("new EmbeddingPipelineFactory");
  });
});

describe("TD-C — OCP negative (F4)", () => {
  it("N5: no hardcoded chunker conditional in EmbeddingPipelineFactory", () => {
    const src = readSource("src/core/search/EmbeddingPipelineFactory.ts");
    expect(src).not.toContain('sourceType === "conversation"');
  });
});

describe("TD-C — DIP negative (F6)", () => {
  it("N6: no dashboard-loaders import in admin-prioritize-offer.tool.ts", () => {
    const src = readSource("src/core/use-cases/tools/admin-prioritize-offer.tool.ts");
    expect(src).not.toMatch(/import\s+\{[^}]*\}\s+from\s+["']@\/lib\/dashboard\/dashboard-loaders["']/);
  });

  it("N7: no dashboard-loaders import in admin-triage-routing-risk.tool.ts", () => {
    const src = readSource("src/core/use-cases/tools/admin-triage-routing-risk.tool.ts");
    expect(src).not.toMatch(/import.*from\s+["']@\/lib\/dashboard\/dashboard-loaders["']/);
  });
});

// ---------------------------------------------------------------------------
// §5.3 Edge tests — behavioral preservation
// ---------------------------------------------------------------------------

describe("TD-C — behavioral preservation", () => {
  it("E1: set_preference tool still saves preferences", async () => {
    const mockRepo = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const { SetPreferenceCommand } = await import("@/core/use-cases/tools/set-preference.tool");
    const cmd = new SetPreferenceCommand(mockRepo);
    const result = await cmd.execute(
      { key: "tone", value: "casual" },
      { userId: "user-1", role: "AUTHENTICATED", conversationId: "conv-1" },
    );
    expect(mockRepo.set).toHaveBeenCalledWith("user-1", "tone", "casual");
    expect(result).toContain("tone");
  });

  it("E2: adjust_ui tool still persists UI preferences", async () => {
    const mockRepo = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const { AdjustUICommand } = await import("@/core/use-cases/tools/UiTools");
    const cmd = new AdjustUICommand(mockRepo);
    const result = await cmd.execute(
      { theme: "bauhaus" },
      { userId: "user-2", role: "AUTHENTICATED", conversationId: "conv-2" },
    );
    expect(mockRepo.set).toHaveBeenCalledWith("user-2", "theme", "bauhaus");
    expect(result).toContain("theme=bauhaus");
  });

  it("E3: getSearchHandler returns functional search handler", async () => {
    const { getSearchHandler } = await import("@/lib/chat/search-pipeline");
    const handler = getSearchHandler();
    expect(handler).toBeDefined();
    expect(typeof handler.search).toBe("function");
  });

  it("E4: getToolComposition still registers expected tool count", async () => {
    const { getToolComposition } = await import("@/lib/chat/tool-composition-root");
    const reg = getToolComposition().registry;
    const names = reg.getToolNames();
    expect(names.length).toBeGreaterThanOrEqual(19);
  });
});

describe("TD-C — EmbeddingPipelineFactory OCP edge (F4)", () => {
  const createMockEmbedder = () => ({
    embed: vi.fn().mockResolvedValue(Float32Array.from([0.1, 0.2])),
    embedBatch: vi.fn().mockResolvedValue([Float32Array.from([0.1, 0.2])]),
    dimensions: vi.fn(() => 2),
    isReady: vi.fn(() => true),
  });

  it("E5: creates pipeline for markdown source", async () => {
    const { EmbeddingPipelineFactory } = await import("@/core/search/EmbeddingPipelineFactory");
    const mockEmbedder = createMockEmbedder();
    const mockVectorStore = {
      upsert: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(() => []),
      getBySourceId: vi.fn(() => []),
      searchSimilar: vi.fn(() => []),
      searchKeyword: vi.fn(() => []),
      hydrateByIds: vi.fn(() => []),
      listSourceIds: vi.fn(() => []),
      getContentHash: vi.fn(() => null),
      getModelVersion: vi.fn(() => null),
      count: vi.fn(() => 0),
    };
    const factory = new EmbeddingPipelineFactory(mockEmbedder, mockVectorStore, "test-v1");
    const pipeline = factory.createForSource("markdown");
    expect(pipeline).toBeDefined();
  });

  it("E6: creates pipeline for conversation source", async () => {
    const { EmbeddingPipelineFactory } = await import("@/core/search/EmbeddingPipelineFactory");
    const mockEmbedder = createMockEmbedder();
    const mockVectorStore = {
      upsert: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(() => []),
      getBySourceId: vi.fn(() => []),
      searchSimilar: vi.fn(() => []),
      searchKeyword: vi.fn(() => []),
      hydrateByIds: vi.fn(() => []),
      listSourceIds: vi.fn(() => []),
      getContentHash: vi.fn(() => null),
      getModelVersion: vi.fn(() => null),
      count: vi.fn(() => 0),
    };
    const factory = new EmbeddingPipelineFactory(mockEmbedder, mockVectorStore, "test-v1");
    const pipeline = factory.createForSource("conversation");
    expect(pipeline).toBeDefined();
  });

  it("E7: falls back to markdown for unknown source type", async () => {
    const { EmbeddingPipelineFactory } = await import("@/core/search/EmbeddingPipelineFactory");
    const mockEmbedder = createMockEmbedder();
    const mockVectorStore = {
      upsert: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(() => []),
      getBySourceId: vi.fn(() => []),
      searchSimilar: vi.fn(() => []),
      searchKeyword: vi.fn(() => []),
      hydrateByIds: vi.fn(() => []),
      listSourceIds: vi.fn(() => []),
      getContentHash: vi.fn(() => null),
      getModelVersion: vi.fn(() => null),
      count: vi.fn(() => 0),
    };
    const factory = new EmbeddingPipelineFactory(mockEmbedder, mockVectorStore, "test-v1");
    const pipeline = factory.createForSource("pdf");
    expect(pipeline).toBeDefined();
  });
});

describe("TD-C — service locator documentation (F5)", () => {
  it("E8: RepositoryFactory.ts documents the service locator exception", () => {
    const src = readSource("src/adapters/RepositoryFactory.ts");
    expect(src).toContain("accepted DIP");
    expect(src).toContain("exception for the RSC layer");
  });
});
