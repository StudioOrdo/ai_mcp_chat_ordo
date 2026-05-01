import type { BlogPost, BlogPostSection, BlogPostStatus } from "@/core/entities/blog";
import type { BlogQaReport } from "@/core/use-cases/BlogArticlePipelineModel";
import type { JournalEditorialInteractor } from "@/core/use-cases/JournalEditorialInteractor";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { BlogAssetRepository } from "@/core/use-cases/BlogAssetRepository";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { BlogPostRevisionRepository } from "@/core/use-cases/BlogPostRevisionRepository";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { BlogArticleProductionService } from "@/lib/blog/blog-article-production-service";
import type { BlogImageGenerationService } from "@/lib/blog/blog-image-generation-service";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import {
  getAdminJournalDetailPath,
  getAdminJournalPreviewPath,
} from "@/lib/journal/admin-journal-routes";

const VALID_SECTIONS: readonly BlogPostSection[] = ["essay", "briefing"];

export interface UpdateJournalMetadataInput {
  post_id: string;
  slug?: string;
  title?: string;
  description?: string;
  standfirst?: string | null;
  section?: BlogPostSection | null;
  change_note?: string;
}

export interface UpdateJournalDraftInput {
  post_id: string;
  content: string;
  change_note?: string;
}

export interface TransitionJournalWorkflowInput {
  post_id: string;
  change_note?: string;
}

export interface PublishJournalPostInput {
  post_id?: string;
  slug?: string;
  change_note?: string;
}

export interface RestoreJournalRevisionInput {
  post_id: string;
  revision_id: string;
  change_note?: string;
}

export interface SelectJournalHeroImageInput {
  post_id: string;
  asset_id: string;
}

export interface PrepareJournalPostForPublishInput {
  post_id: string;
  run_qa?: boolean;
  active_job_limit?: number;
}

type JournalMutationPostRecord = {
  id: string;
  slug: string;
  title: string;
  status: BlogPostStatus;
  section: BlogPostSection | null;
  standfirst: string | null;
  hero_image_asset_id: string | null;
  preview_route: string;
  detail_route: string;
  public_route: string | null;
};

function requireExecutionUserId(context: ToolExecutionContext | undefined): string {
  if (!context?.userId) {
    throw new Error("Tool execution context is required.");
  }

  return context.userId;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseOptionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("standfirst must be a string when provided.");
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseOptionalSection(value: unknown): BlogPostSection | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("section must be essay, briefing, or unset.");
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "unset") {
    return null;
  }

  if (!VALID_SECTIONS.includes(trimmed as BlogPostSection)) {
    throw new Error("section must be essay, briefing, or unset.");
  }

  return trimmed as BlogPostSection;
}

function parseLimit(value: unknown, fallback = 10): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("active_job_limit must be a finite number.");
  }

  return Math.max(1, Math.min(50, Math.trunc(value)));
}

function toPostRecord(post: BlogPost): JournalMutationPostRecord {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    status: post.status,
    section: post.section ?? null,
    standfirst: post.standfirst ?? null,
    hero_image_asset_id: post.heroImageAssetId,
    preview_route: getAdminJournalPreviewPath(post.slug),
    detail_route: getAdminJournalDetailPath(post.id),
    public_route: post.status === "published" ? `/journal/${post.slug}` : null,
  };
}

