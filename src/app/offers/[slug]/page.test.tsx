import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Offer } from "@/core/entities/offer";

const { findPublicOfferBySlugMock, notFoundMock, recordOfferViewedByCodeMock } = vi.hoisted(() => ({
  findPublicOfferBySlugMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("not-found");
  }),
  recordOfferViewedByCodeMock: vi.fn(),
}));

vi.mock("@/lib/offers/offer-service", () => ({
  getOfferService: () => ({
    findPublicOfferBySlug: findPublicOfferBySlugMock,
  }),
}));

vi.mock("@/lib/tracked-links/tracked-link-service", () => ({
  getTrackedLinkService: () => ({
    recordOfferViewedByCode: recordOfferViewedByCodeMock,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import PublicOfferDetailPage, { generateMetadata } from "./page";

const now = "2026-05-05T12:00:00.000Z";

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer_1",
    slug: "strategy-call",
    ownerUserId: "usr_owner",
    title: "Strategy Call",
    summary: "Turn messy work into a repeatable process.",
    description: "A focused session.",
    audience: "Solopreneurs",
    promise: "A clear next step.",
    priceCents: 50_000,
    currency: "USD",
    billingKind: "fixed",
    estimatedMinutes: 90,
    status: "published",
    visibility: "public",
    ctaLabel: "Start a conversation",
    createdFromConversationId: "conv_private",
    createdFromMessageId: "msg_private",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    archivedAt: null,
    ...overrides,
  };
}

describe("/offers/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders only public offer details for visitors", async () => {
    findPublicOfferBySlugMock.mockResolvedValue(offer());

    render(await PublicOfferDetailPage({ params: Promise.resolve({ slug: "strategy-call" }) }));

    expect(findPublicOfferBySlugMock).toHaveBeenCalledWith("strategy-call");
    expect(screen.getByRole("heading", { name: "Strategy Call" })).toBeInTheDocument();
    expect(screen.getByText("$500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a conversation" })).toHaveAttribute(
      "href",
      "/?offer=strategy-call",
    );
    expect(recordOfferViewedByCodeMock).not.toHaveBeenCalled();
    expect(screen.queryByText("conv_private")).toBeNull();
    expect(screen.queryByText("msg_private")).toBeNull();
    expect(screen.queryByText(/provenance/i)).toBeNull();
  });

  it("returns not found when no public offer exists for the slug", async () => {
    findPublicOfferBySlugMock.mockResolvedValue(null);

    await expect(
      PublicOfferDetailPage({ params: Promise.resolve({ slug: "private-offer" }) }),
    ).rejects.toThrow("not-found");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("generates metadata from public offer copy", async () => {
    findPublicOfferBySlugMock.mockResolvedValue(offer());

    await expect(generateMetadata({ params: Promise.resolve({ slug: "strategy-call" }) })).resolves.toEqual({
      title: "Strategy Call | Studio Ordo",
      description: "Turn messy work into a repeatable process.",
    });
  });

  it("attributes public offer views and carries tracked link context into chat", async () => {
    findPublicOfferBySlugMock.mockResolvedValue(offer());

    render(await PublicOfferDetailPage({
      params: Promise.resolve({ slug: "strategy-call" }),
      searchParams: Promise.resolve({ tl: "TRACKED1" }),
    }));

    expect(recordOfferViewedByCodeMock).toHaveBeenCalledWith({
      code: "TRACKED1",
      offerId: "offer_1",
      anonymousVisitId: null,
    });
    expect(screen.getByRole("link", { name: "Start a conversation" })).toHaveAttribute(
      "href",
      "/?offer=strategy-call&tl=TRACKED1",
    );
  });
});
