import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── §6.1 MCP tool tests (P1–P4, N1–N6, E8–E9) ──────────────────────

import {
  createDraftContentTool,
  createPublishContentTool,
  generateSlug,
} from "@/core/use-cases/tools/admin-content.tool";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { hasStructuredMarkdown, normalizeBlogMarkdown } from "@/lib/blog/normalize-markdown";

const mockContext: ToolExecutionContext = {
  userId: "usr_admin",
  role: "ADMIN",
  conversationId: "conv_test",
};

function createMockRepo(
  overrides: Partial<BlogPostRepository> = {},
): BlogPostRepository {
  return {
    create: vi.fn().mockImplementation((seed) =>
      Promise.resolve({
        id: "post_123",
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        content: seed.content,
        standfirst: seed.standfirst ?? null,
        section: seed.section ?? null,
        heroImageAssetId: null,
        status: "draft" as const,
        publishedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByUserId: seed.createdByUserId,
        publishedByUserId: null,
      }),
    ),
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    listPublished: vi.fn().mockResolvedValue([]),
    countPublished: vi.fn().mockResolvedValue(0),
    listForAdmin: vi.fn().mockResolvedValue([]),
    countForAdmin: vi.fn().mockResolvedValue(0),
    updateDraftContent: vi.fn(),
    updateEditorialMetadata: vi.fn(),
    transitionWorkflow: vi.fn(),
    publishById: vi.fn().mockImplementation((id, userId) =>
      Promise.resolve({
        id,
        slug: "test-post",
        title: "Test Post",
        description: "Test",
        content: "Content",
        standfirst: null,
        section: null,
        heroImageAssetId: null,
        status: "published" as const,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByUserId: "usr_admin",
        publishedByUserId: userId,
      }),
    ),
    setHeroImageAsset: vi.fn(),
    ...overrides,
  };
}

describe("draft_content tool", () => {
  it("P1: creates a draft blog post", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    const result = await tool.command.execute(
      { title: "Test Post", content: "## Hello world\n\nThis is the post body." },
      mockContext,
    );
    expect(result).toMatchObject({
      id: "post_123",
      slug: "test-post",
      status: "draft",
      title: "Test Post",
    });
    expect(mockRepo.create).toHaveBeenCalledOnce();
  });

  it("P2: auto-generates slug from title", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await tool.command.execute(
      { title: "My First Blog Post!", content: "## Overview\n\nContent here." },
      mockContext,
    );
    const seed = (mockRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(seed.slug).toBe("my-first-blog-post");
  });

  it("P3: auto-generates description from content", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await tool.command.execute(
      { title: "Test", content: "# Heading\n\nFirst paragraph of the post." },
      mockContext,
    );
    const seed = (mockRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(seed.description).toBe("First paragraph of the post.");
  });

  it("N1: rejects content with medical advice", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await expect(
      tool.command.execute(
        { title: "Health Tips", content: "Take this medical advice seriously." },
        mockContext,
      ),
    ).rejects.toThrow(/medical advice/i);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("N2: rejects content with legal advice", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await expect(
      tool.command.execute(
        { title: "Legal Help", content: "Here is legal advice for your case." },
        mockContext,
      ),
    ).rejects.toThrow(/legal advice/i);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("N6: rejects content with financial advice", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await expect(
      tool.command.execute(
        {
          title: "Investing 101",
          content: "Follow this financial advice for investing.",
        },
        mockContext,
      ),
    ).rejects.toThrow(/financial advice/i);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("N3: rejects empty title", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await expect(
      tool.command.execute({ title: "", content: "Some content." }, mockContext),
    ).rejects.toThrow();
  });

  it("N4: rejects empty content", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await expect(
      tool.command.execute({ title: "Valid Title", content: "" }, mockContext),
    ).rejects.toThrow();
  });

  it("N7: rejects plain prose that lacks markdown structure", async () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    await expect(
      tool.command.execute(
        {
          title: "Studio Ordo Capabilities",
          content: "Studio Ordo helps teams qualify leads and move work forward in one conversational interface.",
        },
        mockContext,
      ),
    ).rejects.toThrow(/structured markdown/i);
  });

  it("E8: tool descriptor has ADMIN-only roles", () => {
    const mockRepo = createMockRepo();
    const tool = createDraftContentTool(mockRepo);
    expect(tool.roles).toEqual(["ADMIN"]);
    expect(tool.category).toBe("content");
    expect(tool.name).toBe("draft_content");
    expect(tool.executionMode).toBe("deferred");
    expect(tool.deferred).toMatchObject({
      dedupeStrategy: "per-conversation-payload",
      retryable: true,
      notificationPolicy: "completion-and-failure",
    });
  });
});

