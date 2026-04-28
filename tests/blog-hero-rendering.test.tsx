import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listPublishedMock,
  findBySlugMock,
  findAssetByIdMock,
  markdownProseMock,
} = vi.hoisted(() => ({
  listPublishedMock: vi.fn(),
  findBySlugMock: vi.fn(),
  findAssetByIdMock: vi.fn(),
  markdownProseMock: vi.fn(({ content }: { content: string }) => <div data-testid="markdown">{content}</div>),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    return createElement("img", { ...imageProps, alt: props.alt ?? "" });
  },
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getBlogPostRepository: () => ({
    listPublished: listPublishedMock,
    findBySlug: findBySlugMock,
  }),
  getBlogAssetRepository: () => ({
    findById: findAssetByIdMock,
  }),
}));

vi.mock("@/components/MarkdownProse", () => ({
  MarkdownProse: markdownProseMock,
}));

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({
    name: "Studio Ordo",
    domain: "studioordo.com",
    linkedInUrl: "https://www.linkedin.com/in/keithwilliams5/",
  }),
}));

vi.mock("@/lib/blog/normalize-markdown", () => ({
  normalizeBlogMarkdown: (_title: string, content: string) => content,
}));

import JournalIndexPage, { generateMetadata as generateJournalIndexMetadata } from "@/app/journal/page";
import JournalPostPage, { generateMetadata } from "@/app/journal/[slug]/page";
import { buildJournalPublicationStructure } from "@/lib/blog/journal-taxonomy";

