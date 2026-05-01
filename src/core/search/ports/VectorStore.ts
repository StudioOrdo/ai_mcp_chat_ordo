import type { ChunkMetadata } from "./Chunker";

export interface EmbeddingRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkLevel: "document" | "section" | "passage";
  heading: string | null;
  content: string;
  embeddingInput: string;
  contentHash: string;
  modelVersion: string;
  embedding: Float32Array;
  metadata: ChunkMetadata;
}

export interface VectorQuery {
  sourceType?: string;
  chunkLevel?: "document" | "section" | "passage";
  sourceIdPrefix?: string;
  allowedAudiences?: string[];
  classes?: string[];
  rolePersonas?: string[];
  limit?: number;
}

export interface RankedSearchCandidate {
  id: string;
  rank: number;
  score: number;
}

export interface VectorSearchRequest {
  embedding: Float32Array;
  filters?: VectorQuery;
  limit: number;
}

export interface KeywordSearchRequest {
  rawQuery: string;
  terms: readonly string[];
  filters?: VectorQuery;
  limit: number;
}

export interface VectorStore {
  upsert(records: EmbeddingRecord[]): void;
  delete(sourceId: string): void;
  getAll(query?: VectorQuery): EmbeddingRecord[];
  getBySourceId(sourceId: string): EmbeddingRecord[];
  searchSimilar(query: VectorSearchRequest): RankedSearchCandidate[];
  searchKeyword(query: KeywordSearchRequest): RankedSearchCandidate[];
  hydrateByIds(ids: readonly string[]): EmbeddingRecord[];
  listSourceIds(sourceType: string): string[];
  getContentHash(sourceId: string): string | null;
  getModelVersion(sourceId: string): string | null;
  count(sourceType?: string): number;
}
