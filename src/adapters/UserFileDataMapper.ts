import type Database from "better-sqlite3";
import type { UserFile } from "@/core/entities/user-file";
import type {
  AdminUserFileFilters,
  AdminUserFileListFilters,
  UserFileListFilters,
  UserFileListPage,
} from "@/core/entities/user-file-query";
import {
  createEmptyFleetUserFileStorageSummary,
  createEmptyUserFileStorageSummary,
  type FleetUserFileStorageSummary,
  type UserFileStorageSummary,
  type UserStorageLeaderboardEntry,
} from "@/core/entities/user-file-storage";
import type {
  CreateUserFileBatchWithinQuotaOptions,
  CreateUserFileBatchWithinQuotaResult,
  UserFileRepository,
} from "@/core/use-cases/UserFileRepository";
import { buildUserFileMetadata } from "@/lib/media/media-asset-projection";

interface UserFileRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  content_hash: string;
  file_type: string;
  file_name: string;
  status: "pending" | "ready" | "failed";
  mime_type: string;
  file_size: number;
  metadata_json: string;
  created_at: string;
}

interface StorageTypeRow {
  file_type: UserFile["fileType"];
  file_count: number;
  total_bytes: number;
}

interface StorageRetentionRow {
  retention_class: "conversation" | "durable" | "ephemeral";
  file_count: number;
  total_bytes: number;
}

interface StorageSourceRow {
  source: "derived" | "generated" | "uploaded";
  file_count: number;
  total_bytes: number;
}

interface StorageSummaryRow {
  total_files: number;
  total_bytes: number;
  attached_files: number;
  attached_bytes: number;
  unattached_files: number;
  unattached_bytes: number;
}

interface FleetStorageSummaryRow extends StorageSummaryRow {
  total_users: number;
}

interface LargestUserRow {
  user_id: string;
  total_files: number;
  total_bytes: number;
}

const DEFAULT_USER_FILE_LIST_LIMIT = 25;
const DEFAULT_ADMIN_USER_FILE_LIST_LIMIT = 50;
const MAX_USER_FILE_LIST_LIMIT = 100;

function retentionClassSqlExpression(): string {
  return `COALESCE(json_extract(metadata_json, '$.retentionClass'), CASE WHEN conversation_id IS NULL THEN 'ephemeral' ELSE 'conversation' END)`;
}

function sourceSqlExpression(): string {
  return `COALESCE(json_extract(metadata_json, '$.source'), CASE WHEN file_type IN ('audio', 'chart', 'graph', 'subtitle', 'waveform') THEN 'generated' ELSE 'uploaded' END)`;
}

function clampListLimit(limit: number | undefined, fallback: number): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return fallback;
  }

  return Math.min(Math.trunc(limit), MAX_USER_FILE_LIST_LIMIT);
}

function buildListConditions(
  filters: AdminUserFileFilters,
  params: unknown[],
): string[] {
  const conditions: string[] = [];

  if (filters.search?.trim()) {
    const like = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(`(LOWER(file_name) LIKE ? OR LOWER(mime_type) LIKE ?)`);
    params.push(like, like);
  }

  if (filters.userId) {
    conditions.push(`user_id = ?`);
    params.push(filters.userId);
  }

  if (filters.conversationId) {
    conditions.push(`conversation_id = ?`);
    params.push(filters.conversationId);
  }

  if (filters.fileType) {
    conditions.push(`file_type = ?`);
    params.push(filters.fileType);
  }

  if (filters.source) {
    conditions.push(`${sourceSqlExpression()} = ?`);
    params.push(filters.source);
  }

  if (filters.retentionClass) {
    conditions.push(`${retentionClassSqlExpression()} = ?`);
    params.push(filters.retentionClass);
  }

  if (filters.attached === true) {
    conditions.push(`conversation_id IS NOT NULL`);
  } else if (filters.attached === false) {
    conditions.push(`conversation_id IS NULL`);
  }

  return conditions;
}

function mapStorageSummaryRow(row: StorageSummaryRow | undefined): UserFileStorageSummary {
  const summary = createEmptyUserFileStorageSummary();
  if (!row) {
    return summary;
  }

  summary.totalFiles = Number(row.total_files ?? 0);
  summary.totalBytes = Number(row.total_bytes ?? 0);
  summary.attachedFiles = Number(row.attached_files ?? 0);
  summary.attachedBytes = Number(row.attached_bytes ?? 0);
  summary.unattachedFiles = Number(row.unattached_files ?? 0);
  summary.unattachedBytes = Number(row.unattached_bytes ?? 0);
  return summary;
}

