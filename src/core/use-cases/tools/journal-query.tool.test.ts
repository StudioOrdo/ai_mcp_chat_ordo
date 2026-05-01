import { describe, expect, it, vi } from "vitest";

import {
  GetJournalPostInteractor,
  GetJournalWorkflowSummaryInteractor,
  ListJournalPostsInteractor,
  createGetJournalWorkflowSummaryTool,
  parseListJournalPostsInput,
} from "@/core/use-cases/tools/journal-query.tool";
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
    status: "draft",
    publishedAt: null,
    createdAt: "2026-03-26T10:00:00.000Z",
    updatedAt: "2026-03-26T12:00:00.000Z",
    createdByUserId: "usr_admin",
    publishedByUserId: null,
    ...overrides,
  };
}

function makeActiveJob(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_jobs",
    userId: null,
    toolName: "produce_blog_article",
    label: "Produce Blog Article",
    status: "running",
    sequence: 0,
    progressPercent: 40,
    progressLabel: "Reviewing article",
    summary: "Producing a publish-ready journal draft.",
    createdAt: "2026-03-26T12:29:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-03-26T12:30:00.000Z",
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

describe("journal query tools", () => {
  it("lists journal posts with counts and support routes", async () => {
    const blogRepo = {
      countForAdmin: vi
        .fn()
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
      listForAdmin: vi.fn().mockResolvedValue([
        makePost(),
        makePost({ id: "post_2", slug: "industrial-policy", title: "Industrial Policy" }),
      ]),
    };

    const interactor = new ListJournalPostsInteractor(blogRepo as never);
    const result = await interactor.execute({ search: "policy", section: "briefing", limit: 25 });

    expect(blogRepo.listForAdmin).toHaveBeenCalledWith({ search: "policy", section: "briefing", limit: 25 });
    expect(result.counts).toEqual({ all: 4, draft: 2, review: 1, approved: 1, published: 0 });
    expect(result.posts[0]).toMatchObject({
      slug: "economic-statecraft",
      preview_route: "/admin/journal/preview/economic-statecraft",
      detail_route: "/admin/journal/post_1",
    });
  });

  it("loads one journal post and fails closed when the post is missing", async () => {
    const blogRepo = {
      findById: vi.fn().mockResolvedValueOnce(makePost({ status: "approved" })).mockResolvedValueOnce(null),
    };

    const interactor = new GetJournalPostInteractor(blogRepo as never);
    const result = await interactor.execute({ post_id: "post_1" });

    expect(result.post).toMatchObject({
      id: "post_1",
      status: "approved",
      preview_route: "/admin/journal/preview/economic-statecraft",
    });
    await expect(interactor.execute({ post_id: "missing" })).rejects.toThrow("Post not found: missing");
  });

  it("summarizes blocked, ready, and active journal work", async () => {
    const blogRepo = {
      listForAdmin: vi
        .fn()
        .mockResolvedValueOnce([
          makePost({ id: "draft_blocked", title: "Blocked Draft", standfirst: null, heroImageAssetId: null, section: null }),
        ])
        .mockResolvedValueOnce([
          makePost({ id: "review_1", title: "Review Piece", status: "review" }),
        ])
        .mockResolvedValueOnce([
          makePost({ id: "approved_1", title: "Ready Piece", status: "approved" }),
        ]),
    };
    const jobStatusQuery = {
      listUserJobSnapshots: vi.fn().mockResolvedValue([makeActiveJob()]),
    };

    const tool = createGetJournalWorkflowSummaryTool(
      new GetJournalWorkflowSummaryInteractor(blogRepo as never, jobStatusQuery as never),
    );

    const result = await tool.command.execute({ limit: 5 }, { role: "ADMIN", userId: "usr_admin" });

    expect(jobStatusQuery.listUserJobSnapshots).toHaveBeenCalledWith("usr_admin", {
      statuses: ["queued", "running"],
      limit: 5,
    });
    expect(result.counts).toMatchObject({
      draft: 1,
      review: 1,
      approved: 1,
      blocked: 1,
      ready_to_publish: 1,
      active_jobs: 1,
    });
    expect(result.blocked_posts[0].blockers).toEqual([
      "Section is not set.",
      "Standfirst is missing.",
      "Hero image is not selected.",
    ]);
  });

  it("validates list filters before the repository is called", () => {
    expect(() => parseListJournalPostsInput({ status: "invalid" })).toThrow(
      "Status must be one of draft, review, approved, or published.",
    );
    expect(() => parseListJournalPostsInput({ section: "invalid" })).toThrow(
      "Section must be one of essay or briefing.",
    );
  });
});