describe("publish_content tool", () => {
  it("P4: transitions draft to published", async () => {
    const mockRepo = createMockRepo();
    const tool = createPublishContentTool(mockRepo);
    const result = await tool.command.execute(
      { post_id: "post_123" },
      mockContext,
    );
    expect(result).toMatchObject({
      status: "published",
    });
    expect(result.publishedAt).toBeTruthy();
    expect(mockRepo.publishById).toHaveBeenCalledWith("post_123", "usr_admin");
  });

  it("N5: rejects non-existent post ID", async () => {
    const mockRepo = createMockRepo({
      publishById: vi.fn().mockRejectedValue(new Error("Post not found")),
    });
    const tool = createPublishContentTool(mockRepo);
    await expect(
      tool.command.execute({ post_id: "nonexistent-id" }, mockContext),
    ).rejects.toThrow(/not found/i);
  });

  it("E9: tool descriptor has ADMIN-only roles", () => {
    const mockRepo = createMockRepo();
    const tool = createPublishContentTool(mockRepo);
    expect(tool.roles).toEqual(["ADMIN"]);
    expect(tool.category).toBe("content");
    expect(tool.name).toBe("publish_content");
  });
});

// ── §6.2 Data mapper tests (P5–P7) ───────────────────────────────────

import Database from "better-sqlite3";
import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT);
    CREATE TABLE blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      standfirst TEXT DEFAULT NULL,
      section TEXT DEFAULT NULL,
      hero_image_asset_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by_user_id TEXT NOT NULL,
      published_by_user_id TEXT
    );
  `);
  db.exec(
    `INSERT INTO users (id, email, name) VALUES ('usr_admin', 'admin@test.com', 'Admin')`,
  );
  return db;
}

describe("BlogPostDataMapper", () => {
  let db: Database.Database;
  let mapper: BlogPostDataMapper;

  beforeEach(() => {
    db = createTestDb();
    mapper = new BlogPostDataMapper(db);
  });

  it("P5: create persists and returns entity", async () => {
    const post = await mapper.create({
      slug: "hello-world",
      title: "Hello World",
      description: "A first post",
      content: "# Hello\n\nWorld.",
      createdByUserId: "usr_admin",
    });
    expect(post.id).toBeTruthy();
    expect(post.status).toBe("draft");
    expect(post.slug).toBe("hello-world");
    expect(post.title).toBe("Hello World");
    expect(post.standfirst).toBeNull();
    expect(post.section).toBeNull();

    const found = await mapper.findById(post.id);
    expect(found).toMatchObject({ id: post.id, slug: "hello-world" });
  });

  it("P6: listPublished returns only published posts", async () => {
    await mapper.create({
      slug: "draft-post",
      title: "Draft Post",
      description: "Draft",
      content: "Draft content.",
      createdByUserId: "usr_admin",
    });
    const toPublish = await mapper.create({
      slug: "published-post",
      title: "Published Post",
      description: "Published",
      content: "Published content.",
      createdByUserId: "usr_admin",
    });
    await mapper.publishById(toPublish.id, "usr_admin");

    const published = await mapper.listPublished();
    expect(published).toHaveLength(1);
    expect(published[0].slug).toBe("published-post");
    expect(published[0].status).toBe("published");
  });

  it("P7: findBySlug returns correct post or null", async () => {
    await mapper.create({
      slug: "hello-world",
      title: "Hello World",
      description: "A post",
      content: "Content.",
      createdByUserId: "usr_admin",
    });

    const found = await mapper.findBySlug("hello-world");
    expect(found).toBeTruthy();
    expect(found!.title).toBe("Hello World");

    const notFound = await mapper.findBySlug("nonexistent");
    expect(notFound).toBeNull();
  });

  it("P7b: persists explicit section and standfirst metadata", async () => {
    const post = await mapper.create({
      slug: "essay-post",
      title: "Essay Post",
      description: "A post",
      content: "## Heading\n\nBody.",
      standfirst: "A clear editorial opener.",
      section: "essay",
      createdByUserId: "usr_admin",
    });

    expect(post.standfirst).toBe("A clear editorial opener.");
    expect(post.section).toBe("essay");
  });

  it("P7c: countForAdmin respects search, section, and status filters", async () => {
    await mapper.create({
      slug: "essay-draft",
      title: "Essay Draft",
      description: "Essay draft",
      content: "## Essay\n\nDraft content.",
      section: "essay",
      createdByUserId: "usr_admin",
    });
    const reviewPost = await mapper.create({
      slug: "briefing-review",
      title: "Briefing Review",
      description: "Briefing review",
      content: "## Briefing\n\nReview content.",
      section: "briefing",
      createdByUserId: "usr_admin",
    });
    await mapper.transitionWorkflow(reviewPost.id, "review", "usr_admin");

    await expect(mapper.countForAdmin()).resolves.toBe(2);
    await expect(mapper.countForAdmin({ section: "essay" })).resolves.toBe(1);
    await expect(mapper.countForAdmin({ status: "review" })).resolves.toBe(1);
    await expect(mapper.countForAdmin({ search: "briefing" })).resolves.toBe(1);
  });
});

// ── §6.3 Sitemap tests (P8–P9, N7) ──────────────────────────────────

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({
    name: "Studio Ordo",
    domain: "studioordo.com",
    logoPath: "/ordo-avatar.png",
    tagline: "Strategic AI Advisory",
    description: "Test description",
  }),
}));

vi.mock("@/lib/corpus-library", () => ({
  getCorpusSummaries: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBlogPostRepository: () => ({
    countPublished: vi.fn().mockResolvedValue(1),
    listPublished: vi.fn().mockResolvedValue([
      {
        id: "post_1",
        slug: "first-post",
        title: "First Post",
        description: "The first post",
        content: "Content",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2025-01-15T00:00:00.000Z",
        createdAt: "2025-01-15T00:00:00.000Z",
        updatedAt: "2025-01-15T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]),
  }),
}));

import sitemap from "@/app/sitemap";

describe("sitemap public feed entries", () => {
  it("P8: includes /feed index entry when public feed content exists", async () => {
    const entries = await sitemap();
    const feedIndex = entries.find(
      (e) => e.url === "https://studioordo.com/feed",
    );
    expect(feedIndex).toBeDefined();
    expect(feedIndex?.priority).toBe(0.7);
  });

  it("P9: does not emit retired journal post entries", async () => {
    const entries = await sitemap();
    const postEntry = entries.find(
      (e) => e.url === "https://studioordo.com/journal/first-post",
    );
    expect(postEntry).toBeUndefined();
  });

  it("N7: keeps retired journal posts out of the public sitemap", async () => {
    const entries = await sitemap();
    const journalPosts = entries.filter((e) => e.url.match(/\/journal\/[^/]+$/));
    expect(journalPosts).toHaveLength(0);
  });
});

// ── §6.4 Source analysis and edge tests (E1–E7) ─────────────────────

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

describe("slug generation", () => {
  it("E1: strips special characters", () => {
    expect(generateSlug("Hello, World! (2025)")).toBe("hello-world-2025");
  });

  it("E2: truncates to 100 characters", () => {
    const slug = generateSlug("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(100);
  });
});

// Public blog/journal/library routes are retired; feed will own public output.
describe("blog page source analysis", () => {
  it("E3: journal index page is retired with notFound", () => {
    const src = readSource("src/app/journal/page.tsx");
    expect(src).toContain("notFound");
    expect(src).not.toContain("generateMetadata");
  });

  it("E4: journal post page is retired with notFound", () => {
    const src = readSource("src/app/journal/[slug]/page.tsx");
    expect(src).toContain("notFound");
    expect(src).not.toContain("generateMetadata");
  });

  it("E5: blog post redirect page calls notFound for missing posts", () => {
    const src = readSource("src/app/blog/[slug]/page.tsx");
    expect(src).toContain("notFound");
  });

  it("E5b: journal post page uses library markdown rendering", () => {
    // Rendering moved to the shared PublicJournalPages component re-exported by journal route
    const src = readSource("src/components/journal/PublicJournalPages.tsx");
    expect(src).toContain("MarkdownProse");
    expect(src).toContain("normalizeBlogMarkdown");
  });

  it("E5c: library section page is retired with notFound", () => {
    const src = readSource("src/app/library/[document]/[section]/page.tsx");
    expect(src).toContain("notFound");
    expect(src).not.toContain("MarkdownProse");
  });

  it("E6: blog redirect pages have no auth imports", () => {
    const indexSrc = readSource("src/app/blog/page.tsx");
    const postSrc = readSource("src/app/blog/[slug]/page.tsx");
    for (const src of [indexSrc, postSrc]) {
      expect(src).not.toContain("getSessionUser");
      expect(src).not.toContain("getServerSession");
    }
  });
});

describe("blog schema", () => {
  it("E7: blog_posts table exists in schema", () => {
    const src = readSource("src/lib/db/tables.ts");
    expect(src).toContain("blog_posts");
  });
});

describe("blog markdown normalization", () => {
  it("E8: removes duplicated title lines from generated post bodies", () => {
    const normalized = normalizeBlogMarkdown(
      "Meet Studio Ordo",
      "Meet Studio Ordo\n\n## What It Does\n\nIt helps teams move work forward.",
    );

    expect(normalized.startsWith("## What It Does")).toBe(true);
  });

  it("E9: upgrades standalone section labels into markdown headings", () => {
    const normalized = normalizeBlogMarkdown(
      "Meet Studio Ordo",
      "Intro paragraph.\n\nWhat It Can Do for Your Business\nIt helps teams qualify leads.",
    );

    expect(normalized).toContain("## What It Can Do for Your Business");
  });

  it("E10: detects structured markdown content", () => {
    expect(hasStructuredMarkdown("## Heading\n\n- Item one")).toBe(true);
    expect(hasStructuredMarkdown("Plain prose only")).toBe(false);
  });
});
