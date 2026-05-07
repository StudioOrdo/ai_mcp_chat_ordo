import type { ActivityItem } from "@/lib/activity";
import type {
  OrdoCard,
  OrdoCardAction,
  OrdoCardKind,
  OrdoSourceKind,
  OrdoSourceRef,
} from "@/lib/ordo-cards/ordo-card-types";
import { projectActivityItemToOrdoCard } from "@/lib/ordo-cards/ordo-card-projectors";

import type { UserDashboardData } from "./load-user-dashboard";

export const TODAY_INTENTS = ["decide", "watch", "inspect", "learn", "fix"] as const;

export type TodayIntent = typeof TODAY_INTENTS[number];

export interface TodayEvidenceRef {
  id: string;
  kind: OrdoSourceKind;
  kindLabel: string;
  label: string;
  href?: string;
}

export interface TodaySourceLink {
  id: string;
  label: string;
  href: string;
}

export interface TodayAction {
  id: string;
  label: string;
  href: string;
  prompt?: string;
}

export interface TodayBriefItem {
  id: string;
  intent: TodayIntent;
  intentLabel: string;
  domain: string;
  iconLabel: string;
  title: string;
  summary: string;
  statusLabel: string;
  updatedAt: string;
  why: string;
  currentState: string;
  recommendedAction: TodayAction;
  evidenceRefs: TodayEvidenceRef[];
  sourceLinks: TodaySourceLink[];
  card: OrdoCard;
}

export interface TodayBriefReadModel {
  id: string;
  asOf: string | null;
  status: "fresh" | "limited";
  title: string;
  summary: string;
  bullets: string[];
  recommendedAction: TodayAction;
  limitations: string[];
  evidenceRefs: TodayEvidenceRef[];
  items: TodayBriefItem[];
  counts: Record<TodayIntent, number> & { total: number };
}

const ASK_ORDO_ACTION_ID = "ask_ordo";

const INTENT_LABELS: Record<TodayIntent, string> = {
  decide: "Decide",
  watch: "Watch",
  inspect: "Inspect",
  learn: "Learn",
  fix: "Fix",
};

const INTENT_ICON_LABELS: Record<TodayIntent, string> = {
  decide: "D",
  watch: "W",
  inspect: "I",
  learn: "L",
  fix: "F",
};

const KIND_DOMAIN_LABELS: Record<OrdoCardKind, string> = {
  campaign: "Campaign",
  content_item: "Content",
  conversation: "Conversation",
  media_asset: "Media",
  offer: "Offer",
  operation: "Work",
  person: "Person",
  backup: "System",
  restore_plan: "System",
  system: "System",
  tracked_link: "Link",
  workflow_run: "Work",
};

const SAFE_SOURCE_LABELS: Record<OrdoSourceKind, string> = {
  activity: "Today evidence",
  artifact: "Produced asset",
  asset_catalog: "Media record",
  blog_asset: "Media asset",
  blog_post: "Content",
  blog_post_artifact: "Content artifact",
  business_workflow_context: "Conversation context",
  campaign: "Campaign",
  capability_result: "Work result",
  conversation: "Conversation",
  consultation: "Consultation",
  deal: "Deal",
  job: "Work record",
  job_event: "Work event",
  lead: "Lead",
  materialization: "Saved output",
  media_workflow: "Studio work",
  offer: "Offer",
  offer_event: "Offer event",
  operation: "Governed work",
  operation_event: "Work event",
  person: "Person",
  referral: "Referral",
  referral_event: "Referral event",
  tracked_link: "Shared link",
  tracked_link_event: "Link activity",
  user: "User",
  user_file: "Media file",
};

function isConversationAction(action: OrdoCardAction): boolean {
  return action.id === "open_conversation"
    || action.id === "open-conversation"
    || action.href?.startsWith("/?conversationId=") === true;
}

function safeOwnerCopy(value: string): string {
  return value
    .replace(/\bjob:[a-z0-9:_-]+\b/gi, "work item")
    .replace(/\bjob_[a-z0-9-]+\b/gi, "work item")
    .replace(/\bjobs?\b/gi, "work")
    .replace(/\bqueued\b/gi, "waiting to start")
    .replace(/\bqueue\b/gi, "work list")
    .replace(/\bpayloads?\b/gi, "request details")
    .replace(/\boperation ids?\b/gi, "work reference")
    .replace(/\boperations?\b/gi, "governed work")
    .replace(/\bprovider\b/gi, "background service")
    .replace(/\blogs?\b/gi, "records");
}

function parseHref(href: string): URL | null {
  try {
    return new URL(href, "http://ordo.local");
  } catch (error) {
    void error;
    return null;
  }
}

