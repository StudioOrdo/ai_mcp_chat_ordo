import { describe, expect, it, vi } from "vitest";
import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { ContentCampaignReadModel } from "@/core/entities/content-campaign";
import type { ActivityItem, ActivityReadResult } from "@/lib/activity";
import type { PersonReadModelItem } from "@/lib/business/people-read-model";
import { loadUserDashboard } from "./load-user-dashboard";

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "job:job_1",
    sourceKind: "job",
    sourceId: "job_1",
    userId: "usr_1",
    roleVisibility: ["AUTHENTICATED"],
    bucket: "running",
    severity: "info",
    title: "Generate audio",
    summary: "Audio is rendering.",
    statusLabel: "Running",
    sourceStatus: "running",
    href: "/jobs?jobId=job_1",
    primaryAction: {
      id: "open_job",
      label: "Open work",
      href: "/jobs?jobId=job_1",
      tone: "primary",
    },
    secondaryActions: [],
    createdAt: "2026-05-04T10:00:00.000Z",
    updatedAt: "2026-05-04T10:01:00.000Z",
    dedupeKey: "job:job_1",
    receipt: {
      readAt: null,
      acknowledgedAt: null,
      dismissedAt: null,
      pinnedAt: null,
      updatedAt: null,
    },
    ...overrides,
  };
}

function result(items: ActivityItem[], total = items.length): ActivityReadResult {
  return {
    items,
    pageInfo: {
      page: 1,
      limit: 4,
      total,
      hasNextPage: total > items.length,
      nextPage: total > items.length ? 2 : null,
    },
  };
}

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer_1",
    slug: "launch-offer",
    ownerUserId: "usr_1",
    title: "Launch Offer",
    summary: "Help launching the first offer.",
    description: "Help launching the first offer.",
    audience: "Solopreneurs",
    promise: "Ship the first offer.",
    priceCents: 50000,
    currency: "USD",
    billingKind: "fixed",
    estimatedMinutes: 120,
    status: "published",
    visibility: "public",
    ctaLabel: "Start",
    createdFromConversationId: "conv_1",
    createdFromMessageId: "msg_1",
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T10:00:00.000Z",
    publishedAt: "2026-05-04T10:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

function offerEvent(overrides: Partial<OfferEvent> = {}): OfferEvent {
  return {
    id: "offer_evt_1",
    offerId: "offer_1",
    eventType: "chosen",
    actorUserId: "usr_1",
    personRef: "person:lead_1",
    conversationId: "conv_1",
    messageId: null,
    trackedLinkId: "tl_1",
    metadata: {},
    createdAt: "2026-05-04T11:00:00.000Z",
    ...overrides,
  };
}

function person(overrides: Partial<PersonReadModelItem> = {}): PersonReadModelItem {
  return {
    id: "person:lead_1",
    ownerUserId: "usr_1",
    stage: "lost_or_inactive",
    stageLabel: "Follow-up",
    displayName: "Pat Prospect",
    email: "pat@example.com",
    organization: "Pat Studio",
    summary: "Asked about the launch offer.",
    nextAction: "Follow up about the launch offer.",
    sourceLabels: ["Direct conversation"],
    sourceCategories: ["direct_conversation"],
    offerLabels: ["Launch offer"],
    relationshipRole: "Prospect",
    affiliate: false,
    isAnonymous: false,
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
    detailHref: "/business/people/person%3Alead_1",
    primaryConversationId: "conv_1",
    conversationIds: ["conv_1"],
    leadIds: ["lead_1"],
    consultationRequestIds: [],
    dealIds: [],
    referralIds: [],
    referralCodes: [],
    offerIds: ["offer_1"],
    sourceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    relationshipTrail: [{
      id: "lead:lead_1",
      label: "Lead captured",
      summary: "Asked about the launch offer.",
      occurredAt: "2026-05-04T09:00:00.000Z",
      sourceRef: { sourceKind: "lead", sourceId: "lead_1", label: "Lead" },
    }],
    ...overrides,
  };
}

