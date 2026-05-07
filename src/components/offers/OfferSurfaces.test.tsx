import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import type { SessionUser } from "@/lib/auth";
import { loadOwnerOffersWorkspace } from "@/lib/offers/load-offers-workspace";

import { OwnerOffersWorkspace, PublicOffersSurface } from "./OfferSurfaces";

const now = "2026-05-05T12:00:00.000Z";
const owner: SessionUser = {
  id: "usr_owner",
  email: "keith@example.com",
  name: "Keith Williams",
  roles: ["AUTHENTICATED"],
};

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
    status: "draft",
    visibility: "private",
    ctaLabel: "Start a conversation",
    createdFromConversationId: null,
    createdFromMessageId: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function offerEvent(overrides: Partial<OfferEvent> = {}): OfferEvent {
  return {
    id: "offer_evt_1",
    offerId: "offer_1",
    eventType: "created",
    actorUserId: "usr_owner",
    personRef: null,
    conversationId: null,
    messageId: null,
    trackedLinkId: null,
    metadata: { source: "ui" },
    createdAt: now,
    ...overrides,
  };
}

function trackedLinkForOffer(offerId = "offer_2"): TrackedLinkWithPerformance {
  return {
    link: {
      id: "tl_1",
      code: "TRACKED1",
      ownerUserId: "usr_owner",
      targetKind: "offer",
      targetId: offerId,
      destinationUrl: "/offers/public-sprint?tl=TRACKED1",
      label: "Public Sprint QR",
      purpose: "offer",
      status: "active",
      createdFromConversationId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
    performance: {
      visits: 3,
      chats: 1,
      signups: 0,
      offerViews: 2,
      offerChoices: 1,
      simulatedPurchases: 0,
      conversions: 0,
    },
  };
}

async function renderOwnerOffers(input: {
  offers: Offer[];
  events?: Record<string, OfferEvent[]>;
  links?: TrackedLinkWithPerformance[];
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const listOwnerOffers = vi.fn(async () => input.offers);
  const listOfferEvents = vi.fn(async (_actor, offerId: string) => input.events?.[offerId] ?? []);
  const listOwnerLinks = vi.fn(async () => input.links ?? []);
  const workspace = await loadOwnerOffersWorkspace(owner, input.searchParams, {
    offerService: { listOwnerOffers, listOfferEvents },
    trackedLinkService: { listOwnerLinks },
  });

  render(<OwnerOffersWorkspace userName="Keith Williams" workspace={workspace} />);
  return { workspace, listOwnerOffers, listOfferEvents, listOwnerLinks };
}

describe("OfferSurfaces", () => {
  it("renders the owner Offers Brief with a second-column selector", async () => {
    const draft = offer();
    const published = offer({
      id: "offer_2",
      slug: "public-sprint",
      title: "Public Sprint",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });

    await renderOwnerOffers({
      offers: [draft, published],
      events: {
        offer_1: [offerEvent()],
        offer_2: [offerEvent({ id: "offer_evt_2", offerId: "offer_2" })],
      },
    });

    expect(screen.getByLabelText("Offer selection")).toHaveAttribute("data-governance-selector-column", "true");
    expect(screen.getByRole("heading", { name: "Offers Brief" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create an offer" })).toBeInTheDocument();
    const selector = screen.getByLabelText("Offer selection");
    expect(within(selector).getByText("Strategy Call")).toBeInTheDocument();
    expect(within(selector).getByText("Public Sprint")).toBeInTheDocument();
    expect(screen.getByLabelText("Open offer filters")).toBeInTheDocument();
    expect(screen.queryByText(/offer_evt/i)).toBeNull();
    expect(screen.queryByText(/offer_events/i)).toBeNull();
  });

  it("renders selected public offer detail with price, source evidence, public link, and tracked link controls", async () => {
    const published = offer({
      id: "offer_2",
      slug: "public-sprint",
      title: "Public Sprint",
      status: "published",
      visibility: "public",
      publishedAt: now,
      createdFromConversationId: "conv_offer",
    });

    await renderOwnerOffers({
      offers: [published],
      events: {
        offer_2: [
          offerEvent({
            id: "offer_evt_2",
            offerId: "offer_2",
            conversationId: "conv_offer",
            metadata: { source: "conversation" },
          }),
          offerEvent({
            id: "offer_evt_published",
            offerId: "offer_2",
            eventType: "published",
          }),
        ],
      },
      links: [trackedLinkForOffer("offer_2")],
      searchParams: { offerId: "offer_2" },
    });

    expect(screen.getByRole("heading", { name: "Public Sprint" })).toBeInTheDocument();
    expect(screen.getByText("$500")).toBeInTheDocument();
    expect(screen.getByText("Created from conversation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open public offer" })).toHaveAttribute("href", "/offers/public-sprint");
    expect(screen.getByRole("button", { name: "Create QR / tracked link" })).toBeInTheDocument();
    expect(screen.getByText("/t/TRACKED1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open QR" })).toHaveAttribute("href", "/api/qr/tracked/TRACKED1");
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.queryByText(/metadata_json/i)).toBeNull();
  });

  it("renders selected private offer detail with relationship links and no public visitor link", async () => {
    const privateOffer = offer({
      id: "offer_private",
      slug: "private-proposal",
      title: "Private Proposal",
      visibility: "private",
      status: "draft",
    });

    await renderOwnerOffers({
      offers: [privateOffer],
      events: {
        offer_private: [
          offerEvent({ id: "offer_evt_private", offerId: "offer_private" }),
          offerEvent({
            id: "offer_evt_sent",
            offerId: "offer_private",
            eventType: "sent_private",
            personRef: "person:lead_1",
            conversationId: "conv_private",
          }),
        ],
      },
      searchParams: { offerId: "offer_private" },
    });

    expect(screen.getByRole("heading", { name: "Private Proposal" })).toBeInTheDocument();
    expect(screen.getByText("Private audience")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lead lead_1" })).toHaveAttribute("href", "/business/people/person%3Alead_1");
    expect(screen.getByRole("link", { name: "Discuss in chat" })).toHaveAttribute("href", expect.stringContaining("prompt="));
    expect(screen.queryByRole("link", { name: "Open public offer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create QR / tracked link" })).toBeNull();
  });

  it("renders accepted-offer lifecycle as evidence without revenue or checkout claims", async () => {
    const acceptedOffer = offer({
      id: "offer_accepted",
      slug: "accepted-workflow",
      title: "Accepted Workflow",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });

    await renderOwnerOffers({
      offers: [acceptedOffer],
      events: {
        offer_accepted: [
          offerEvent({
            id: "offer_evt_choice",
            offerId: "offer_accepted",
            eventType: "chosen",
            personRef: "person:lead_2",
            conversationId: "conv_accepted",
            metadata: {
              fulfillmentHref: "/studio?kind=workflow_run&object=workflow_run%3Aaccepted",
              fulfillmentLabel: "Open fulfillment work",
            },
          }),
        ],
      },
      searchParams: { offerId: "offer_accepted" },
    });

    const lifecycle = screen.getByText("Lifecycle").closest("[data-offer-lifecycle]");
    expect(lifecycle).toHaveAttribute("data-offer-lifecycle", "active");
    expect(within(lifecycle as HTMLElement).getByText("Accepted")).toBeInTheDocument();
    expect(within(lifecycle as HTMLElement).getByText("Offer accepted")).toBeInTheDocument();
    expect(within(lifecycle as HTMLElement).getByText("Fulfillment work")).toBeInTheDocument();
    expect(within(lifecycle as HTMLElement).getByRole("link", { name: "Open fulfillment work" })).toHaveAttribute(
      "href",
      "/studio?kind=workflow_run&object=workflow_run%3Aaccepted",
    );
    expect(screen.queryByText(/Accepted Offers/i)).toBeNull();
    expect(screen.queryByText(/revenue/i)).toBeNull();
    expect(screen.queryByText(/conversion/i)).toBeNull();
    expect(screen.queryByText(/checkout/i)).toBeNull();
  });

  it("shows honest lifecycle limitations for simulated purchases without fulfillment evidence", async () => {
    const purchasedOffer = offer({
      id: "offer_purchased",
      slug: "purchased-workflow",
      title: "Purchased Workflow",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });

    await renderOwnerOffers({
      offers: [purchasedOffer],
      events: {
        offer_purchased: [
          offerEvent({
            id: "offer_evt_purchase",
            offerId: "offer_purchased",
            eventType: "purchase_simulated",
          }),
        ],
      },
      searchParams: { offerId: "offer_purchased" },
    });

    const lifecycle = screen.getByText("Lifecycle").closest("[data-offer-lifecycle]");
    expect(lifecycle).toHaveAttribute("data-offer-lifecycle", "active");
    expect(within(lifecycle as HTMLElement).getByText("Purchased (simulated)")).toBeInTheDocument();
    expect(within(lifecycle as HTMLElement).getByText("Purchase simulated")).toBeInTheDocument();
    expect(within(lifecycle as HTMLElement).getByText("No fulfillment work is linked to this accepted offer yet.")).toBeInTheDocument();
    expect(within(lifecycle as HTMLElement).getByText("Purchase state is simulated until real payment evidence exists.")).toBeInTheDocument();
  });

  it("keeps public offers free of private draft and provenance copy", () => {
    render(
      <PublicOffersSurface
        data={{
          identityName: "Studio Ordo",
          hasDurableOffers: true,
          offers: [{
            id: "offer_2",
            slug: "public-sprint",
            title: "Public Sprint",
            summary: "A public offer.",
            description: "A public offer.",
            audience: "Solopreneurs",
            promise: "A clear next step.",
            priceLabel: "$500",
            ctaLabel: "Start a conversation",
            detailHref: "/offers/public-sprint",
            source: "durable",
          }],
        }}
      />,
    );

    const publicSurface = screen.getByRole("main");
    expect(within(publicSurface).getByText("Public Sprint")).toBeInTheDocument();
    expect(within(publicSurface).queryByText(/private proposal/i)).toBeNull();
    expect(within(publicSurface).queryByText(/provenance/i)).toBeNull();
    expect(within(publicSurface).queryByText(/draft/i)).toBeNull();
  });
});
