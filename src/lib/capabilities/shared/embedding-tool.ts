import type { Embedder } from "@/core/search/ports/Embedder";
import type { VectorStore, VectorQuery } from "@/core/search/ports/VectorStore";
import type { BM25IndexStore } from "@/core/search/ports/BM25IndexStore";
import type { SearchHandler } from "@/core/search/ports/SearchHandler";
import type { EmbeddingPipelineFactory } from "@/core/search/EmbeddingPipelineFactory";
import { buildCorpusIndexContentHash } from "@/core/search/corpus-indexing";
import type { DocumentChunkMetadata } from "@/core/search/ports/Chunker";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";
import { corpusConfig } from "@/lib/corpus-vocabulary";

export interface EmbeddingToolDeps {
  embedder: Embedder;
  vectorStore: VectorStore;
  bm25IndexStore: BM25IndexStore;
  searchHandler: SearchHandler;
  pipelineFactory: EmbeddingPipelineFactory;
  corpusRepo: CorpusRepository;
}

// --- embed_text (VSEARCH-30) ---
export async function embedText(
  deps: EmbeddingToolDeps,
  args: { text: string },
) {
  if (!args.text || typeof args.text !== "string") {
    throw new Error("embed_text requires a non-empty 'text' string.");
  }
  const embedding = await deps.embedder.embed(args.text);
  return {
    dimensions: deps.embedder.dimensions(),
    embeddingPreview: Array.from(embedding.slice(0, 5)),
  };
}

// --- embed_document (VSEARCH-31) ---
export async function embedDocument(
  deps: EmbeddingToolDeps,
  args: { source_type: string; source_id: string; content: string },
) {
  if (!args.source_type || !args.source_id || !args.content) {
    throw new Error(
      "embed_document requires source_type, source_id, and content.",
    );
  }
  const pipeline = deps.pipelineFactory.createForSource(
    args.source_type,
  );
  const [documentSlug, sectionSlug] = args.source_id.split("/");
  const firstSentence = args.content.split(/[.!?]\s/)[0]?.slice(0, 200) ?? "";
  const metadata: DocumentChunkMetadata = {
    sourceType: args.source_type,
    documentSlug: documentSlug ?? args.source_id,
    sectionSlug: sectionSlug ?? "",
    documentTitle: "",
    documentId: documentSlug ?? args.source_id,
    sectionTitle: "",
    sectionFirstSentence: firstSentence,
    bookSlug: documentSlug ?? args.source_id,
    chapterSlug: sectionSlug ?? "",
    bookTitle: "",
    bookNumber: documentSlug ?? args.source_id,
    chapterTitle: "",
    chapterFirstSentence: firstSentence,
  };
  const contentHash = buildCorpusIndexContentHash(args.content, metadata);
  const result = await pipeline.indexDocument({
    sourceType: args.source_type,
    sourceId: args.source_id,
    content: args.content,
    contentHash,
    metadata,
  });
  return result;
}

// --- search_similar (VSEARCH-32) ---
export async function searchSimilar(
  deps: EmbeddingToolDeps,
  args: { query: string; source_type?: string; limit?: number },
) {
  if (!args.query || typeof args.query !== "string") {
    throw new Error("search_similar requires a non-empty 'query' string.");
  }
  const filters: VectorQuery = {};
  if (args.source_type) filters.sourceType = args.source_type;
  if (args.limit) filters.limit = args.limit;
  const results = await deps.searchHandler.search(args.query, filters);
  return results;
}

