import { getActivityReadModel } from "@/adapters/RepositoryFactory";
import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { RoleName } from "@/core/entities/user";
import type { ActivityItem, ActivityReadResult } from "@/lib/activity";
import {
  type PersonReadModelItem,
  loadPeopleReadModel,
} from "@/lib/business/people-read-model";
import type {
  ContentCampaignItem,
  ContentCampaignReadModel,
  ContentPerformanceSummary,
} from "@/core/entities/content-campaign";
import { loadOwnerContentCampaign } from "@/lib/content/content-campaign-read-model";
import { getOfferService, type OfferService } from "@/lib/offers/offer-service";
import {
  projectContentCampaignToOrdoCard,
  projectContentItemToOrdoCard,
  projectOfferToOrdoCard,
  projectPersonToOrdoCard,
  projectTrackedLinkToOrdoCard,
} from "@/lib/ordo-cards/ordo-card-projectors";
import type { OrdoCard, OrdoSourceRef } from "@/lib/ordo-cards/ordo-card-types";
import {
  createReferralAnalyticsService,
  type AffiliateOverviewData,
  type ReferralAnalyticsService,
} from "@/lib/referrals/referral-analytics";

const DASHBOARD_BLOCK_LIMIT = 4;

type DashboardActivityReadModel = Pick<ReturnType<typeof getActivityReadModel>, "listUserActivity">;

export interface UserDashboardActivityBlock {
  items: ActivityItem[];
  total: number;
}

export interface UserDashboardSystemHealth {
  tone: "ready" | "active" | "attention" | "limited";
  label: string;
  summary: string;
}

export interface UserDashboardMetric {
  id: string;
  label: string;
  value: number | string;
  summary: string;
  tone: "neutral" | "good" | "attention" | "weak";
  href?: string;
}

export interface UserDashboardCardBlock {
  cards: OrdoCard[];
  total: number;
}

export interface UserDashboardAskPrompt {
  id: string;
  label: string;
  prompt: string;
  href: string;
  sourceRefs: readonly OrdoSourceRef[];
}

export interface UserDashboardResults {
  metrics: UserDashboardMetric[];
  resultCards: UserDashboardCardBlock;
  weakSignalCards: UserDashboardCardBlock;
  nextActionCards: UserDashboardCardBlock;
  askOrdoPrompts: UserDashboardAskPrompt[];
}

export interface UserDashboardData {
  attention: UserDashboardActivityBlock;
  currentWork: UserDashboardActivityBlock;
  recentOutputs: UserDashboardActivityBlock;
  businessLoop: UserDashboardActivityBlock;
  referralOverview: AffiliateOverviewData | null;
  results: UserDashboardResults;
  systemHealth: UserDashboardSystemHealth;
  activityLoadStatus: "ready" | "limited";
  activityLoadMessage: string | null;
}

export interface LoadUserDashboardDependencies {
  activityReadModel?: DashboardActivityReadModel;
  referralAnalytics?: Pick<ReferralAnalyticsService, "getOverview">;
  peopleReadModel?: (userId: string) => Promise<PersonReadModelItem[]>;
  offerService?: Pick<OfferService, "listOwnerOffers" | "listOfferEvents">;
  contentCampaignLoader?: (userId: string) => Promise<ContentCampaignReadModel | null>;
}

const EMPTY_RESULT: ActivityReadResult = {
  items: [],
  pageInfo: {
    page: 1,
    limit: DASHBOARD_BLOCK_LIMIT,
    total: 0,
    hasNextPage: false,
    nextPage: null,
  },
};

function isOutputActivity(item: ActivityItem): boolean {
  return item.sourceKind === "media_workflow"
    || item.sourceKind === "job"
    || item.sourceKind === "operation";
}

function emptyPerformance(): ContentPerformanceSummary {
  return {
    links: 0,
    visits: 0,
    chats: 0,
    signups: 0,
    offerViews: 0,
    offerChoices: 0,
    simulatedPurchases: 0,
    conversions: 0,
  };
}

function performanceScore(performance: ContentPerformanceSummary): number {
  return performance.conversions * 100
    + performance.simulatedPurchases * 80
    + performance.offerChoices * 45
    + performance.signups * 25
    + performance.chats * 12
    + performance.offerViews * 5
    + performance.visits;
}

