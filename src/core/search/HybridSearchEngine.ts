import type { Embedder } from "./ports/Embedder";
import type { VectorStore, EmbeddingRecord, VectorQuery } from "./ports/VectorStore";
import type { HybridSearchResult } from "./types";
import type { QueryProcessor } from "./QueryProcessor";
import { toSearchChunkMetadata } from "./chunk-metadata";
import { l2Normalize } from "./l2Normalize";
import { reciprocalRankFusion } from "./ReciprocalRankFusion";
import { highlightTerms, deduplicateBySection, assignRelevance } from "./ResultFormatter";

export interface HybridSearchOptions {
  vectorTopN: number;
  bm25TopN: number;
  rrfK: number;
  maxResults: number;
}

export class HybridSearchEngine {
  constructor(
    private readonly embedder: Embedder,
    private readonly vectorStore: VectorStore,
    private readonly vectorQueryProcessor: QueryProcessor,
    private readonly bm25QueryProcessor: QueryProcessor,
    private readonly options: HybridSearchOptions,
  ) {}

  async search(query: string, filters?: VectorQuery): Promise<HybridSearchResult[]> {
    const sourceType = filters?.sourceType ?? "document_chunk";

    // 1. Process query through both pipelines
    const vectorTokens = this.vectorQueryProcessor.process(query);
    const bm25Tokens = this.bm25QueryProcessor.process(query);

    const storeQuery: VectorQuery = {
      ...filters,
      sourceType,
      chunkLevel: "passage",
    };

    // 2. Vector candidate retrieval
    const vectorText = vectorTokens.join(" ");
    const queryEmbedding = l2Normalize(await this.embedder.embed(vectorText));
    const vectorTop = this.vectorStore.searchSimilar({
      embedding: queryEmbedding,
      filters: storeQuery,
      limit: this.options.vectorTopN,
    });

    const vectorRanking = new Map<string, number>();
    vectorTop.forEach((item) => vectorRanking.set(item.id, item.rank));

    // 3. FTS keyword candidate retrieval
    const keywordTop = this.vectorStore.searchKeyword({
      rawQuery: query,
      terms: bm25Tokens,
      filters: storeQuery,
      limit: this.options.bm25TopN,
    });
    const bm25Ranking = new Map<string, number>();
    keywordTop.forEach((item) => bm25Ranking.set(item.id, item.rank));

    // 4. Reciprocal Rank Fusion over bounded candidate ids
    const rrfScores = reciprocalRankFusion(
      [vectorRanking, bm25Ranking],
      this.options.rrfK,
    );

    // 5. Hydrate only fused candidate ids
    const recordMap = new Map<string, EmbeddingRecord>();
    const fusedEntries = [...rrfScores.entries()]
      .sort((a, b) => b[1] - a[1]);
    const fusedIds = fusedEntries.map(([id]) => id);
    for (const r of this.vectorStore.hydrateByIds(fusedIds)) recordMap.set(r.id, r);

    const merged: HybridSearchResult[] = fusedEntries
      .flatMap(([id, score], rank) => {
        const record = recordMap.get(id);
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
          rrfScore: score,
          vectorRank: vectorRanking.get(id) ?? null,
          bm25Rank: bm25Ranking.get(id) ?? null,
          relevance: assignRelevance(score, rank + 1),
          matchPassage: record.content,
          matchSection: record.heading,
          matchHighlight: highlightTerms(record.content, bm25Tokens),
          passageOffset: {
            start: record.chunkIndex * 400,
            end: record.chunkIndex * 400 + record.content.length,
          },
          chunkMetadata: toSearchChunkMetadata(record.metadata),
          bookTitle: documentTitle,
          bookNumber: documentId,
          bookSlug: documentSlug,
          chapterTitle: sectionTitle,
          chapterSlug: sectionSlug,
        } satisfies HybridSearchResult];
      });

    // 7. Deduplication
    const deduped = deduplicateBySection(merged);

    // 8. Return top N
    return deduped.slice(0, this.options.maxResults);
  }
}