function summarizeEditorialBlockers(post: BlogPost): string[] {
  const blockers: string[] = [];

  if (post.status !== "approved") {
    blockers.push(`Post must be in approved status before publish preparation is complete. Current status: ${post.status}.`);
  }
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

function summarizeQaFindings(report: BlogQaReport): string[] {
  if (report.findings.length === 0) {
    return [];
  }

  return report.findings.map((finding) => `${finding.severity}: ${finding.issue}`);
}

export function parseUpdateJournalMetadataInput(
  value: Record<string, unknown>,
): UpdateJournalMetadataInput {
  const postId = requireNonEmptyString(value.post_id, "post_id");
  const patch = {
    slug: parseOptionalString(value.slug),
    title: parseOptionalString(value.title),
    description: parseOptionalString(value.description),
    standfirst: parseOptionalNullableString(value.standfirst),
    section: parseOptionalSection(value.section),
  };

  if (Object.values(patch).every((entry) => entry === undefined)) {
    throw new Error("At least one metadata field must be provided.");
  }

  return {
    post_id: postId,
    ...patch,
    change_note: parseOptionalString(value.change_note),
  };
}

export function parseUpdateJournalDraftInput(value: Record<string, unknown>): UpdateJournalDraftInput {
  return {
    post_id: requireNonEmptyString(value.post_id, "post_id"),
    content: requireNonEmptyString(value.content, "content"),
    change_note: parseOptionalString(value.change_note),
  };
}

export function parseTransitionJournalWorkflowInput(
  value: Record<string, unknown>,
): TransitionJournalWorkflowInput {
  return {
    post_id: requireNonEmptyString(value.post_id, "post_id"),
    change_note: parseOptionalString(value.change_note),
  };
}

export function parseRestoreJournalRevisionInput(
  value: Record<string, unknown>,
): RestoreJournalRevisionInput {
  return {
    post_id: requireNonEmptyString(value.post_id, "post_id"),
    revision_id: requireNonEmptyString(value.revision_id, "revision_id"),
    change_note: parseOptionalString(value.change_note),
  };
}

export function parseSelectJournalHeroImageInput(
  value: Record<string, unknown>,
): SelectJournalHeroImageInput {
  return {
    post_id: requireNonEmptyString(value.post_id, "post_id"),
    asset_id: requireNonEmptyString(value.asset_id, "asset_id"),
  };
}

export function parsePrepareJournalPostForPublishInput(
  value: Record<string, unknown>,
): PrepareJournalPostForPublishInput {
  return {
    post_id: requireNonEmptyString(value.post_id, "post_id"),
    run_qa: typeof value.run_qa === "boolean" ? value.run_qa : false,
    active_job_limit: parseLimit(value.active_job_limit, 10),
  };
}

export class UpdateJournalMetadataInteractor {
  constructor(private readonly editorial: JournalEditorialInteractor) {}

  async execute(input: UpdateJournalMetadataInput, actorUserId: string) {
    const post = await this.editorial.updateEditorialMetadata({
      postId: input.post_id,
      patch: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.standfirst !== undefined ? { standfirst: input.standfirst } : {}),
        ...(input.section !== undefined ? { section: input.section } : {}),
      },
      actorUserId,
      changeNote: input.change_note,
    });

    return {
      action: "update_journal_metadata" as const,
      post: toPostRecord(post),
      summary: `Updated journal metadata for \"${post.title}\".`,
    };
  }
}

export class UpdateJournalDraftInteractor {
  constructor(private readonly editorial: JournalEditorialInteractor) {}

  async execute(input: UpdateJournalDraftInput, actorUserId: string) {
    const post = await this.editorial.updateDraftContent({
      postId: input.post_id,
      patch: { content: input.content },
      actorUserId,
      changeNote: input.change_note,
    });

    return {
      action: "update_journal_draft" as const,
      post: toPostRecord(post),
      summary: `Updated the draft body for \"${post.title}\".`,
    };
  }
}

export class SubmitJournalReviewInteractor {
  constructor(private readonly editorial: JournalEditorialInteractor) {}

  async execute(input: TransitionJournalWorkflowInput, actorUserId: string) {
    const post = await this.editorial.transitionWorkflow({
      postId: input.post_id,
      nextStatus: "review",
      actorUserId,
      changeNote: input.change_note,
    });

    return {
      action: "submit_journal_review" as const,
      post: toPostRecord(post),
      summary: `Moved \"${post.title}\" into editorial review.`,
    };
  }
}

export class ApproveJournalPostInteractor {
  constructor(private readonly editorial: JournalEditorialInteractor) {}

  async execute(input: TransitionJournalWorkflowInput, actorUserId: string) {
    const post = await this.editorial.transitionWorkflow({
      postId: input.post_id,
      nextStatus: "approved",
      actorUserId,
      changeNote: input.change_note,
    });

    return {
      action: "approve_journal_post" as const,
      post: toPostRecord(post),
      summary: `Marked \"${post.title}\" approved for publication.`,
    };
  }
}

export class PublishJournalPostInteractor {
  constructor(
    private readonly blogRepo: BlogPostRepository,
    private readonly revisionRepo: BlogPostRevisionRepository,
    private readonly assetRepo: BlogAssetRepository,
  ) {}

