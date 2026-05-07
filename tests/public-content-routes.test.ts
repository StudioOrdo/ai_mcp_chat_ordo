import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  loadPublicFeedItemsMock,
  loadOwnerOffersWorkspaceMock,
  loadPublicOffersPageDataMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  loadPublicFeedItemsMock: vi.fn(),
  loadOwnerOffersWorkspaceMock: vi.fn(),
  loadPublicOffersPageDataMock: vi.fn(),
}));

vi.mock("@/lib/config/instance", () => ({
  getInstanceIdentity: () => ({
    name: "Studio Ordo",
    domain: "studioordo.com",
  }),
  getInstanceServices: () => ({
    offerings: [],
    bookingEnabled: false,
  }),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/content/content-campaign-read-model", () => ({
  loadPublicFeedItems: loadPublicFeedItemsMock,
  publicFeedHeroHref: (item: { heroAsset?: { id: string } | null }) => (
    item.heroAsset ? `/api/blog/assets/${item.heroAsset.id}` : null
  ),
}));

vi.mock("@/lib/offers/load-offers-workspace", () => ({
  loadOwnerOffersWorkspace: loadOwnerOffersWorkspaceMock,
  loadPublicOffersPageData: loadPublicOffersPageDataMock,
  buildOwnerOffersHref: (_current: Record<string, unknown>, patch: Record<string, unknown> = {}) => (
    patch.offerId ? `/offers?offerId=${encodeURIComponent(String(patch.offerId))}` : "/offers"
  ),
}));

import FeedPage from "@/app/feed/page";
import OffersPage from "@/app/offers/page";
import { extractDescription } from "@/lib/seo/extract-description";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue({
    id: "anon_1",
    email: "anon@example.com",
    name: "Anonymous",
    roles: ["ANONYMOUS"],
  });
  loadPublicOffersPageDataMock.mockResolvedValue({
    identityName: "Studio Ordo",
    hasDurableOffers: false,
    offers: [],
  });
  loadPublicFeedItemsMock.mockResolvedValue([]);
});

describe("extractDescription", () => {
  it("returns first paragraph from markdown", () => {
    const md = "# Title\n\n## Abstract\n\nFirst paragraph here.\n\nSecond paragraph.";
    expect(extractDescription(md)).toBe("First paragraph here.");
  });

  it("strips markdown formatting", () => {
    const md = "# T\n\n**Bold** and *italic* with [link text](https://example.com).";
    expect(extractDescription(md)).toBe("Bold and italic with link text.");
  });

  it("returns empty string when there is no paragraph content", () => {
    expect(extractDescription("# Title\n## Section")).toBe("");
  });
});