describe("journal public rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders published hero images on the blog index", async () => {
    listPublishedMock.mockResolvedValue([
      {
        id: "post_1",
        slug: "hero-post",
        title: "Hero Post",
        description: "With hero image",
        content: "Body",
        heroImageAssetId: "asset_hero",
        status: "published",
        publishedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]);
    findAssetByIdMock.mockResolvedValue({
      id: "asset_hero",
      postId: "post_1",
      kind: "hero",
      storagePath: "2026/hero-post/hero.png",
      mimeType: "image/png",
      width: 1200,
      height: 630,
      altText: "A bright hero image.",
      sourcePrompt: null,
      provider: null,
      providerModel: null,
      visibility: "published",
      createdByUserId: "usr_admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    render(await JournalIndexPage());

    expect(screen.getByAltText("A bright hero image.")).toHaveAttribute("src", "/api/blog/assets/asset_hero");
  });

  it("renders the journal as a sectioned publication index", async () => {
    listPublishedMock.mockResolvedValue([
      {
        id: "post_1",
        slug: "systems-essay",
        title: "Systems Essay",
        description: "A reflective piece on system design.",
        content: "A long opening paragraph about systems.\n\n## Reflection\n\nMore narrative prose.",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-04T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_2",
        slug: "essay-on-systems",
        title: "Essay On Systems",
        description: "A reflective piece on system design.",
        content: "A slow opening paragraph about systems.\n\n## Reflection\n\nMore narrative prose.",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-03T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_3",
        slug: "field-note",
        title: "Field Note",
        description: "Notes from the latest delivery cycle.",
        content: "A field note opening.\n\nMore paragraphs.",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-02T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_4",
        slug: "qa-playbook",
        title: "QA Playbook",
        description: "A practical walkthrough for release checks.",
        content: "## Checklist\n\n- Verify jobs\n- Verify release\n\n```ts\nconsole.log('ship');\n```",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-01T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_5",
        slug: "release-runbook",
        title: "Release Runbook",
        description: "Operational release procedure.",
        content: "## Checklist\n\n- Verify jobs\n- Verify release",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-03-30T00:00:00.000Z",
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-30T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_6",
        slug: "continuity-brief",
        title: "Continuity Brief",
        description: "Deferred work continuity in production.",
        content: "## Runbook\n\n1. Resume stream\n2. Refresh jobs\n3. Confirm status",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2025-12-20T00:00:00.000Z",
        createdAt: "2025-12-19T00:00:00.000Z",
        updatedAt: "2025-12-20T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_7",
        slug: "older-systems-note",
        title: "Older Systems Note",
        description: "A prior argument kept for reference.",
        content: "A longer essay from an earlier cycle.\n\n## Context\n\nMore reflective prose.",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2025-06-10T00:00:00.000Z",
        createdAt: "2025-06-09T00:00:00.000Z",
        updatedAt: "2025-06-10T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_8",
        slug: "archive-runbook",
        title: "Archive Runbook",
        description: "Legacy release procedure retained for comparison.",
        content: "## Steps\n\n1. Freeze deploy\n2. Review outputs\n3. Close run",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2024-11-14T00:00:00.000Z",
        createdAt: "2024-11-13T00:00:00.000Z",
        updatedAt: "2024-11-14T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_9",
        slug: "older-release-check",
        title: "Older Release Check",
        description: "An older operational checklist kept in the archive.",
        content: "## Checklist\n\n- Stage\n- Verify\n- Ship",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2023-08-08T00:00:00.000Z",
        createdAt: "2023-08-07T00:00:00.000Z",
        updatedAt: "2023-08-08T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_10",
        slug: "legacy-systems-note",
        title: "Legacy Systems Note",
        description: "A prior essay retained in the archive.",
        content: "A reflective archive entry.\n\n## Context\n\nMore reflective prose.",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2024-01-15T00:00:00.000Z",
        createdAt: "2024-01-14T00:00:00.000Z",
        updatedAt: "2024-01-15T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]);
    findAssetByIdMock.mockResolvedValue(null);

    const { container } = render(await JournalIndexPage());

    expect(screen.getByRole("heading", { name: "Field notes from a compact AI operator system." })).toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.getByText("Latest entry")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Systems Essay" })).toBeInTheDocument();
    expect(screen.queryByText(/editorial theater/i)).toBeNull();
    expect(screen.queryByText("Lead")).toBeNull();
    expect(screen.getByText("Latest essays")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operational briefings" })).toBeInTheDocument();
    expect(screen.getByText("Browse by year")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Back issues" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2024" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2023" })).toBeInTheDocument();

    const essayRegion = container.querySelector('[data-journal-region="essays"]');
    const briefingRegion = container.querySelector('[data-journal-region="briefings"]');
    const archiveRegion = container.querySelector('[data-journal-region="archive"]');
    const leadEntry = container.querySelector('[data-journal-role="lead-entry"]');
    const archiveYearList = container.querySelector('[data-journal-role="archive-year-list"]');
    const archiveYearLinks = container.querySelectorAll('[data-journal-role="archive-year-link"]');
    const archiveYearGroups = container.querySelectorAll('[data-journal-role="archive-year-group"]');

    expect(essayRegion).not.toBeNull();
    expect(briefingRegion).not.toBeNull();
    expect(archiveRegion).not.toBeNull();
    expect(archiveYearList).not.toBeNull();
    expect(archiveYearLinks).toHaveLength(2);
    expect(archiveYearGroups).toHaveLength(2);
    expect(leadEntry).toHaveAttribute("data-journal-layout", "lead-ledger");
    expect(essayRegion?.querySelector('[data-journal-entry-tone="essay"][data-journal-layout="essay-ledger"]')).not.toBeNull();
    expect(briefingRegion?.querySelector('[data-journal-entry-tone="briefing"][data-journal-layout="briefing-ledger"]')).not.toBeNull();
    expect(archiveRegion?.querySelector('[data-journal-entry-tone="archive"][data-journal-layout="archive-row"]')).not.toBeNull();
    expect(archiveYearList?.querySelector('[href="#archive-2024"]')).not.toBeNull();
    expect(archiveYearList?.querySelector('[href="#archive-2023"]')).not.toBeNull();
    expect(within(archiveRegion as HTMLElement).queryByText("Field Note")).toBeNull();
    expect(within(archiveRegion as HTMLElement).queryByText("QA Playbook")).toBeNull();
    expect(within(archiveRegion as HTMLElement).getByText("Archive Runbook")).toBeInTheDocument();
    expect(within(archiveRegion as HTMLElement).getByText("Legacy Systems Note")).toBeInTheDocument();
    expect(within(archiveRegion as HTMLElement).getByText("Older Release Check")).toBeInTheDocument();
  }, 10000);

  it("does not duplicate essays into the briefing shelf when the issue has no briefings", async () => {
    listPublishedMock.mockResolvedValue([
      {
        id: "post_1",
        slug: "capabilities-brief",
        title: "Capabilities Brief",
        description: "Operational overview.",
        content: "## Checklist\n\n- Validate\n- Release\n\n```ts\nconsole.log('brief');\n```",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-04T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-04T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
      {
        id: "post_2",
        slug: "essay-on-systems",
        title: "Essay On Systems",
        description: "A reflective piece.",
        content: "A slow opening paragraph about systems.\n\n## Reflection\n\nMore narrative prose.",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-03T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]);
    findAssetByIdMock.mockResolvedValue(null);

    const { container } = render(await JournalIndexPage());

    expect(screen.getByText("No briefings right now")).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(container.querySelector('[data-journal-region="briefings"] [data-journal-layout="briefing-ledger"]')).toBeNull();

    const publication = buildJournalPublicationStructure(await listPublishedMock.mock.results[0].value);

    expect(publication.latestEssays).toHaveLength(1);
    expect(publication.latestEssays[0]?.post.slug).toBe("essay-on-systems");
    expect(publication.practicalBriefings).toHaveLength(0);
    expect(publication.archiveGroups.flatMap((group) => group.posts.map((entry) => entry.post.slug))).toEqual([]);
  });

  it("exposes canonical and Open Graph hero metadata on the journal index", async () => {
    listPublishedMock.mockResolvedValue([
      {
        id: "post_1",
        slug: "hero-post",
        title: "Hero Post",
        description: "With hero image",
        content: "Body",
        heroImageAssetId: "asset_hero",
        status: "published",
        publishedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]);
    findAssetByIdMock.mockResolvedValue({
      id: "asset_hero",
      postId: "post_1",
      kind: "hero",
      storagePath: "2026/hero-post/hero.png",
      mimeType: "image/png",
      width: 1200,
      height: 630,
      altText: "A bright hero image.",
      sourcePrompt: null,
      provider: null,
      providerModel: null,
      visibility: "published",
      createdByUserId: "usr_admin",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const metadata = await generateJournalIndexMetadata();

    expect(metadata.alternates).toMatchObject({
      canonical: "https://studioordo.com/journal",
    });
    expect(metadata.openGraph).toMatchObject({
      url: "https://studioordo.com/journal",
      images: [
        expect.objectContaining({
          url: "https://studioordo.com/api/blog/assets/asset_hero",
          alt: "A bright hero image.",
        }),
      ],
    });
  });

  it("renders hero imagery on the post page and exposes it in metadata", async () => {
    findBySlugMock.mockResolvedValue({
      id: "post_2",
      slug: "deep-dive",
      title: "Deep Dive",
      description: "Detailed article",
      content: "A concise opening for the article route.\n\n## Deep\n\nDive content.",
      heroImageAssetId: "asset_post",
      status: "published",
      publishedAt: "2026-02-02T00:00:00.000Z",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
      createdByUserId: "usr_admin",
      publishedByUserId: "usr_admin",
    });
    findAssetByIdMock.mockResolvedValue({
      id: "asset_post",
      postId: "post_2",
      kind: "hero",
      storagePath: "2026/deep-dive/hero.png",
      mimeType: "image/png",
      width: 1600,
      height: 900,
      altText: "The deep dive hero image.",
      sourcePrompt: null,
      provider: null,
      providerModel: null,
      visibility: "published",
      createdByUserId: "usr_admin",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });

    const { container } = render(await JournalPostPage({ params: Promise.resolve({ slug: "deep-dive" }) }));
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "deep-dive" }) });

    const heroImage = screen.getByAltText("The deep dive hero image.");

    expect(heroImage).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Studio Ordo on LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/keithwilliams5/");
    const articleHeader = container.querySelector('[data-journal-role="article-header"]');
    const standfirst = container.querySelector('[data-journal-role="article-standfirst"]');
    const articleBody = container.querySelector('[data-journal-role="article-body"]');
    const bodyCopy = screen.getByTestId("markdown");

    expect(articleHeader).toHaveAttribute("data-journal-article-tone", "essay");
    expect(articleHeader).toHaveTextContent("Essay");
    expect(articleHeader).toHaveTextContent("2 min read");
    expect(articleHeader).toHaveTextContent("February 2, 2026");
    expect(articleHeader).not.toHaveTextContent("Journal article");
    expect(standfirst).toBeInTheDocument();
    expect(standfirst).not.toBeNull();
    expect(standfirst!.compareDocumentPosition(articleBody!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(articleBody).toContainElement(heroImage);
    expect(articleBody).toContainElement(bodyCopy);
    expect(metadata.openGraph).toMatchObject({
      images: [
        expect.objectContaining({
          url: "https://studioordo.com/api/blog/assets/asset_post",
          alt: "The deep dive hero image.",
        }),
      ],
    });
  });

  it("renders a denser factual opener for practical briefings", async () => {
    findBySlugMock.mockResolvedValue({
      id: "post_5",
      slug: "release-runbook",
      title: "Release Runbook",
      description: "Operational release procedure.",
      content: "Release checklist for production readiness.\n\n## Steps\n\n1. Verify jobs\n2. Verify metrics\n3. Ship",
      heroImageAssetId: null,
      status: "published",
      publishedAt: "2026-03-12T00:00:00.000Z",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z",
      createdByUserId: "usr_admin",
      publishedByUserId: "usr_admin",
    });
    findAssetByIdMock.mockResolvedValue(null);

    const { container } = render(await JournalPostPage({ params: Promise.resolve({ slug: "release-runbook" }) }));

    const articleHeader = container.querySelector('[data-journal-role="article-header"]');
    const standfirst = container.querySelector('[data-journal-role="article-standfirst"]');

    expect(articleHeader).toHaveAttribute("data-journal-article-tone", "briefing");
    expect(articleHeader).toHaveTextContent("Practical briefing");
    expect(articleHeader).toHaveTextContent("2 min read");
    expect(articleHeader).toHaveTextContent("March 12, 2026");
    expect(articleHeader).not.toHaveTextContent("Article details");
    expect(screen.getByRole("link", { name: "Studio Ordo on LinkedIn" })).toHaveAttribute("href", "https://www.linkedin.com/in/keithwilliams5/");
    expect(standfirst).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("does not duplicate the opener when the description matches the standfirst", async () => {
    findBySlugMock.mockResolvedValue({
      id: "post_6",
      slug: "duplicate-opener",
      title: "Duplicate Opener",
      description: "A concise opening for the article route.",
      content: "A concise opening for the article route.\n\n## Deep\n\nDive content.",
      heroImageAssetId: null,
      status: "published",
      publishedAt: "2026-04-08T00:00:00.000Z",
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
      createdByUserId: "usr_admin",
      publishedByUserId: "usr_admin",
    });
    findAssetByIdMock.mockResolvedValue(null);

    render(await JournalPostPage({ params: Promise.resolve({ slug: "duplicate-opener" }) }));

    expect(screen.getAllByText("A concise opening for the article route.")).toHaveLength(1);
  });

  it("omits draft or mismatched assets from public rendering", async () => {
    listPublishedMock.mockResolvedValue([
      {
        id: "post_3",
        slug: "no-public-hero",
        title: "No Public Hero",
        description: "Draft hero asset should not render",
        content: "Body",
        heroImageAssetId: "asset_draft",
        status: "published",
        publishedAt: "2026-03-02T00:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]);
    findAssetByIdMock.mockResolvedValue({
      id: "asset_draft",
      postId: "post_3",
      kind: "hero",
      storagePath: "2026/no-public-hero/hero.png",
      mimeType: "image/png",
      width: 1200,
      height: 630,
      altText: "Hidden draft hero image.",
      sourcePrompt: null,
      provider: null,
      providerModel: null,
      visibility: "draft",
      createdByUserId: "usr_admin",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });

    render(await JournalIndexPage());

    expect(screen.queryByAltText("Hidden draft hero image.")).toBeNull();
  });

  it("omits Open Graph images on the journal index when no public hero assets exist", async () => {
    listPublishedMock.mockResolvedValue([
      {
        id: "post_4",
        slug: "no-hero-post",
        title: "No Hero Post",
        description: "No hero image",
        content: "Body",
        heroImageAssetId: null,
        status: "published",
        publishedAt: "2026-04-02T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
        createdByUserId: "usr_admin",
        publishedByUserId: "usr_admin",
      },
    ]);

    const metadata = await generateJournalIndexMetadata();

    expect(metadata.alternates).toMatchObject({
      canonical: "https://studioordo.com/journal",
    });
    expect(metadata.openGraph).toMatchObject({
      url: "https://studioordo.com/journal",
    });
    expect(metadata.openGraph && "images" in metadata.openGraph ? metadata.openGraph.images : undefined).toBeUndefined();
  });
});