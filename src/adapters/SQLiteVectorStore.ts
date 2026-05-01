import type Database from "better-sqlite3";
import type {
  EmbeddingRecord,
  KeywordSearchRequest,
  RankedSearchCandidate,
  VectorQuery,
  VectorSearchRequest,
  VectorStore,
} from "@/core/search/ports/VectorStore";
import type { ChunkMetadata } from "@/core/search/ports/Chunker";
import { dotSimilarity } from "@/core/search/dotSimilarity";

type EmbeddingRow = {
  id: string;
  source_type: string;
  source_id: string;
  chunk_index: number;
  chunk_level: string;
  heading: string | null;
  content: string;
  embedding_input: string;
  content_hash: string;
  model_version: string;
  embedding: Buffer;
  metadata: string;
};

type RankedRow = {
  id: string;
  score: number;
};

function serializeEmbedding(embedding: Float32Array): Buffer {
  return Buffer.from(
    embedding.buffer,
    embedding.byteOffset,
    embedding.byteLength,
  );
}

function deserializeEmbedding(buffer: Buffer): Float32Array {
  const copy = Buffer.alloc(buffer.length);
  buffer.copy(copy);
  return new Float32Array(
    copy.buffer,
    copy.byteOffset,
    copy.byteLength / 4,
  );
}

function mapRow(row: EmbeddingRow): EmbeddingRecord {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    chunkLevel: row.chunk_level as EmbeddingRecord["chunkLevel"],
    heading: row.heading,
    content: row.content,
    embeddingInput: row.embedding_input,
    contentHash: row.content_hash,
    modelVersion: row.model_version,
    embedding: deserializeEmbedding(row.embedding),
    metadata: JSON.parse(row.metadata) as ChunkMetadata,
  };
}

function metadataText(metadata: ChunkMetadata): string {
  if (metadata.sourceType === "conversation") {
    const conversationMetadata = metadata as Extract<ChunkMetadata, { sourceType: "conversation" }>;
    return [
      conversationMetadata.conversationId,
      conversationMetadata.userId,
      conversationMetadata.role,
      String(conversationMetadata.turnIndex),
    ].join(" ");
  }

  const documentMetadata = metadata as Exclude<ChunkMetadata, { sourceType: "conversation" }>;
  return [
    documentMetadata.documentTitle,
    documentMetadata.documentId,
    documentMetadata.documentSlug,
    documentMetadata.sectionTitle,
    documentMetadata.sectionSlug,
    documentMetadata.sectionFirstSentence,
    documentMetadata.bookTitle,
    documentMetadata.bookNumber,
    documentMetadata.bookSlug,
    documentMetadata.chapterTitle,
    documentMetadata.chapterSlug,
    documentMetadata.chapterFirstSentence,
    ...(documentMetadata.contributors ?? []),
    ...(documentMetadata.supplements ?? []),
    ...(documentMetadata.practitioners ?? []),
    ...(documentMetadata.checklistItems ?? []),
    ...(documentMetadata.conceptKeywords ?? []),
  ].filter(Boolean).join(" ");
}

