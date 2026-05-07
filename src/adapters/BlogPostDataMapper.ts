import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  BlogPost,
  BlogPostAdminFilters,
  BlogPostDraftPatch,
  BlogPostEditorialMetadataPatch,
  BlogPostSeed,
  BlogPostStatus,
} from "@/core/entities/blog";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";

interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  standfirst: string | null;
  section: string | null;
  hero_image_asset_id: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  published_by_user_id: string | null;
}

function buildAdminFilterQuery(filters: Omit<BlogPostAdminFilters, "limit"> = {}) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.search?.trim()) {
    clauses.push(`(lower(title) LIKE ? OR lower(slug) LIKE ?)`);
    const search = `%${filters.search.trim().toLowerCase()}%`;
    params.push(search, search);
  }

  if (filters.status) {
    clauses.push(`status = ?`);
    params.push(filters.status);
  }

  if (filters.section) {
    clauses.push(`section = ?`);
    params.push(filters.section);
  }

  return {
    whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function mapRow(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    content: row.content,
    standfirst: row.standfirst,
    section: row.section as BlogPost["section"],
    heroImageAssetId: row.hero_image_asset_id,
    status: row.status as BlogPost["status"],
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
    publishedByUserId: row.published_by_user_id,
  };
}

export class BlogPostDataMapper implements BlogPostRepository {
  constructor(private readonly db: Database.Database) {}

  async create(seed: BlogPostSeed): Promise<BlogPost> {
    const id = `blogpost_${randomUUID()}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO blog_posts (
          id,
          slug,
          title,
          description,
          content,
          standfirst,
          section,
          status,
          created_at,
          updated_at,
          created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      )
      .run(
        id,
        seed.slug,
        seed.title,
        seed.description,
        seed.content,
        seed.standfirst ?? null,
        seed.section ?? null,
        now,
        now,
        seed.createdByUserId,
      );

    const row = this.db
      .prepare(`SELECT * FROM blog_posts WHERE id = ?`)
      .get(id) as BlogPostRow;
    return mapRow(row);
  }

  async findById(id: string): Promise<BlogPost | null> {
    const row = this.db
      .prepare(`SELECT * FROM blog_posts WHERE id = ?`)
      .get(id) as BlogPostRow | undefined;
    return row ? mapRow(row) : null;
  }

  async findBySlug(slug: string): Promise<BlogPost | null> {
    const row = this.db
      .prepare(`SELECT * FROM blog_posts WHERE slug = ?`)
      .get(slug) as BlogPostRow | undefined;
    return row ? mapRow(row) : null;
  }

  async listPublished(): Promise<BlogPost[]> {
    const rows = this.db
      .prepare(`SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`)
      .all() as BlogPostRow[];
    return rows.map(mapRow);
  }

  async countPublished(): Promise<number> {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS total FROM blog_posts WHERE status = 'published'`)
      .get() as { total: number };

    return row.total;
  }

  async listForAdmin(filters: BlogPostAdminFilters = {}): Promise<BlogPost[]> {
    const { whereClause, params } = buildAdminFilterQuery(filters);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const rows = this.db.prepare(
      `SELECT * FROM blog_posts ${whereClause} ORDER BY updated_at DESC LIMIT ?`,
    ).all(...params, limit) as BlogPostRow[];

    return rows.map(mapRow);
  }

  async countForAdmin(filters: Omit<BlogPostAdminFilters, "limit"> = {}): Promise<number> {
    const { whereClause, params } = buildAdminFilterQuery(filters);
    const row = this.db.prepare(
      `SELECT COUNT(*) AS total FROM blog_posts ${whereClause}`,
    ).get(...params) as { total: number };

    return row.total;
  }

  async updateDraftContent(id: string, patch: BlogPostDraftPatch): Promise<BlogPost> {
    const current = this.getRequiredRow(id);
    const now = new Date().toISOString();

    this.db.prepare(
      `UPDATE blog_posts
       SET title = ?, description = ?, content = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      patch.title ?? current.title,
      patch.description ?? current.description,
      patch.content ?? current.content,
      now,
      id,
    );

    return mapRow(this.getRequiredRow(id));
  }

  async updateEditorialMetadata(id: string, patch: BlogPostEditorialMetadataPatch): Promise<BlogPost> {
    const current = this.getRequiredRow(id);
    const now = new Date().toISOString();

    this.db.prepare(
      `UPDATE blog_posts
       SET slug = ?, title = ?, description = ?, standfirst = ?, section = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      patch.slug ?? current.slug,
      patch.title ?? current.title,
      patch.description ?? current.description,
      patch.standfirst === undefined ? current.standfirst : patch.standfirst,
      patch.section === undefined ? current.section : patch.section,
      now,
      id,
    );

    return mapRow(this.getRequiredRow(id));
  }

  async transitionWorkflow(id: string, nextStatus: BlogPostStatus, actorUserId: string): Promise<BlogPost> {
    const current = this.getRequiredRow(id);
    const now = new Date().toISOString();
    const enteringPublished = current.status !== "published" && nextStatus === "published";
    const leavingPublished = current.status === "published" && nextStatus !== "published";

    this.db.prepare(
      `UPDATE blog_posts
       SET status = ?,
           published_at = ?,
           updated_at = ?,
           published_by_user_id = ?
       WHERE id = ?`,
    ).run(
      nextStatus,
      enteringPublished ? now : (leavingPublished ? null : current.published_at),
      now,
      enteringPublished ? actorUserId : (leavingPublished ? null : current.published_by_user_id),
      id,
    );

    return mapRow(this.getRequiredRow(id));
  }

  async setHeroImageAsset(id: string, heroImageAssetId: string | null): Promise<BlogPost> {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`UPDATE blog_posts SET hero_image_asset_id = ?, updated_at = ? WHERE id = ?`)
      .run(heroImageAssetId, now, id);

    if (result.changes === 0) {
      throw new Error(`Post not found: ${id}`);
    }

    const row = this.db
      .prepare(`SELECT * FROM blog_posts WHERE id = ?`)
      .get(id) as BlogPostRow;
    return mapRow(row);
  }

  async publishById(id: string, publishedByUserId: string): Promise<BlogPost> {
    const current = this.getRequiredRow(id);

    if (current.status === "published") {
      throw new Error(`Post not found or already published: ${id}`);
    }

    return this.transitionWorkflow(id, "published", publishedByUserId);
  }

  private getRequiredRow(id: string): BlogPostRow {
    const row = this.db.prepare(`SELECT * FROM blog_posts WHERE id = ?`).get(id) as BlogPostRow | undefined;

    if (!row) {
      throw new Error(`Post not found: ${id}`);
    }

    return row;
  }
}