describe("public content route contract", () => {
  it("renders feed empty state with approved public actions", async () => {
    render(await FeedPage());

    expect(screen.getByRole("heading", { name: "Public feed" })).toBeInTheDocument();
    expect(screen.getByText("No public feed items yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start chat" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "View offers" })).toHaveAttribute("href", "/offers");
  });

  it("renders published feed items without exposing private content controls", async () => {
    loadPublicFeedItemsMock.mockResolvedValue([{
      post: {
        id: "blogpost_1",
        slug: "launch-note",
        title: "Launch Note",
        description: "A public launch update.",
        section: "essay",
      },
      heroAsset: { id: "blogasset_1", altText: "Launch hero" },
      publicHref: "/feed/launch-note",
    }]);

    render(await FeedPage());

    expect(screen.getByRole("heading", { name: "Public feed" })).toBeInTheDocument();
    expect(screen.getByText("Launch Note")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute("href", "/feed/launch-note");
    expect(screen.queryByText("No public feed items yet")).toBeNull();
    expect(document.body.textContent).not.toContain("tracked_link_events");
  });

  it("renders offers empty state when no public offers are published", async () => {
    render(await OffersPage());

    expect(screen.getByRole("heading", { name: "Offers" })).toBeInTheDocument();
    expect(screen.getByText("No current public offers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start chat" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "About Ordo" })).toHaveAttribute("href", "/about");
  });

  it("renders durable published public offers from the offer read model", async () => {
    loadPublicOffersPageDataMock.mockResolvedValue({
      identityName: "Studio Ordo",
      hasDurableOffers: true,
      offerings: [
      ],
      offers: [
        {
          id: "offer_1",
          slug: "launch-sprint",
          title: "Launch Sprint",
          summary: "A focused launch support offer.",
          description: "A focused launch support offer.",
          audience: "Solopreneurs",
          promise: "A cleaner launch process.",
          priceLabel: "$2,500",
          ctaLabel: "Start a conversation",
          detailHref: "/offers/launch-sprint",
          source: "durable",
        },
      ],
    });

    render(await OffersPage());

    expect(screen.getByRole("heading", { name: "Offers" })).toBeInTheDocument();
    expect(screen.getByText("Launch Sprint")).toBeInTheDocument();
    expect(screen.getByText("A focused launch support offer.")).toBeInTheDocument();
    expect(screen.getByText("$2,500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a conversation" })).toHaveAttribute(
      "href",
      "/offers/launch-sprint",
    );
    expect(screen.queryByText("No current public offers")).toBeNull();
  });

  it("renders the signed-in owner offers governance surface", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_owner",
      email: "owner@example.com",
      name: "Keith",
      roles: ["AUTHENTICATED"],
    });
    loadOwnerOffersWorkspaceMock.mockResolvedValue({
      offers: [],
      objects: [],
      filteredObjects: [],
      selectedOffer: null,
      cards: [],
      brief: {
        id: "offers-brief",
        sectionId: "offers",
        status: "limited",
        title: "Offers Brief",
        summary: "No governed offers exist yet.",
        bullets: ["Ask Ordo to create an offer."],
        recommendedAction: { label: "Create first offer", href: "/offers#create-offer" },
        evidenceRefs: [],
        limitations: [],
      },
      query: {
        q: null,
        state: null,
        visibility: null,
        offerId: null,
        page: 1,
        limit: 20,
      },
      summary: {
        total: 0,
        public: 0,
        private: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        purchased: 0,
        archived: 0,
        missingPrice: 0,
      },
      pageInfo: {
        page: 1,
        limit: 20,
        total: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    render(await OffersPage());

    expect(loadOwnerOffersWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({ id: "usr_owner" }), undefined);
    expect(screen.getByRole("heading", { name: "Offers Brief" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
  });

  it("defines feed and offers public pages with honest empty states", () => {
    const feed = readSource("src/app/feed/page.tsx");
    const offers = readSource("src/app/offers/page.tsx");

    expect(feed).toContain("No public feed items yet");
    expect(feed).toContain('href="/offers"');
    expect(offers).toContain("loadPublicOffersPageData");
    expect(offers).toContain("loadOwnerOffersWorkspace");
    expect(offers).not.toContain("getInstanceServices");
  });

  it("keeps about page CTAs on approved public routes", () => {
    const aboutPage = readSource("src/app/about/page.tsx");
    const aboutSurface = readSource("src/components/about/AboutSurfaces.tsx");
    const about = `${aboutPage}\n${aboutSurface}`;

    expect(about).toContain('href="/register"');
    expect(about).toContain('href="/offers"');
    expect(about).not.toContain('href="/library"');
    expect(about).not.toContain("publish to your journal");
  });

  it("makes retired public routes fail visibly instead of redirecting", () => {
    const retiredPages = [
      "src/app/library/page.tsx",
      "src/app/library/[document]/page.tsx",
      "src/app/library/[document]/[section]/page.tsx",
      "src/app/library/section/[slug]/page.tsx",
      "src/app/journal/page.tsx",
      "src/app/journal/[slug]/page.tsx",
      "src/app/blog/page.tsx",
      "src/app/blog/[slug]/page.tsx",
    ];

    for (const pagePath of retiredPages) {
      const source = readSource(pagePath);
      expect(source).toContain("notFound");
      expect(source).not.toContain("redirect(");
    }
  });

  it("keeps not-found recovery on approved public destinations", () => {
    const source = readSource("src/app/not-found.tsx");

    expect(source).toContain('href: "/"');
    expect(source).toContain('href: "/feed"');
    expect(source).not.toContain("/library");
  });
});
