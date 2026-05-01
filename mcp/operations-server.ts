import * as path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDb } from "@/lib/db";
import { FileSystemCorpusRepository } from "@/adapters/FileSystemCorpusRepository";
import { CachedCorpusRepository } from "@/adapters/CachedCorpusRepository";
import { localEmbedder } from "@/adapters/LocalEmbedder";
import { SQLiteVectorStore } from "@/adapters/SQLiteVectorStore";
import { SQLiteBM25IndexStore } from "@/adapters/SQLiteBM25IndexStore";
import { EmbeddingPipelineFactory } from "@/core/search/EmbeddingPipelineFactory";
import { QueryProcessor } from "@/core/search/QueryProcessor";
import { LowercaseStep } from "@/core/search/query-steps/LowercaseStep";
import { StopwordStep } from "@/core/search/query-steps/StopwordStep";
import { SynonymStep } from "@/core/search/query-steps/SynonymStep";
import { HybridSearchEngine } from "@/core/search/HybridSearchEngine";
import {
  HybridSearchHandler,
  BM25SearchHandler,
  EmptyResultHandler,
} from "@/core/search/SearchHandlerChain";
import { STOPWORDS } from "@/core/search/data/stopwords";
import { SYNONYMS } from "@/core/search/data/synonyms";
import type { EmbeddingToolDeps } from "@/lib/capabilities/shared/embedding-tool";
import {
  embedText,
  embedDocument,
  searchSimilar,
  rebuildIndex,
  getIndexStats,
  deleteEmbeddings,
  getEmbeddingToolSchemas,
} from "@/lib/capabilities/shared/embedding-tool";
import type { CorpusToolDeps } from "@/lib/capabilities/shared/librarian-tool";
import {
  corpusList,
  corpusGetDocument,
  corpusAddDocument,
  corpusAddSection,
  corpusRemoveDocument,
  corpusRemoveSection,
  getCorpusToolSchemas,
} from "@/lib/capabilities/shared/librarian-tool";
import type { PromptToolDeps } from "@/lib/capabilities/shared/prompt-tool";
import {
  promptList,
  promptGet,
  promptSet,
  promptRollback,
  promptDiff,
  promptGetProvenance,
  getPromptToolSchemas,
} from "@/lib/capabilities/shared/prompt-tool";
import type { AnalyticsToolDeps } from "@/lib/capabilities/shared/analytics-tool";
import {
  conversationAnalytics,
  conversationInspect,
  conversationCohort,
  getAnalyticsToolSchemas,
} from "@/lib/capabilities/shared/analytics-tool";
import type { AdminIntelligenceToolDeps } from "@/lib/capabilities/shared/admin-intelligence-tool";
import { SystemPromptDataMapper } from "@/adapters/SystemPromptDataMapper";
import { ConversationEventDataMapper } from "@/adapters/ConversationEventDataMapper";
import { ConversationEventRecorder } from "@/core/use-cases/ConversationEventRecorder";
import { corpusConfig } from "@/lib/corpus-vocabulary";
import { getAllMcpExportableTools } from "@/core/capability-catalog/mcp-export";
import {
  createCatalogMcpToolEntries,
  type McpExportAdapterDeps,
  type McpExportToolHandler,
  type McpToolArgs,
  type McpToolSchema,
} from "@/lib/capabilities/mcp-export-adapter-registry";
import {
  loadOperatorAnonymousOpportunities,
  loadOperatorFunnelRecommendations,
  loadOperatorLeadQueue,
  loadOperatorRoutingReview,
} from "@/lib/operator/operator-signal-loaders";

// ---------------------------------------------------------------------------
// Sprint 11: Catalog-driven MCP export awareness
// At server startup, enumerate all catalog tools that declare mcpExport.
// This is the connection point between the unified catalog and MCP servers.
// ---------------------------------------------------------------------------
const catalogExportableTools = getAllMcpExportableTools();
if (catalogExportableTools.length > 0) {
  process.stderr.write(
    `[mcp-server] Catalog-aware tools available for MCP export: ${catalogExportableTools.map((t) => t.name).join(", ")}\n`,
  );
}

const MODEL_VERSION = "all-MiniLM-L6-v2@1.0";

interface AllDeps {
  embedding: EmbeddingToolDeps;
  librarian: CorpusToolDeps;
  prompt: PromptToolDeps;
  analytics: AnalyticsToolDeps;
  adminIntelligence: AdminIntelligenceToolDeps;
}

type ToolArgs = McpToolArgs;
type ToolSchema = McpToolSchema;
type ToolHandler = (deps: AllDeps, args: ToolArgs) => Promise<unknown> | unknown;