  async execute(input: PublishJournalPostInput, actorUserId: string) {
    let postId = input.post_id?.trim();

    if (!postId && input.slug?.trim()) {
      const found = await this.blogRepo.findBySlug(input.slug.trim());
      if (!found) throw new Error(`No journal post found with slug "${input.slug.trim()}".`);
      postId = found.id;
    }

    if (!postId) {
      throw new Error("Either post_id or slug is required.");
    }

    const current = await this.blogRepo.findById(postId);
    if (!current) {
      throw new Error(`Post not found: ${postId}`);
    }

    await this.revisionRepo.create({
      postId: current.id,
      snapshot: {
        slug: current.slug,
        title: current.title,
        description: current.description,
        standfirst: current.standfirst ?? null,
        content: current.content,
        section: current.section ?? null,
        status: current.status,
      },
      changeNote: input.change_note ?? "Published to journal.",
      createdByUserId: actorUserId,
    });

    const post = await this.blogRepo.publishById(current.id, actorUserId);
    if (post.heroImageAssetId) {
      await this.assetRepo.setVisibility(post.heroImageAssetId, "published");
    }

    return {
      action: "publish_journal_post" as const,
      post: toPostRecord(post),
      summary: `Published \"${post.title}\" to the journal.`,
    };
  }
}

export class RestoreJournalRevisionInteractor {
  constructor(private readonly editorial: JournalEditorialInteractor) {}

  async execute(input: RestoreJournalRevisionInput, actorUserId: string) {
    const post = await this.editorial.restoreRevision({
      postId: input.post_id,
      revisionId: input.revision_id,
      actorUserId,
      changeNote: input.change_note,
    });

    return {
      action: "restore_journal_revision" as const,
      post: toPostRecord(post),
      summary: `Restored revision ${input.revision_id} for \"${post.title}\".`,
    };
  }
}

export class SelectJournalHeroImageInteractor {
  constructor(private readonly imageService: BlogImageGenerationService) {}

  async execute(input: SelectJournalHeroImageInput, actorUserId: string) {
    const result = await this.imageService.selectHeroImage(input.post_id, input.asset_id, actorUserId);

    return {
      action: "select_journal_hero_image" as const,
      post_id: result.postId,
      asset_id: result.assetId,
      preview_route: result.postSlug ? getAdminJournalPreviewPath(result.postSlug) : null,
      summary: result.summary,
      hero_image: {
        post_slug: result.postSlug,
        visibility: result.visibility,
        image_url: result.imageUrl,
      },
    };
  }
}

export class PrepareJournalPostForPublishInteractor {
  constructor(
    private readonly blogRepo: BlogPostRepository,
    private readonly revisionRepo: BlogPostRevisionRepository,
    private readonly jobStatusQuery: JobStatusQuery,
    private readonly blogArticleService: BlogArticleProductionService,
  ) {}

  async execute(input: PrepareJournalPostForPublishInput, actorUserId: string) {
    const post = await this.blogRepo.findById(input.post_id);
    if (!post) {
      throw new Error(`Post not found: ${input.post_id}`);
    }

    const [revisions, activeJobs, qaReport] = await Promise.all([
      this.revisionRepo.listByPostId(post.id),
      this.jobStatusQuery.listUserJobSnapshots(actorUserId, {
        statuses: getActiveJobStatuses(),
        limit: parseLimit(input.active_job_limit, 10),
      }),
      input.run_qa
        ? this.blogArticleService.reviewArticleForPost(
          post.id,
          {
            title: post.title,
            description: post.description,
            content: post.content,
          },
          actorUserId,
        )
        : Promise.resolve<BlogQaReport | null>(null),
    ]);
    const relevantActiveJobs = activeJobs.filter((snapshot) => isJournalReadinessJobForPost(snapshot, post.id));

    const blockers = summarizeEditorialBlockers(post);
    if (revisions.length === 0) {
      blockers.push("No revisions are recorded yet.");
    }
    if (post.status === "published") {
      blockers.push("Post is already published.");
    }

    const qaFindings = qaReport ? summarizeQaFindings(qaReport) : [];
    blockers.push(...qaFindings);

    return {
      action: "prepare_journal_post_for_publish" as const,
      ready: blockers.length === 0,
      post: toPostRecord(post),
      blockers,
      active_jobs: relevantActiveJobs.map((snapshot) => ({
        job_id: snapshot.jobId,
        tool_name: snapshot.toolName,
        status: snapshot.status,
        summary: snapshot.summary,
        updated_at: snapshot.updatedAt,
      })),
      revision_count: revisions.length,
      qa_report: qaReport
        ? {
          approved: qaReport.approved,
          summary: qaReport.summary,
          findings: qaReport.findings,
        }
        : null,
      summary:
        blockers.length === 0
          ? `\"${post.title}\" is ready to publish.`
          : `\"${post.title}\" is not ready to publish yet. ${blockers.length} blocker${blockers.length === 1 ? " remains" : "s remain"}.`,
    };
  }
}