function isMetadataTextKey(key: "audience" | "contentClass" | "rolePersona", value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readMetadataFilter(metadata: ChunkMetadata, key: "audience" | "contentClass" | "rolePersona"): string | null {
  if (metadata.sourceType === "conversation") {
    return null;
  }

  const value = (metadata as unknown as Record<string, unknown>)[key];
  return isMetadataTextKey(key, value) ? value : null;
}

function applyMetadataFilters(record: EmbeddingRecord, query?: VectorQuery): boolean {
  if (query?.allowedAudiences?.length) {
    const audience = readMetadataFilter(record.metadata, "audience");
    if (!audience || !query.allowedAudiences.includes(audience)) {
      return false;
    }
  }

  if (query?.classes?.length) {
    const contentClass = readMetadataFilter(record.metadata, "contentClass");
    if (!contentClass || !query.classes.includes(contentClass)) {
      return false;
    }
  }

  if (query?.rolePersonas?.length) {
    const rolePersona = readMetadataFilter(record.metadata, "rolePersona");
    if (!rolePersona || !query.rolePersonas.includes(rolePersona)) {
      return false;
    }
  }

  return true;
}

function buildSqlFilters(query?: VectorQuery, tableAlias = ""): {
  sql: string;
  params: unknown[];
  needsMetadataFilter: boolean;
} {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query?.sourceType) {
    conditions.push(`${prefix}source_type = ?`);
    params.push(query.sourceType);
  }
  if (query?.chunkLevel) {
    conditions.push(`${prefix}chunk_level = ?`);
    params.push(query.chunkLevel);
  }
  if (query?.sourceIdPrefix) {
    conditions.push(`${prefix}source_id LIKE ?`);
    params.push(`${query.sourceIdPrefix}%`);
  }

  return {
    sql: conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "",
    params,
    needsMetadataFilter: Boolean(query?.allowedAudiences?.length || query?.classes?.length || query?.rolePersonas?.length),
  };
}

function escapeFtsTerm(term: string): string {
  return term.replace(/"/g, "\"\"");
}

function buildFtsMatchExpression(request: KeywordSearchRequest): string {
  const terms = request.terms
    .map((term) => term.trim())
    .filter(Boolean);
  const values = terms.length > 0 ? terms : request.rawQuery.split(/\s+/).filter(Boolean);
  return values.map((term) => `"${escapeFtsTerm(term)}"`).join(" OR ");
}

export class SQLiteVectorStore implements VectorStore {
  constructor(private db: Database.Database) {
    this.registerVectorSimilarityFunction();
  }

  private registerVectorSimilarityFunction(): void {
    if (typeof this.db.function !== "function") {
      return;
    }

    try {
      this.db.function("vector_dot_similarity", { deterministic: true }, (left: Buffer, right: Buffer) => (
        dotSimilarity(deserializeEmbedding(left), deserializeEmbedding(right))
      ));
    } catch (error) {
      if (!(error instanceof Error) || !/already exists/i.test(error.message)) {
        throw error;
      }
    }
  }