function countOfferEvents(events: readonly OfferEvent[], type: OfferEvent["eventType"]): number {
  return events.filter((event) => event.eventType === type).length;
}

function ownedActor(userId: string): { userId: string; role: RoleName } {
  return { userId, role: "AUTHENTICATED" };
}

async function loadPeople(
  loader: (userId: string) => Promise<PersonReadModelItem[]>,
  userId: string,
): Promise<{ people: PersonReadModelItem[]; failed: boolean }> {
  try {
    return { people: await loader(userId), failed: false };
  } catch (error) {
    void error;
    return { people: [], failed: true };
  }
}

async function loadOffers(
  offerService: Pick<OfferService, "listOwnerOffers" | "listOfferEvents">,
  userId: string,
): Promise<{ offers: Offer[]; events: OfferEvent[]; failed: boolean }> {
  try {
    const actor = ownedActor(userId);
    const offers = await offerService.listOwnerOffers(actor);
    const events = (await Promise.all(
      offers.map((offer) => offerService.listOfferEvents(actor, offer.id)),
    )).flat();

    return { offers, events, failed: false };
  } catch (error) {
    void error;
    return { offers: [], events: [], failed: true };
  }
}

async function loadContentCampaign(
  loader: (userId: string) => Promise<ContentCampaignReadModel | null>,
  userId: string,
): Promise<{ campaign: ContentCampaignReadModel | null; failed: boolean }> {
  try {
    return { campaign: await loader(userId), failed: false };
  } catch (error) {
    void error;
    return { campaign: null, failed: true };
  }
}

function withCardSummary(card: OrdoCard, summary: string): OrdoCard {
  return { ...card, summary };
}

function bestContentItems(campaign: ContentCampaignReadModel | null): ContentCampaignItem[] {
  if (!campaign) {
    return [];
  }

  return [...campaign.items]
    .filter((item) => performanceScore(item.performance) > 0)
    .sort((left, right) => performanceScore(right.performance) - performanceScore(left.performance));
}

function buildResultCards(input: {
  campaign: ContentCampaignReadModel | null;
  people: readonly PersonReadModelItem[];
  offers: readonly Offer[];
  offerEvents: readonly OfferEvent[];
}): UserDashboardCardBlock {
  const campaignScore = input.campaign ? performanceScore(input.campaign.performance) : 0;
  const campaignCard = input.campaign && campaignScore > 0
    ? [projectContentCampaignToOrdoCard(input.campaign)]
    : [];
  const contentCards = bestContentItems(input.campaign).slice(0, 2).map(projectContentItemToOrdoCard);
  const linkCards = input.campaign
    ? [...input.campaign.trackedLinks]
        .filter((link) => performanceScore({ links: 1, ...link.performance }) > 0)
        .sort((left, right) =>
          performanceScore({ links: 1, ...right.performance }) - performanceScore({ links: 1, ...left.performance }),
        )
        .slice(0, 2)
        .map(projectTrackedLinkToOrdoCard)
    : [];
  const purchasedPeople = input.people
    .filter((person) => person.stageLabel === "Purchased")
    .slice(0, 2)
    .map(projectPersonToOrdoCard);
  const chosenOfferIds = new Set(input.offerEvents
    .filter((event) => event.eventType === "chosen" || event.eventType === "purchase_simulated")
    .map((event) => event.offerId));
  const offerCards = input.offers
    .filter((offer) => chosenOfferIds.has(offer.id))
    .slice(0, 2)
    .map(projectOfferToOrdoCard);
  const cards = [
    ...campaignCard,
    ...contentCards,
    ...linkCards,
    ...purchasedPeople,
    ...offerCards,
  ].slice(0, DASHBOARD_BLOCK_LIMIT);

  return { cards, total: cards.length };
}