function applyTypeBreakdown<T extends UserFileStorageSummary | FleetUserFileStorageSummary>(
  summary: T,
  rows: StorageTypeRow[],
): T {
  for (const row of rows) {
    summary.byType[row.file_type] = {
      files: Number(row.file_count ?? 0),
      bytes: Number(row.total_bytes ?? 0),
    };
  }

  return summary;
}

function applyRetentionBreakdown<T extends UserFileStorageSummary | FleetUserFileStorageSummary>(
  summary: T,
  rows: StorageRetentionRow[],
): T {
  for (const row of rows) {
    summary.byRetentionClass[row.retention_class] = {
      files: Number(row.file_count ?? 0),
      bytes: Number(row.total_bytes ?? 0),
    };
  }

  return summary;
}

function applySourceBreakdown<T extends UserFileStorageSummary | FleetUserFileStorageSummary>(
  summary: T,
  rows: StorageSourceRow[],
): T {
  for (const row of rows) {
    summary.bySource[row.source] = {
      files: Number(row.file_count ?? 0),
      bytes: Number(row.total_bytes ?? 0),
    };
  }

  return summary;
}

function parseMetadata(metadataJson: string | null | undefined): UserFile["metadata"] {
  if (!metadataJson || !metadataJson.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadataJson) as Partial<UserFile["metadata"]>;
    return buildUserFileMetadata(parsed);
  } catch {
    return {};
  }
}

function mapRow(row: UserFileRow): UserFile {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    contentHash: row.content_hash,
    status: row.status,
    fileType: row.file_type as UserFile["fileType"],
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
  };
}

export class UserFileDataMapper implements UserFileRepository {
  constructor(private db: Database.Database) {}

  async create(file: Omit<UserFile, "createdAt">): Promise<UserFile> {
    this.db
      .prepare(
        `INSERT INTO user_files (id, user_id, conversation_id, content_hash, file_type, status, file_name, mime_type, file_size, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           content_hash = excluded.content_hash,
           status = excluded.status,
           file_name = excluded.file_name,
           mime_type = excluded.mime_type,
           file_size = excluded.file_size,
           metadata_json = excluded.metadata_json`,
      )
      .run(
        file.id,
        file.userId,
        file.conversationId,
        file.contentHash,
        file.fileType,
        file.status,
        file.fileName,
        file.mimeType,
        file.fileSize,
        JSON.stringify(buildUserFileMetadata(file.metadata)),
      );

    const row = this.db
      .prepare(`SELECT * FROM user_files WHERE id = ?`)
      .get(file.id) as UserFileRow;

    return mapRow(row);
  }