  upsert(records: EmbeddingRecord[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings
        (id, source_type, source_id, chunk_index, chunk_level, heading,
         content, embedding_input, content_hash, model_version, embedding, metadata,
         updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const deleteFtsStmt = this.db.prepare(`DELETE FROM embedding_fts WHERE id = ?`);
    const ftsStmt = this.db.prepare(`
      INSERT INTO embedding_fts
        (id, source_type, source_id, chunk_level, content, heading, metadata_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((recs: EmbeddingRecord[]) => {
      for (const r of recs) {
        stmt.run(
          r.id,
          r.sourceType,
          r.sourceId,
          r.chunkIndex,
          r.chunkLevel,
          r.heading,
          r.content,
          r.embeddingInput,
          r.contentHash,
          r.modelVersion,
          serializeEmbedding(r.embedding),
          JSON.stringify(r.metadata),
        );
        deleteFtsStmt.run(r.id);
        ftsStmt.run(
          r.id,
          r.sourceType,
          r.sourceId,
          r.chunkLevel,
          r.content,
          r.heading,
          metadataText(r.metadata),
        );
      }
    });

    tx(records);
  }

  delete(sourceId: string): void {
    const tx = this.db.transaction((id: string) => {
      this.db.prepare(`DELETE FROM embedding_fts WHERE source_id = ?`).run(id);
      this.db.prepare(`DELETE FROM embeddings WHERE source_id = ?`).run(id);
    });
    tx(sourceId);
  }

  getAll(query?: VectorQuery): EmbeddingRecord[] {
    const filters = buildSqlFilters(query);
    let sql = `SELECT * FROM embeddings${filters.sql}`;
    const params = [...filters.params];

    if (query?.limit) {
      sql += " LIMIT ?";
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as EmbeddingRow[];
    const records = rows.map(mapRow);
    return filters.needsMetadataFilter
      ? records.filter((record) => applyMetadataFilters(record, query))
      : records;
  }

  getBySourceId(sourceId: string): EmbeddingRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM embeddings WHERE source_id = ? ORDER BY chunk_index`)
      .all(sourceId) as EmbeddingRow[];
    return rows.map(mapRow);
  }

  searchSimilar(request: VectorSearchRequest): RankedSearchCandidate[] {
    const filters = buildSqlFilters(request.filters);
    const sql = `
      SELECT id, vector_dot_similarity(embedding, ?) AS score
      FROM embeddings
      ${filters.sql}
      ORDER BY score DESC
      LIMIT ?
    `;
    const rows = this.db.prepare(sql).all(
      serializeEmbedding(request.embedding),
      ...filters.params,
      request.limit,
    ) as RankedRow[];

    if (!filters.needsMetadataFilter) {
      return rows.map((row, index) => ({ id: row.id, score: row.score, rank: index + 1 }));
    }

    const hydrated = new Map(this.hydrateByIds(rows.map((row) => row.id)).map((record) => [record.id, record]));
    return rows
      .filter((row) => {
        const record = hydrated.get(row.id);
        return record ? applyMetadataFilters(record, request.filters) : false;
      })
      .slice(0, request.limit)
      .map((row, index) => ({ id: row.id, score: row.score, rank: index + 1 }));
  }

  searchKeyword(request: KeywordSearchRequest): RankedSearchCandidate[] {
    const match = buildFtsMatchExpression(request);
    if (!match) {
      return [];
    }

    const filters = buildSqlFilters(request.filters);
    const filterSql = filters.sql ? ` AND ${filters.sql.slice(" WHERE ".length)}` : "";
    const sql = `
      SELECT id, -bm25(embedding_fts) AS score
      FROM embedding_fts
      WHERE embedding_fts MATCH ?${filterSql}
      ORDER BY bm25(embedding_fts)
      LIMIT ?
    `;
    const rows = this.db.prepare(sql).all(match, ...filters.params, request.limit) as RankedRow[];

    if (!filters.needsMetadataFilter) {
      return rows.map((row, index) => ({ id: row.id, score: row.score, rank: index + 1 }));
    }

    const hydrated = new Map(this.hydrateByIds(rows.map((row) => row.id)).map((record) => [record.id, record]));
    return rows
      .filter((row) => {
        const record = hydrated.get(row.id);
        return record ? applyMetadataFilters(record, request.filters) : false;
      })
      .slice(0, request.limit)
      .map((row, index) => ({ id: row.id, score: row.score, rank: index + 1 }));
  }

  hydrateByIds(ids: readonly string[]): EmbeddingRecord[] {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db.prepare(`SELECT * FROM embeddings WHERE id IN (${placeholders})`).all(...ids) as EmbeddingRow[];
    const byId = new Map(rows.map((row) => [row.id, mapRow(row)]));
    return ids.flatMap((id) => {
      const record = byId.get(id);
      return record ? [record] : [];
    });
  }

  listSourceIds(sourceType: string): string[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT source_id FROM embeddings WHERE source_type = ?`)
      .all(sourceType) as { source_id: string }[];
    return rows.map((row) => row.source_id);
  }

  getContentHash(sourceId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT DISTINCT content_hash FROM embeddings WHERE source_id = ? LIMIT 1`,
      )
      .get(sourceId) as { content_hash: string } | undefined;
    return row?.content_hash ?? null;
  }

  getModelVersion(sourceId: string): string | null {
    const row = this.db
      .prepare(
        `SELECT DISTINCT model_version FROM embeddings WHERE source_id = ? LIMIT 1`,
      )
      .get(sourceId) as { model_version: string } | undefined;
    return row?.model_version ?? null;
  }

  count(sourceType?: string): number {
    if (sourceType) {
      const row = this.db
        .prepare(`SELECT COUNT(*) AS cnt FROM embeddings WHERE source_type = ?`)
        .get(sourceType) as { cnt: number };
      return row.cnt;
    }
    const row = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM embeddings`)
      .get() as { cnt: number };
    return row.cnt;
  }
}
