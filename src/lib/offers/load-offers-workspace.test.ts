import { describe, expect, it, vi } from "vitest";

import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { StoredSectionBrief } from "@/core/entities/brief";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import type { SessionUser } from "@/lib/auth";
import type { SectionBriefStore } from "@/lib/briefs/section-brief-resolver";

import {
  buildOwnerOffersHref,
  loadOwnerOffersWorkspace,
  parseOwnerOffersQuery,
} from "./load-offers-workspace";

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

function trackedLinkForOffer(offerId: string): TrackedLinkWithPerformance {
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
      visits: 2,
      chats: 1,
      signups: 0,
      offerViews: 2,
      offerChoices: 1,
      simulatedPurchases: 0,
      conversions: 0,
    },
  };
}

async function load(input: {
  offers: Offer[];
  events?: Record<string, OfferEvent[]>;
  links?: TrackedLinkWithPerformance[];
  searchParams?: Record<string, string | string[] | undefined>;
  briefs?: SectionBriefStore | null;
}) {
  const listOwnerOffers = vi.fn(async () => input.offers);
  const listOfferEvents = vi.fn(async (_actor, offerId: string) => input.events?.[offerId] ?? []);
  const listOwnerLinks = vi.fn(async () => input.links ?? []);

  const workspace = await loadOwnerOffersWorkspace(owner, input.searchParams, {
    offerService: { listOwnerOffers, listOfferEvents },
    trackedLinkService: { listOwnerLinks },
    briefs: input.briefs,
  });

  return { workspace, listOwnerOffers, listOfferEvents, listOwnerLinks };
}

