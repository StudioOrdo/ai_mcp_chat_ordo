import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { Conversation } from "@/core/entities/conversation";
import type {
  ContentCampaignItem,
  ContentCampaignReadModel,
} from "@/core/entities/content-campaign";
import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { OrdoDetailLens } from "@/core/entities/ordo-object";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import type { PersonReadModelItem } from "@/lib/business/people-read-model";
import type { JobHistoryEntry } from "@/lib/jobs/job-event-history";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type {
  AffiliateOverviewData,
  AffiliatePipelineData,
  AffiliateTimeseriesPoint,
} from "@/lib/referrals/referral-analytics";
import type { ReferralActivityItem } from "@/lib/referrals/referral-milestones";

import {
  projectBusinessWorkflowContextToOrdoCard,
  projectAssetCatalogEntryToOrdoCard,
  projectContentCampaignToOrdoCard,
  projectContentItemToOrdoCard,
  projectJobSnapshotToOrdoCard,
  projectMediaWorkflowToOrdoCard,
  projectOfferToOrdoCard,
  projectPersonToOrdoCard,
  projectReferralActivityToOrdoCard,
  projectReferralLinkToOrdoCard,
  projectTrackedLinkToOrdoCard,
} from "@/lib/ordo-cards";
import { formatStableUtcShortDateTime } from "@/lib/format/stable-date";
import { formatOfferPrice } from "@/lib/offers/offer-format";
import { buildTrackedLinkPath, buildTrackedLinkQrPath } from "@/lib/tracked-links/tracked-link-origin";
import type {
  OrdoCard,
  OrdoCardAction,
  OrdoSourceRef,
} from "@/lib/ordo-cards";

import {
  businessConversationDetailHref,
  businessOfferDetailHref,
  businessPersonDetailHref,
  businessReferralDetailHref,
  studioCampaignDetailHref,
  studioContentDetailHref,
  studioMediaDetailHref,
  studioWorkflowDetailHref,
} from "./ordo-detail-routes";
import type {
  OrdoDetailAdminDiagnosticLink,
  OrdoDetailBadge,
  OrdoDetailFact,
  OrdoDetailLensModel,
  OrdoDetailLink,
  OrdoDetailTimelineItem,
  OrdoObjectDetailModel,
} from "./ordo-detail-types";

function compactFacts(facts: Array<OrdoDetailFact | null | undefined>): OrdoDetailFact[] {
  return facts.filter((fact): fact is OrdoDetailFact => Boolean(fact));
}

function compactRefs(refs: Array<OrdoSourceRef | null | undefined>): OrdoSourceRef[] {
  return refs.filter((ref): ref is OrdoSourceRef => Boolean(ref));
}

function compactCards(cards: Array<OrdoCard | null | undefined>): OrdoCard[] {
  return cards.filter((card): card is OrdoCard => Boolean(card));
}

const ADMIN_ONLY_SOURCE_KINDS = new Set<OrdoSourceRef["sourceKind"]>([
  "job",
  "job_event",
  "operation",
  "operation_event",
]);

const ADMIN_ONLY_HREF_PREFIXES = [
  "/jobs",
  "/operations",
  "/admin",
  "/factory",
  "/api/",
  "/my/media",
];

function ownerSafeHref(ref: OrdoSourceRef): string | undefined {
  if (!ref.href || ADMIN_ONLY_SOURCE_KINDS.has(ref.sourceKind)) {
    return undefined;
  }

  if (ADMIN_ONLY_HREF_PREFIXES.some((prefix) => ref.href?.startsWith(prefix))) {
    return undefined;
  }

  return ref.href;
}