  async createBatchWithinQuota(
    files: Array<Omit<UserFile, "createdAt">>,
    options: CreateUserFileBatchWithinQuotaOptions,
  ): Promise<CreateUserFileBatchWithinQuotaResult> {
    const loadUsedBytes = this.db.prepare(
      `SELECT COALESCE(SUM(file_size), 0) AS total_bytes FROM user_files WHERE user_id = ?`,
    );
    const findExisting = this.db.prepare(
      `SELECT * FROM user_files WHERE user_id = ? AND content_hash = ? AND file_type = ?`,
    );
    const insert = this.db.prepare(
      `INSERT INTO user_files (id, user_id, conversation_id, content_hash, file_type, status, file_name, mime_type, file_size, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const loadCreated = this.db.prepare(`SELECT * FROM user_files WHERE id = ?`);

    this.db.exec("BEGIN IMMEDIATE");

    try {
      const currentUsedBytes = Number(
        ((loadUsedBytes.get(options.userId) as { total_bytes?: number } | undefined)?.total_bytes ?? 0),
      );
      const resolvedRows: UserFileRow[] = [];
      let insertedBytes = 0;

      for (const file of files) {
        const existing = findExisting.get(
          file.userId,
          file.contentHash,
          file.fileType,
        ) as UserFileRow | undefined;

        if (existing) {
          continue;
        }

        insertedBytes += file.fileSize;
      }

      const projectedTotalBytes = currentUsedBytes + insertedBytes;
      if (options.hardBlockUploadsAtQuota && projectedTotalBytes > options.quotaBytes) {
        this.db.exec("ROLLBACK");
        return {
          files: [],
          insertedBytes,
          projectedTotalBytes,
          quotaExceeded: true,
        };
      }

      for (const file of files) {
        const existing = findExisting.get(
          file.userId,
          file.contentHash,
          file.fileType,
        ) as UserFileRow | undefined;

        if (existing) {
          resolvedRows.push(existing);
          continue;
        }

        insert.run(
          file.id,
          file.userId,
          file.conversationId,
          file.contentHash,
          file.fileType,
          file.status,
          file.fileName,
          file.mimeType,
          file.fileSize,
          JSON.stringify(buildUserFileMetadata(file.metadata)),
        );

        const created = loadCreated.get(file.id) as UserFileRow | undefined;
        if (!created) {
          throw new Error(`Expected user file ${file.id} to exist after insert.`);
        }

        resolvedRows.push(created);
      }

      this.db.exec("COMMIT");

      return {
        files: resolvedRows.map(mapRow),
        insertedBytes,
        projectedTotalBytes,
        quotaExceeded: false,
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async findById(id: string): Promise<UserFile | null> {
    const row = this.db
      .prepare(`SELECT * FROM user_files WHERE id = ?`)
      .get(id) as UserFileRow | undefined;

    return row ? mapRow(row) : null;
  }

  async findByHash(
    userId: string,
    contentHash: string,
    fileType: UserFile["fileType"],
  ): Promise<UserFile | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM user_files
         WHERE user_id = ? AND content_hash = ? AND file_type = ?
         ORDER BY CASE WHEN conversation_id IS NULL THEN 1 ELSE 0 END ASC,
                  datetime(created_at) DESC,
                  id DESC`,
      )
      .get(userId, contentHash, fileType) as UserFileRow | undefined;

    return row ? mapRow(row) : null;
  }

  async listByConversation(conversationId: string): Promise<UserFile[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM user_files WHERE conversation_id = ? ORDER BY created_at ASC`,
      )
      .all(conversationId) as UserFileRow[];

    return rows.map(mapRow);
  }

  async listByUser(userId: string): Promise<UserFile[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM user_files WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .all(userId) as UserFileRow[];

    return rows.map(mapRow);
  }

  async listForUser(userId: string, filters: UserFileListFilters): Promise<UserFileListPage> {
    const limit = clampListLimit(filters.limit, DEFAULT_USER_FILE_LIST_LIMIT);
    const params: unknown[] = [];
    const conditions = buildListConditions({
      search: filters.search,
      fileType: filters.fileType,
      source: filters.source,
      retentionClass: filters.retentionClass,
      attached: filters.attached,
      userId,
    }, params);

    if (filters.cursor) {
      conditions.push(`(datetime(created_at) < datetime(?) OR (datetime(created_at) = datetime(?) AND id < ?))`);
      params.push(filters.cursor.createdAt, filters.cursor.createdAt, filters.cursor.id);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM user_files
         WHERE ${conditions.join(" AND ")}
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ?`,
      )
      .all(...params, limit + 1) as UserFileRow[];

    const pageRows = rows.slice(0, limit);
    const nextRow = rows.length > limit ? pageRows[pageRows.length - 1] : null;