function buildWeakSignalCards(input: {
  campaign: ContentCampaignReadModel | null;
  offers: readonly Offer[];
  offerEvents: readonly OfferEvent[];
}): UserDashboardCardBlock {
  const contentWeakSignals = input.campaign
    ? input.campaign.items.flatMap((item) => {
        if (!item.isPublic) {
          return [withCardSummary(
            projectContentItemToOrdoCard(item),
            "Created content is not public yet. Review it before publishing or sharing.",
          )];
        }
        if (item.performance.links === 0) {
          return [withCardSummary(
            projectContentItemToOrdoCard(item),
            "Published content has no tracked link or QR code yet.",
          )];
        }
        if (item.performance.visits > 0 && item.performance.chats === 0) {
          return [withCardSummary(
            projectContentItemToOrdoCard(item),
            "People visited this content, but no tracked chat has started from it yet.",
          )];
        }
        return [];
      })
    : [];
  const trackedLinkWeakSignals = input.campaign
    ? input.campaign.trackedLinks.flatMap((link) => {
        if (link.link.status !== "active") {
          return [];
        }
        const score = performanceScore({ links: 1, ...link.performance });
        if (score === 0) {
          return [withCardSummary(
            projectTrackedLinkToOrdoCard(link),
            "This shared link has no recorded visits yet.",
          )];
        }
        if (link.performance.visits > 0 && link.performance.chats === 0) {
          return [withCardSummary(
            projectTrackedLinkToOrdoCard(link),
            "This link has visits, but no tracked chat has started yet.",
          )];
        }
        return [];
      })
    : [];
  const offerEventCounts = new Map<string, number>();
  for (const event of input.offerEvents) {
    if (event.eventType === "chosen" || event.eventType === "purchase_simulated") {
      offerEventCounts.set(event.offerId, (offerEventCounts.get(event.offerId) ?? 0) + 1);
    }
  }
  const offerWeakSignals = input.offers
    .filter((offer) => offer.status === "published" && offer.visibility === "public" && (offerEventCounts.get(offer.id) ?? 0) === 0)
    .map((offer) => withCardSummary(
      projectOfferToOrdoCard(offer),
      "This offer is public, but no offer choice or simulated purchase is recorded yet.",
    ));
  const cards = [
    ...contentWeakSignals,
    ...trackedLinkWeakSignals,
    ...offerWeakSignals,
  ].slice(0, DASHBOARD_BLOCK_LIMIT);

  return { cards, total: cards.length };
}

function buildNextActionCards(input: {
  people: readonly PersonReadModelItem[];
  offers: readonly Offer[];
  campaign: ContentCampaignReadModel | null;
}): UserDashboardCardBlock {
  const offerActions = input.offers
    .filter((offer) => offer.status === "draft" || offer.status === "ready")
    .map((offer) => withCardSummary(
      projectOfferToOrdoCard(offer),
      "Review the offer, price, and visibility before publishing or sending it.",
    ));
  const peopleActions = input.people
    .filter((person) => person.stageLabel === "Follow-up" || Boolean(person.nextAction))
    .map(projectPersonToOrdoCard);
  const contentActions = input.campaign
    ? input.campaign.items
        .filter((item) => item.post.status === "draft" || item.post.status === "review" || item.post.status === "approved")
        .map((item) => withCardSummary(
          projectContentItemToOrdoCard(item),
          "Review this content and decide whether to revise, publish, or keep it private.",
        ))
    : [];
  const cards = [
    ...offerActions,
    ...peopleActions,
    ...contentActions,
  ].slice(0, DASHBOARD_BLOCK_LIMIT);

  return { cards, total: cards.length };
}

function buildMetrics(input: {
  campaign: ContentCampaignReadModel | null;
  offerEvents: readonly OfferEvent[];
  referralOverview: AffiliateOverviewData | null;
}): UserDashboardMetric[] {
  const campaignPerformance = input.campaign?.performance ?? emptyPerformance();
  const offerChoices = campaignPerformance.offerChoices + countOfferEvents(input.offerEvents, "chosen");
  const simulatedPurchases = campaignPerformance.simulatedPurchases + countOfferEvents(input.offerEvents, "purchase_simulated");

  const metrics: UserDashboardMetric[] = [
    {
      id: "tracked_visits",
      label: "Visits/scans",
      value: campaignPerformance.visits + (input.referralOverview?.introductions ?? 0),
      summary: "Tracked visits and QR/referral introductions with durable evidence.",
      tone: campaignPerformance.visits > 0 || (input.referralOverview?.introductions ?? 0) > 0 ? "good" : "neutral",
      href: "/business",
    },
    {
      id: "tracked_chats",
      label: "Tracked chats",
      value: campaignPerformance.chats + (input.referralOverview?.startedChats ?? 0),
      summary: "Chats started from content, QR, or referral evidence.",
      tone: campaignPerformance.chats > 0 || (input.referralOverview?.startedChats ?? 0) > 0 ? "good" : "neutral",
      href: "/business",
    },
    {
      id: "offer_choices",
      label: "Offer choices",
      value: offerChoices,
      summary: "Recorded choices from public offers and tracked links.",
      tone: offerChoices > 0 ? "good" : "neutral",
      href: "/offers",
    },
    {
      id: "simulated_purchases",
      label: "Purchases",
      value: simulatedPurchases,
      summary: "Simulated purchase events only; no revenue is inferred.",
      tone: simulatedPurchases > 0 ? "good" : "neutral",
      href: "/offers",
    },
  ];

  return metrics.slice(0, 4);
}