function sourceKindTitle(sourceKind: OrdoSourceRef["sourceKind"]): string {
  return sourceKind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function linkFromSourceRef(ref: OrdoSourceRef, group: string): OrdoDetailLink {
  const href = ownerSafeHref(ref);

  return {
    id: `${group}:${ref.sourceKind}:${ref.sourceId}`,
    label: ref.label ?? sourceKindTitle(ref.sourceKind),
    ...(href ? { href } : {}),
    ...(!href ? { unavailableReason: "Available only from an authorized source surface." } : {}),
  };
}

function linksFromRefs(refs: readonly OrdoSourceRef[], group: string): OrdoDetailLink[] {
  const seen = new Set<string>();
  const result: OrdoDetailLink[] = [];

  for (const ref of refs) {
    const key = `${ref.sourceKind}:${ref.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(linkFromSourceRef(ref, group));
  }

  return result;
}

function badgeToneForStatus(status: string): OrdoDetailBadge["tone"] {
  const normalized = status.toLowerCase();
  if (["succeeded", "ready", "published", "active"].includes(normalized)) {
    return "good";
  }
  if (["running", "queued", "in motion"].includes(normalized)) {
    return "active";
  }
  if (["needs_review", "needs review", "blocked", "draft"].includes(normalized)) {
    return "warn";
  }
  if (["failed", "archived", "canceled"].includes(normalized)) {
    return "bad";
  }
  return "neutral";
}

function badgesForCard(card: OrdoCard, extra: Array<OrdoDetailBadge | null | undefined> = []): OrdoDetailBadge[] {
  return [
    { id: "kind", label: card.kind.replace(/_/g, " "), tone: "neutral" },
    { id: "status", label: card.status.replace(/_/g, " "), tone: badgeToneForStatus(card.status) },
    ...extra.filter((item): item is OrdoDetailBadge => Boolean(item)),
  ];
}

function headerFactsForCard(card: OrdoCard, extra: Array<OrdoDetailFact | null | undefined> = []): OrdoDetailFact[] {
  return compactFacts([
    fact("state", "Current state", card.status.replace(/_/g, " ")),
    fact("updated", "Updated", formatStableUtcShortDateTime(card.updatedAt) ?? card.updatedAt),
    ...extra,
  ]);
}

function actionsForCard(card: OrdoCard): OrdoCardAction[] {
  return compactActions(card);
}

function adminDiagnosticLink(
  label: string,
  href: string | undefined,
  canViewAdminDiagnostics: boolean | undefined,
  summary?: string,
): OrdoDetailAdminDiagnosticLink | null {
  if (!href || !canViewAdminDiagnostics) {
    return null;
  }

  return { label, href, ...(summary ? { summary } : {}) };
}

function sourceRef(
  sourceKind: OrdoSourceRef["sourceKind"],
  sourceId: string,
  label: string,
  href?: string,
): OrdoSourceRef {
  return {
    sourceKind,
    sourceId,
    label,
    ...(href ? { href } : {}),
  };
}

function fact(
  id: string,
  label: string,
  value: string | number | null | undefined,
  source?: OrdoSourceRef,
): OrdoDetailFact | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return {
    id,
    label,
    value: String(value),
    ...(source ? { sourceRef: source } : {}),
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function lens(
  lensKey: OrdoDetailLens,
  label: string,
  input: Omit<OrdoDetailLensModel, "lens" | "label"> = {},
): OrdoDetailLensModel {
  return {
    lens: lensKey,
    label,
    ...input,
  };
}

function jobHistoryToTimeline(history: readonly JobHistoryEntry[]): OrdoDetailTimelineItem[] {
  return history.map((entry) => ({
    id: entry.id,
    label: entry.eventType.replace(/_/g, " "),
    occurredAt: entry.createdAt,
    summary: entry.part.label ?? entry.part.status,
    sourceRef: sourceRef("job_event", entry.id, entry.eventType, `/jobs?jobId=${encodeURIComponent(entry.jobId)}`),
  }));
}

function workflowStepsToTimeline(workflow: CanonicalMediaWorkflowSnapshot): OrdoDetailTimelineItem[] {
  return workflow.steps.map((step) => ({
    id: step.stepId,
    label: step.label,
    occurredAt: workflow.updatedAt,
    summary: `${step.status}${step.assetId ? ` - ${step.assetId}` : ""}`,
    sourceRef: step.jobId
      ? sourceRef("job", step.jobId, "Step job", `/jobs?jobId=${encodeURIComponent(step.jobId)}`)
      : sourceRef("media_workflow", workflow.workflowId, "Media workflow"),
  }));
}

function referralActivityToTimeline(items: readonly ReferralActivityItem[]): OrdoDetailTimelineItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.title,
    occurredAt: item.occurredAt,
    summary: item.description,
    sourceRef: sourceRef("referral_event", item.id, item.milestone, businessReferralDetailHref(item.referralCode)),
  }));
}

function timelineFromContext(context: BusinessWorkflowContext): OrdoDetailTimelineItem[] {
  const lifecycle = context.lifecycleRefs.map((ref) => ({
    id: ref.lifecycleId,
    label: ref.label,
    occurredAt: ref.evidenceRefs[0]?.observedAt ?? context.updatedAt,
    summary: ref.status.replace(/_/g, " "),
    sourceRef: sourceRef("business_workflow_context", context.id, "Lifecycle"),
  }));

  const notifications = context.notificationRefs.map((ref) => ({
    id: ref.notificationId,
    label: `${ref.channel} notification`,
    occurredAt: ref.evidenceRefs[0]?.observedAt ?? context.updatedAt,
    summary: ref.status,
    sourceRef: sourceRef("business_workflow_context", context.id, "Notification"),
  }));

  const health = context.healthRefs.map((ref) => ({
    id: ref.id,
    label: ref.label,
    occurredAt: context.updatedAt,
    summary: ref.severity,
    sourceRef: sourceRef("business_workflow_context", context.id, "Health"),
  }));

  return [...lifecycle, ...notifications, ...health];
}

export function projectMediaAssetToOrdoDetail(input: {
  entry: AssetCatalogEntry;
  producingJob?: CanonicalJobSnapshot | null;
  jobHistory?: readonly JobHistoryEntry[];
  workflow?: CanonicalMediaWorkflowSnapshot | null;
  canViewAdminDiagnostics?: boolean;
}): OrdoObjectDetailModel {
  const { entry, producingJob = null, workflow = null } = input;
  const jobHistory = input.jobHistory ?? [];
  const primaryCard = projectAssetCatalogEntryToOrdoCard(entry);
  const previewRef = sourceRef(entry.sourceType, entry.assetId, entry.sourceType === "blog_asset" ? "Blog asset" : "User file", `/api/user-files/${encodeURIComponent(entry.assetId)}`);
  const workflowRef = workflow
    ? sourceRef("media_workflow", workflow.workflowId, "Media workflow", studioWorkflowDetailHref(workflow.workflowId))
    : null;
  const jobRef = entry.producedByJobId
    ? sourceRef("job", entry.producedByJobId, "Producing job", `/jobs?jobId=${encodeURIComponent(entry.producedByJobId)}`)
    : null;
  const conversationRef = entry.conversationId
    ? sourceRef("conversation", entry.conversationId, "Conversation", businessConversationDetailHref(entry.conversationId))
    : null;

  const dimensions = typeof entry.width === "number" && typeof entry.height === "number"
    ? `${entry.width}x${entry.height}`
    : null;
  const duration = typeof entry.durationSeconds === "number"
    ? formatDuration(entry.durationSeconds)
    : null;
  const relatedCards = compactCards([
    workflow ? projectMediaWorkflowToOrdoCard(workflow) : null,
    input.canViewAdminDiagnostics && producingJob ? projectJobSnapshotToOrdoCard(producingJob) : null,
  ]);
  const productionLabel = entry.producedByJobId ? "Recorded production work" : null;
  const provenanceFacts = compactFacts([
    fact("source-type", "Source type", entry.sourceType, previewRef),
    fact("source", "Source", entry.source),
    fact("retention", "Retention", entry.retentionClass),
    fact("tool", "Tool", entry.toolName),
    fact("conversation", "Conversation", entry.conversationId, conversationRef ?? undefined),
    fact("producing-work", "Producing work", productionLabel, jobRef ?? undefined),
    fact("workflow", "Workflow", workflow?.workflowId, workflowRef ?? undefined),
    fact("materialization", "Materialization", entry.materializationKey),
    fact("derivative", "Derivative of", entry.derivativeOfAssetId),
  ]);
  const overviewFacts = compactFacts([
    fact("asset", "Asset", entry.label || entry.fileName, primaryCard.sourceRefs[0]),
    fact("kind", "Kind", entry.kind),
    fact("status", "Status", entry.status),
    fact("mime", "MIME type", entry.mimeType),
    fact("dimensions", "Dimensions", dimensions),
    fact("duration", "Duration", duration),
  ]);
  const historyTimeline = jobHistoryToTimeline(jobHistory);

  return {
    object: {
      kind: "media_asset",
      id: entry.assetId,
      label: entry.label,
      status: entry.status,
      ownerUserId: entry.ownerUserId,
    },
    title: entry.label || entry.fileName,
    summary: `${entry.kind} asset from ${entry.sourceType}.`,
    defaultLens: "provenance",
    availableLenses: ["overview", "provenance", "related", "performance", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "asset-kind", label: entry.kind, tone: "neutral" },
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("type", "Type", entry.kind),
      fact("source", "Source", entry.source),
      fact("conversation", "Conversation", entry.conversationId, conversationRef ?? undefined),
      fact("duration", "Duration", duration),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(compactRefs([previewRef, conversationRef]), "media-source"),
    provenanceLinks: linksFromRefs(compactRefs([workflowRef, jobRef, conversationRef]), "media-provenance"),
    sourceRefs: compactRefs([...primaryCard.sourceRefs, previewRef, conversationRef]),
    provenanceRefs: compactRefs([...primaryCard.provenanceRefs, workflowRef, jobRef, conversationRef]),
    relatedCards,
    adminDiagnostic: adminDiagnosticLink(
      "Open diagnostics",
      primaryCard.diagnosticHref,
      input.canViewAdminDiagnostics,
      "Raw job and media diagnostics are restricted to authorized operators.",
    ),
    diagnosticHref: primaryCard.diagnosticHref,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        summary: "Current asset state and preview details.",
        facts: overviewFacts,
        actions: compactActions(primaryCard),
      }),
      lens("provenance", "Provenance", {
        summary: "Real recorded lineage for this asset.",
        facts: provenanceFacts,
        timeline: historyTimeline,
        emptyState: provenanceFacts.some((item) => item.id === "producing-job" || item.id === "workflow")
          ? undefined
          : "This asset is in the catalog, but no producing workflow was recorded.",
      }),
      lens("related", "Related", {
        summary: "Connected workflow and job records.",
        cards: relatedCards,
        emptyState: "No related workflow or job card is available for this asset.",
      }),
      lens("performance", "Performance", {
        emptyState: "Media performance metrics are not recorded yet.",
      }),
      lens("activity", "Activity", {
        summary: "Owner-visible durable activity related to this asset.",
        timeline: historyTimeline,
        emptyState: "No durable job history is available for this asset.",
      }),
    ],
  };
}

export function projectWorkflowRunToOrdoDetail(
  workflow: CanonicalMediaWorkflowSnapshot,
  options: { canViewAdminDiagnostics?: boolean } = {},
): OrdoObjectDetailModel {
  const primaryCard = projectMediaWorkflowToOrdoCard(workflow);
  const relatedCards = options.canViewAdminDiagnostics
    ? workflow.linkedJobs.map(projectJobSnapshotToOrdoCard)
    : [];
  const operationRef = workflow.operation
    ? sourceRef("operation", workflow.operation.operationId, "Operation", `/operations/${encodeURIComponent(workflow.operation.operationId)}`)
    : null;
  const finalAssetRef = workflow.finalArtifact
    ? sourceRef("user_file", workflow.finalArtifact.assetId, "Final artifact", studioMediaDetailHref(workflow.finalArtifact.assetId))
    : null;
  const overviewFacts = compactFacts([
    fact("workflow-id", "Workflow ID", workflow.workflowId, primaryCard.sourceRefs[0]),
    fact("deliverable", "Deliverable", workflow.requestedDeliverable),
    fact("status", "Status", workflow.status),
    fact("stage", "Stage", workflow.stage.label),
    fact("conversation", "Conversation", workflow.conversationId, sourceRef("conversation", workflow.conversationId, "Conversation", businessConversationDetailHref(workflow.conversationId))),
    fact("final-artifact", "Final artifact", workflow.finalArtifact?.assetId, finalAssetRef ?? undefined),
    fact("operation", "Operation", workflow.operation?.operationId, operationRef ?? undefined),
  ]);
  const timeline = workflowStepsToTimeline(workflow);
  const actions = workflow.operation?.availableActions.map((action) => ({
    id: action.id,
    label: action.label,
    href: `/operations/${encodeURIComponent(action.operationId)}`,
    actionType: action.actionType,
    requiresConfirmation: action.confirmPolicy !== "none",
    confirmPolicy: action.confirmPolicy,
    confirmationText: action.confirmationText,
    riskLevel: action.riskLevel,
    allowedRoles: action.allowedRoles,
    allowedStatuses: action.allowedStatuses,
    expiresAt: action.expiresAt,
    disabled: !action.enabled,
    disabledReason: action.disabledReason,
    tone: action.riskLevel === "destructive" ? "destructive" as const : "secondary" as const,
  })) ?? [];

  return {
    object: {
      kind: "workflow_run",
      id: workflow.workflowId,
      label: workflow.title,
      status: workflow.status,
      ownerUserId: workflow.userId,
    },
    title: workflow.title,
    summary: workflow.stage.label,
    defaultLens: "provenance",
    availableLenses: ["overview", "provenance", "actions", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "deliverable", label: workflow.requestedDeliverable, tone: "neutral" },
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("deliverable", "Deliverable", workflow.requestedDeliverable),
      fact("stage", "Stage", workflow.stage.label),
      fact("conversation", "Conversation", workflow.conversationId, sourceRef("conversation", workflow.conversationId, "Conversation", businessConversationDetailHref(workflow.conversationId))),
      fact("final-artifact", "Final artifact", workflow.finalArtifact?.assetId, finalAssetRef ?? undefined),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(primaryCard.sourceRefs, "workflow-source"),
    provenanceLinks: linksFromRefs(compactRefs([...primaryCard.provenanceRefs, operationRef, finalAssetRef]), "workflow-provenance"),
    sourceRefs: primaryCard.sourceRefs,
    provenanceRefs: compactRefs([...primaryCard.provenanceRefs, operationRef, finalAssetRef]),
    relatedCards,
    adminDiagnostic: adminDiagnosticLink(
      "Open diagnostics",
      primaryCard.diagnosticHref,
      options.canViewAdminDiagnostics,
      "Raw linked job diagnostics are restricted to authorized operators.",
    ),
    diagnosticHref: primaryCard.diagnosticHref,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        summary: "Current workflow state and deliverable.",
        facts: overviewFacts,
      }),
      lens("provenance", "Provenance", {
        summary: "Workflow steps, linked jobs, and final artifact.",
        facts: overviewFacts,
        timeline,
      }),
      lens("actions", "Actions", {
        summary: "Available governed actions for the linked operation.",
        actions,
        emptyState: "No workflow actions are currently available.",
      }),
      lens("related", "Related", {
        cards: relatedCards,
        emptyState: "No linked job cards are available for this workflow.",
      }),
      lens("activity", "Activity", {
        timeline,
        emptyState: "No workflow step activity is available.",
      }),
    ],
  };
}

function contentTimeline(item: ContentCampaignItem): OrdoDetailTimelineItem[] {
  const published = item.post.publishedAt
    ? [{
        id: `${item.post.id}:published`,
        label: "Published",
        occurredAt: item.post.publishedAt,
        summary: "Public feed item became shareable.",
        sourceRef: sourceRef("blog_post", item.post.id, "Content record", item.publicHref ?? studioContentDetailHref(item.post.id)),
      }]
    : [];

  return [
    {
      id: `${item.post.id}:created`,
      label: "Created",
      occurredAt: item.post.createdAt,
      summary: "Content record created.",
      sourceRef: sourceRef("blog_post", item.post.id, "Content record", studioContentDetailHref(item.post.id)),
    },
    ...published,
    ...item.artifacts.map((artifact) => ({
      id: artifact.id,
      label: artifact.artifactType.replace(/_/g, " "),
      occurredAt: artifact.createdAt,
      summary: "Recorded production or QA artifact.",
      sourceRef: sourceRef("blog_post_artifact", artifact.id, artifact.artifactType),
    })),
    ...item.trackedLinks.map(({ link }) => ({
      id: link.id,
      label: "Tracked link",
      occurredAt: link.createdAt,
      summary: `${link.label} is ${link.status}.`,
      sourceRef: sourceRef("tracked_link", link.id, link.label, `/t/${encodeURIComponent(link.code)}`),
    })),
  ].sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
}

export function projectContentItemToOrdoDetail(item: ContentCampaignItem): OrdoObjectDetailModel {
  const primaryCard = projectContentItemToOrdoCard(item);
  const publicRef = item.publicHref
    ? sourceRef("blog_post", item.post.id, "Public feed item", item.publicHref)
    : null;
  const contentRef = sourceRef("blog_post", item.post.id, "Content record", studioContentDetailHref(item.post.id));
  const heroRef = item.heroAsset
    ? sourceRef("blog_asset", item.heroAsset.id, "Hero image", `/api/blog/assets/${encodeURIComponent(item.heroAsset.id)}`)
    : null;
  const trackedLinkCards = item.trackedLinks.map(projectTrackedLinkToOrdoCard);
  const timeline = contentTimeline(item);

  return {
    object: {
      kind: "content_item",
      id: item.post.id,
      label: item.post.title,
      status: item.post.status,
      ownerUserId: item.post.createdByUserId,
    },
    title: item.post.title,
    summary: item.post.description || item.post.standfirst || "Content item.",
    defaultLens: item.post.status === "published" ? "performance" : "provenance",
    availableLenses: ["overview", "provenance", "performance", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "visibility", label: item.isPublic ? "public" : "private", tone: item.isPublic ? "good" : "neutral" },
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("visibility", "Visibility", item.post.status === "published" ? "public" : "owner draft"),
      fact("section", "Section", item.post.section),
      fact("public-url", "Public URL", item.publicHref, publicRef ?? undefined),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(compactRefs([contentRef, publicRef]), "content-source"),
    provenanceLinks: linksFromRefs(compactRefs([...primaryCard.provenanceRefs, heroRef, publicRef]), "content-provenance"),
    sourceRefs: compactRefs([contentRef, publicRef]),
    provenanceRefs: compactRefs([...primaryCard.provenanceRefs, heroRef, publicRef]),
    relatedCards: trackedLinkCards,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        summary: "Current publication state and owner actions for this content.",
        facts: compactFacts([
          fact("status", "Status", item.post.status, contentRef),
          fact("visibility", "Visibility", item.post.status === "published" ? "public" : "owner draft"),
          fact("section", "Section", item.post.section),
          fact("public-url", "Public URL", item.publicHref, publicRef ?? undefined),
          fact("hero", "Hero image", item.heroAsset?.id, heroRef ?? undefined),
        ]),
        actions: compactActions(primaryCard),
      }),
      lens("provenance", "Provenance", {
        summary: "Recorded content, asset, QA, and publication evidence. Raw generation payloads stay out of the owner UI.",
        facts: compactFacts([
          fact("content-record", "Content record", item.post.id, contentRef),
          fact("assets", "Assets", item.assets.length),
          fact("artifacts", "Artifacts", item.artifacts.length),
          fact("created-by", "Created by", item.post.createdByUserId),
          fact("published-by", "Published by", item.post.publishedByUserId),
        ]),
        timeline,
      }),
      lens("performance", "Performance", {
        summary: item.performance.links > 0
          ? "Measured visits and downstream actions from tracked links for this content."
          : "No tracked link performance has been recorded for this content yet.",
        facts: item.performance.links > 0
          ? compactFacts([
              fact("links", "Tracked links", item.performance.links),
              fact("visits", "Visits", item.performance.visits),
              fact("chats", "Chats", item.performance.chats),
              fact("signups", "Signups", item.performance.signups),
              fact("choices", "Offer choices", item.performance.offerChoices),
              fact("purchases", "Simulated purchases", item.performance.simulatedPurchases),
            ])
          : [],
        emptyState: item.performance.links > 0 ? undefined : "Create a public tracked link before performance can be measured.",
      }),
      lens("related", "Related", {
        summary: "Share links and QR cards attached to this content.",
        cards: trackedLinkCards,
        emptyState: "No tracked links or QR codes are attached to this content yet.",
      }),
      lens("activity", "Activity", {
        timeline,
        emptyState: "No content activity has been recorded yet.",
      }),
    ],
  };
}

function campaignTimeline(campaign: ContentCampaignReadModel): OrdoDetailTimelineItem[] {
  const itemEvents = campaign.items.flatMap(contentTimeline);
  const offerEvents = campaign.offers.map((offer) => ({
    id: `offer:${offer.id}`,
    label: "Offer available",
    occurredAt: offer.publishedAt ?? offer.updatedAt,
    summary: offer.title,
    sourceRef: sourceRef("offer", offer.id, offer.title, `/offers?offerId=${encodeURIComponent(offer.id)}`),
  }));

  return [...itemEvents, ...offerEvents]
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
    .slice(-30);
}

export function projectContentCampaignToOrdoDetail(
  campaign: ContentCampaignReadModel,
): OrdoObjectDetailModel {
  const primaryCard = projectContentCampaignToOrdoCard(campaign);
  const contentCards = campaign.items.map(projectContentItemToOrdoCard);
  const offerCards = campaign.offers.map(projectOfferToOrdoCard);
  const linkCards = campaign.trackedLinks
    .filter((link) => link.link.targetKind !== "content_item")
    .slice(0, 6)
    .map(projectTrackedLinkToOrdoCard);
  const relatedCards = [...contentCards.slice(0, 4), ...offerCards.slice(0, 2), ...linkCards.slice(0, 2)];
  const timeline = campaignTimeline(campaign);
  const detailHref = studioCampaignDetailHref(campaign.id);

  return {
    object: {
      kind: "campaign",
      id: campaign.id,
      label: campaign.title,
      status: "active",
      ownerUserId: campaign.ownerUserId,
    },
    title: campaign.title,
    summary: campaign.summary,
    defaultLens: "performance",
    availableLenses: ["overview", "performance", "provenance", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("content", "Content items", campaign.items.length),
      fact("offers", "Public offers", campaign.offers.length),
      fact("links", "Tracked links", campaign.performance.links),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(primaryCard.sourceRefs, "campaign-source"),
    provenanceLinks: linksFromRefs(primaryCard.provenanceRefs, "campaign-provenance"),
    sourceRefs: primaryCard.sourceRefs,
    provenanceRefs: primaryCard.provenanceRefs,
    relatedCards,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        summary: "A read-model campaign that groups the owner's content, public offers, and tracked links.",
        facts: compactFacts([
          fact("campaign", "Campaign", campaign.id, sourceRef("campaign", campaign.id, "Campaign read model", detailHref)),
          fact("content", "Content items", campaign.items.length),
          fact("published-content", "Published content", campaign.items.filter((item) => item.post.status === "published").length),
          fact("offers", "Public offers", campaign.offers.length),
          fact("links", "Tracked links", campaign.performance.links),
        ]),
        actions: compactActions(primaryCard),
      }),
      lens("performance", "Performance", {
        summary: campaign.performance.links > 0
          ? "Measured business motion from the campaign's public links."
          : "No campaign link performance has been recorded yet.",
        facts: campaign.performance.links > 0
          ? compactFacts([
              fact("visits", "Visits", campaign.performance.visits),
              fact("chats", "Chats", campaign.performance.chats),
              fact("signups", "Signups", campaign.performance.signups),
              fact("choices", "Offer choices", campaign.performance.offerChoices),
              fact("purchases", "Simulated purchases", campaign.performance.simulatedPurchases),
              fact("conversions", "Conversions", campaign.performance.conversions),
            ])
          : [],
        emptyState: campaign.performance.links > 0
          ? undefined
          : "Publish content and create tracked links before campaign performance can be measured.",
      }),
      lens("provenance", "Provenance", {
        summary: "The campaign is derived from durable content, offer, and tracked-link records.",
        timeline,
      }),
      lens("related", "Related", {
        cards: relatedCards,
        emptyState: "No related content, offers, or links are available yet.",
      }),
      lens("activity", "Activity", {
        timeline,
        emptyState: "No campaign activity has been recorded yet.",
      }),
    ],
  };
}

const OFFER_EVENT_LABELS: Record<OfferEvent["eventType"], string> = {
  created: "Offer created",
  updated: "Offer updated",
  published: "Offer published",
  archived: "Offer archived",
  viewed: "Offer viewed",
  chosen: "Offer accepted",
  sent_private: "Private offer sent",
  purchase_simulated: "Purchase simulated",
};

function offerEventTimeline(events: readonly OfferEvent[]): OrdoDetailTimelineItem[] {
  return [...events]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .map((event) => {
      const conversationRef = event.conversationId
        ? sourceRef("conversation", event.conversationId, "Conversation", businessConversationDetailHref(event.conversationId))
        : null;
      const trackedLinkRef = event.trackedLinkId
        ? sourceRef("tracked_link", event.trackedLinkId, "Tracked link")
        : null;
      const source = conversationRef ?? trackedLinkRef ?? sourceRef("offer_event", event.id, "Offer event");

      return {
        id: event.id,
        label: OFFER_EVENT_LABELS[event.eventType],
        occurredAt: event.createdAt,
        summary: event.personRef ? `Recorded for ${event.personRef}.` : "Recorded offer event.",
        sourceRef: source,
        sourceActionLabel: conversationRef ? "Open conversation" : trackedLinkRef ? "View link" : "View evidence",
      };
    });
}

function trackedLinkPerformanceFacts(trackedLinks: readonly TrackedLinkWithPerformance[]): OrdoDetailFact[] {
  if (trackedLinks.length === 0) {
    return [];
  }

  const totals = trackedLinks.reduce((acc, item) => ({
    visits: acc.visits + item.performance.visits,
    chats: acc.chats + item.performance.chats,
    signups: acc.signups + item.performance.signups,
    offerViews: acc.offerViews + item.performance.offerViews,
    offerChoices: acc.offerChoices + item.performance.offerChoices,
    simulatedPurchases: acc.simulatedPurchases + item.performance.simulatedPurchases,
    conversions: acc.conversions + item.performance.conversions,
  }), {
    visits: 0,
    chats: 0,
    signups: 0,
    offerViews: 0,
    offerChoices: 0,
    simulatedPurchases: 0,
    conversions: 0,
  });

  return compactFacts([
    fact("links", "Tracked links", trackedLinks.length),
    fact("visits", "Visits", totals.visits),
    fact("chats", "Chats", totals.chats),
    fact("offer-views", "Offer views", totals.offerViews),
    fact("offer-choices", "Offer choices", totals.offerChoices),
    fact("simulated-purchases", "Simulated purchases", totals.simulatedPurchases),
    fact("conversions", "Conversions", totals.conversions),
  ]);
}

export function projectOfferToOrdoDetail(input: {
  offer: Offer;
  events?: readonly OfferEvent[];
  trackedLinks?: readonly TrackedLinkWithPerformance[];
}): OrdoObjectDetailModel {
  const { offer } = input;
  const events = input.events ?? [];
  const trackedLinks = input.trackedLinks ?? [];
  const primaryCard = projectOfferToOrdoCard(offer);
  const offerRef = sourceRef("offer", offer.id, offer.title, businessOfferDetailHref(offer.id));
  const publicRef = offer.status === "published" && offer.visibility === "public"
    ? sourceRef("offer", `${offer.id}:public`, "Public offer", `/offers/${encodeURIComponent(offer.slug)}`)
    : null;
  const conversationRef = offer.createdFromConversationId
    ? sourceRef("conversation", offer.createdFromConversationId, "Created from conversation", businessConversationDetailHref(offer.createdFromConversationId))
    : null;
  const eventRefs = events.map((event) => sourceRef("offer_event", event.id, OFFER_EVENT_LABELS[event.eventType]));
  const linkCards = trackedLinks.map(projectTrackedLinkToOrdoCard);
  const timeline = offerEventTimeline(events);
  const performanceFacts = trackedLinkPerformanceFacts(trackedLinks);
  const linkRefs = trackedLinks.map(({ link }) => sourceRef("tracked_link", link.id, link.label, buildTrackedLinkPath(link.code)));

  return {
    object: {
      kind: "offer",
      id: offer.id,
      label: offer.title,
      status: offer.status,
      ownerUserId: offer.ownerUserId,
    },
    title: offer.title,
    summary: offer.summary || offer.promise || "Offer draft awaiting owner review.",
    defaultLens: offer.visibility === "public" ? "performance" : "visibility",
    availableLenses: ["overview", "visibility", "provenance", "performance", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "visibility", label: offer.visibility, tone: offer.visibility === "public" ? "good" : "neutral" },
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("price", "Price", formatOfferPrice(offer)),
      fact("visibility", "Visibility", offer.visibility),
      fact("billing", "Billing", offer.billingKind),
      fact("source", "Source", offer.createdFromConversationId ? "Conversation" : "UI or seed data", conversationRef ?? undefined),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(compactRefs([offerRef, publicRef, conversationRef]), "offer-source"),
    provenanceLinks: linksFromRefs(compactRefs([offerRef, conversationRef, ...eventRefs]), "offer-trail"),
    sourceRefs: compactRefs([offerRef, publicRef, conversationRef]),
    provenanceRefs: compactRefs([...primaryCard.provenanceRefs, offerRef, conversationRef, ...eventRefs]),
    relatedCards: linkCards,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        summary: "Current offer state and owner-safe actions.",
        facts: compactFacts([
          fact("status", "Status", offer.status, offerRef),
          fact("price", "Price", formatOfferPrice(offer)),
          fact("audience", "Audience", offer.audience),
          fact("promise", "Promise", offer.promise),
          fact("cta", "Call to action", offer.ctaLabel),
        ]),
        actions: actionsForCard(primaryCard),
      }),
      lens("visibility", "Visibility", {
        summary: "Public/private availability for this offer.",
        facts: compactFacts([
          fact("visibility", "Visibility", offer.visibility, offerRef),
          fact("status", "Status", offer.status),
          fact("public-page", "Public page", publicRef ? `/offers/${offer.slug}` : null, publicRef ?? undefined),
        ]),
        emptyState: publicRef ? undefined : "This offer has no public offer page yet.",
      }),
      lens("provenance", "Provenance", {
        summary: "Durable offer creation, publication, and buyer motion events.",
        timeline,
        emptyState: timeline.length > 0 ? undefined : "This offer exists, but no offer events have been recorded yet.",
      }),
      lens("performance", "Performance", {
        summary: trackedLinks.length > 0
          ? "Measured motion from tracked links attached to this offer."
          : "No tracked link performance has been recorded for this offer yet.",
        facts: performanceFacts,
        emptyState: trackedLinks.length > 0 ? undefined : "Create or attach a tracked link before performance can be measured.",
      }),
      lens("related", "Related", {
        summary: "Tracked links and QR entry points attached to this offer.",
        cards: linkCards,
        facts: trackedLinks.flatMap(({ link }) => compactFacts([
          fact(`link-${link.id}`, "Tracked link", link.label, sourceRef("tracked_link", link.id, link.label, buildTrackedLinkPath(link.code))),
          fact(`qr-${link.id}`, "QR code", buildTrackedLinkQrPath(link.code), sourceRef("tracked_link", link.id, "QR code", buildTrackedLinkQrPath(link.code))),
        ])),
        emptyState: "No tracked links or QR codes are attached to this offer yet.",
      }),
      lens("activity", "Activity", {
        timeline,
        facts: linkRefs.length > 0 ? compactFacts([fact("link-count", "Tracked links", linkRefs.length)]) : [],
        emptyState: timeline.length > 0 ? undefined : "No offer activity has been recorded yet.",
      }),
    ],
  };
}

interface AdminSystemDetailSection {
  id: string;
  title: string;
  summary: string;
  href: string;
  targetHref: string | null;
  targetLabel: string | null;
  statusLabel: string | null;
  countLabel: string | null;
  iconLabel: string;
}

export function projectAdminSystemSectionToOrdoDetail(input: {
  section: AdminSystemDetailSection;
  canViewAdminDiagnostics?: boolean;
  updatedAt?: string;
}): OrdoObjectDetailModel {
  const { section } = input;
  const updatedAt = input.updatedAt ?? "1970-01-01T00:00:00.000Z";
  const status = section.statusLabel?.toLowerCase() === "review" ? "needs_review" : "succeeded";
  const sectionRef = sourceRef("activity", `system:${section.id}`, "System section", section.href);
  const targetRef = section.targetHref
    ? sourceRef("activity", `system-target:${section.id}`, section.targetLabel ?? section.title, section.targetHref)
    : null;
  const primaryAction = section.targetHref && input.canViewAdminDiagnostics
    ? { id: "open-admin-source", label: section.targetLabel ?? "Open admin source", href: section.targetHref, tone: "primary" as const }
    : { id: "open-admin-source", label: section.targetLabel ?? "Open admin source", disabled: true, disabledReason: "Admin diagnostics require permission.", tone: "secondary" as const };
  const primaryCard: OrdoCard = {
    id: `system:${section.id}`,
    kind: "system",
    objectRef: {
      kind: "system",
      id: section.id,
      label: section.title,
      href: section.href,
    },
    bucket: section.statusLabel?.toLowerCase() === "review" ? "needs_attention" : "history",
    status,
    tone: section.statusLabel?.toLowerCase() === "review" ? "warn" : "good",
    title: section.title,
    summary: section.summary,
    updatedAt,
    roleVisibility: ["ADMIN"],
    sourceRefs: compactRefs([sectionRef]),
    provenanceRefs: compactRefs([sectionRef, targetRef]),
    detailHref: section.href,
    diagnosticHref: section.targetHref ?? undefined,
    defaultLens: "actions",
    metrics: compactFacts([
      fact("status", "Status", section.statusLabel),
      fact("count", "Count", section.countLabel),
    ]).map((item) => ({ id: item.id, label: item.label, value: item.value })),
    primaryAction,
  };

  return {
    object: {
      kind: "system",
      id: section.id,
      label: section.title,
      status: section.statusLabel ?? "Available",
    },
    title: section.title,
    summary: section.summary,
    defaultLens: "actions",
    availableLenses: ["overview", "actions", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      section.statusLabel ? { id: "section-status", label: section.statusLabel, tone: badgeToneForStatus(section.statusLabel) } : null,
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("section", "Section", section.title, sectionRef),
      fact("count", "Count", section.countLabel),
    ]),
    primaryActions: input.canViewAdminDiagnostics ? actionsForCard(primaryCard) : [],
    sourceLinks: linksFromRefs(compactRefs([sectionRef]), "system-source"),
    provenanceLinks: linksFromRefs(compactRefs([sectionRef, targetRef]), "system-diagnostics"),
    sourceRefs: primaryCard.sourceRefs,
    provenanceRefs: primaryCard.provenanceRefs,
    relatedCards: [],
    adminDiagnostic: adminDiagnosticLink(
      section.targetLabel ?? "Open admin source",
      section.targetHref ?? undefined,
      input.canViewAdminDiagnostics,
      "Admin diagnostic route for this System section.",
    ),
    diagnosticHref: primaryCard.diagnosticHref,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        facts: compactFacts([
          fact("status", "Status", section.statusLabel ?? "Available"),
          fact("count", "Count", section.countLabel),
          fact("summary", "Summary", section.summary),
        ]),
      }),
      lens("actions", "Actions", {
        actions: input.canViewAdminDiagnostics ? actionsForCard(primaryCard) : [],
        emptyState: input.canViewAdminDiagnostics ? undefined : "Admin diagnostics are unavailable for this viewer.",
      }),
      lens("related", "Related", {
        facts: targetRef ? compactFacts([fact("target", "Target page", section.targetLabel ?? section.targetHref, targetRef)]) : [],
        emptyState: targetRef ? undefined : "No deeper System page is configured for this section yet.",
      }),
      lens("activity", "Activity", {
        emptyState: "System section activity is summarized by the admin loaders for this pass.",
      }),
    ],
  };
}

export function projectReferralToOrdoDetail(input: {
  profile: UserProfileViewModel;
  overview: AffiliateOverviewData | null;
  pipeline: AffiliatePipelineData | null;
  timeseries: readonly AffiliateTimeseriesPoint[];
  recentActivity: readonly ReferralActivityItem[];
  updatedAt?: string;
}): OrdoObjectDetailModel | null {
  const primaryCard = projectReferralLinkToOrdoCard({
    profile: input.profile,
    overview: input.overview,
    pipeline: input.pipeline,
    updatedAt: input.updatedAt,
  });

  if (!primaryCard || !input.profile.referralCode) {
    return null;
  }

  const referralCode = input.profile.referralCode;
  const relatedCards = input.recentActivity.map((item) => projectReferralActivityToOrdoCard(item, input.profile.id));
  const timeline = referralActivityToTimeline(input.recentActivity);
  const performanceFacts = input.overview
    ? compactFacts([
        fact("introductions", "Introductions", input.overview.introductions),
        fact("started-chats", "Started chats", input.overview.startedChats),
        fact("registered", "Registered", input.overview.registered),
        fact("qualified", "Qualified opportunities", input.overview.qualifiedOpportunities),
        fact("credit", "Credit state", input.overview.creditStatusLabel),
        fact("timeseries", "Timeseries points", input.timeseries.length),
      ])
    : [];
  const funnelFacts = [
    ...(input.pipeline?.stages.map((stage) => fact(
      `stage-${stage.stage}`,
      stage.label,
      `${stage.count} (${stage.conversionRate}%)`,
    )) ?? []),
    ...(input.pipeline?.outcomes.map((outcome) => fact(
      `outcome-${outcome.outcome}`,
      outcome.label,
      outcome.count,
    )) ?? []),
  ].filter((item): item is OrdoDetailFact => Boolean(item));

  return {
    object: {
      kind: "tracked_link",
      id: referralCode,
      label: `Referral ${referralCode}`,
      status: "published",
      ownerUserId: input.profile.id,
    },
    title: "Referral QR code",
    summary: input.overview?.narrative ?? `Referral link for ${input.profile.name}.`,
    defaultLens: "performance",
    availableLenses: ["overview", "performance", "funnel", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "affiliate", label: input.profile.affiliateEnabled ? "affiliate" : "referral", tone: input.profile.affiliateEnabled ? "active" : "neutral" },
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("code", "Referral code", referralCode, primaryCard.sourceRefs[0]),
      fact("introductions", "Introductions", input.overview?.introductions),
      fact("qualified", "Qualified", input.overview?.qualifiedOpportunities),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(primaryCard.sourceRefs, "referral-source"),
    provenanceLinks: linksFromRefs(primaryCard.provenanceRefs, "referral-trail"),
    sourceRefs: primaryCard.sourceRefs,
    provenanceRefs: primaryCard.provenanceRefs,
    relatedCards,
    roleVisibility: primaryCard.roleVisibility,
    lenses: [
      lens("overview", "Overview", {
        summary: "Canonical referral link and QR code.",
        facts: compactFacts([
          fact("code", "Referral code", referralCode, primaryCard.sourceRefs[0]),
          fact("url", "Referral URL", input.profile.referralUrl),
          fact("qr", "QR image", input.profile.qrCodeUrl),
        ]),
        actions: compactCards([primaryCard]).flatMap((card) => compactActions(card)),
      }),
      lens("performance", "Performance", {
        summary: input.overview?.narrative ?? "No referral performance has been recorded yet.",
        facts: performanceFacts,
        emptyState: input.overview ? undefined : "No referral performance has been recorded yet.",
      }),
      lens("funnel", "Funnel", {
        summary: "How introductions move toward qualified business outcomes.",
        facts: funnelFacts,
        emptyState: "No referral funnel milestones have been recorded yet.",
      }),
      lens("related", "Related", {
        cards: relatedCards,
        emptyState: "No referral milestone cards are available yet.",
      }),
      lens("activity", "Activity", {
        timeline,
        emptyState: "No referral activity has been recorded yet.",
      }),
    ],
  };
}

function compactActions(card: OrdoCard): OrdoCardAction[] {
  return compactCards([card]).flatMap((item) => [
    item.primaryAction,
    ...(item.secondaryActions ?? []),
  ]).filter((action): action is OrdoCardAction => Boolean(action));
}

function contextRelatedFacts(context: BusinessWorkflowContext): OrdoDetailFact[] {
  return context.relatedRefs.map((ref) => fact(
    `related-${ref.kind}-${ref.id}`,
    ref.kind.replace(/_/g, " "),
    [ref.label, ref.status].filter(Boolean).join(" - ") || ref.id,
  )).filter((item): item is OrdoDetailFact => Boolean(item));
}

function personRelationshipTimeline(person: PersonReadModelItem): OrdoDetailTimelineItem[] {
  return person.relationshipTrail.map((item) => ({
    id: item.id,
    label: item.label,
    occurredAt: item.occurredAt,
    summary: item.summary,
    sourceRef: item.sourceRef,
    sourceActionLabel: item.sourceActionLabel,
  }));
}

function latestPersonTrailDate(
  person: PersonReadModelItem,
  predicate: (item: PersonReadModelItem["relationshipTrail"][number]) => boolean,
): string | null {
  const matchingItems = person.relationshipTrail.filter(predicate);
  if (matchingItems.length === 0) {
    return null;
  }

  return matchingItems.reduce((latest, item) => (
    Date.parse(item.occurredAt) > Date.parse(latest.occurredAt) ? item : latest
  )).occurredAt;
}

function stablePersonDate(value: string | null): string {
  return value ? formatStableUtcShortDateTime(value) ?? "—" : "—";
}

function personIntroducedByFact(person: PersonReadModelItem): OrdoDetailFact {
  const referralCode = person.referralCodes[0];
  if (!referralCode) {
    return { id: "introduced-by", label: "Introduced by", value: "—" };
  }

  return {
    id: "introduced-by",
    label: "Introduced by",
    value: `Referral ${referralCode}`,
    sourceRef: sourceRef("referral", referralCode, "Referral", businessReferralDetailHref(referralCode)),
  };
}

function personHeaderFacts(person: PersonReadModelItem): OrdoDetailFact[] {
  const lastConversationAt = latestPersonTrailDate(person, (item) => (
    item.sourceRef.sourceKind === "conversation" || item.label.toLowerCase().includes("conversation")
  ));

  return [
    personIntroducedByFact(person),
    { id: "came-from", label: "Came from", value: person.sourceLabels.join(" · ") || "—" },
    { id: "last-conversation", label: "Last conversation", value: stablePersonDate(lastConversationAt) },
    { id: "next-follow-up", label: "Next follow-up", value: person.nextAction ?? "—" },
  ];
}

export function projectPersonToOrdoDetail(person: PersonReadModelItem): OrdoObjectDetailModel {
  const primaryCard = projectPersonToOrdoCard(person);
  const href = businessPersonDetailHref(person.id);
  const timeline = personRelationshipTimeline(person);
  const overviewFacts = compactFacts([
    fact("stage", "Stage", person.stageLabel, sourceRef("person", person.id, "Person", href)),
    fact("anonymous", "Anonymous", person.isAnonymous ? "Yes" : "No"),
    fact("next-action", "Next action", person.nextAction),
    fact("conversations", "Conversations", person.conversationIds.length),
  ]);
  const funnelFacts = compactFacts([
    fact("stage", "Current stage", person.stageLabel),
    fact("signals", "Evidence signals", person.relationshipTrail.length),
    fact("offers", "Offers", person.offerIds.length),
    fact("referrals", "Referral links", person.referralCodes.length),
  ]);
  const relatedFacts = compactFacts([
    person.primaryConversationId
      ? fact(
          "primary-conversation",
          "Primary conversation",
          person.primaryConversationId,
          sourceRef("conversation", person.primaryConversationId, "Conversation", businessConversationDetailHref(person.primaryConversationId)),
        )
      : null,
    ...person.leadIds.map((id) => fact(`lead-${id}`, "Lead", id, sourceRef("lead", id, "Lead"))),
    ...person.consultationRequestIds.map((id) => fact(`consultation-${id}`, "Consultation", id, sourceRef("consultation", id, "Consultation"))),
    ...person.dealIds.map((id) => fact(`deal-${id}`, "Deal", id, sourceRef("deal", id, "Deal"))),
    ...person.referralCodes.map((code) => fact(`referral-${code}`, "Referral", code, sourceRef("referral", code, "Referral", businessReferralDetailHref(code)))),
    ...person.offerIds.map((id) => fact(`offer-${id}`, "Offer", id, sourceRef("offer", id, "Offer", `/offers?offerId=${encodeURIComponent(id)}`))),
  ]);

  return {
    object: {
      kind: "person",
      id: person.id,
      label: person.displayName,
      status: person.stageLabel,
      ownerUserId: person.ownerUserId,
    },
    title: person.displayName,
    summary: person.summary,
    defaultLens: "funnel",
    availableLenses: ["overview", "history", "funnel", "related", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "stage", label: person.stageLabel, tone: ["purchased_simulated", "customer"].includes(person.stage) ? "good" : "active" },
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(primaryCard.sourceRefs, "person-source"),
    provenanceLinks: linksFromRefs(primaryCard.provenanceRefs, "person-trail"),
    sourceRefs: primaryCard.sourceRefs,
    provenanceRefs: primaryCard.provenanceRefs,
    relatedCards: [],
    roleVisibility: primaryCard.roleVisibility,
    personHeader: {
      displayName: person.displayName,
      organization: person.organization,
      stageLabel: person.stageLabel,
      primaryConversationHref: person.primaryConversationId
        ? businessConversationDetailHref(person.primaryConversationId)
        : null,
      facts: personHeaderFacts(person),
    },
    lenses: [
      lens("overview", "Overview", {
        facts: overviewFacts,
      }),
      lens("history", "Relationship Trail", {
        summary: "Evidence-backed relationship motion for this person.",
        timeline,
        emptyState: "No relationship trail has been recorded for this person.",
      }),
      lens("funnel", "Funnel", {
        summary: "Current stage and the durable evidence supporting it.",
        facts: funnelFacts,
      }),
      lens("related", "Related", {
        facts: relatedFacts,
        emptyState: "No related conversations, offers, or referral records are visible yet.",
      }),
      lens("activity", "Activity", {
        timeline,
        emptyState: "No owner-visible person activity has been recorded yet.",
      }),
    ],
  };
}

export function projectBusinessConversationToOrdoDetail(input: {
  conversation: Conversation;
  context?: BusinessWorkflowContext | null;
}): OrdoObjectDetailModel {
  const { conversation, context = null } = input;
  const href = businessConversationDetailHref(conversation.id);
  const fallbackCard: OrdoCard = {
    id: `conversation:${conversation.id}`,
    kind: "conversation",
    objectRef: {
      kind: "conversation",
      id: conversation.id,
      label: conversation.title || "Conversation",
      href,
    },
    bucket: "history",
    status: conversation.status === "active" ? "succeeded" : "archived",
    tone: "neutral",
    title: conversation.title || "Conversation",
    summary: `${conversation.messageCount} messages recorded in this conversation.`,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    ownerUserId: conversation.userId,
    roleVisibility: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
    sourceRefs: [sourceRef("conversation", conversation.id, "Conversation", href)],
    provenanceRefs: [sourceRef("conversation", conversation.id, "Conversation", href)],
    detailHref: href,
    defaultLens: context ? "funnel" : "history",
    metrics: [
      { id: "messages", label: "Messages", value: conversation.messageCount },
      { id: "status", label: "Status", value: conversation.status },
    ],
    primaryAction: { id: "open-chat", label: "Open chat", href: `/?conversationId=${encodeURIComponent(conversation.id)}`, tone: "primary" },
  };
  const primaryCard = context ? projectBusinessWorkflowContextToOrdoCard(context) : fallbackCard;
  const timeline = context ? timelineFromContext(context) : [];
  const funnelFacts = context
    ? compactFacts([
        fact("mode", "Mode", context.primaryMode.replace(/_/g, " ")),
        fact("origin", "Origin", context.origin?.label),
        fact("recommended-action", "Recommended action", context.recommendedAction?.label),
        fact("related-count", "Related records", context.relatedRefs.length),
        fact("health-count", "Health notes", context.healthRefs.length),
        ...contextRelatedFacts(context),
      ])
    : [];

  const overviewLens = lens("overview", "Overview", {
    facts: compactFacts([
      fact("conversation", "Conversation", conversation.id, sourceRef("conversation", conversation.id, "Conversation", href)),
      fact("messages", "Messages", conversation.messageCount),
      fact("status", "Status", conversation.status),
      fact("mode", "Business mode", context?.primaryMode.replace(/_/g, " ")),
    ]),
  });
  const funnelOrHistoryLens = context
    ? lens("funnel", "Funnel", {
        summary: "Conversation-scoped business workflow state.",
        facts: funnelFacts,
        timeline,
        emptyState: "No business workflow milestones are available for this conversation.",
      })
    : lens("history", "History", {
        emptyState: "No business workflow context has been recorded for this conversation.",
      });
  const activityLens = lens("activity", "Activity", {
    timeline,
    emptyState: "No owner-visible business activity has been recorded for this conversation.",
  });
  const relatedLens = context
    ? [lens("related", "Related", {
        facts: contextRelatedFacts(context),
        emptyState: "No related business records are visible for this conversation.",
      })]
    : [];

  return {
    object: {
      kind: "conversation",
      id: conversation.id,
      label: conversation.title || "Conversation",
      status: context ? context.primaryMode : conversation.status,
      ownerUserId: conversation.userId,
    },
    title: context?.origin?.label ?? conversation.title ?? "Conversation",
    summary: context?.recommendedAction?.label ?? `${conversation.messageCount} messages recorded in this conversation.`,
    defaultLens: context ? "funnel" : "history",
    availableLenses: context
      ? ["overview", "funnel", "related", "activity"]
      : ["overview", "history", "activity"],
    primaryCard,
    badges: badgesForCard(primaryCard, [
      { id: "conversation-status", label: conversation.status, tone: conversation.status === "active" ? "active" : "neutral" },
    ]),
    headerFacts: headerFactsForCard(primaryCard, [
      fact("messages", "Messages", conversation.messageCount),
      fact("status", "Status", conversation.status),
      fact("mode", "Business mode", context?.primaryMode.replace(/_/g, " ")),
    ]),
    primaryActions: actionsForCard(primaryCard),
    sourceLinks: linksFromRefs(primaryCard.sourceRefs, "conversation-source"),
    provenanceLinks: linksFromRefs(primaryCard.provenanceRefs, "conversation-trail"),
    sourceRefs: primaryCard.sourceRefs,
    provenanceRefs: primaryCard.provenanceRefs,
    relatedCards: [],
    roleVisibility: primaryCard.roleVisibility,
    lenses: [overviewLens, funnelOrHistoryLens, ...relatedLens, activityLens],
  };
}