function studioMediaHrefFromDonorRoute(href: string): string | null {
  const parsed = parseHref(href);
  if (!parsed || parsed.pathname !== "/my/media") {
    return null;
  }

  const assetId = parsed.searchParams.get("assetId");
  return assetId ? `/studio/media/${encodeURIComponent(assetId)}` : null;
}

function studioWorkflowHrefFromJobRoute(href: string): string | null {
  const parsed = parseHref(href);
  if (!parsed || parsed.pathname !== "/jobs") {
    return null;
  }

  const workflowId = parsed.searchParams.get("workflowId")
    ?? (parsed.searchParams.get("sourceKind") === "media_workflow"
      ? parsed.searchParams.get("sourceId")
      : null);

  return workflowId ? `/studio/workflows/${encodeURIComponent(workflowId)}` : null;
}

function ownerSafeHref(href: string | null | undefined): string | null {
  if (!href) {
    return null;
  }

  const parsed = parseHref(href);
  if (!parsed) {
    return href;
  }

  if (parsed.pathname === "/my/media") {
    return studioMediaHrefFromDonorRoute(href);
  }

  if (parsed.pathname === "/jobs") {
    return studioWorkflowHrefFromJobRoute(href);
  }

  if (
    parsed.pathname.startsWith("/admin")
    || parsed.pathname.startsWith("/factory")
    || parsed.pathname.startsWith("/operations")
  ) {
    return null;
  }

  return href;
}

function withAskOrdoAction(card: OrdoCard): OrdoCard {
  const secondaryActions = card.secondaryActions ?? [];
  const conversationAction = secondaryActions.find(isConversationAction);
  const retainedSecondaryActions = secondaryActions
    .filter((action) => action.id !== ASK_ORDO_ACTION_ID && !isConversationAction(action));
  const safeTitle = safeOwnerCopy(card.title);
  const safeSummary = safeOwnerCopy(card.summary);
  const prompt = `Look at ${safeTitle}. Explain the evidence, the risk, and the safest next action before changing anything.`;
  const askOrdoAction: OrdoCardAction = {
    id: ASK_ORDO_ACTION_ID,
    label: "Ask Ordo",
    href: conversationAction?.href ?? "/",
    tone: "secondary",
    payload: {
      prompt,
      objectRef: card.objectRef,
      sourceRefs: card.sourceRefs,
    },
  };

  return {
    ...card,
    summary: safeSummary,
    title: safeTitle,
    secondaryActions: [
      askOrdoAction,
      ...retainedSecondaryActions,
    ].slice(0, 3),
  };
}

function projectDashboardItem(item: ActivityItem): OrdoCard | null {
  const card = projectActivityItemToOrdoCard(item);
  if (!card) {
    return null;
  }

  if (item.sourceKind !== "referral_milestone") {
    return withAskOrdoAction(card);
  }

  return withAskOrdoAction({
    ...card,
    detailHref: "/business",
    diagnosticHref: item.href,
    primaryAction: {
      id: "open_business",
      label: "Open business",
      href: "/business",
      tone: "primary",
    },
    secondaryActions: [
      ...(card.secondaryActions ?? []),
      {
        id: "open_referral_detail",
        label: "Open referral evidence",
        href: item.href,
        tone: "secondary",
      },
    ],
  });
}

function statusLabel(card: OrdoCard): string {
  switch (card.status) {
    case "queued":
      return "waiting to start";
    case "running":
      return "in motion";
    case "failed":
      return "needs recovery";
    case "succeeded":
      return "ready";
    case "needs_review":
      return "needs review";
    default:
      return card.status.replace(/_/g, " ");
  }
}

function domainLabel(card: OrdoCard): string {
  return KIND_DOMAIN_LABELS[card.kind];
}

function intentWhy(intent: TodayIntent, card: OrdoCard): string {
  switch (intent) {
    case "decide":
      return "This needs owner judgment before Ordo should keep moving.";
    case "watch":
      return "This work is moving in the background. Today keeps it visible without making you manage backend systems.";
    case "inspect":
      return "Ordo produced something. Inspect the output before reuse, publishing, sharing, or follow-up.";
    case "learn":
      return "This has evidence of business motion. Review it so Ordo can repeat what worked.";
    case "fix":
      return card.status === "failed" || card.status === "blocked"
        ? "This is blocked or failed and needs a recovery path."
        : "This signal suggests something is missing, weak, or not converting yet.";
  }
}

function currentState(intent: TodayIntent, card: OrdoCard): string {
  const domain = domainLabel(card).toLowerCase();
  const status = statusLabel(card);

  switch (intent) {
    case "decide":
      return `This ${domain} is waiting on an owner decision.`;
    case "watch":
      return status === "waiting to start"
        ? `This ${domain} is waiting to start.`
        : `This ${domain} is moving in the background.`;
    case "inspect":
      return `This ${domain} is ready to inspect.`;
    case "learn":
      return `This ${domain} has measurable or relationship evidence.`;
    case "fix":
      return `This ${domain} is marked ${status}.`;
  }
}