describe("loadOwnerOffersWorkspace", () => {
  it("builds an Offers Brief and projects owner offers without raw event internals", async () => {
    const published = offer({
      id: "offer_2",
      slug: "public-sprint",
      title: "Public Sprint",
      status: "published",
      visibility: "public",
      publishedAt: now,
      createdFromConversationId: "conv_offer",
    });
    const privateProposal = offer({
      id: "offer_private",
      slug: "private-proposal",
      title: "Private Proposal",
      visibility: "private",
      status: "draft",
    });

    const { workspace, listOfferEvents } = await load({
      offers: [published, privateProposal],
      events: {
        offer_2: [
          offerEvent({ id: "offer_evt_pub", offerId: "offer_2", eventType: "published" }),
          offerEvent({ id: "offer_evt_choice", offerId: "offer_2", eventType: "chosen" }),
        ],
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
      links: [trackedLinkForOffer("offer_2")],
      searchParams: { offerId: "offer_2" },
    });

    expect(listOfferEvents).toHaveBeenCalledTimes(2);
    expect(workspace.brief.title).toBe("Offers Brief");
    expect(workspace.summary).toMatchObject({
      total: 2,
      public: 1,
      private: 1,
      draft: 1,
      sent: 1,
      accepted: 1,
      purchased: 0,
    });
    expect(workspace.selectedOffer).toMatchObject({
      id: "offer_2",
      priceLabel: "$500",
      visibilityLabel: "Public",
      sourceLabel: "Created from conversation",
      publicHref: "/offers/public-sprint",
    });
    expect(workspace.selectedOffer?.trackedLinks).toHaveLength(1);
    expect(JSON.stringify(workspace)).not.toContain("metadata_json");
    expect(workspace.objects.find((object) => object.id === "offer_private")?.relationshipLinks).toEqual([
      {
        id: "person:lead_1",
        label: "Lead lead_1",
        href: "/business/people/person%3Alead_1",
      },
    ]);
  });

  it("filters by offer state and query while keeping selected missing offers safe", async () => {
    const purchased = offer({
      id: "offer_purchased",
      slug: "private-purchase",
      title: "Private Purchase",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });
    const draft = offer({
      id: "offer_draft",
      slug: "unpriced",
      title: "Unpriced Draft",
      billingKind: "fixed",
      priceCents: null,
    });

    const { workspace } = await load({
      offers: [purchased, draft],
      events: {
        offer_purchased: [
          offerEvent({ id: "offer_evt_purchase", offerId: "offer_purchased", eventType: "purchase_simulated" }),
        ],
        offer_draft: [offerEvent({ id: "offer_evt_draft", offerId: "offer_draft" })],
      },
      searchParams: { state: "purchased", q: "private", offerId: "missing_offer" },
    });

    expect(workspace.filteredObjects.map((object) => object.id)).toEqual(["offer_purchased"]);
    expect(workspace.selectedOffer).toBeNull();
    expect(workspace.summary.missingPrice).toBe(1);
    expect(workspace.brief.limitations).toEqual([
      "Unpriced fixed/hourly offers cannot be published until pricing or contact/free billing is explicit.",
    ]);
  });

  it("builds accepted-offer lifecycle only from durable accepted or simulated purchase evidence", async () => {
    const accepted = offer({
      id: "offer_accepted",
      slug: "accepted-workflow",
      title: "Accepted Workflow",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });
    const publicWithoutChoice = offer({
      id: "offer_public",
      slug: "public-no-choice",
      title: "Public No Choice",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });

    const { workspace } = await load({
      offers: [accepted, publicWithoutChoice],
      events: {
        offer_accepted: [
          offerEvent({
            id: "offer_evt_accepted",
            offerId: "offer_accepted",
            eventType: "chosen",
            personRef: "person:lead_7",
            conversationId: "conv_accepted",
            metadata: {
              fulfillmentHref: "/studio?kind=workflow_run&object=workflow_run%3Aaudit",
              fulfillmentLabel: "Open fulfillment work",
            },
          }),
        ],
        offer_public: [
          offerEvent({
            id: "offer_evt_view",
            offerId: "offer_public",
            eventType: "viewed",
          }),
        ],
      },
      searchParams: { offerId: "offer_accepted" },
    });

    expect(workspace.objects.find((object) => object.id === "offer_public")?.stateLabels).not.toContain("accepted");
    expect(workspace.selectedOffer?.lifecycle).toMatchObject({
      active: true,
      stateLabel: "Accepted",
      nextActionLabel: "Inspect fulfillment evidence",
      limitations: [],
    });
    expect(workspace.selectedOffer?.lifecycle.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "accepted",
        status: "complete",
        sourceHref: "/business/conversations/conv_accepted",
      }),
      expect.objectContaining({
        id: "fulfillment",
        status: "complete",
        sourceHref: "/studio?kind=workflow_run&object=workflow_run%3Aaudit",
      }),
      expect.objectContaining({
        id: "delivery",
        status: "pending",
      }),
    ]));
  });

  it("labels simulated purchase and missing lifecycle links as limitations instead of fake checkout or revenue state", async () => {
    const purchased = offer({
      id: "offer_purchased",
      slug: "purchased-workflow",
      title: "Purchased Workflow",
      status: "published",
      visibility: "public",
      publishedAt: now,
    });

    const { workspace } = await load({
      offers: [purchased],
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

    expect(workspace.selectedOffer?.lifecycle).toMatchObject({
      active: true,
      stateLabel: "Purchased (simulated)",
      nextActionLabel: "Plan fulfillment in chat",
    });
    expect(workspace.selectedOffer?.lifecycle.limitations).toEqual([
      "No related person is attached to the accepted-offer event yet.",
      "No fulfillment work is linked to this accepted offer yet.",
      "Purchase state is simulated until real payment evidence exists.",
    ]);
    expect(JSON.stringify(workspace.selectedOffer?.lifecycle)).not.toMatch(/revenue|conversion|checkout/i);
  });

  it("returns a first-offer brief when no offers exist", async () => {
    const { workspace } = await load({ offers: [] });

    expect(workspace.brief.status).toBe("limited");
    expect(workspace.brief.recommendedAction).toMatchObject({
      label: "Create first offer",
      href: "/offers#create-offer",
    });
    expect(workspace.filteredObjects).toEqual([]);
    expect(workspace.summary.total).toBe(0);
  });

  it("prefers a stored current offer brief over the deterministic fallback", async () => {
    const storedBrief: StoredSectionBrief = {
      id: "offers-stored-brief",
      sectionId: "offers",
      asOf: now,
      status: "fresh",
      title: "Stored Offer Brief",
      summary: "Background brief has already reconciled accepted-offer evidence.",
      bullets: ["Accepted offer evidence is linked to a person and fulfillment work."],
      recommendedAction: { label: "Review accepted offer", href: "/offers?state=accepted" },
      evidenceRefs: [{
        kind: "offer_event",
        id: "offer_evt_accepted",
        label: "Offer accepted",
        visibility: "owner",
      }],
      limitations: [],
      version: 2,
      priorBriefId: "offers-stored-brief-v1",
      ownerUserId: owner.id,
      visibilityPolicy: "owner",
      generatedAt: now,
      generatedBy: "brief-executor:deterministic",
      manifest: {
        schemaVersion: "1",
        briefId: "offers-stored-brief",
        briefVersion: 2,
        generatedAt: now,
        generatedBy: "brief-executor:deterministic",
        ownerUserId: owner.id,
        sectionId: "offers",
        visibilityPolicy: "owner",
        includedSourceRefs: [{
          kind: "offer_event",
          id: "offer_evt_accepted",
          label: "Offer accepted",
          visibility: "owner",
        }],
        excludedSourceRefs: [],
        claims: [{
          id: "claim_1",
          text: "Accepted offer evidence is linked to a person and fulfillment work.",
          evidenceRefIds: ["offer_event:offer_evt_accepted"],
        }],
        limitations: [],
        executorMetadata: { kind: "deterministic" },
        warnings: [],
      },
      isCurrent: true,
    };
    const findCurrentSectionBrief = vi.fn(async () => storedBrief);

    const { workspace } = await load({
      offers: [offer()],
      briefs: { findCurrentSectionBrief },
    });

    expect(workspace.brief).toMatchObject({
      id: "offers-stored-brief",
      title: "Stored Offer Brief",
      priorBriefId: "offers-stored-brief-v1",
    });
    expect(findCurrentSectionBrief).toHaveBeenCalledWith("offers", {
      ownerUserId: owner.id,
      visibilityPolicy: "owner",
    });
  });
});

describe("offer workspace query helpers", () => {
  it("normalizes query params and preserves supported selector state", () => {
    const query = parseOwnerOffersQuery({
      q: "  private proposal ",
      state: "sent",
      visibility: "private",
      offerId: "offer_1",
      page: "2",
      limit: "5",
    });

    expect(query).toMatchObject({
      q: "private proposal",
      state: "sent",
      visibility: "private",
      offerId: "offer_1",
      page: 2,
      limit: 5,
    });
    expect(buildOwnerOffersHref(query, { offerId: "offer_2", page: 1 })).toBe(
      "/offers?q=private+proposal&state=sent&visibility=private&offerId=offer_2&limit=5",
    );
  });
});