    return {
      items: pageRows.map(mapRow),
      nextCursor: nextRow
        ? {
          createdAt: nextRow.created_at,
          id: nextRow.id,
        }
        : null,
    };
  }

  async getUserStorageSummary(userId: string): Promise<UserFileStorageSummary> {
    const summaryRow = this.db
      .prepare(
        `SELECT
            COUNT(*) AS total_files,
            COALESCE(SUM(file_size), 0) AS total_bytes,
            SUM(CASE WHEN conversation_id IS NOT NULL THEN 1 ELSE 0 END) AS attached_files,
            COALESCE(SUM(CASE WHEN conversation_id IS NOT NULL THEN file_size ELSE 0 END), 0) AS attached_bytes,
            SUM(CASE WHEN conversation_id IS NULL THEN 1 ELSE 0 END) AS unattached_files,
            COALESCE(SUM(CASE WHEN conversation_id IS NULL THEN file_size ELSE 0 END), 0) AS unattached_bytes
         FROM user_files
         WHERE user_id = ?`,
      )
      .get(userId) as StorageSummaryRow | undefined;

    const typeRows = this.db
      .prepare(
        `SELECT
            file_type,
            COUNT(*) AS file_count,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         WHERE user_id = ?
         GROUP BY file_type`,
      )
      .all(userId) as StorageTypeRow[];

    const retentionRows = this.db
      .prepare(
        `SELECT
            ${retentionClassSqlExpression()} AS retention_class,
            COUNT(*) AS file_count,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         WHERE user_id = ?
         GROUP BY retention_class`,
      )
      .all(userId) as StorageRetentionRow[];

    const sourceRows = this.db
      .prepare(
        `SELECT
            ${sourceSqlExpression()} AS source,
            COUNT(*) AS file_count,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         WHERE user_id = ?
         GROUP BY source`,
      )
      .all(userId) as StorageSourceRow[];

    return applySourceBreakdown(
      applyRetentionBreakdown(
        applyTypeBreakdown(mapStorageSummaryRow(summaryRow), typeRows),
        retentionRows,
      ),
      sourceRows,
    );
  }

  async listForAdmin(filters: AdminUserFileListFilters): Promise<UserFile[]> {
    const limit = clampListLimit(filters.limit, DEFAULT_ADMIN_USER_FILE_LIST_LIMIT);
    const offset = Number.isFinite(filters.offset) && filters.offset && filters.offset > 0
      ? Math.trunc(filters.offset)
      : 0;
    const params: unknown[] = [];
    const conditions = buildListConditions(filters, params);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = this.db
      .prepare(
        `SELECT * FROM user_files
         ${whereClause}
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as UserFileRow[];

    return rows.map(mapRow);
  }

  async countForAdmin(filters: AdminUserFileFilters = {}): Promise<number> {
    const params: unknown[] = [];
    const conditions = buildListConditions(filters, params);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const row = this.db
      .prepare(`SELECT COUNT(*) AS total FROM user_files ${whereClause}`)
      .get(...params) as { total: number } | undefined;

    return Number(row?.total ?? 0);
  }

  async getFleetStorageSummary(filters: AdminUserFileFilters = {}): Promise<FleetUserFileStorageSummary> {
    const params: unknown[] = [];
    const conditions = buildListConditions(filters, params);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const summaryRow = this.db
      .prepare(
        `SELECT
            COUNT(*) AS total_files,
            COALESCE(SUM(file_size), 0) AS total_bytes,
            SUM(CASE WHEN conversation_id IS NOT NULL THEN 1 ELSE 0 END) AS attached_files,
            COALESCE(SUM(CASE WHEN conversation_id IS NOT NULL THEN file_size ELSE 0 END), 0) AS attached_bytes,
            SUM(CASE WHEN conversation_id IS NULL THEN 1 ELSE 0 END) AS unattached_files,
            COALESCE(SUM(CASE WHEN conversation_id IS NULL THEN file_size ELSE 0 END), 0) AS unattached_bytes,
            COUNT(DISTINCT user_id) AS total_users
         FROM user_files
         ${whereClause}`,
      )
      .get(...params) as FleetStorageSummaryRow | undefined;

    const typeRows = this.db
      .prepare(
        `SELECT
            file_type,
            COUNT(*) AS file_count,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         ${whereClause}
         GROUP BY file_type`,
      )
      .all(...params) as StorageTypeRow[];

    const retentionRows = this.db
      .prepare(
        `SELECT
            ${retentionClassSqlExpression()} AS retention_class,
            COUNT(*) AS file_count,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         ${whereClause}
         GROUP BY retention_class`,
      )
      .all(...params) as StorageRetentionRow[];

    const sourceRows = this.db
      .prepare(
        `SELECT
            ${sourceSqlExpression()} AS source,
            COUNT(*) AS file_count,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         ${whereClause}
         GROUP BY source`,
      )
      .all(...params) as StorageSourceRow[];

    const summary = createEmptyFleetUserFileStorageSummary();
    if (summaryRow) {
      summary.totalFiles = Number(summaryRow.total_files ?? 0);
      summary.totalBytes = Number(summaryRow.total_bytes ?? 0);
      summary.attachedFiles = Number(summaryRow.attached_files ?? 0);
      summary.attachedBytes = Number(summaryRow.attached_bytes ?? 0);
      summary.unattachedFiles = Number(summaryRow.unattached_files ?? 0);
      summary.unattachedBytes = Number(summaryRow.unattached_bytes ?? 0);
      summary.totalUsers = Number(summaryRow.total_users ?? 0);
    }

    return applySourceBreakdown(
      applyRetentionBreakdown(
        applyTypeBreakdown(summary, typeRows),
        retentionRows,
      ),
      sourceRows,
    );
  }

  async listLargestUsersByStorage(limit: number): Promise<UserStorageLeaderboardEntry[]> {
    const resolvedLimit = clampListLimit(limit, 10);
    const rows = this.db
      .prepare(
        `SELECT
            user_id,
            COUNT(*) AS total_files,
            COALESCE(SUM(file_size), 0) AS total_bytes
         FROM user_files
         GROUP BY user_id
         ORDER BY total_bytes DESC, total_files DESC, user_id ASC
         LIMIT ?`,
      )
      .all(resolvedLimit) as LargestUserRow[];

    return rows.map((row) => ({
      userId: row.user_id,
      totalFiles: Number(row.total_files ?? 0),
      totalBytes: Number(row.total_bytes ?? 0),
    }));
  }

  async listUnattachedCreatedBefore(
    cutoffIso: string,
    options?: {
      userId?: string;
      fileType?: UserFile["fileType"];
    },
  ): Promise<UserFile[]> {
    const conditions = [
      `conversation_id IS NULL`,
      `datetime(created_at) < datetime(?)`,
    ];
    const params: unknown[] = [cutoffIso];

    if (options?.userId) {
      conditions.push(`user_id = ?`);
      params.push(options.userId);
    }

    if (options?.fileType) {
      conditions.push(`file_type = ?`);
      params.push(options.fileType);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM user_files
         WHERE ${conditions.join(" AND ")}
         ORDER BY created_at ASC`,
      )
      .all(...params) as UserFileRow[];

    return rows.map(mapRow);
  }

  async assignConversation(
    fileIds: string[],
    userId: string,
    conversationId: string,
  ): Promise<void> {
    if (fileIds.length === 0) {
      return;
    }

    const placeholders = fileIds.map(() => "?").join(", ");
    this.db
      .prepare(
        `UPDATE user_files
         SET conversation_id = ?,
             metadata_json = CASE
               WHEN COALESCE(json_extract(metadata_json, '$.retentionClass'), '') IN ('', 'ephemeral', 'conversation')
                 THEN json_set(COALESCE(NULLIF(metadata_json, ''), '{}'), '$.retentionClass', 'conversation')
               ELSE metadata_json
             END
         WHERE user_id = ? AND id IN (${placeholders})`,
      )
      .run(conversationId, userId, ...fileIds);
  }

  async transferOwnershipForConversations(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
  }): Promise<UserFile[]> {
    const conversationIds = Array.from(new Set(input.conversationIds.map((id) => id.trim()).filter(Boolean)));
    if (conversationIds.length === 0) {
      return [];
    }

    const placeholders = conversationIds.map(() => "?").join(", ");
    const rows = this.db.prepare(
      `SELECT * FROM user_files
       WHERE conversation_id IN (${placeholders})
         AND user_id IN (?, ?)
       ORDER BY created_at ASC, id ASC`,
    ).all(...conversationIds, input.previousUserId, input.userId) as UserFileRow[];

    this.db.prepare(
      `UPDATE user_files
       SET user_id = ?
       WHERE conversation_id IN (${placeholders})
         AND user_id = ?`,
    ).run(input.userId, ...conversationIds, input.previousUserId);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const idPlaceholders = ids.map(() => "?").join(", ");
    const transferredRows = this.db.prepare(
      `SELECT * FROM user_files
       WHERE id IN (${idPlaceholders})
       ORDER BY created_at ASC, id ASC`,
    ).all(...ids) as UserFileRow[];

    return transferredRows.map(mapRow);
  }

  async deleteIfUnattached(id: string, userId: string): Promise<UserFile | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM user_files WHERE id = ? AND user_id = ? AND conversation_id IS NULL`,
      )
      .get(id, userId) as UserFileRow | undefined;

    if (!row) {
      return null;
    }

    this.db.prepare(`DELETE FROM user_files WHERE id = ?`).run(id);
    return mapRow(row);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM user_files WHERE id = ?`).run(id);
  }
}
