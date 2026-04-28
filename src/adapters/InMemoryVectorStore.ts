import type {
  EmbeddingRecord,
  VectorQuery,
  VectorStore,
} from "@/core/search/ports/VectorStore";

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
    if (query?.sourceType) {
      results = results.filter((r) => r.sourceType === query.sourceType);
    }
    if (query?.chunkLevel) {
      results = results.filter((r) => r.chunkLevel === query.chunkLevel);
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
    if (query?.limit) {
      results = results.slice(0, query.limit);
    }
    return results;
  }

  getBySourceId(sourceId: string): EmbeddingRecord[] {
    return [...this.records.values()].filter((r) => r.sourceId === sourceId);
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