function buildDeps(): AllDeps {
  const db = getDb();
  const embedder = localEmbedder;
  const vectorStore = new SQLiteVectorStore(db);
  const bm25IndexStore = new SQLiteBM25IndexStore(db);

  // Build repo graph directly to capture concrete types for cache clearing
  const fsRepo = new FileSystemCorpusRepository();
  const cached = new CachedCorpusRepository(fsRepo);
  const corpusRepo = cached;

  const pipelineFactory = new EmbeddingPipelineFactory(
    embedder,
    vectorStore,
    MODEL_VERSION,
  );

  const vectorProcessor = new QueryProcessor([
    new LowercaseStep(),
    new StopwordStep(STOPWORDS),
  ]);
  const bm25Processor = new QueryProcessor([
    new LowercaseStep(),
    new StopwordStep(STOPWORDS),
    new SynonymStep(SYNONYMS),
  ]);
  const engine = new HybridSearchEngine(
    embedder,
    vectorStore,
    vectorProcessor,
    bm25Processor,
    { vectorTopN: 50, bm25TopN: 50, rrfK: 60, maxResults: 10 },
  );
  const hybrid = new HybridSearchHandler(engine, embedder, corpusConfig.sourceType);
  const bm25 = new BM25SearchHandler(
    vectorStore,
    bm25Processor,
    corpusConfig.sourceType,
  );
  const empty = new EmptyResultHandler();
  hybrid.setNext(bm25);
  bm25.setNext(empty);

  return {
    embedding: {
      embedder,
      vectorStore,
      bm25IndexStore,
      searchHandler: hybrid,
      pipelineFactory,
      corpusRepo,
    },
    librarian: {
      corpusDir: path.resolve(process.cwd(), "docs/_corpus"),
      vectorStore,
      clearCaches: () => {
        cached.clearCache();
        fsRepo.clearDiscoveryCache();
      },
    },
    prompt: {
      promptRepo: new SystemPromptDataMapper(db),
      eventRecorder: new ConversationEventRecorder(new ConversationEventDataMapper(db)),
      findActiveConversationIds: async (role: string): Promise<string[]> => {
        if (role === "ALL") {
          const rows = db.prepare(`SELECT id FROM conversations WHERE status = 'active'`).all() as { id: string }[];
          return rows.map((r) => r.id);
        }
        if (role === "ANONYMOUS") {
          const rows = db.prepare(`SELECT id FROM conversations WHERE status = 'active' AND user_id LIKE 'anon_%'`).all() as { id: string }[];
          return rows.map((r) => r.id);
        }
        const rows = db.prepare(
          `SELECT c.id FROM conversations c
           JOIN user_roles ur ON c.user_id = ur.user_id
           JOIN roles r ON ur.role_id = r.id
           WHERE c.status = 'active' AND r.name = ?`
        ).all(role) as { id: string }[];
        return rows.map((r) => r.id);
      },
    },
    analytics: {
      db,
    },
    adminIntelligence: {
      loadLeadQueue: loadOperatorLeadQueue,
      loadFunnelRecommendations: loadOperatorFunnelRecommendations,
      loadAnonymousOpportunities: loadOperatorAnonymousOpportunities,
      loadRoutingReview: loadOperatorRoutingReview,
    },
  };
}

let deps: AllDeps | null = null;
function getDeps(): AllDeps {
  if (!deps) deps = buildDeps();
  return deps;
}

