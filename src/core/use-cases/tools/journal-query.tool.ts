import type { BlogPost, BlogPostAdminFilters, BlogPostSection, BlogPostStatus } from "@/core/entities/blog";
import type { BlogPostRevision } from "@/core/entities/blog-revision";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { BlogPostRevisionRepository } from "@/core/use-cases/BlogPostRevisionRepository";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { getActiveJobStatuses, type CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import {
  getAdminJournalDetailPath,
  getAdminJournalListPath,
  getAdminJournalPreviewPath,
} from "@/lib/journal/admin-journal-routes";

const VALID_STATUSES: readonly BlogPostStatus[] = ["draft", "review", "approved", "published"];
const VALID_SECTIONS: readonly BlogPostSection[] = ["essay", "briefing"];

type NormalizedListFilters = {
  search?: string;
  status?: BlogPostStatus;
  section?: BlogPostSection;
  limit: number;
};

export interface ListJournalPostsInput {
  search?: string;
  status?: BlogPostStatus;
  section?: BlogPostSection;
  limit?: number;
}

export interface GetJournalPostInput {
  post_id?: string;
  slug?: string;
}

export interface ListJournalRevisionsInput {
  post_id: string;
}

export interface GetJournalWorkflowSummaryInput {
  limit?: number;
}

type JournalPostToolRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  standfirst: string | null;
  section: BlogPostSection | null;
  status: BlogPostStatus;
  hero_image_asset_id: string | null;
  updated_at: string;
  published_at: string | null;
  preview_route: string;
  detail_route: string;
  public_route: string | null;
};

type JournalRevisionToolRecord = {
  id: string;
  post_id: string;
  status: BlogPostStatus;
  section: BlogPostSection | null;
  change_note: string | null;
  created_at: string;
  created_by_user_id: string;
};

type ActiveJobSummary = {
  job_id: string;
  tool_name: string;
  status: string;
  title?: string;
  summary?: string;
  updated_at: string | null;
};

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseOptionalStatus(value: unknown): BlogPostStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !VALID_STATUSES.includes(value as BlogPostStatus)) {
    throw new Error("Status must be one of draft, review, approved, or published.");
  }

  return value as BlogPostStatus;
}

function parseOptionalSection(value: unknown): BlogPostSection | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !VALID_SECTIONS.includes(value as BlogPostSection)) {
    throw new Error("Section must be one of essay or briefing.");
  }

  return value as BlogPostSection;
}

function parseLimit(value: unknown, fallback = 10): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Limit must be a finite number.");
  }

  return Math.max(1, Math.min(50, Math.trunc(value)));
}

function toJournalPostRecord(post: BlogPost): JournalPostToolRecord {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.description,
    standfirst: post.standfirst ?? null,
    section: post.section ?? null,
    status: post.status,
    hero_image_asset_id: post.heroImageAssetId,
    updated_at: post.updatedAt,
    published_at: post.publishedAt,
    preview_route: getAdminJournalPreviewPath(post.slug),
    detail_route: getAdminJournalDetailPath(post.id),
    public_route: post.status === "published" ? `/journal/${post.slug}` : null,
  };
}

function toRevisionRecord(revision: BlogPostRevision): JournalRevisionToolRecord {
  return {
    id: revision.id,
    post_id: revision.postId,
    status: revision.snapshot.status,
    section: revision.snapshot.section,
    change_note: revision.changeNote ?? null,
    created_at: revision.createdAt,
    created_by_user_id: revision.createdByUserId,
  };
}

function summarizePostBlockers(post: BlogPost): string[] {
  const blockers: string[] = [];

  if (!post.section) {
    blockers.push("Section is not set.");
  }
  if (!post.standfirst || post.standfirst.trim().length === 0) {
    blockers.push("Standfirst is missing.");
  }
  if (!post.heroImageAssetId) {
    blockers.push("Hero image is not selected.");
  }

  return blockers;
}

function summarizeActiveJob(snapshot: CanonicalJobSnapshot): ActiveJobSummary {
  return {
    job_id: snapshot.jobId,
    tool_name: snapshot.toolName,
    status: snapshot.status,
    title: snapshot.title,
    summary: snapshot.summary,
    updated_at: snapshot.updatedAt ?? null,
  };
}

function requireExecutionUserId(context: ToolExecutionContext | undefined): string {
  if (!context?.userId) {
    throw new Error("Tool execution context is required.");
  }

  return context.userId;
}

export function parseListJournalPostsInput(value: Record<string, unknown>): ListJournalPostsInput {
  return {
    search: parseOptionalString(value.search),
    status: parseOptionalStatus(value.status),
    section: parseOptionalSection(value.section),
    limit: parseLimit(value.limit, 25),
  };
}

export function parseGetJournalPostInput(value: Record<string, unknown>): GetJournalPostInput {
  const post_id = parseOptionalString(value.post_id);
  const slug = parseOptionalString(value.slug);

  if (!post_id && !slug) {
    throw new Error("Either post_id or slug is required.");
  }

  return { ...(post_id ? { post_id } : {}), ...(slug ? { slug } : {}) };
}

