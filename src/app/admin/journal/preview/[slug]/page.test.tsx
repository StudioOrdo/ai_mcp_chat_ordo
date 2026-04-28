import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  findBySlugMock,
  findAssetByIdMock,
  redirectMock,
  notFoundMock,
  markdownProseMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  findBySlugMock: vi.fn(),
  findAssetByIdMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  markdownProseMock: vi.fn(({ content }: { content: string }) => <div data-testid="markdown">{content}</div>),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    const unoptimized = Boolean(imageProps.unoptimized);
    delete imageProps.unoptimized;
    return createElement("img", {
      ...imageProps,
      alt: props.alt ?? "",
      "data-unoptimized": unoptimized ? "true" : undefined,
    });
  },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBlogPostRepository: () => ({
    findBySlug: findBySlugMock,
  }),
  getBlogAssetRepository: () => ({
    findById: findAssetByIdMock,
  }),
}));

vi.mock("@/components/MarkdownProse", () => ({
  MarkdownProse: markdownProseMock,
}));

vi.mock("@/lib/blog/normalize-markdown", () => ({
  normalizeBlogMarkdown: (_title: string, content: string) => content,
}));

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({
    name: "Studio Ordo",
    domain: "studioordo.com",
  }),
}));

import AdminJournalPreviewPage, { generateMetadata } from "@/app/admin/journal/preview/[slug]/page";

describe("/admin/journal/preview/[slug] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    await expect(AdminJournalPreviewPage({ params: Promise.resolve({ slug: "launch-plan" }) })).rejects.toThrow("redirect:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns generic metadata for anonymous callers without resolving the post", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_anon", email: "anon@example.com", name: "Anon", roles: ["ANONYMOUS"] });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "launch-plan" }) });

    expect(metadata).toMatchObject({
      title: "Draft Preview | Studio Ordo",
      description: "Editorial draft preview for Studio Ordo.",
      robots: { index: false, follow: false },
    });
    expect(findBySlugMock).not.toHaveBeenCalled();
  });

  it("returns not found for non-admin users", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_staff", email: "staff@example.com", name: "Staff", roles: ["AUTHENTICATED"] });

    await expect(AdminJournalPreviewPage({ params: Promise.resolve({ slug: "launch-plan" }) })).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("returns generic metadata for non-admin callers without resolving the post", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_staff", email: "staff@example.com", name: "Staff", roles: ["AUTHENTICATED"] });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "launch-plan" }) });

    expect(metadata).toMatchObject({
      title: "Draft Preview | Studio Ordo",
      description: "Editorial draft preview for Studio Ordo.",
      robots: { index: false, follow: false },
    });
    expect(findBySlugMock).not.toHaveBeenCalled();
  });

  it("renders a published preview without a hero image and preserves noindex metadata", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_admin", email: "admin@example.com", name: "Admin", roles: ["ADMIN"] });
    findBySlugMock.mockResolvedValue({
      id: "post_1",
      slug: "launch-plan",
      title: "Launch Plan",
      description: "Internal draft preview",
      content: "## Launch\n\nPlan body.",
      heroImageAssetId: null,
      status: "published",
      publishedAt: "2026-03-26T00:00:00.000Z",
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdByUserId: "usr_admin",
      publishedByUserId: "usr_admin",
    });

    render(await AdminJournalPreviewPage({ params: Promise.resolve({ slug: "launch-plan" }) }));
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "launch-plan" }) });

    expect(screen.getByText("Published preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Launch Plan" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("## Launch");
    expect(metadata).toMatchObject({
      title: "Launch Plan | Published Preview | Studio Ordo",
      robots: { index: false, follow: false },
    });
  });

  it("renders a draft hero image through the direct asset URL without image optimization", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_admin", email: "admin@example.com", name: "Admin", roles: ["ADMIN"] });
    findBySlugMock.mockResolvedValue({
      id: "post_2",
      slug: "launch-plan",
      title: "Launch Plan",
      description: "Internal draft preview",
      content: "Draft body.",
      heroImageAssetId: "asset_hero",
      status: "draft",
      publishedAt: null,
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
      createdByUserId: "usr_admin",
      publishedByUserId: null,
    });
    findAssetByIdMock.mockResolvedValue({
      id: "asset_hero",
      postId: "post_2",
      kind: "hero",
      storagePath: "2026/04/post/hero.png",
      mimeType: "image/png",
      width: 1536,
      height: 1024,
      altText: "Launch hero",
      sourcePrompt: "Prompt",
      provider: "openai",
      providerModel: "gpt-image-1",
      visibility: "draft",
      selectionState: "selected",
      variationGroupId: null,
      createdByUserId: "usr_admin",
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
    });

    render(await AdminJournalPreviewPage({ params: Promise.resolve({ slug: "launch-plan" }) }));

    const image = screen.getByRole("img", { name: "Launch hero" });
    expect(image).toHaveAttribute("src", "/api/blog/assets/asset_hero");
    expect(image).toHaveAttribute("data-unoptimized", "true");
  });

  it("returns not found when the slug does not resolve", async () => {
    getSessionUserMock.mockResolvedValue({ id: "usr_admin", email: "admin@example.com", name: "Admin", roles: ["ADMIN"] });
    findBySlugMock.mockResolvedValue(null);

    await expect(AdminJournalPreviewPage({ params: Promise.resolve({ slug: "missing-post" }) })).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalled();
  });
});