function campaign(overrides: Partial<ContentCampaignReadModel> = {}): ContentCampaignReadModel {
  return {
    id: "content-performance",
    ownerUserId: "usr_1",
    title: "Content performance",
    summary: "Published content, offers, and links.",
    items: [{
      post: {
        id: "post_1",
        slug: "launch-post",
        title: "Launch Post",
        description: "A launch post.",
        standfirst: "A launch post.",
        status: "published",
        createdByUserId: "usr_1",
        createdAt: "2026-05-04T09:00:00.000Z",
        updatedAt: "2026-05-04T12:00:00.000Z",
      } as never,
      heroAsset: null,
      assets: [],
      artifacts: [],
      trackedLinks: [],
      performance: {
        links: 1,
        visits: 12,
        chats: 2,
        signups: 1,
        offerViews: 1,
        offerChoices: 1,
        simulatedPurchases: 0,
        conversions: 0,
      },
      publicHref: "/feed/launch-post",
      detailHref: "/studio/content/post_1",
      isPublic: true,
    }],
    offers: [offer()],
    trackedLinks: [],
    performance: {
      links: 1,
      visits: 12,
      chats: 2,
      signups: 1,
      offerViews: 1,
      offerChoices: 1,
      simulatedPurchases: 0,
      conversions: 0,
    },
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("loadUserDashboard", () => {
  it("loads mobile dashboard blocks from durable activity", async () => {
    const listUserActivity = vi.fn(async (_userId: string, query?: { bucket?: string; sourceKind?: string }) => {
      if (query?.bucket === "needs_attention") {
        return result([activity({
          id: "job:failed",
          sourceId: "failed",
          bucket: "needs_attention",
          statusLabel: "Failed",
          sourceStatus: "failed",
          title: "Fix failed render",
        })], 1);
      }
      if (query?.bucket === "running") {
        return result([activity({
          id: "media_workflow:mwf_1",
          sourceKind: "media_workflow",
          sourceId: "mwf_1",
          bucket: "running",
          title: "Create promo short",
        })], 1);
      }
      if (query?.bucket === "completed") {
        return result([
          activity({
            id: "media_workflow:mwf_done",
            sourceKind: "media_workflow",
            sourceId: "mwf_done",
            bucket: "completed",
            title: "Promo short ready",
          }),
          activity({
            id: "referral_milestone:ref_evt",
            sourceKind: "referral_milestone",
            sourceId: "ref_evt",
            bucket: "completed",
            title: "Referral registered",
          }),
        ], 2);
      }
      if (query?.sourceKind === "referral_milestone") {
        return result([activity({
          id: "referral_milestone:ref_evt",
          sourceKind: "referral_milestone",
          sourceId: "ref_evt",
          bucket: "completed",
          title: "Referral registered",
        })], 1);
      }
      return result([]);
    });
    const dashboard = await loadUserDashboard("usr_1", {
      activityReadModel: { listUserActivity },
      referralAnalytics: {
        getOverview: vi.fn(async () => ({
          introductions: 3,
          startedChats: 2,
          registered: 1,
          qualifiedOpportunities: 1,
          creditStatusLabel: "Pending",
          creditStatusCounts: {
            tracked: 1,
            pending_review: 0,
            approved: 0,
            paid: 0,
            void: 0,
          },
          narrative: "1 qualified opportunity reached downstream milestones.",
        })),
      },
      peopleReadModel: vi.fn(async () => [person()]),
      offerService: {
        listOwnerOffers: vi.fn(async () => [offer()]),
        listOfferEvents: vi.fn(async () => [offerEvent()]),
      },
      contentCampaignLoader: vi.fn(async () => campaign()),
    });

    expect(dashboard.attention.total).toBe(1);
    expect(dashboard.currentWork.items[0]?.id).toBe("media_workflow:mwf_1");
    expect(dashboard.recentOutputs.items.map((item) => item.id)).toEqual(["media_workflow:mwf_done"]);
    expect(dashboard.businessLoop.items[0]?.sourceKind).toBe("referral_milestone");
    expect(dashboard.results.metrics.map((metric) => metric.id)).toEqual([
      "tracked_visits",
      "tracked_chats",
      "offer_choices",
      "simulated_purchases",
    ]);
    expect(dashboard.results.metrics.find((metric) => metric.id === "tracked_visits")?.value).toBe(15);
    expect(dashboard.results.nextActionCards.cards[0]?.kind).toBe("person");
    expect(dashboard.results.resultCards.cards[0]?.kind).toBe("campaign");
    expect(dashboard.systemHealth.tone).toBe("attention");
    expect(listUserActivity).toHaveBeenCalledWith("usr_1", {
      bucket: "completed",
      includeDismissed: false,
      limit: 8,
    });
  });

  it("returns a quiet empty dashboard for a new account", async () => {
    const dashboard = await loadUserDashboard("usr_1", {
      activityReadModel: { listUserActivity: vi.fn(async () => result([])) },
      referralAnalytics: {
        getOverview: vi.fn(async () => ({
          introductions: 0,
          startedChats: 0,
          registered: 0,
          qualifiedOpportunities: 0,
          creditStatusLabel: "No credits yet",
          creditStatusCounts: {
            tracked: 0,
            pending_review: 0,
            approved: 0,
            paid: 0,
            void: 0,
          },
          narrative: "Your referral and QR workspace are ready, but no attributed activity has landed yet.",
        })),
      },
      peopleReadModel: vi.fn(async () => []),
      offerService: {
        listOwnerOffers: vi.fn(async () => []),
        listOfferEvents: vi.fn(async () => []),
      },
      contentCampaignLoader: vi.fn(async () => null),
    });

    expect(dashboard.attention.items).toEqual([]);
    expect(dashboard.currentWork.items).toEqual([]);
    expect(dashboard.results.askOrdoPrompts[0]?.id).toBe("first-offer");
    expect(dashboard.results.resultCards.cards).toEqual([]);
    expect(dashboard.systemHealth).toMatchObject({
      tone: "ready",
      label: "Ready",
    });
  });

  it("degrades to a limited dashboard when source reads fail", async () => {
    const dashboard = await loadUserDashboard("usr_1", {
      activityReadModel: {
        listUserActivity: vi.fn(async () => {
          throw new Error("source unavailable");
        }),
      },
      referralAnalytics: {
        getOverview: vi.fn(async () => {
          throw new Error("referrals unavailable");
        }),
      },
      peopleReadModel: vi.fn(async () => {
        throw new Error("people unavailable");
      }),
      offerService: {
        listOwnerOffers: vi.fn(async () => {
          throw new Error("offers unavailable");
        }),
        listOfferEvents: vi.fn(async () => []),
      },
      contentCampaignLoader: vi.fn(async () => {
        throw new Error("campaign unavailable");
      }),
    });

    expect(dashboard.activityLoadStatus).toBe("limited");
    expect(dashboard.systemHealth).toMatchObject({
      tone: "limited",
      label: "Limited visibility",
    });
    expect(dashboard.attention.items).toEqual([]);
    expect(dashboard.referralOverview).toBeNull();
  });
});