export function parseListJournalRevisionsInput(value: Record<string, unknown>): ListJournalRevisionsInput {
  return {
    post_id: requireNonEmptyString(value.post_id, "post_id"),
  };
}

export function parseGetJournalWorkflowSummaryInput(
  value: Record<string, unknown>,
): GetJournalWorkflowSummaryInput {
  return {
    limit: parseLimit(value.limit, 10),
  };
}

export class ListJournalPostsInteractor {
  constructor(private readonly blogRepo: BlogPostRepository) {}

  async execute(input: ListJournalPostsInput) {
    const filters: NormalizedListFilters = {
      search: parseOptionalString(input.search),
      status: input.status,
      section: input.section,
      limit: parseLimit(input.limit, 25),
    };

    const baseFilters: BlogPostAdminFilters = {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.section ? { section: filters.section } : {}),
    };

    const [all, draft, review, approved, published, posts] = await Promise.all([
      this.blogRepo.countForAdmin(baseFilters),
      this.blogRepo.countForAdmin({ ...baseFilters, status: "draft" }),
      this.blogRepo.countForAdmin({ ...baseFilters, status: "review" }),
      this.blogRepo.countForAdmin({ ...baseFilters, status: "approved" }),
      this.blogRepo.countForAdmin({ ...baseFilters, status: "published" }),
      this.blogRepo.listForAdmin({
        ...baseFilters,
        ...(filters.status ? { status: filters.status } : {}),
        limit: filters.limit,
      }),
    ]);

    return {
      action: "list_journal_posts" as const,
      list_route: getAdminJournalListPath(),
      filters: {
        search: filters.search ?? "",
        status: filters.status ?? "all",
        section: filters.section ?? "all",
        limit: filters.limit,
      },
      counts: { all, draft, review, approved, published },
      posts: posts.map(toJournalPostRecord),
      summary: `Found ${posts.length} journal post${posts.length === 1 ? "" : "s"} matching the current admin filters.`,
    };
  }
}

export class GetJournalPostInteractor {
  constructor(private readonly blogRepo: BlogPostRepository) {}

  async execute(input: GetJournalPostInput) {
    let post: BlogPost | null = null;

    if (input.post_id) {
      post = await this.blogRepo.findById(input.post_id);
    } else if (input.slug) {
      post = await this.blogRepo.findBySlug(input.slug);
    }

    if (!post) {
      throw new Error(`Post not found: ${input.post_id ?? input.slug}`);
    }

    return {
      action: "get_journal_post" as const,
      post: toJournalPostRecord(post),
      summary: `Loaded journal post \"${post.title}\" (${post.status}).`,
    };
  }
}

export class ListJournalRevisionsInteractor {
  constructor(
    private readonly blogRepo: BlogPostRepository,
    private readonly revisionRepo: BlogPostRevisionRepository,
  ) {}

  async execute(input: ListJournalRevisionsInput) {
    const post = await this.blogRepo.findById(input.post_id);
    if (!post) {
      throw new Error(`Post not found: ${input.post_id}`);
    }

    const revisions = await this.revisionRepo.listByPostId(input.post_id);

    return {
      action: "list_journal_revisions" as const,
      post: {
        id: post.id,
        title: post.title,
        status: post.status,
        detail_route: getAdminJournalDetailPath(post.id),
      },
      revisions: revisions.map(toRevisionRecord),
      summary: `Loaded ${revisions.length} revision${revisions.length === 1 ? "" : "s"} for \"${post.title}\".`,
    };
  }
}

export class GetJournalWorkflowSummaryInteractor {
  constructor(
    private readonly blogRepo: BlogPostRepository,
    private readonly jobStatusQuery: JobStatusQuery,
  ) {}

  async execute(input: GetJournalWorkflowSummaryInput, userId: string) {
    const [draftPosts, reviewPosts, approvedPosts, activeJobs] = await Promise.all([
      this.blogRepo.listForAdmin({ status: "draft" }),
      this.blogRepo.listForAdmin({ status: "review" }),
      this.blogRepo.listForAdmin({ status: "approved" }),
      this.jobStatusQuery.listUserJobSnapshots(userId, {
        statuses: getActiveJobStatuses(),
        limit: parseLimit(input.limit, 10),
      }),
    ]);

    const blockedDrafts = draftPosts
      .map((post) => ({ post, blockers: summarizePostBlockers(post) }))
      .filter((entry) => entry.blockers.length > 0);

    const readyToPublish = approvedPosts
      .map((post) => ({ post, blockers: summarizePostBlockers(post) }))
      .filter((entry) => entry.blockers.length === 0);

    return {
      action: "get_journal_workflow_summary" as const,
      counts: {
        draft: draftPosts.length,
        review: reviewPosts.length,
        approved: approvedPosts.length,
        blocked: blockedDrafts.length,
        ready_to_publish: readyToPublish.length,
        active_jobs: activeJobs.length,
      },
      blocked_posts: blockedDrafts.map(({ post, blockers }) => ({
        ...toJournalPostRecord(post),
        blockers,
      })),
      in_review_posts: reviewPosts.map(toJournalPostRecord),
      ready_to_publish_posts: readyToPublish.map(({ post }) => toJournalPostRecord(post)),
      active_jobs: activeJobs.map(summarizeActiveJob),
      summary:
        readyToPublish.length > 0
          ? `${readyToPublish.length} journal post${readyToPublish.length === 1 ? " is" : "s are"} approved and ready to publish.`
          : blockedDrafts.length > 0
            ? `${blockedDrafts.length} journal post${blockedDrafts.length === 1 ? " is" : "s are"} blocked on missing editorial prerequisites.`
            : "No journal posts are currently blocked or ready to publish.",
    };
  }
}