function buildAskOrdoPrompts(input: {
  results: UserDashboardCardBlock;
  weakSignals: UserDashboardCardBlock;
  nextActions: UserDashboardCardBlock;
  hasAnyData: boolean;
}): UserDashboardAskPrompt[] {
  const prompts: UserDashboardAskPrompt[] = [];
  const nextActionCard = input.nextActions.cards[0];
  if (nextActionCard) {
    prompts.push({
      id: "continue-next-action",
      label: "Ask Ordo to continue the top action",
      prompt: `Look at ${nextActionCard.title} and recommend the safest next step. Use the available evidence before changing anything.`,
      href: "/",
      sourceRefs: nextActionCard.sourceRefs,
    });
  }

  const weakSignalCard = input.weakSignals.cards[0];
  if (weakSignalCard) {
    prompts.push({
      id: "explain-weak-signal",
      label: "Ask Ordo why this is not working",
      prompt: `Review ${weakSignalCard.title}. Explain what evidence exists, what is missing, and what one action should be tried next.`,
      href: "/",
      sourceRefs: weakSignalCard.sourceRefs,
    });
  }

  const resultCard = input.results.cards[0];
  if (resultCard) {
    prompts.push({
      id: "repeat-result",
      label: "Ask Ordo to repeat what worked",
      prompt: `Review ${resultCard.title}. Identify why it appears to be working and propose one repeatable workflow.`,
      href: "/",
      sourceRefs: resultCard.sourceRefs,
    });
  }

  if (!input.hasAnyData) {
    prompts.push({
      id: "first-offer",
      label: "Ask Ordo to create the first offer",
      prompt: "Help me create one clear public offer with a price, audience, promise, and next step.",
      href: "/",
      sourceRefs: [],
    });
  }

  return prompts.slice(0, 3);
}

function buildResults(input: {
  attention: ActivityReadResult;
  people: readonly PersonReadModelItem[];
  offers: readonly Offer[];
  offerEvents: readonly OfferEvent[];
  campaign: ContentCampaignReadModel | null;
  referralOverview: AffiliateOverviewData | null;
}): UserDashboardResults {
  const resultCards = buildResultCards({
    campaign: input.campaign,
    people: input.people,
    offers: input.offers,
    offerEvents: input.offerEvents,
  });
  const weakSignalCards = buildWeakSignalCards({
    campaign: input.campaign,
    offers: input.offers,
    offerEvents: input.offerEvents,
  });
  const nextActionCards = buildNextActionCards({
    people: input.people,
    offers: input.offers,
    campaign: input.campaign,
  });
  const hasAnyData = input.people.length > 0
    || input.offers.length > 0
    || Boolean(input.campaign && (input.campaign.items.length > 0 || input.campaign.trackedLinks.length > 0))
    || input.attention.pageInfo.total > 0
    || resultCards.total > 0
    || weakSignalCards.total > 0;

  return {
    metrics: buildMetrics({
      campaign: input.campaign,
      offerEvents: input.offerEvents,
      referralOverview: input.referralOverview,
    }),
    resultCards,
    weakSignalCards,
    nextActionCards,
    askOrdoPrompts: buildAskOrdoPrompts({
      results: resultCards,
      weakSignals: weakSignalCards,
      nextActions: nextActionCards,
      hasAnyData,
    }),
  };
}

async function loadActivityResult(
  readModel: DashboardActivityReadModel,
  userId: string,
  query: Parameters<DashboardActivityReadModel["listUserActivity"]>[1],
): Promise<{ result: ActivityReadResult; failed: boolean }> {
  try {
    return {
      result: await readModel.listUserActivity(userId, query),
      failed: false,
    };
  } catch (error) {
    void error;
    return {
      result: EMPTY_RESULT,
      failed: true,
    };
  }
}