const server = new Server(
  { name: "operations-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

function defineTool(schema: ToolSchema, handler: ToolHandler) {
  return [schema.name, { schema, handler }] as const;
}

function bindCatalogHandler(handler: McpExportToolHandler): ToolHandler {
  return (deps, args) => handler(deps as McpExportAdapterDeps, args);
}

const catalogToolEntries = createCatalogMcpToolEntries(catalogExportableTools)
  .map(([, entry]) => defineTool(entry.schema, bindCatalogHandler(entry.handler)));
const catalogToolSchemas = catalogToolEntries.map(([, entry]) => entry.schema);

const toolSchemas = [
  ...getEmbeddingToolSchemas(corpusConfig.sourceType),
  ...getCorpusToolSchemas(),
  ...getPromptToolSchemas(),
  ...getAnalyticsToolSchemas(),
  ...catalogToolSchemas,
];

const toolRegistry = new Map<string, { schema: ToolSchema; handler: ToolHandler }>([
  defineTool(getEmbeddingToolSchemas(corpusConfig.sourceType)[0], (d, a) => embedText(d.embedding, a as { text: string })),
  defineTool(getEmbeddingToolSchemas(corpusConfig.sourceType)[1], (d, a) => embedDocument(d.embedding, a as { source_type: string; source_id: string; content: string })),
  defineTool(getEmbeddingToolSchemas(corpusConfig.sourceType)[2], (d, a) => searchSimilar(d.embedding, a as { query: string; source_type?: string; limit?: number })),
  defineTool(getEmbeddingToolSchemas(corpusConfig.sourceType)[3], (d, a) => rebuildIndex(d.embedding, a as { source_type: string; force?: boolean })),
  defineTool(getEmbeddingToolSchemas(corpusConfig.sourceType)[4], (d, a) => getIndexStats(d.embedding, a as { source_type?: string })),
  defineTool(getEmbeddingToolSchemas(corpusConfig.sourceType)[5], (d, a) => deleteEmbeddings(d.embedding, a as { source_id: string })),
  defineTool(getCorpusToolSchemas()[0], (d) => corpusList(d.librarian)),
  defineTool(getCorpusToolSchemas()[1], (d, a) => corpusGetDocument(d.librarian, a as { slug: string })),
  defineTool(getCorpusToolSchemas()[2], (d, a) => corpusAddDocument(d.librarian, a as {
    slug?: string;
    title?: string;
    number?: string;
    sortOrder?: number;
    domain?: string[];
    tags?: string[];
    chapters?: Array<{ slug: string; content: string }>;
    zip_base64?: string;
  })),
  defineTool(getCorpusToolSchemas()[3], (d, a) => corpusAddSection(d.librarian, a as { book_slug: string; chapter_slug: string; content: string })),
  defineTool(getCorpusToolSchemas()[4], (d, a) => corpusRemoveDocument(d.librarian, a as { slug: string })),
  defineTool(getCorpusToolSchemas()[5], (d, a) => corpusRemoveSection(d.librarian, a as { book_slug: string; chapter_slug: string })),
  defineTool(getPromptToolSchemas()[0], (d, a) => promptList(d.prompt, a as { role?: string; prompt_type?: string })),
  defineTool(getPromptToolSchemas()[1], (d, a) => promptGet(d.prompt, a as { role: string; prompt_type: string; version?: number })),
  defineTool(getPromptToolSchemas()[2], (d, a) => promptSet(d.prompt, a as { role: string; prompt_type: string; content: string; notes: string })),
  defineTool(getPromptToolSchemas()[3], (d, a) => promptRollback(d.prompt, a as { role: string; prompt_type: string; version: number })),
  defineTool(getPromptToolSchemas()[4], (d, a) => promptDiff(d.prompt, a as { role: string; prompt_type: string; version_a: number; version_b: number })),
  defineTool(getPromptToolSchemas()[5], (_d, a) => promptGetProvenance(a as { conversation_id?: string; turn_id?: string; include_replay_diff?: boolean })),
  defineTool(getAnalyticsToolSchemas()[0], (d, a) => conversationAnalytics(d.analytics, a as {
    metric: "overview" | "funnel" | "engagement" | "tool_usage" | "drop_off" | "routing_review";
    time_range?: "24h" | "7d" | "30d" | "all";
    limit?: number;
  })),
  defineTool(getAnalyticsToolSchemas()[1], (d, a) => conversationInspect(d.analytics, a as {
    conversation_id?: string;
    user_id?: string;
    limit?: number;
  })),
  defineTool(getAnalyticsToolSchemas()[2], (d, a) => conversationCohort(d.analytics, a as {
    cohort_a: "anonymous" | "authenticated" | "converted";
    cohort_b: "anonymous" | "authenticated" | "converted";
    metric: "message_count" | "tool_usage" | "session_duration" | "return_rate";
  })),
  ...catalogToolEntries,
  ["librarian_list", { schema: getCorpusToolSchemas()[0], handler: (d: AllDeps) => corpusList(d.librarian) }],
  ["librarian_get_book", { schema: getCorpusToolSchemas()[1], handler: (d: AllDeps, a: ToolArgs) => corpusGetDocument(d.librarian, a as { slug: string }) }],
  ["librarian_add_book", { schema: getCorpusToolSchemas()[2], handler: (d: AllDeps, a: ToolArgs) => corpusAddDocument(d.librarian, a as {
    slug?: string;
    title?: string;
    number?: string;
    sortOrder?: number;
    domain?: string[];
    tags?: string[];
    chapters?: Array<{ slug: string; content: string }>;
    zip_base64?: string;
  }) }],
  ["librarian_add_chapter", { schema: getCorpusToolSchemas()[3], handler: (d: AllDeps, a: ToolArgs) => corpusAddSection(d.librarian, a as { book_slug: string; chapter_slug: string; content: string }) }],
  ["librarian_remove_book", { schema: getCorpusToolSchemas()[4], handler: (d: AllDeps, a: ToolArgs) => corpusRemoveDocument(d.librarian, a as { slug: string }) }],
  ["librarian_remove_chapter", { schema: getCorpusToolSchemas()[5], handler: (d: AllDeps, a: ToolArgs) => corpusRemoveSection(d.librarian, a as { book_slug: string; chapter_slug: string }) }],
]);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolSchemas,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const d = getDeps();
  const a = (args ?? {}) as Record<string, unknown>;
  const tool = toolRegistry.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const result = await tool.handler(d, a);

  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