class ListJournalPostsCommand implements ToolCommand<ListJournalPostsInput, Awaited<ReturnType<ListJournalPostsInteractor["execute"]>>> {
  constructor(private readonly interactor: ListJournalPostsInteractor) {}

  async execute(input: ListJournalPostsInput) {
    return this.interactor.execute(input);
  }
}

class GetJournalPostCommand implements ToolCommand<GetJournalPostInput, Awaited<ReturnType<GetJournalPostInteractor["execute"]>>> {
  constructor(private readonly interactor: GetJournalPostInteractor) {}

  async execute(input: GetJournalPostInput) {
    return this.interactor.execute(input);
  }
}

class ListJournalRevisionsCommand implements ToolCommand<ListJournalRevisionsInput, Awaited<ReturnType<ListJournalRevisionsInteractor["execute"]>>> {
  constructor(private readonly interactor: ListJournalRevisionsInteractor) {}

  async execute(input: ListJournalRevisionsInput) {
    return this.interactor.execute(input);
  }
}

class GetJournalWorkflowSummaryCommand implements ToolCommand<GetJournalWorkflowSummaryInput, Awaited<ReturnType<GetJournalWorkflowSummaryInteractor["execute"]>>> {
  constructor(private readonly interactor: GetJournalWorkflowSummaryInteractor) {}

  async execute(input: GetJournalWorkflowSummaryInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

function adminTool<TInput, TOutput>(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  command: ToolCommand<TInput, TOutput>,
): ToolDescriptor<TInput, TOutput> {
  return {
    name,
    schema: {
      description,
      input_schema: inputSchema,
    },
    command,
    roles: ["ADMIN"],
    category: "content",
  };
}

export function createListJournalPostsTool(
  interactor: ListJournalPostsInteractor,
): ToolDescriptor<ListJournalPostsInput, Awaited<ReturnType<ListJournalPostsInteractor["execute"]>>> {
  return adminTool(
    "list_journal_posts",
    "List journal posts for the admin workspace, with support for search, workflow status, and section filters.",
    {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional title or slug search term" },
        status: { type: "string", enum: [...VALID_STATUSES], description: "Optional workflow status filter" },
        section: { type: "string", enum: [...VALID_SECTIONS], description: "Optional journal section filter" },
        limit: { type: "number", description: "Maximum number of posts to return, clamped to 1-50" },
      },
    },
    new ListJournalPostsCommand(interactor),
  );
}

export function createGetJournalPostTool(
  interactor: GetJournalPostInteractor,
): ToolDescriptor<GetJournalPostInput, Awaited<ReturnType<GetJournalPostInteractor["execute"]>>> {
  return adminTool(
    "get_journal_post",
    "Load one journal post with editorial metadata, workflow status, and admin support routes. Accepts either the post ID or the article slug.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        slug: { type: "string", description: "The journal post slug (alternative to post_id)" },
      },
    },
    new GetJournalPostCommand(interactor),
  );
}

export function createListJournalRevisionsTool(
  interactor: ListJournalRevisionsInteractor,
): ToolDescriptor<ListJournalRevisionsInput, Awaited<ReturnType<ListJournalRevisionsInteractor["execute"]>>> {
  return adminTool(
    "list_journal_revisions",
    "List saved editorial revisions for a journal post.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
      },
      required: ["post_id"],
    },
    new ListJournalRevisionsCommand(interactor),
  );
}

export function createGetJournalWorkflowSummaryTool(
  interactor: GetJournalWorkflowSummaryInteractor,
): ToolDescriptor<GetJournalWorkflowSummaryInput, Awaited<ReturnType<GetJournalWorkflowSummaryInteractor["execute"]>>> {
  return adminTool(
    "get_journal_workflow_summary",
    "Summarize blocked drafts, in-review items, publish-ready articles, and active journal jobs for the current admin.",
    {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of active jobs to summarize, clamped to 1-50" },
      },
    },
    new GetJournalWorkflowSummaryCommand(interactor),
  );
}