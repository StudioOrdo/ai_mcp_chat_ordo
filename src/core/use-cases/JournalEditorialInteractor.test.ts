import { describe, expect, it, vi } from "vitest";

import type { BlogPost } from "@/core/entities/blog";
import { JournalEditorialInteractor } from "@/core/use-cases/JournalEditorialInteractor";
import type { BlogPostRepository } from "@/core/use-cases/BlogPostRepository";
import type { BlogPostRevisionRepository } from "@/core/use-cases/BlogPostRevisionRepository";

function createPost(status: BlogPost["status"]): BlogPost {
  return {
    id: "post_1",
    slug: "ops-ledger",
    title: "Ops Ledger",
    description: "Operational description.",
    content: "Draft body",
    standfirst: null,
    section: "essay",
    heroImageAssetId: null,
    status,
    publishedAt: status === "published" ? "2026-03-26T11:00:00.000Z" : null,
    createdAt: "2026-03-26T00:00:00.000Z",
    updatedAt: "2026-03-26T10:00:00.000Z",
    createdByUserId: "admin_1",
    publishedByUserId: status === "published" ? "admin_1" : null,
  };
}

describe("JournalEditorialInteractor.publishPost", () => {
  it("advances a draft through review and approved before publishing", async () => {
    const repo: BlogPostRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => createPost("draft")),
      findBySlug: vi.fn(),
      listPublished: vi.fn(),
      countPublished: vi.fn(),
      listForAdmin: vi.fn(),
      countForAdmin: vi.fn(),
      updateDraftContent: vi.fn(),
      updateEditorialMetadata: vi.fn(),
      publishById: vi.fn(),
      setHeroImageAsset: vi.fn(),
      transitionWorkflow: vi
        .fn()
        .mockResolvedValueOnce(createPost("review"))
        .mockResolvedValueOnce(createPost("approved"))
        .mockResolvedValueOnce(createPost("published")),
    };

    const revisionRepo: BlogPostRevisionRepository = {
      create: vi.fn(async (seed) => ({
        id: crypto.randomUUID(),
        postId: seed.postId,
        snapshot: seed.snapshot,
        changeNote: seed.changeNote,
        createdByUserId: seed.createdByUserId,
        createdAt: "2026-03-26T10:00:00.000Z",
      })),
      findById: vi.fn(),
      listByPostId: vi.fn(),
    };

    const interactor = new JournalEditorialInteractor(repo, revisionRepo);
    const published = await interactor.publishPost({ postId: "post_1", actorUserId: "admin_1" });

    expect(published.status).toBe("published");
    expect(repo.transitionWorkflow).toHaveBeenNthCalledWith(1, "post_1", "review", "admin_1");
    expect(repo.transitionWorkflow).toHaveBeenNthCalledWith(2, "post_1", "approved", "admin_1");
    expect(repo.transitionWorkflow).toHaveBeenNthCalledWith(3, "post_1", "published", "admin_1");
    expect(revisionRepo.create).toHaveBeenCalledTimes(3);
  });

  it("does nothing when the post is already published", async () => {
    const repo: BlogPostRepository = {
      create: vi.fn(),
      findById: vi.fn(async () => createPost("published")),
      findBySlug: vi.fn(),
      listPublished: vi.fn(),
      countPublished: vi.fn(),
      listForAdmin: vi.fn(),
      countForAdmin: vi.fn(),
      updateDraftContent: vi.fn(),
      updateEditorialMetadata: vi.fn(),
      publishById: vi.fn(),
      setHeroImageAsset: vi.fn(),
      transitionWorkflow: vi.fn(),
    };

    const revisionRepo: BlogPostRevisionRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      listByPostId: vi.fn(),
    };

    const interactor = new JournalEditorialInteractor(repo, revisionRepo);
    const published = await interactor.publishPost({ postId: "post_1", actorUserId: "admin_1" });

    expect(published.status).toBe("published");
    expect(repo.transitionWorkflow).not.toHaveBeenCalled();
    expect(revisionRepo.create).not.toHaveBeenCalled();
  });
});
