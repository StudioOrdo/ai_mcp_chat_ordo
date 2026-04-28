import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import type { BlogAsset, BlogAssetSeed } from "@/core/entities/blog-asset";
import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";

interface BlogAssetRow {
  id: string;
  post_id: string | null;
  kind: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  alt_text: string;
  source_prompt: string | null;
  provider: string | null;
  provider_model: string | null;
  visibility: string;
  selection_state: string;
  variation_group_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: BlogAssetRow): BlogAsset {
  return {
    id: row.id,
    postId: row.post_id,
    kind: row.kind as BlogAsset["kind"],
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    sourcePrompt: row.source_prompt,
    provider: row.provider,
    providerModel: row.provider_model,
    visibility: row.visibility as BlogAsset["visibility"],
    selectionState: row.selection_state as BlogAsset["selectionState"],
    variationGroupId: row.variation_group_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BlogAssetDataMapper implements BlogAssetRepository {
  constructor(private readonly db: Database.Database) {}

  async create(seed: BlogAssetSeed): Promise<BlogAsset> {
    const id = `blogasset_${randomUUID()}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO blog_assets (
          id,
          post_id,
          kind,
          storage_path,
          mime_type,
          width,
          height,
          alt_text,
          source_prompt,
          provider,
          provider_model,
          visibility,
          selection_state,
          variation_group_id,
          created_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        seed.postId ?? null,
        seed.kind,
        seed.storagePath,
        seed.mimeType,
        seed.width ?? null,
        seed.height ?? null,
        seed.altText,
        seed.sourcePrompt ?? null,
        seed.provider ?? null,
        seed.providerModel ?? null,
        seed.visibility ?? "draft",
        seed.selectionState ?? "candidate",
        seed.variationGroupId ?? null,
        seed.createdByUserId,
        now,
        now,
      );

    return this.getRequiredById(id);
  }

  async findById(id: string): Promise<BlogAsset | null> {
    const row = this.db
      .prepare(`SELECT * FROM blog_assets WHERE id = ?`)
      .get(id) as BlogAssetRow | undefined;
    return row ? mapRow(row) : null;
  }

  async listByPost(postId: string): Promise<BlogAsset[]> {
    const rows = this.db
      .prepare(`SELECT * FROM blog_assets WHERE post_id = ? ORDER BY created_at ASC`)
      .all(postId) as BlogAssetRow[];
    return rows.map(mapRow);
  }

  async listByUser(
    userId: string,
    options?: { limit?: number; kinds?: string[] },
  ): Promise<BlogAsset[]> {
    const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
    const kinds = options?.kinds;

    if (kinds && kinds.length > 0) {
      const placeholders = kinds.map(() => "?").join(", ");
      const rows = this.db
        .prepare(
          `SELECT * FROM blog_assets
           WHERE created_by_user_id = ?
             AND kind IN (${placeholders})
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(userId, ...kinds, limit) as BlogAssetRow[];
      return rows.map(mapRow);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM blog_assets
         WHERE created_by_user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(userId, limit) as BlogAssetRow[];
    return rows.map(mapRow);
  }

  async listHeroCandidates(postId: string): Promise<BlogAsset[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM blog_assets
         WHERE post_id = ? AND kind = 'hero'
         ORDER BY
           CASE selection_state
             WHEN 'selected' THEN 0
             WHEN 'candidate' THEN 1
             ELSE 2
           END,
           created_at DESC`,
      )
      .all(postId) as BlogAssetRow[];
    return rows.map(mapRow);
  }

  async attachToPost(id: string, postId: string): Promise<BlogAsset> {
    return this.updateSingle(
      `UPDATE blog_assets SET post_id = ?, updated_at = ? WHERE id = ?`,
      postId,
      new Date().toISOString(),
      id,
    );
  }

  async detachFromPost(id: string): Promise<BlogAsset> {
    return this.updateSingle(
      `UPDATE blog_assets SET post_id = NULL, updated_at = ? WHERE id = ?`,
      new Date().toISOString(),
      id,
    );
  }

  async setVisibility(id: string, visibility: BlogAsset["visibility"]): Promise<BlogAsset> {
    return this.updateSingle(
      `UPDATE blog_assets SET visibility = ?, updated_at = ? WHERE id = ?`,
      visibility,
      new Date().toISOString(),
      id,
    );
  }

  async setSelectionState(
    id: string,
    selectionState: BlogAsset["selectionState"],
  ): Promise<BlogAsset> {
    return this.updateSingle(
      `UPDATE blog_assets SET selection_state = ?, updated_at = ? WHERE id = ?`,
      selectionState,
      new Date().toISOString(),
      id,
    );
  }

  private updateSingle(sql: string, ...params: Array<string | null>): BlogAsset {
    const result = this.db.prepare(sql).run(...params);
    const id = String(params[params.length - 1]);

    if (result.changes === 0) {
      throw new Error(`Blog asset not found: ${id}`);
    }

    return this.getRequiredById(id);
  }

  private getRequiredById(id: string): BlogAsset {
    const row = this.db
      .prepare(`SELECT * FROM blog_assets WHERE id = ?`)
      .get(id) as BlogAssetRow | undefined;

    if (!row) {
      throw new Error(`Blog asset not found: ${id}`);
    }

    return mapRow(row);
  }
}