function askOrdoAction(card: OrdoCard): TodayAction {
  const action = card.secondaryActions?.find((candidate) => candidate.id === ASK_ORDO_ACTION_ID);
  const prompt = action?.payload?.prompt;

  return {
    id: ASK_ORDO_ACTION_ID,
    label: "Ask Ordo",
    href: action?.href ?? "/",
    prompt: typeof prompt === "string" ? prompt : undefined,
  };
}

function recommendedAction(intent: TodayIntent, card: OrdoCard): TodayAction {
  const primary = card.primaryAction;
  const ask = askOrdoAction(card);
  const primaryHref = ownerSafeHref(primary?.href);

  if (intent === "fix") {
    return ask;
  }

  if (primary && primaryHref) {
    return {
      id: primary.id,
      label: primary.label,
      href: primaryHref,
    };
  }

  return ask;
}

function safeEvidenceLabel(ref: OrdoSourceRef): string {
  return ref.label && !/\bjob\b/i.test(ref.label)
    ? ref.label
    : SAFE_SOURCE_LABELS[ref.sourceKind];
}

function evidenceRefs(card: OrdoCard): TodayEvidenceRef[] {
  const seen = new Set<string>();
  const refs: TodayEvidenceRef[] = [];

  for (const ref of [...card.sourceRefs, ...card.provenanceRefs]) {
    const id = `${ref.sourceKind}:${ref.sourceId}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    refs.push({
      id,
      kind: ref.sourceKind,
      kindLabel: SAFE_SOURCE_LABELS[ref.sourceKind],
      label: safeEvidenceLabel(ref),
      href: ownerSafeHref(ref.href) ?? undefined,
    });
  }

  return refs.slice(0, 6);
}

function addLink(
  links: TodaySourceLink[],
  seen: Set<string>,
  label: string,
  href: string | null | undefined,
  id = href,
) {
  if (!href || seen.has(href)) {
    return;
  }
  seen.add(href);
  links.push({ id: id ?? href, label, href });
}

function sourceLinks(card: OrdoCard): TodaySourceLink[] {
  const links: TodaySourceLink[] = [];
  const seen = new Set<string>();
  const domain = domainLabel(card);

  addLink(links, seen, `Open ${domain.toLowerCase()}`, ownerSafeHref(card.objectRef.href ?? card.detailHref), "object");
  addLink(links, seen, card.primaryAction?.label ?? `Open ${domain.toLowerCase()}`, ownerSafeHref(card.primaryAction?.href), "primary");

  for (const action of card.secondaryActions ?? []) {
    if (action.id === ASK_ORDO_ACTION_ID) {
      continue;
    }
    addLink(links, seen, action.label, ownerSafeHref(action.href), action.id);
  }

  for (const ref of [...card.sourceRefs, ...card.provenanceRefs]) {
    addLink(links, seen, safeEvidenceLabel(ref), ownerSafeHref(ref.href), `${ref.sourceKind}:${ref.sourceId}`);
  }

  return links.slice(0, 5);
}

function todayItem(intent: TodayIntent, card: OrdoCard): TodayBriefItem {
  return {
    id: `${intent}:${card.id}`,
    intent,
    intentLabel: INTENT_LABELS[intent],
    domain: domainLabel(card),
    iconLabel: INTENT_ICON_LABELS[intent],
    title: card.title,
    summary: card.summary,
    statusLabel: statusLabel(card),
    updatedAt: card.updatedAt,
    why: intentWhy(intent, card),
    currentState: currentState(intent, card),
    recommendedAction: recommendedAction(intent, card),
    evidenceRefs: evidenceRefs(card),
    sourceLinks: sourceLinks(card),
    card,
  };
}

function attentionIntent(item: ActivityItem, card: OrdoCard): TodayIntent {
  if (
    item.sourceStatus === "failed"
    || item.sourceStatus === "blocked"
    || item.severity === "critical"
    || card.status === "failed"
    || card.status === "blocked"
    || card.tone === "bad"
  ) {
    return "fix";
  }

  return "decide";
}

function projectedActivityItems(items: readonly ActivityItem[]): Array<{ activity: ActivityItem; card: OrdoCard }> {
  return items
    .map((activity) => ({ activity, card: projectDashboardItem(activity) }))
    .filter((entry): entry is { activity: ActivityItem; card: OrdoCard } => entry.card !== null);
}

function dedupeItems(items: TodayBriefItem[]): TodayBriefItem[] {
  const seen = new Set<string>();
  const result: TodayBriefItem[] = [];

  for (const item of items) {
    const key = `${item.intent}:${item.card.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function buildTodayItems(dashboard: UserDashboardData): TodayBriefItem[] {
  const nextActions = dashboard.results.nextActionCards.cards.map(withAskOrdoAction);
  const attention = projectedActivityItems(dashboard.attention.items);
  const currentWork = projectedActivityItems(dashboard.currentWork.items);
  const recentOutputs = projectedActivityItems(dashboard.recentOutputs.items);
  const businessLoop = projectedActivityItems(dashboard.businessLoop.items);
  const resultCards = dashboard.results.resultCards.cards.map(withAskOrdoAction);
  const weakSignals = dashboard.results.weakSignalCards.cards.map(withAskOrdoAction);

  return dedupeItems([
    ...nextActions.map((card) => todayItem("decide", card)),
    ...attention.map(({ activity, card }) => todayItem(attentionIntent(activity, card), card)),
    ...currentWork.map(({ card }) => todayItem("watch", card)),
    ...recentOutputs.map(({ card }) => todayItem("inspect", card)),
    ...resultCards.map((card) => todayItem("learn", card)),
    ...businessLoop.map(({ card }) => todayItem("learn", card)),
    ...weakSignals.map((card) => todayItem("fix", card)),
  ]);
}

function counts(items: readonly TodayBriefItem[]): TodayBriefReadModel["counts"] {
  return {
    total: items.length,
    decide: items.filter((item) => item.intent === "decide").length,
    watch: items.filter((item) => item.intent === "watch").length,
    inspect: items.filter((item) => item.intent === "inspect").length,
    learn: items.filter((item) => item.intent === "learn").length,
    fix: items.filter((item) => item.intent === "fix").length,
  };
}

function briefBullets(items: readonly TodayBriefItem[], modelCounts: TodayBriefReadModel["counts"]): string[] {
  if (items.length === 0) {
    return [
      "No owner decisions are waiting right now.",
      "Start with one concrete outcome in chat so Ordo can turn it into governed work.",
      "When work, people, offers, or results appear, their evidence will show in the Today index.",
    ];
  }

  const bullets: string[] = [];
  if (modelCounts.decide > 0) {
    bullets.push(`${modelCounts.decide} item${modelCounts.decide === 1 ? " needs" : "s need"} your judgment before Ordo should continue.`);
  }
  if (modelCounts.fix > 0) {
    bullets.push(`${modelCounts.fix} item${modelCounts.fix === 1 ? " looks" : "s look"} blocked, weak, or incomplete enough to fix.`);
  }
  if (modelCounts.watch > 0) {
    bullets.push(`${modelCounts.watch} item${modelCounts.watch === 1 ? " is" : "s are"} moving in the background.`);
  }
  if (modelCounts.inspect > 0) {
    bullets.push(`${modelCounts.inspect} output${modelCounts.inspect === 1 ? "" : "s"} are ready to inspect.`);
  }
  if (modelCounts.learn > 0) {
    bullets.push(`${modelCounts.learn} signal${modelCounts.learn === 1 ? "" : "s"} can teach Ordo what is producing motion.`);
  }

  return bullets.slice(0, 4);
}

function briefRecommendedAction(items: readonly TodayBriefItem[], dashboard: UserDashboardData): TodayAction {
  const topAction = items.find((item) => item.intent === "decide")
    ?? items.find((item) => item.intent === "fix")
    ?? items[0];

  if (topAction) {
    return topAction.recommendedAction;
  }

  const prompt = dashboard.results.askOrdoPrompts[0];
  return {
    id: prompt?.id ?? "ask-ordo-first-action",
    label: prompt?.label ?? "Ask Ordo what to do first",
    href: prompt?.href ?? "/",
    prompt: prompt?.prompt,
  };
}

export function buildTodayBriefReadModel(
  dashboard: UserDashboardData,
): TodayBriefReadModel {
  const items = buildTodayItems(dashboard);
  const modelCounts = counts(items);
  const limitations = dashboard.activityLoadMessage ? [dashboard.activityLoadMessage] : [];
  const evidence = items.flatMap((item) => item.evidenceRefs).slice(0, 8);

  return {
    id: "today:deterministic",
    asOf: null,
    status: dashboard.activityLoadStatus === "limited" ? "limited" : "fresh",
    title: "Today Brief",
    summary: items.length > 0
      ? "A concise staff brief of what needs your judgment, what to watch, what to inspect, what to learn from, and what to fix."
      : "No urgent work is waiting. Use chat to start the next concrete business outcome.",
    bullets: briefBullets(items, modelCounts),
    recommendedAction: briefRecommendedAction(items, dashboard),
    limitations,
    evidenceRefs: evidence,
    items,
    counts: modelCounts,
  };
}

export function todayIntentLabel(intent: TodayIntent): string {
  return INTENT_LABELS[intent];
}

export function isTodayIntent(value: string | null | undefined): value is TodayIntent {
  return Boolean(value && (TODAY_INTENTS as readonly string[]).includes(value));
}