function isJournalReadinessJobForPost(snapshot: CanonicalJobSnapshot, postId: string): boolean {
  const normalizedPostId = postId.trim().toLowerCase();
  const title = snapshot.title?.trim().toLowerCase() ?? "";

  if (!normalizedPostId || !title.includes(normalizedPostId)) {
    return false;
  }

  return snapshot.toolName === "prepare_journal_post_for_publish"
    || snapshot.toolName === "publish_content";
}

class UpdateJournalMetadataCommand implements ToolCommand<UpdateJournalMetadataInput, Awaited<ReturnType<UpdateJournalMetadataInteractor["execute"]>>> {
  constructor(private readonly interactor: UpdateJournalMetadataInteractor) {}

  async execute(input: UpdateJournalMetadataInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class UpdateJournalDraftCommand implements ToolCommand<UpdateJournalDraftInput, Awaited<ReturnType<UpdateJournalDraftInteractor["execute"]>>> {
  constructor(private readonly interactor: UpdateJournalDraftInteractor) {}

  async execute(input: UpdateJournalDraftInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class SubmitJournalReviewCommand implements ToolCommand<TransitionJournalWorkflowInput, Awaited<ReturnType<SubmitJournalReviewInteractor["execute"]>>> {
  constructor(private readonly interactor: SubmitJournalReviewInteractor) {}

  async execute(input: TransitionJournalWorkflowInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class ApproveJournalPostCommand implements ToolCommand<TransitionJournalWorkflowInput, Awaited<ReturnType<ApproveJournalPostInteractor["execute"]>>> {
  constructor(private readonly interactor: ApproveJournalPostInteractor) {}

  async execute(input: TransitionJournalWorkflowInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class PublishJournalPostCommand implements ToolCommand<PublishJournalPostInput, Awaited<ReturnType<PublishJournalPostInteractor["execute"]>>> {
  constructor(private readonly interactor: PublishJournalPostInteractor) {}

  async execute(input: PublishJournalPostInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class RestoreJournalRevisionCommand implements ToolCommand<RestoreJournalRevisionInput, Awaited<ReturnType<RestoreJournalRevisionInteractor["execute"]>>> {
  constructor(private readonly interactor: RestoreJournalRevisionInteractor) {}

  async execute(input: RestoreJournalRevisionInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class SelectJournalHeroImageCommand implements ToolCommand<SelectJournalHeroImageInput, Awaited<ReturnType<SelectJournalHeroImageInteractor["execute"]>>> {
  constructor(private readonly interactor: SelectJournalHeroImageInteractor) {}

  async execute(input: SelectJournalHeroImageInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

class PrepareJournalPostForPublishCommand implements ToolCommand<PrepareJournalPostForPublishInput, Awaited<ReturnType<PrepareJournalPostForPublishInteractor["execute"]>>> {
  constructor(private readonly interactor: PrepareJournalPostForPublishInteractor) {}

  async execute(input: PrepareJournalPostForPublishInput, context?: ToolExecutionContext) {
    return this.interactor.execute(input, requireExecutionUserId(context));
  }
}

function adminTool<TInput, TOutput>(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  command: ToolCommand<TInput, TOutput>,
  executionMode: "inline" | "deferred" = "inline",
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
    executionMode,
    ...(executionMode === "deferred"
      ? {
        deferred: {
          dedupeStrategy: "per-conversation-payload" as const,
          retryable: true,
          notificationPolicy: "completion-and-failure" as const,
        },
      }
      : {}),
  };
}

export function createUpdateJournalMetadataTool(
  interactor: UpdateJournalMetadataInteractor,
): ToolDescriptor<UpdateJournalMetadataInput, Awaited<ReturnType<UpdateJournalMetadataInteractor["execute"]>>> {
  return adminTool(
    "update_journal_metadata",
    "Update journal title, slug, description, standfirst, or section through the canonical editorial mutation boundary.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        slug: { type: "string", description: "Optional replacement slug" },
        title: { type: "string", description: "Optional replacement title" },
        description: { type: "string", description: "Optional replacement description" },
        standfirst: { type: "string", description: "Optional replacement standfirst. Pass an empty string to clear it." },
        section: { type: "string", enum: [...VALID_SECTIONS, "unset"], description: "Optional replacement section or unset to clear it" },
        change_note: { type: "string", description: "Optional revision note for the metadata change" },
      },
      required: ["post_id"],
    },
    new UpdateJournalMetadataCommand(interactor),
  );
}

export function createUpdateJournalDraftTool(
  interactor: UpdateJournalDraftInteractor,
): ToolDescriptor<UpdateJournalDraftInput, Awaited<ReturnType<UpdateJournalDraftInteractor["execute"]>>> {
  return adminTool(
    "update_journal_draft",
    "Update the draft body for a journal post through the canonical editorial mutation boundary.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        content: { type: "string", description: "Replacement markdown body for the journal draft" },
        change_note: { type: "string", description: "Optional revision note for the draft-body change" },
      },
      required: ["post_id", "content"],
    },
    new UpdateJournalDraftCommand(interactor),
  );
}

export function createSubmitJournalReviewTool(
  interactor: SubmitJournalReviewInteractor,
): ToolDescriptor<TransitionJournalWorkflowInput, Awaited<ReturnType<SubmitJournalReviewInteractor["execute"]>>> {
  return adminTool(
    "submit_journal_review",
    "Move a journal post into editorial review.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        change_note: { type: "string", description: "Optional revision note for the workflow transition" },
      },
      required: ["post_id"],
    },
    new SubmitJournalReviewCommand(interactor),
  );
}

export function createApproveJournalPostTool(
  interactor: ApproveJournalPostInteractor,
): ToolDescriptor<TransitionJournalWorkflowInput, Awaited<ReturnType<ApproveJournalPostInteractor["execute"]>>> {
  return adminTool(
    "approve_journal_post",
    "Approve a journal post for publication, or return a published post to approved status through the workflow policy boundary.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        change_note: { type: "string", description: "Optional revision note for the workflow transition" },
      },
      required: ["post_id"],
    },
    new ApproveJournalPostCommand(interactor),
  );
}

export function createPublishJournalPostTool(
  interactor: PublishJournalPostInteractor,
): ToolDescriptor<PublishJournalPostInput, Awaited<ReturnType<PublishJournalPostInteractor["execute"]>>> {
  return adminTool(
    "publish_journal_post",
    "Publish an approved journal post, preserving revision history and aligning the selected hero image visibility. Accepts either the post ID or the article slug.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        slug: { type: "string", description: "The journal post slug (alternative to post_id)" },
        change_note: { type: "string", description: "Optional revision note recorded before publish" },
      },
    },
    new PublishJournalPostCommand(interactor),
  );
}

export function createRestoreJournalRevisionTool(
  interactor: RestoreJournalRevisionInteractor,
): ToolDescriptor<RestoreJournalRevisionInput, Awaited<ReturnType<RestoreJournalRevisionInteractor["execute"]>>> {
  return adminTool(
    "restore_journal_revision",
    "Restore a prior journal revision through the canonical revision-safe editorial mutation boundary.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        revision_id: { type: "string", description: "The revision identifier to restore" },
        change_note: { type: "string", description: "Optional revision note for the restore action" },
      },
      required: ["post_id", "revision_id"],
    },
    new RestoreJournalRevisionCommand(interactor),
  );
}

export function createSelectJournalHeroImageTool(
  interactor: SelectJournalHeroImageInteractor,
): ToolDescriptor<SelectJournalHeroImageInput, Awaited<ReturnType<SelectJournalHeroImageInteractor["execute"]>>> {
  return adminTool(
    "select_journal_hero_image",
    "Select the canonical hero image for a journal post by delegating to the existing hero-image service.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        asset_id: { type: "string", description: "The hero image asset identifier" },
      },
      required: ["post_id", "asset_id"],
    },
    new SelectJournalHeroImageCommand(interactor),
  );
}

export function createPrepareJournalPostForPublishTool(
  interactor: PrepareJournalPostForPublishInteractor,
): ToolDescriptor<PrepareJournalPostForPublishInput, Awaited<ReturnType<PrepareJournalPostForPublishInteractor["execute"]>>> {
  return adminTool(
    "prepare_journal_post_for_publish",
    "Check whether a journal post is ready to publish, optionally run editorial QA, and summarize blockers or readiness.",
    {
      type: "object",
      properties: {
        post_id: { type: "string", description: "The journal post identifier" },
        run_qa: { type: "boolean", description: "Whether to run article QA as part of the readiness check" },
        active_job_limit: { type: "number", description: "Maximum number of active jobs to include in the readiness summary, clamped to 1-50" },
      },
      required: ["post_id"],
    },
    new PrepareJournalPostForPublishCommand(interactor),
    "deferred",
  );
}