import type { SearchHandler } from "./ports/SearchHandler";
import type { HybridSearchResult, VectorQuery, VectorStore } from "./types";
import type { Embedder } from "./ports/Embedder";
import type { HybridSearchEngine } from "./HybridSearchEngine";
import type { QueryProcessor } from "./QueryProcessor";
import { toSearchChunkMetadata } from "./chunk-metadata";

abstract class BaseSearchHandler implements SearchHandler {
  private nextHandler: SearchHandler | null = null;

  setNext(handler: SearchHandler): SearchHandler {
    this.nextHandler = handler;
    return handler;
  }

  abstract canHandle(): boolean;
  abstract search(query: string, filters?: VectorQuery): Promise<HybridSearchResult[]>;

  protected async passToNext(query: string, filters?: VectorQuery): Promise<HybridSearchResult[]> {
    if (this.nextHandler) {
      if (this.nextHandler.canHandle()) {
        return this.nextHandler.search(query, filters);
      }
      // Walk the chain manually if current next can't handle
      if (this.nextHandler instanceof BaseSearchHandler) {
        return this.nextHandler.passToNext(query, filters);
      }
    }
    return [];
  }
}

export class HybridSearchHandler extends BaseSearchHandler {
  constructor(
    private readonly engine: HybridSearchEngine,
    private readonly embedder: Embedder,
    private readonly sourceType: string = "document_chunk",
  ) {
    super();
  }

  canHandle(): boolean {
    return this.embedder.isReady();
  }

  async search(query: string, filters?: VectorQuery): Promise<HybridSearchResult[]> {
    if (!this.canHandle()) return this.passToNext(query, filters);
    return this.engine.search(query, { ...filters, sourceType: filters?.sourceType ?? this.sourceType });
  }
}

export class BM25SearchHandler extends BaseSearchHandler {
  constructor(
    private readonly vectorStore: VectorStore,
    private readonly bm25QueryProcessor: QueryProcessor,
    private readonly sourceType: string = "document_chunk",
  ) {
    super();
  }

  canHandle(): boolean {
    return true;
  }

  async search(query: string, filters?: VectorQuery): Promise<HybridSearchResult[]> {
    const queryTerms = this.bm25QueryProcessor.process(query);
    const candidates = this.vectorStore.searchKeyword({
      rawQuery: query,
      terms: queryTerms,
      filters: {
        ...filters,
        sourceType: filters?.sourceType ?? this.sourceType,
        chunkLevel: "passage",
      },
      limit: filters?.limit ?? 10,
    });
    if (candidates.length === 0) return this.passToNext(query, filters);

    const records = new Map(
      this.vectorStore
        .hydrateByIds(candidates.map((candidate) => candidate.id))
        .map((record) => [record.id, record]),
    );

    return candidates.flatMap((item, rank) => {
      const record = records.get(item.id);
      if (!record) {
        return [];
      }

      const meta = record.metadata as {
        documentTitle?: string;
        documentId?: string;
        documentSlug?: string;
        sectionTitle?: string;
        sectionSlug?: string;
        bookTitle?: string;
        bookNumber?: string;
        bookSlug?: string;
        chapterTitle?: string;
        chapterSlug?: string;
      };
      const documentTitle = meta.documentTitle ?? meta.bookTitle ?? "";
      const documentId = meta.documentId ?? meta.bookNumber ?? "";
      const documentSlug = meta.documentSlug ?? meta.bookSlug ?? "";
      const sectionTitle = meta.sectionTitle ?? meta.chapterTitle ?? "";
      const sectionSlug = meta.sectionSlug ?? meta.chapterSlug ?? "";
      return [{
        documentTitle,
        documentId,
        documentSlug,
        sectionTitle,
        sectionSlug,
        rrfScore: item.score,
        vectorRank: null,
        bm25Rank: rank + 1,
        relevance: (rank < 3 ? "high" : rank < 7 ? "medium" : "low") as "high" | "medium" | "low",
        matchPassage: record.content,
        matchSection: record.heading,
        matchHighlight: record.content,
        passageOffset: { start: 0, end: record.content.length },
        chunkMetadata: toSearchChunkMetadata(record.metadata),
        bookTitle: documentTitle,
        bookNumber: documentId,
        bookSlug: documentSlug,
        chapterTitle: sectionTitle,
        chapterSlug: sectionSlug,
      }];
    });
  }
}

export class EmptyResultHandler extends BaseSearchHandler {
  canHandle(): boolean {
    return true;
  }

  async search(): Promise<HybridSearchResult[]> {
    return [];
  }
}