// --- rebuild_index (VSEARCH-33) ---
export async function rebuildIndex(
  deps: EmbeddingToolDeps,
  args: { source_type: string; force?: boolean },
) {
  if (!args.source_type) {
    throw new Error("rebuild_index requires a source_type.");
  }
  if (args.source_type !== corpusConfig.sourceType && args.source_type !== corpusConfig.legacySourceType) {
    throw new Error(
      `Unsupported source_type: ${args.source_type}. Only "${corpusConfig.sourceType}" is supported.`,
    );
  }

  const pipeline = deps.pipelineFactory.createForSource(corpusConfig.sourceType);
  const [documents, sections] = await Promise.all([
    deps.corpusRepo.getAllDocuments(),
    deps.corpusRepo.getAllSections(),
  ]);
  const documentTitleMap = new Map(documents.map((document) => [document.slug, document.title]));
  const documentIdMap = new Map(documents.map((document) => [document.slug, document.id]));

  if (args.force) {
    for (const section of sections) {
      deps.vectorStore.delete(`${section.documentSlug}/${section.sectionSlug}`);
    }
  }

  const indexedDocuments = sections.map((section) => {
    const metadata = {
      sourceType: corpusConfig.sourceType,
      documentSlug: section.documentSlug,
      sectionSlug: section.sectionSlug,
      documentTitle: documentTitleMap.get(section.documentSlug) ?? section.documentSlug,
      documentId: documentIdMap.get(section.documentSlug) ?? section.documentSlug,
      sectionTitle: section.title,
      sectionFirstSentence:
        section.content.split(/[.!?]\s/)[0]?.slice(0, 200) ?? "",
      bookSlug: section.documentSlug,
      chapterSlug: section.sectionSlug,
      bookTitle: documentTitleMap.get(section.documentSlug) ?? section.documentSlug,
      bookNumber: documentIdMap.get(section.documentSlug) ?? section.documentSlug,
      chapterTitle: section.title,
      chapterFirstSentence: section.content.split(/[.!?]\s/)[0]?.slice(0, 200) ?? "",
    } satisfies DocumentChunkMetadata;

    return {
      sourceId: `${section.documentSlug}/${section.sectionSlug}`,
      content: section.content,
      contentHash: buildCorpusIndexContentHash(section.content, metadata),
      metadata,
    };
  });

  const result = await pipeline.rebuildAll(corpusConfig.sourceType, indexedDocuments);
  return result;
}

// --- get_index_stats (VSEARCH-34) ---
export function getIndexStats(
  deps: EmbeddingToolDeps,
  args: { source_type?: string },
) {
  const sourceType = args.source_type ?? corpusConfig.sourceType;
  const embeddingCount = deps.vectorStore.count(sourceType);
  const bm25Index = deps.bm25IndexStore.getIndex(sourceType);
  return {
    sourceType,
    embeddingCount,
    bm25DocCount: bm25Index?.docCount ?? 0,
    bm25AvgDocLength: bm25Index?.avgDocLength ?? 0,
    bm25Stale: deps.bm25IndexStore.isStale(sourceType),
    embedderReady: deps.embedder.isReady(),
    dimensions: deps.embedder.dimensions(),
  };
}

// --- delete_embeddings (spec §11.2 tool, no VSEARCH req ID) ---
export function deleteEmbeddings(
  deps: EmbeddingToolDeps,
  args: { source_id: string },
) {
  if (!args.source_id || typeof args.source_id !== "string") {
    throw new Error(
      "delete_embeddings requires a non-empty 'source_id' string.",
    );
  }
  const before = deps.vectorStore.count();
  deps.vectorStore.delete(args.source_id);
  const after = deps.vectorStore.count();
  return { deleted: before - after, source_id: args.source_id };
}

// ---------------------------------------------------------------------------
// Tool schemas — Sprint 17: extracted from the MCP operations server transport shell
// ---------------------------------------------------------------------------

export function getEmbeddingToolSchemas(sourceType: string) {
  return [
    {
      name: "embed_text",
      description: "Embed arbitrary text, return vector dimensions and preview.",
      inputSchema: {
        type: "object" as const,
        properties: {
          text: { type: "string", description: "Text to embed." },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
    {
      name: "embed_document",
      description:
        "Chunk, embed, and store a document into the vector store.",
      inputSchema: {
        type: "object" as const,
        properties: {
          source_type: {
            type: "string",
            description: `Source type (e.g. '${sourceType}').`,
          },
          source_id: {
            type: "string",
            description: "Source ID (e.g. 'book-slug/chapter-slug').",
          },
          content: {
            type: "string",
            description: "Document content to embed.",
          },
        },
        required: ["source_type", "source_id", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "search_similar",
      description: "Hybrid similarity search (BM25 + vector + RRF).",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search query." },
          source_type: {
            type: "string",
            description: "Filter by source type.",
          },
          limit: { type: "number", description: "Max results." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "rebuild_index",
      description:
        "Full or incremental rebuild of embeddings for a source type.",
      inputSchema: {
        type: "object" as const,
        properties: {
          source_type: {
            type: "string",
            description: `Source type to rebuild (e.g. '${sourceType}').`,
          },
          force: {
            type: "boolean",
            description: "Force full rebuild (delete existing first).",
          },
        },
        required: ["source_type"],
        additionalProperties: false,
      },
    },
    {
      name: "get_index_stats",
      description: "Embedding counts, BM25 stats, model readiness.",
      inputSchema: {
        type: "object" as const,
        properties: {
          source_type: {
            type: "string",
            description: "Source type filter.",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "delete_embeddings",
      description: "Remove all embeddings for a specific source ID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          source_id: {
            type: "string",
            description: "Source ID to delete.",
          },
        },
        required: ["source_id"],
        additionalProperties: false,
      },
    },
  ];
}
