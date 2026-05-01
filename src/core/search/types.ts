import type { ChunkMetadata, SearchChunkMetadata } from "./ports/Chunker";

export interface HybridSearchResult {
  documentTitle?: string;
  documentId?: string;
  documentSlug?: string;
  sectionTitle?: string;
  sectionSlug?: string;
  rrfScore: number;
  vectorRank: number | null;
  bm25Rank: number | null;
  relevance: "high" | "medium" | "low";
  matchPassage: string;
  matchSection: string | null;
  matchHighlight: string;
  passageOffset: { start: number; end: number };
  chunkMetadata?: SearchChunkMetadata | null;
  bookTitle?: string;
  bookNumber?: string;
  bookSlug?: string;
  chapterTitle?: string;
  chapterSlug?: string;
}

export interface ConversationSearchResult {
  conversationId: string;
  conversationTitle: string;
  conversationDate: string;
  matchPassage: string;
  matchHighlight: string;
  turnIndex: number;
  rrfScore: number;
  relevance: "high" | "medium" | "low";
}

/** Result of indexing a single document */
export interface IndexResult {
  sourceId: string;
  status: "created" | "updated" | "unchanged";
  chunksUpserted: number;
}

/** Result of a full rebuild across all documents */
export interface RebuildResult {
  created: number;
  updated: number;
  unchanged: number;
  orphansDeleted: number;
  totalChunks: number;
}

/** Input to rebuildAll() — minimal document descriptor */
export interface DocumentInput {
  sourceId: string;
  content: string;
  contentHash: string;
  metadata: ChunkMetadata;
}

// Re-export all port types for convenient single-point imports
export type {
  Chunk,
  ChunkMetadata,
  Chunker,
  ChunkerOptions,
  ConversationMetadata,
  DocumentChunkMetadata,
  SearchChunkMetadata,
} from "./ports/Chunker";
export type { BookChunkMetadata } from "./ports/Chunker";
export type { Embedder } from "./ports/Embedder";
export type {
  EmbeddingRecord,
  KeywordSearchRequest,
  RankedSearchCandidate,
  VectorQuery,
  VectorSearchRequest,
  VectorStore,
} from "./ports/VectorStore";
export type {
  BM25Index,
  BM25IndexStore,
} from "./ports/BM25IndexStore";
export type { SearchHandler } from "./ports/SearchHandler";
export type { QueryProcessingStep } from "./ports/QueryProcessingStep";
export { ConversationChunker } from "./ConversationChunker";
