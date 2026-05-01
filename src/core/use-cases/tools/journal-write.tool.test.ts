import { describe, expect, it, vi } from "vitest";

import {
  createSelectJournalHeroImageTool,
  parseUpdateJournalMetadataInput,
  PrepareJournalPostForPublishInteractor,
  PublishJournalPostInteractor,
  SelectJournalHeroImageInteractor,
  UpdateJournalMetadataInteractor,
} from "@/core/use-cases/tools/journal-write.tool";
import type { BlogPost } from "@/core/entities/blog";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: "post_1",
    slug: "economic-statecraft",
    title: "Economic Statecraft",
    description: "A briefing on economic statecraft.",
    content: "# Economic Statecraft\n\nStructured markdown body.",
    standfirst: "How states shape markets.",
    section: "briefing",
    heroImageAssetId: "asset_1",
    status: "approved",
    publishedAt: null,
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T12:00:00.000Z",
    createdByUserId: "usr_admin",
    publishedByUserId: null,
    ...overrides,
  };
}

function makeJobSnapshot(overrides: Partial<CanonicalJobSnapshot>): CanonicalJobSnapshot {
  return {
    jobId: overrides.jobId ?? "job_1",
    conversationId: "conv_jobs",
    userId: null,
    toolName: overrides.toolName ?? "publish_content",
    label: "Publish Content",
    status: overrides.status ?? "running",
    sequence: overrides.sequence ?? 0,
    title: overrides.title,
    summary: overrides.summary,
    subtitle: overrides.subtitle,
    createdAt: overrides.createdAt ?? "2026-03-26T12:29:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: overrides.updatedAt ?? "2026-03-26T12:30:00.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: null, visibility: "anonymous_session", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

describe("journal write tools", () => {
  it("parses metadata updates and supports clearing standfirst and section", () => {
    expect(
      parseUpdateJournalMetadataInput({
        post_id: "post_1",
        standfirst: "",
        section: "unset",
      }),
    ).toMatchObject({
      post_id: "post_1",
      standfirst: null,
      section: null,
    });

    expect(() => parseUpdateJournalMetadataInput({ post_id: "post_1" })).toThrow(
      "At least one metadata field must be provided.",
    );
  });

  it("updates metadata through the canonical editorial interactor", async () => {
    const editorial = {
      updateEditorialMetadata: vi.fn().mockResolvedValue(makePost({ title: "Updated Title" })),
    };
    const interactor = new UpdateJournalMetadataInteractor(editorial as never);

    const result = await interactor.execute(
      {
        post_id: "post_1",
        title: "Updated Title",
        section: "essay",
        change_note: "Tighten framing.",
      },
      "usr_admin",
    );

    expect(editorial.updateEditorialMetadata).toHaveBeenCalledWith({
      postId: "post_1",
      patch: { title: "Updated Title", section: "essay" },
      actorUserId: "usr_admin",
      changeNote: "Tighten framing.",
    });
    expect(result.post).toMatchObject({ title: "Updated Title", detail_route: "/admin/journal/post_1" });
  });

  it("publishes through the canonical publish path and aligns hero visibility", async () => {
    const current = makePost({ status: "approved", heroImageAssetId: "asset_hero" });
    const published = makePost({ status: "published", publishedAt: "2026-03-26T13:00:00.000Z", heroImageAssetId: "asset_hero" });
    const blogRepo = {
      findById: vi.fn().mockResolvedValue(current),
      publishById: vi.fn().mockResolvedValue(published),
    };
    const revisionRepo = { create: vi.fn().mockResolvedValue({ id: "rev_1" }) };
    const assetRepo = { setVisibility: vi.fn().mockResolvedValue({ id: "asset_hero" }) };

    const interactor = new PublishJournalPostInteractor(blogRepo as never, revisionRepo as never, assetRepo as never);
    const result = await interactor.execute({ post_id: "post_1", change_note: "Ready for launch." }, "usr_admin");

    expect(revisionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      postId: "post_1",
      changeNote: "Ready for launch.",
      createdByUserId: "usr_admin",
    }));
    expect(blogRepo.publishById).toHaveBeenCalledWith("post_1", "usr_admin");
    expect(assetRepo.setVisibility).toHaveBeenCalledWith("asset_hero", "published");
    expect(result.post).toMatchObject({ status: "published", public_route: "/journal/economic-statecraft" });
  });

  it("delegates hero-image selection to the shared image service", async () => {
    const imageService = {
      selectHeroImage: vi.fn().mockResolvedValue({
        postId: "post_1",
        postSlug: "economic-statecraft",
        assetId: "asset_2",
        visibility: "draft",
        imageUrl: "/media/asset_2",
        summary: 'Selected hero image asset_2 for "Economic Statecraft".',
      }),
    };
    const tool = createSelectJournalHeroImageTool(new SelectJournalHeroImageInteractor(imageService as never));

    const result = await tool.command.execute(
      { post_id: "post_1", asset_id: "asset_2" },
      { role: "ADMIN", userId: "usr_admin" },
    );

    expect(imageService.selectHeroImage).toHaveBeenCalledWith("post_1", "asset_2", "usr_admin");
    expect(result).toMatchObject({
      action: "select_journal_hero_image",
      preview_route: "/admin/journal/preview/economic-statecraft",
      asset_id: "asset_2",
    });
  });

  it("reports publish blockers and optional QA findings", async () => {
    const blogRepo = {
      findById: vi.fn().mockResolvedValue(makePost({
        status: "review",
        standfirst: null,
        heroImageAssetId: null,
        section: null,
      })),
    };
    const revisionRepo = {
      listByPostId: vi.fn().mockResolvedValue([]),
    };
    const jobStatusQuery = {
      listUserJobSnapshots: vi.fn().mockResolvedValue([]),
    };
    const blogArticleService = {
      reviewArticleForPost: vi.fn().mockResolvedValue({
        approved: false,
        summary: "Editorial QA found unresolved issues.",
        findings: [
          {
            id: "finding_1",
            severity: "high",
            issue: "Add sourcing context.",
            recommendation: "Cite the source directly.",
          },
        ],
      }),
    };

    const interactor = new PrepareJournalPostForPublishInteractor(
      blogRepo as never,
      revisionRepo as never,
      jobStatusQuery as never,
      blogArticleService as never,
    );

    const result = await interactor.execute({ post_id: "post_1", run_qa: true }, "usr_admin");

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual([
      "Post must be in approved status before publish preparation is complete. Current status: review.",
      "Section is not set.",
      "Standfirst is missing.",
      "Hero image is not selected.",
      "No revisions are recorded yet.",
      "high: Add sourcing context.",
    ]);
    expect(blogArticleService.reviewArticleForPost).toHaveBeenCalledWith(
      "post_1",
      expect.objectContaining({ title: "Economic Statecraft" }),
      "usr_admin",
    );
  });

  it("limits active job reporting to the named post", async () => {
    const blogRepo = {
      findById: vi.fn().mockResolvedValue(makePost()),
    };
    const revisionRepo = {
      listByPostId: vi.fn().mockResolvedValue([{ id: "rev_1" }]),
    };
    const jobStatusQuery = {
      listUserJobSnapshots: vi.fn().mockResolvedValue([
        makeJobSnapshot({
          jobId: "job_related",
          toolName: "publish_content",
          title: "Publish journal draft post_1",
          summary: "Publishing the current post.",
        }),
        makeJobSnapshot({
          jobId: "job_unrelated",
          toolName: "publish_content",
          title: "Publish journal draft post_2",
          summary: "Publishing a different post.",
        }),
        makeJobSnapshot({
          jobId: "job_generic",
          toolName: "produce_blog_article",
          title: "Launch brief",
          summary: "Generating a different draft.",
        }),
      ]),
    };
    const blogArticleService = {
      reviewArticleForPost: vi.fn(),
    };

    const interactor = new PrepareJournalPostForPublishInteractor(
      blogRepo as never,
      revisionRepo as never,
      jobStatusQuery as never,
      blogArticleService as never,
    );

    const result = await interactor.execute({ post_id: "post_1" }, "usr_admin");

    expect(result.ready).toBe(true);
    expect(result.active_jobs).toEqual([
      expect.objectContaining({
        job_id: "job_related",
        tool_name: "publish_content",
        summary: "Publishing the current post.",
      }),
    ]);
  });
});
