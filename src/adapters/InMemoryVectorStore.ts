import type {
  EmbeddingRecord,
  KeywordSearchRequest,
  RankedSearchCandidate,
  VectorQuery,
  VectorSearchRequest,
  VectorStore,
} from "@/core/search/ports/VectorStore";
import { dotSimilarity } from "@/core/search/dotSimilarity";

function readMetadataString(record: EmbeddingRecord, key: "audience" | "contentClass" | "rolePersona"): string | null {
  const metadata = record.metadata;
  const value = key === "audience"
    ? ("audience" in metadata ? metadata.audience : undefined)
    : key === "contentClass"
      ? ("contentClass" in metadata ? metadata.contentClass : undefined)
      : ("rolePersona" in metadata ? metadata.rolePersona : undefined);
  return typeof value === "string" ? value : null;
}

export class InMemoryVectorStore implements VectorStore {
  private records = new Map<string, EmbeddingRecord>();

  upsert(records: EmbeddingRecord[]): void {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  delete(sourceId: string): void {
    for (const [id, record] of this.records) {
      if (record.sourceId === sourceId) {
        this.records.delete(id);
      }
    }
  }

  getAll(query?: VectorQuery): EmbeddingRecord[] {
    let results = [...this.records.values()];
    results = this.applyFilters(results, query);
    if (query?.limit) {
      results = results.slice(0, query.limit);
    }
    return results;
  }

  private applyFilters(records: EmbeddingRecord[], query?: VectorQuery): EmbeddingRecord[] {
    let results = records;
    if (query?.sourceType) {
      results = results.filter((r) => r.sourceType === query.sourceType);
    }
    if (query?.chunkLevel) {
      results = results.filter((r) => r.chunkLevel === query.chunkLevel);
    }
    if (query?.sourceIdPrefix) {
      results = results.filter((r) => r.sourceId.startsWith(query.sourceIdPrefix!));
    }
    if (query?.allowedAudiences && query.allowedAudiences.length > 0) {
      const allowed = new Set(query.allowedAudiences);
      results = results.filter((record) => {
        const audience = readMetadataString(record, "audience");
        return audience !== null && allowed.has(audience);
      });
    }
    if (query?.classes && query.classes.length > 0) {
      const allowed = new Set(query.classes);
      results = results.filter((record) => {
        const contentClass = readMetadataString(record, "contentClass");
        return contentClass !== null && allowed.has(contentClass);
      });
    }
    if (query?.rolePersonas && query.rolePersonas.length > 0) {
      const allowed = new Set(query.rolePersonas);
      results = results.filter((record) => {
        const rolePersona = readMetadataString(record, "rolePersona");
        return rolePersona !== null && allowed.has(rolePersona);
      });
    }
    return results;
  }

  getBySourceId(sourceId: string): EmbeddingRecord[] {
    return [...this.records.values()].filter((r) => r.sourceId === sourceId);
  }

  searchSimilar(query: VectorSearchRequest): RankedSearchCandidate[] {
    return this.applyFilters([...this.records.values()], query.filters)
      .map((record) => ({
        id: record.id,
        score: dotSimilarity(query.embedding, record.embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, query.limit)
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
      }));
  }

  searchKeyword(query: KeywordSearchRequest): RankedSearchCandidate[] {
    const terms = query.terms
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean);
    if (terms.length === 0 && !query.rawQuery.trim()) {
      return [];
    }

    return this.applyFilters([...this.records.values()], query.filters)
      .map((record) => {
        const content = `${record.heading ?? ""} ${record.content}`.toLowerCase();
        const score = terms.reduce((total, term) => {
          const matches = content.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
          return total + (matches?.length ?? 0);
        }, 0);
        return { id: record.id, score };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, query.limit)
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
      }));
  }

  hydrateByIds(ids: readonly string[]): EmbeddingRecord[] {
    return ids.flatMap((id) => {
      const record = this.records.get(id);
      return record ? [record] : [];
    });
  }

  listSourceIds(sourceType: string): string[] {
    return [...new Set(
      [...this.records.values()]
        .filter((record) => record.sourceType === sourceType)
        .map((record) => record.sourceId),
    )];
  }

  getContentHash(sourceId: string): string | null {
    for (const record of this.records.values()) {
      if (record.sourceId === sourceId) return record.contentHash;
    }
    return null;
  }

  getModelVersion(sourceId: string): string | null {
    for (const record of this.records.values()) {
      if (record.sourceId === sourceId) return record.modelVersion;
    }
    return null;
  }

  count(sourceType?: string): number {
    if (!sourceType) return this.records.size;
    let count = 0;
    for (const record of this.records.values()) {
      if (record.sourceType === sourceType) count++;
    }
    return count;
  }
}