async function loadReferralOverview(
  referralAnalytics: Pick<ReferralAnalyticsService, "getOverview">,
  userId: string,
): Promise<AffiliateOverviewData | null> {
  try {
    return await referralAnalytics.getOverview(userId);
  } catch (error) {
    void error;
    return null;
  }
}

function buildSystemHealth(input: {
  attentionTotal: number;
  runningTotal: number;
  failed: boolean;
}): UserDashboardSystemHealth {
  if (input.failed) {
    return {
      tone: "limited",
      label: "Limited visibility",
      summary: "Some work state could not be loaded. Existing work is still preserved in the system.",
    };
  }

  if (input.attentionTotal > 0) {
    return {
      tone: "attention",
      label: "Review needed",
      summary: `${input.attentionTotal} item${input.attentionTotal === 1 ? "" : "s"} need a decision or recovery action.`,
    };
  }

  if (input.runningTotal > 0) {
    return {
      tone: "active",
      label: "Work in motion",
      summary: `${input.runningTotal} item${input.runningTotal === 1 ? " is" : "s are"} moving in the background.`,
    };
  }

  return {
    tone: "ready",
    label: "Ready",
    summary: "No active issues are visible for this account.",
  };
}

export async function loadUserDashboard(
  userId: string,
  dependencies: LoadUserDashboardDependencies = {},
): Promise<UserDashboardData> {
  const activityReadModel = dependencies.activityReadModel ?? getActivityReadModel();
  const referralAnalytics = dependencies.referralAnalytics ?? createReferralAnalyticsService();
  const peopleLoader = dependencies.peopleReadModel ?? loadPeopleReadModel;
  const offerService = dependencies.offerService ?? getOfferService();
  const contentCampaignLoader = dependencies.contentCampaignLoader ?? loadOwnerContentCampaign;
  const [attention, currentWork, completed, businessLoop, referralOverview, people, offerData, contentCampaign] = await Promise.all([
    loadActivityResult(activityReadModel, userId, {
      bucket: "needs_attention",
      limit: DASHBOARD_BLOCK_LIMIT,
    }),
    loadActivityResult(activityReadModel, userId, {
      bucket: "running",
      limit: DASHBOARD_BLOCK_LIMIT,
    }),
    loadActivityResult(activityReadModel, userId, {
      bucket: "completed",
      includeDismissed: false,
      limit: DASHBOARD_BLOCK_LIMIT * 2,
    }),
    loadActivityResult(activityReadModel, userId, {
      sourceKind: "referral_milestone",
      limit: DASHBOARD_BLOCK_LIMIT,
    }),
    loadReferralOverview(referralAnalytics, userId),
    loadPeople(peopleLoader, userId),
    loadOffers(offerService, userId),
    loadContentCampaign(contentCampaignLoader, userId),
  ]);
  const failed = attention.failed
    || currentWork.failed
    || completed.failed
    || businessLoop.failed
    || people.failed
    || offerData.failed
    || contentCampaign.failed;
  const recentOutputItems = completed.result.items
    .filter(isOutputActivity)
    .slice(0, DASHBOARD_BLOCK_LIMIT);
  const results = buildResults({
    attention: attention.result,
    people: people.people,
    offers: offerData.offers,
    offerEvents: offerData.events,
    campaign: contentCampaign.campaign,
    referralOverview,
  });

  return {
    attention: {
      items: attention.result.items,
      total: attention.result.pageInfo.total,
    },
    currentWork: {
      items: currentWork.result.items,
      total: currentWork.result.pageInfo.total,
    },
    recentOutputs: {
      items: recentOutputItems,
      total: recentOutputItems.length,
    },
    businessLoop: {
      items: businessLoop.result.items,
      total: businessLoop.result.pageInfo.total,
    },
    referralOverview,
    results,
    systemHealth: buildSystemHealth({
      attentionTotal: attention.result.pageInfo.total + results.nextActionCards.total + results.weakSignalCards.total,
      runningTotal: currentWork.result.pageInfo.total,
      failed,
    }),
    activityLoadStatus: failed ? "limited" : "ready",
    activityLoadMessage: failed
      ? "Today is partially unavailable. Try the detail pages if you need to inspect older work."
      : null,
  };
}
