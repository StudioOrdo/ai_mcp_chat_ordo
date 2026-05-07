import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import type {
  ContentCampaignItem,
  ContentCampaignReadModel,
} from "@/core/entities/content-campaign";
import { ORDO_OBJECT_KIND_CONTRACTS } from "@/core/entities/ordo-object";
import type { OperationAction, OperationStatus } from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type { OperationSummary } from "@/core/use-cases/operations/OperationRepository";
import type { ActivityItem } from "@/lib/activity/activity-types";
import type {
  ActivityBucket,
  ActivitySourceKind,
} from "@/lib/activity/activity-taxonomy";
import { ACTIVITY_SOURCE_MAP } from "@/lib/activity/activity-taxonomy";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import { hasBlockingWorkflowHealth } from "@/core/entities/business-workflow-context";
import type { Offer } from "@/core/entities/offer";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import type { PersonReadModelItem } from "@/lib/business/people-read-model";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type {
  AffiliateOverviewData,
  AffiliatePipelineData,
} from "@/lib/referrals/referral-analytics";
import type { ReferralActivityItem } from "@/lib/referrals/referral-milestones";
import {
  businessConversationDetailHref,
  businessOfferDetailHref,
  businessPersonDetailHref,
  businessReferralDetailHref,
  studioCampaignDetailHref,
  studioContentDetailHref,
  studioMediaDetailHref,
  studioWorkflowDetailHref,
} from "@/lib/ordo-details/ordo-detail-routes";
import {
  buildTrackedLinkPath,
  buildTrackedLinkQrPath,
} from "@/lib/tracked-links/tracked-link-origin";
import { getBlogAssetUrl } from "@/lib/blog/hero-images";

import type {
  OrdoCard,
  OrdoCardAction,
  OrdoCardBucket,
  OrdoCardMetric,
  OrdoCardPreview,
  OrdoCardStatus,
  OrdoCardTone,
  OrdoObjectRef,
  OrdoSourceRef,
} from "./ordo-card-types";
import { SIGNED_IN_CARD_ROLES } from "./ordo-card-types";

const STAFF_OR_ADMIN_ROLES: readonly RoleName[] = ["STAFF", "ADMIN"];

function compactRefs(refs: Array<OrdoSourceRef | null | undefined>): OrdoSourceRef[] {
  const seen = new Set<string>();
  const result: OrdoSourceRef[] = [];

  for (const ref of refs) {
    if (!ref) {
      continue;
    }
    const key = `${ref.sourceKind}:${ref.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(ref);
  }

  return result;
}

function detailLens(kind: OrdoCard["kind"]): OrdoCard["defaultLens"] {
  return ORDO_OBJECT_KIND_CONTRACTS[kind].defaultLens;
}

function previewKindFromMimeType(mimeType: string): OrdoCardPreview["kind"] {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "document";
}

function previewKindFromArtifactKind(kind: string, mimeType?: string): OrdoCardPreview["kind"] {
  switch (kind) {
    case "audio":
    case "chart":
    case "graph":
    case "image":
    case "video":
      return kind;
    default:
      return mimeType ? previewKindFromMimeType(mimeType) : "document";
  }
}

function previewHrefForAsset(assetId: string): string {
  return `/api/user-files/${encodeURIComponent(assetId)}`;
}

function workflowRunRef(id: string, label: string, href: string): OrdoObjectRef {
  return {
    kind: "workflow_run",
    id,
    label,
    href,
  };
}

function statusTone(status: OrdoCardStatus): OrdoCardTone {
  switch (status) {
    case "queued":
    case "running":
    case "draft":
      return "active";
    case "needs_review":
    case "blocked":
      return "warn";
    case "failed":
    case "unavailable":
      return "bad";
    case "succeeded":
    case "published":
      return "good";
    case "archived":
    case "canceled":
      return "neutral";
  }
}

function offerStatusToCardStatus(status: Offer["status"]): OrdoCardStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "ready":
      return "needs_review";
    case "published":
      return "published";
    case "archived":
      return "archived";
  }
}

function statusBucket(status: OrdoCardStatus): OrdoCardBucket {
  switch (status) {
    case "queued":
    case "running":
      return "in_motion";
    case "needs_review":
    case "blocked":
    case "failed":
    case "unavailable":
      return "needs_attention";
    case "succeeded":
    case "published":
      return "produced";
    case "draft":
    case "archived":
    case "canceled":
      return "history";
  }
}

function jobStatusToCardStatus(status: CanonicalJobSnapshot["status"]): OrdoCardStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "dead_letter":
      return "failed";
    case "canceled":
      return "canceled";
  }
}

function workflowStatusToCardStatus(status: CanonicalMediaWorkflowSnapshot["status"]): OrdoCardStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    case "succeeded":
      return "succeeded";
    case "canceled":
      return "canceled";
  }
}

function operationStatusToCardStatus(status: OperationStatus): OrdoCardStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "awaiting_confirmation":
      return "needs_review";
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "blocked":
      return "blocked";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "canceled";
    case "expired":
      return "archived";
  }
}

function activityBucketToCardBucket(
  bucket: ActivityBucket,
  sourceKind: ActivitySourceKind,
): OrdoCardBucket {
  if (sourceKind === "referral_milestone") {
    return bucket === "needs_attention" ? "needs_attention" : "business_loop";
  }

  switch (bucket) {
    case "needs_attention":
      return "needs_attention";
    case "running":
      return "in_motion";
    case "completed":
      return "produced";
    case "history":
    case "diagnostic":
      return "history";
  }
}

function activityStatusToCardStatus(item: ActivityItem): OrdoCardStatus {
  if (item.bucket === "needs_attention") {
    return item.severity === "critical" ? "failed" : "needs_review";
  }
  if (item.bucket === "running") {
    return "running";
  }
  if (item.bucket === "completed") {
    return "succeeded";
  }
  return "archived";
}

function actionFromOperationAction(action: OperationAction): OrdoCardAction {
  return {
    id: action.id,
    label: action.label,
    actionType: action.actionType,
    disabled: !action.enabled,
    disabledReason: action.disabledReason,
    requiresConfirmation: action.confirmPolicy !== "none",
    confirmPolicy: action.confirmPolicy,
    confirmationText: action.confirmationText ?? null,
    riskLevel: action.riskLevel,
    allowedRoles: action.allowedRoles,
    allowedStatuses: action.allowedStatuses,
    expiresAt: action.expiresAt,
    tone: action.riskLevel === "destructive" ? "destructive" : "secondary",
    payload: {
      operationId: action.operationId,
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      operationRevision: action.operationRevision,
      payloadSchemaKey: action.payloadSchemaKey,
    },
  };
}

function canViewerUseAction(action: OperationAction, viewerRoles?: readonly RoleName[]): boolean {
  if (!viewerRoles) {
    return true;
  }

  return action.allowedRoles.some((role) => viewerRoles.includes(role));
}

function filterActionsForViewer(
  actions: readonly OperationAction[],
  viewerRoles?: readonly RoleName[],
): OperationAction[] {
  return actions.filter((action) => canViewerUseAction(action, viewerRoles));
}

function jobPreview(snapshot: CanonicalJobSnapshot): OrdoCardPreview | undefined {
  const artifact = snapshot.artifactRefs[0];
  if (!artifact) {
    return undefined;
  }

  const href = artifact.assetId ? previewHrefForAsset(artifact.assetId) : artifact.uri;
  return {
    kind: previewKindFromArtifactKind(artifact.kind, artifact.mimeType),
    href,
    label: artifact.label,
    alt: artifact.label,
    mimeType: artifact.mimeType,
  };
}

function artifactRefs(snapshot: CanonicalJobSnapshot): OrdoSourceRef[] {
  return snapshot.artifactRefs.map((artifact, index) => ({
    sourceKind: "artifact",
    sourceId: artifact.assetId ?? artifact.uri ?? `${snapshot.jobId}:artifact:${index}`,
    label: artifact.label,
    href: artifact.assetId ? previewHrefForAsset(artifact.assetId) : artifact.uri,
  }));
}

function materializationRefs(snapshot: CanonicalJobSnapshot): OrdoSourceRef[] {
  return snapshot.materializationRefs.map((materializationId) => ({
    sourceKind: "materialization",
    sourceId: materializationId,
    label: "Materialization",
  }));
}

export function projectJobSnapshotToOrdoCard(snapshot: CanonicalJobSnapshot): OrdoCard {
  const status = jobStatusToCardStatus(snapshot.status);
  const detailHref = `/jobs?jobId=${encodeURIComponent(snapshot.jobId)}`;
  const title = snapshot.title ?? snapshot.label;
  const provenanceRefs = compactRefs([
    { sourceKind: "job", sourceId: snapshot.jobId, label: snapshot.label, href: detailHref },
    snapshot.conversationId
      ? { sourceKind: "conversation", sourceId: snapshot.conversationId, label: "Conversation", href: `/?conversationId=${encodeURIComponent(snapshot.conversationId)}` }
      : null,
    snapshot.resultEnvelope
      ? { sourceKind: "capability_result", sourceId: snapshot.jobId, label: snapshot.resultEnvelope.summary.title ?? snapshot.resultEnvelope.toolName }
      : null,
    ...artifactRefs(snapshot),
    ...materializationRefs(snapshot),
  ]);

  return {
    id: `workflow_run:job:${snapshot.jobId}`,
    kind: "workflow_run",
    objectRef: workflowRunRef(`job:${snapshot.jobId}`, title, detailHref),
    bucket: statusBucket(status),
    status,
    tone: statusTone(status),
    title,
    summary: snapshot.summary ?? snapshot.subtitle ?? snapshot.progressLabel ?? snapshot.label,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    ownerUserId: snapshot.userId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "job", sourceId: snapshot.jobId, label: snapshot.label, href: detailHref }],
    provenanceRefs,
    detailHref,
    diagnosticHref: detailHref,
    defaultLens: detailLens("workflow_run"),
    preview: jobPreview(snapshot),
    metrics: [
      { id: "tool", label: "Tool", value: snapshot.toolName },
      { id: "status", label: "Status", value: snapshot.status },
      ...(typeof snapshot.progressPercent === "number"
        ? [{ id: "progress", label: "Progress", value: snapshot.progressPercent, unit: "%" } satisfies OrdoCardMetric]
        : []),
    ],
    primaryAction: { id: "open-job", label: "Open work", href: detailHref, tone: "primary" },
    secondaryActions: snapshot.conversationId
      ? [{ id: "open-conversation", label: "Open conversation", href: `/?conversationId=${encodeURIComponent(snapshot.conversationId)}` }]
      : [],
  };
}

export interface OrdoCardProjectionOptions {
  viewerRoles?: readonly RoleName[];
}

export function projectOfferToOrdoCard(offer: Offer): OrdoCard {
  const status = offerStatusToCardStatus(offer.status);
  const detailHref = businessOfferDetailHref(offer.id);
  const publicHref = offer.status === "published" && offer.visibility === "public"
    ? `/offers/${encodeURIComponent(offer.slug)}`
    : undefined;
  const priceMetric = formatOfferPriceMetric(offer);

  return {
    id: `offer:${offer.id}`,
    kind: "offer",
    objectRef: {
      kind: "offer",
      id: offer.id,
      label: offer.title,
      href: detailHref,
    },
    bucket: offer.status === "published" ? "business_loop" : statusBucket(status),
    status,
    tone: statusTone(status),
    title: offer.title,
    summary: offer.summary || offer.promise || "Offer draft awaiting owner review.",
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    ownerUserId: offer.ownerUserId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: compactRefs([
      { sourceKind: "offer", sourceId: offer.id, label: offer.title, href: detailHref },
    ]),
    provenanceRefs: compactRefs([
      { sourceKind: "offer", sourceId: offer.id, label: "Offer object", href: detailHref },
      offer.createdFromConversationId
        ? {
            sourceKind: "conversation",
            sourceId: offer.createdFromConversationId,
            label: "Created from conversation",
            href: businessConversationDetailHref(offer.createdFromConversationId),
          }
        : null,
      offer.createdFromMessageId
        ? { sourceKind: "offer_event", sourceId: offer.createdFromMessageId, label: "Source message" }
        : null,
    ]),
    detailHref,
    defaultLens: detailLens("offer"),
    metrics: [
      { id: "price", label: "Price", value: priceMetric },
      { id: "visibility", label: "Visibility", value: offer.visibility },
      { id: "billing", label: "Billing", value: offer.billingKind },
      ...(offer.estimatedMinutes
        ? [{ id: "duration", label: "Time", value: Math.round(offer.estimatedMinutes / 60 * 10) / 10, unit: "h" } satisfies OrdoCardMetric]
        : []),
    ],
    primaryAction: publicHref
      ? { id: "preview-public", label: "Preview public page", href: publicHref, tone: "primary" }
      : { id: "review-offer", label: "Review offer", href: detailHref, tone: "primary" },
    secondaryActions: [
      { id: "edit-offer", label: "Edit details", href: `${detailHref}#edit-offer` },
      ...(offer.status === "published"
        ? [{
            id: "create-qr",
            label: "Create QR/tracked link",
            actionType: "create_tracked_link",
            payload: { targetKind: "offer", targetId: offer.id },
          }]
        : []),
    ],
  };
}

function formatOfferPriceMetric(offer: Offer): string {
  if (offer.billingKind === "free") {
    return "Free";
  }
  if (offer.billingKind === "contact") {
    return "Contact";
  }
  if (typeof offer.priceCents === "number" && offer.priceCents > 0) {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: offer.currency,
      maximumFractionDigits: 0,
    }).format(offer.priceCents / 100);
  }

  return "Needs price";
}

function contentStatusToCardStatus(status: ContentCampaignItem["post"]["status"]): OrdoCardStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "review":
    case "approved":
      return "needs_review";
    case "published":
      return "published";
  }
}

function contentPreview(item: ContentCampaignItem): OrdoCardPreview | undefined {
  const asset = item.heroAsset;
  if (!asset) {
    return undefined;
  }

  return {
    kind: "image",
    href: getBlogAssetUrl(asset.id),
    label: "Hero image",
    alt: asset.altText || item.post.title,
    mimeType: asset.mimeType,
  };
}

function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function contentProvenanceRefs(item: ContentCampaignItem): OrdoSourceRef[] {
  const artifactSourceRefs = item.artifacts.flatMap((artifact) => {
    const jobId = payloadString(artifact.payload, "jobId");
    const workflowId = payloadString(artifact.payload, "workflowId");
    const conversationId = payloadString(artifact.payload, "conversationId");

    return compactRefs([
      jobId
        ? { sourceKind: "job" as const, sourceId: jobId, label: "Producing job", href: `/jobs?jobId=${encodeURIComponent(jobId)}` }
        : null,
      workflowId
        ? { sourceKind: "media_workflow" as const, sourceId: workflowId, label: "Source workflow", href: studioWorkflowDetailHref(workflowId) }
        : null,
      conversationId
        ? { sourceKind: "conversation" as const, sourceId: conversationId, label: "Source conversation", href: businessConversationDetailHref(conversationId) }
        : null,
    ]);
  });

  return compactRefs([
    {
      sourceKind: "blog_post",
      sourceId: item.post.id,
      label: "Content record",
      href: item.detailHref,
    },
    item.heroAsset
      ? {
          sourceKind: "blog_asset",
          sourceId: item.heroAsset.id,
          label: "Hero image",
          href: getBlogAssetUrl(item.heroAsset.id),
        }
      : null,
    ...item.artifacts.map((artifact) => ({
      sourceKind: "blog_post_artifact" as const,
      sourceId: artifact.id,
      label: artifact.artifactType.replace(/_/g, " "),
    })),
    ...artifactSourceRefs,
    ...item.trackedLinks.map(({ link }) => ({
      sourceKind: "tracked_link" as const,
      sourceId: link.id,
      label: link.label,
      href: buildTrackedLinkPath(link.code),
    })),
  ]);
}

export function projectContentItemToOrdoCard(item: ContentCampaignItem): OrdoCard {
  const status = contentStatusToCardStatus(item.post.status);
  const published = item.post.status === "published";
  const publicHref = item.publicHref ?? undefined;
  const linkCount = item.performance.links;

  return {
    id: `content_item:${item.post.id}`,
    kind: "content_item",
    objectRef: {
      kind: "content_item",
      id: item.post.id,
      label: item.post.title,
      href: item.detailHref,
    },
    bucket: published ? "business_loop" : statusBucket(status),
    status,
    tone: statusTone(status),
    title: item.post.title,
    summary: item.post.description || item.post.standfirst || "Content item awaiting review.",
    createdAt: item.post.createdAt,
    updatedAt: item.post.updatedAt,
    ownerUserId: item.post.createdByUserId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [
      { sourceKind: "blog_post", sourceId: item.post.id, label: "Content record", href: item.detailHref },
    ],
    provenanceRefs: contentProvenanceRefs(item),
    detailHref: item.detailHref,
    defaultLens: detailLens("content_item"),
    preview: contentPreview(item),
    metrics: [
      { id: "links", label: "Links", value: linkCount },
      { id: "visits", label: "Visits", value: item.performance.visits },
      { id: "chats", label: "Chats", value: item.performance.chats },
      { id: "signups", label: "Signups", value: item.performance.signups },
    ],
    primaryAction: published && publicHref
      ? { id: "open-feed-item", label: "Open feed item", href: publicHref, tone: "primary" }
      : { id: "review-content", label: "Review content", href: item.detailHref, tone: "primary" },
    secondaryActions: [
      { id: "inspect-content", label: "Inspect", href: item.detailHref },
      ...(published
        ? [{
            id: "create-qr",
            label: "Create QR/tracked link",
            actionType: "create_tracked_link",
            payload: { targetKind: "content_item", targetId: item.post.id },
          } satisfies OrdoCardAction]
        : []),
    ],
  };
}

export function projectContentCampaignToOrdoCard(campaign: ContentCampaignReadModel): OrdoCard {
  const detailHref = studioCampaignDetailHref(campaign.id);
  const updatedAt = campaign.updatedAt ?? new Date(0).toISOString();
  const contentCount = campaign.items.length;
  const publishedCount = campaign.items.filter((item) => item.post.status === "published").length;
  const offerCount = campaign.offers.length;

  return {
    id: `campaign:${campaign.id}`,
    kind: "campaign",
    objectRef: {
      kind: "campaign",
      id: campaign.id,
      label: campaign.title,
      href: detailHref,
    },
    bucket: "business_loop",
    status: "published",
    tone: campaign.performance.visits > 0 || campaign.performance.chats > 0 ? "good" : "neutral",
    title: campaign.title,
    summary: campaign.summary,
    createdAt: campaign.createdAt ?? undefined,
    updatedAt,
    ownerUserId: campaign.ownerUserId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "campaign", sourceId: campaign.id, label: "Campaign read model", href: detailHref }],
    provenanceRefs: compactRefs([
      { sourceKind: "campaign", sourceId: campaign.id, label: "Campaign read model", href: detailHref },
      ...campaign.items.map((item) => ({
        sourceKind: "blog_post" as const,
        sourceId: item.post.id,
        label: item.post.title,
        href: studioContentDetailHref(item.post.id),
      })),
      ...campaign.offers.map((offer) => ({
        sourceKind: "offer" as const,
        sourceId: offer.id,
        label: offer.title,
        href: businessOfferDetailHref(offer.id),
      })),
      ...campaign.trackedLinks.map(({ link }) => ({
        sourceKind: "tracked_link" as const,
        sourceId: link.id,
        label: link.label,
        href: buildTrackedLinkPath(link.code),
      })),
    ]),
    detailHref,
    defaultLens: detailLens("campaign"),
    metrics: [
      { id: "content", label: "Content", value: contentCount },
      { id: "published", label: "Published", value: publishedCount },
      { id: "visits", label: "Visits", value: campaign.performance.visits },
      { id: "chats", label: "Chats", value: campaign.performance.chats },
    ],
    primaryAction: { id: "open-campaign", label: "Open campaign", href: detailHref, tone: "primary" },
    secondaryActions: [
      { id: "open-feed", label: "Open feed", href: "/feed" },
      ...(offerCount > 0 ? [{ id: "open-offers", label: "Open offers", href: "/offers" }] : []),
    ],
  };
}

export function projectMediaWorkflowToOrdoCard(
  snapshot: CanonicalMediaWorkflowSnapshot,
  options: OrdoCardProjectionOptions = {},
): OrdoCard {
  const status = workflowStatusToCardStatus(snapshot.status);
  const detailHref = studioWorkflowDetailHref(snapshot.workflowId);
  const diagnosticHref = `/jobs?sourceKind=media_workflow&sourceId=${encodeURIComponent(snapshot.workflowId)}`;
  const finalArtifactRef = snapshot.finalArtifact
    ? {
        sourceKind: "artifact" as const,
        sourceId: snapshot.finalArtifact.assetId,
        label: `${snapshot.finalArtifact.kind} artifact`,
        href: previewHrefForAsset(snapshot.finalArtifact.assetId),
      }
    : null;
  const operationRef = snapshot.operation
    ? {
        sourceKind: "operation" as const,
        sourceId: snapshot.operation.operationId,
        label: "Operation",
      }
    : null;
  const provenanceRefs = compactRefs([
    { sourceKind: "media_workflow", sourceId: snapshot.workflowId, label: "Media workflow", href: detailHref },
    { sourceKind: "conversation", sourceId: snapshot.conversationId, label: "Conversation", href: businessConversationDetailHref(snapshot.conversationId) },
    operationRef,
    finalArtifactRef,
    ...snapshot.linkedJobIds.map((jobId) => ({
      sourceKind: "job" as const,
      sourceId: jobId,
      label: "Linked job",
      href: `/jobs?jobId=${encodeURIComponent(jobId)}`,
    })),
  ]);
  const operationActions = snapshot.operation
    ? filterActionsForViewer(snapshot.operation.availableActions, options.viewerRoles).map(actionFromOperationAction)
    : [];

  return {
    id: `workflow_run:media_workflow:${snapshot.workflowId}`,
    kind: "workflow_run",
    objectRef: workflowRunRef(`media_workflow:${snapshot.workflowId}`, snapshot.title, detailHref),
    bucket: statusBucket(status),
    status,
    tone: statusTone(status),
    title: snapshot.title,
    summary: snapshot.failure.message ?? snapshot.stage.label,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    ownerUserId: snapshot.userId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "media_workflow", sourceId: snapshot.workflowId, label: "Media workflow", href: detailHref }],
    provenanceRefs,
    detailHref,
    diagnosticHref,
    defaultLens: detailLens("workflow_run"),
    preview: snapshot.finalArtifact
      ? {
          kind: snapshot.finalArtifact.kind,
          href: previewHrefForAsset(snapshot.finalArtifact.assetId),
          label: `${snapshot.finalArtifact.kind} artifact`,
          alt: snapshot.title,
        }
      : undefined,
    metrics: [
      { id: "deliverable", label: "Deliverable", value: snapshot.requestedDeliverable },
      { id: "stage", label: "Stage", value: snapshot.stage.label },
      { id: "linked-jobs", label: "Jobs", value: snapshot.linkedJobIds.length },
      ...(typeof snapshot.stage.progressPercent === "number"
        ? [{ id: "progress", label: "Progress", value: snapshot.stage.progressPercent, unit: "%" } satisfies OrdoCardMetric]
        : []),
    ],
    primaryAction: snapshot.finalArtifact
      ? { id: "open-artifact", label: "Open artifact", href: previewHrefForAsset(snapshot.finalArtifact.assetId), tone: "primary" }
      : { id: "open-workflow", label: "Open workflow", href: detailHref, tone: "primary" },
    secondaryActions: [
      { id: "inspect-workflow", label: "Inspect workflow", href: detailHref },
      ...operationActions,
    ],
  };
}

export function projectAssetCatalogEntryToOrdoCard(entry: AssetCatalogEntry): OrdoCard {
  const detailHref = studioMediaDetailHref(entry.assetId);
  const diagnosticHref = `/my/media?assetId=${encodeURIComponent(entry.assetId)}`;
  const previewHref = previewHrefForAsset(entry.assetId);
  const status: OrdoCardStatus = entry.status === "ready"
    ? "succeeded"
    : entry.status === "failed"
      ? "failed"
      : entry.status === "deleted"
        ? "archived"
        : "queued";

  return {
    id: `media_asset:${entry.assetId}`,
    kind: "media_asset",
    objectRef: {
      kind: "media_asset",
      id: entry.assetId,
      label: entry.label,
      href: detailHref,
    },
    bucket: statusBucket(status),
    status,
    tone: statusTone(status),
    title: entry.label || entry.fileName,
    summary: [entry.kind, entry.sourceType, entry.retentionClass].join(" - "),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    ownerUserId: entry.ownerUserId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [
      { sourceKind: "asset_catalog", sourceId: entry.assetId, label: "Asset catalog", href: detailHref },
      {
        sourceKind: entry.sourceType,
        sourceId: entry.assetId,
        label: entry.sourceType === "blog_asset" ? "Blog asset" : "User file",
        href: previewHref,
      },
    ],
    provenanceRefs: compactRefs([
      { sourceKind: "asset_catalog", sourceId: entry.assetId, label: "Asset catalog", href: detailHref },
      {
        sourceKind: entry.sourceType,
        sourceId: entry.assetId,
        label: entry.sourceType === "blog_asset" ? "Blog asset" : "User file",
        href: previewHref,
      },
      entry.conversationId
        ? { sourceKind: "conversation", sourceId: entry.conversationId, label: "Conversation", href: businessConversationDetailHref(entry.conversationId) }
        : null,
      entry.producedByJobId
        ? { sourceKind: "job", sourceId: entry.producedByJobId, label: "Producing job", href: `/jobs?jobId=${encodeURIComponent(entry.producedByJobId)}` }
        : null,
      entry.materializationKey
        ? { sourceKind: "materialization", sourceId: entry.materializationKey, label: "Materialization" }
        : null,
    ]),
    detailHref,
    diagnosticHref,
    defaultLens: detailLens("media_asset"),
    preview: {
      kind: previewKindFromArtifactKind(entry.kind, entry.mimeType),
      href: previewHref,
      label: entry.fileName,
      alt: entry.label,
      mimeType: entry.mimeType,
    },
    metrics: [
      { id: "type", label: "Type", value: entry.kind },
      { id: "source", label: "Source", value: entry.source },
      ...(typeof entry.durationSeconds === "number"
        ? [{ id: "duration", label: "Duration", value: Math.round(entry.durationSeconds), unit: "sec" } satisfies OrdoCardMetric]
        : []),
      ...(typeof entry.width === "number" && typeof entry.height === "number"
        ? [{ id: "size", label: "Size", value: `${entry.width}x${entry.height}` } satisfies OrdoCardMetric]
        : []),
    ],
    primaryAction: { id: "open-asset", label: "Open asset", href: detailHref, tone: "primary" },
    secondaryActions: [{ id: "preview-asset", label: "Preview", href: previewHref }],
  };
}

export interface ProjectReferralLinkInput {
  profile: UserProfileViewModel;
  overview?: AffiliateOverviewData | null;
  pipeline?: AffiliatePipelineData | null;
  updatedAt?: string;
}

export function projectReferralLinkToOrdoCard(input: ProjectReferralLinkInput): OrdoCard | null {
  const { profile, overview, pipeline } = input;
  if (!profile.affiliateEnabled || !profile.referralCode || !profile.referralUrl || !profile.qrCodeUrl) {
    return null;
  }

  const detailHref = businessReferralDetailHref(profile.referralCode);
  return {
    id: `tracked_link:referral:${profile.referralCode}`,
    kind: "tracked_link",
    objectRef: {
      kind: "tracked_link",
      id: profile.referralCode,
      label: `Referral ${profile.referralCode}`,
      href: detailHref,
    },
    bucket: "business_loop",
    status: "published",
    tone: "good",
    title: "Referral QR code",
    summary: overview?.narrative ?? `Referral link for ${profile.name}.`,
    updatedAt: input.updatedAt ?? new Date(0).toISOString(),
    ownerUserId: profile.id,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "referral", sourceId: profile.referralCode, label: "Referral code", href: detailHref }],
    provenanceRefs: [{ sourceKind: "referral", sourceId: profile.referralCode, label: "Referral code", href: detailHref }],
    detailHref,
    defaultLens: detailLens("tracked_link"),
    preview: {
      kind: "qr",
      href: profile.qrCodeUrl,
      label: "QR code",
      alt: `QR code for ${profile.referralCode}`,
    },
    metrics: [
      { id: "introductions", label: "Introductions", value: overview?.introductions ?? 0 },
      { id: "started-chats", label: "Chats", value: overview?.startedChats ?? 0 },
      { id: "registered", label: "Registered", value: overview?.registered ?? 0 },
      { id: "qualified", label: "Qualified", value: overview?.qualifiedOpportunities ?? 0 },
      ...(pipeline ? [{ id: "pipeline-stages", label: "Stages", value: pipeline.stages.length } satisfies OrdoCardMetric] : []),
    ],
    primaryAction: { id: "open-referrals", label: "Open referral", href: detailHref, tone: "primary" },
    secondaryActions: [
      { id: "open-link", label: "Open link", href: profile.referralUrl },
      { id: "download-qr", label: "Download QR", href: profile.qrCodeUrl, actionType: "download" },
      {
        id: "copy-link",
        label: "Copy link",
        actionType: "copy",
        payload: { text: profile.referralUrl },
      },
    ],
  };
}

export function projectReferralActivityToOrdoCard(
  item: ReferralActivityItem,
  userId: string | null = null,
): OrdoCard {
  const needsAttention = item.milestone === "credit_pending_review";
  const detailHref = item.href || businessReferralDetailHref(item.referralCode);

  return {
    id: `tracked_link:referral_event:${item.id}`,
    kind: "tracked_link",
    objectRef: {
      kind: "tracked_link",
      id: item.referralCode,
      label: `Referral ${item.referralCode}`,
      href: detailHref,
    },
    bucket: needsAttention ? "needs_attention" : "business_loop",
    status: needsAttention ? "needs_review" : "succeeded",
    tone: needsAttention ? "warn" : "good",
    title: item.title,
    summary: item.description,
    updatedAt: item.occurredAt,
    ownerUserId: userId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "referral_event", sourceId: item.id, label: item.milestone, href: detailHref }],
    provenanceRefs: [
      { sourceKind: "referral", sourceId: item.referralId, label: item.referralCode, href: detailHref },
      { sourceKind: "referral_event", sourceId: item.id, label: item.milestone, href: detailHref },
    ],
    detailHref,
    defaultLens: detailLens("tracked_link"),
    primaryAction: { id: "open-referrals", label: "Open referral", href: detailHref, tone: "primary" },
  };
}

export function projectTrackedLinkToOrdoCard(input: TrackedLinkWithPerformance): OrdoCard {
  const { link, performance } = input;
  const trackedHref = buildTrackedLinkPath(link.code);
  const qrHref = buildTrackedLinkQrPath(link.code);
  const detailHref = link.targetKind === "offer"
    ? businessOfferDetailHref(link.targetId)
    : link.targetKind === "content_item"
      ? studioContentDetailHref(link.targetId)
      : trackedHref;
  const status: OrdoCardStatus = link.status === "active" ? "published" : "archived";

  return {
    id: `tracked_link:${link.id}`,
    kind: "tracked_link",
    objectRef: {
      kind: "tracked_link",
      id: link.id,
      label: link.label,
      href: detailHref,
    },
    bucket: link.status === "active" ? "business_loop" : "history",
    status,
    tone: statusTone(status),
    title: link.label,
    summary: `${link.purpose} link for ${link.targetKind.replace(/_/g, " ")}.`,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    ownerUserId: link.ownerUserId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [
      { sourceKind: "tracked_link", sourceId: link.id, label: link.code, href: trackedHref },
    ],
    provenanceRefs: compactRefs([
      { sourceKind: "tracked_link", sourceId: link.id, label: "Tracked link", href: trackedHref },
      {
        sourceKind: link.targetKind === "offer"
          ? "offer"
          : link.targetKind === "content_item"
            ? "blog_post"
            : "tracked_link",
        sourceId: link.targetId,
        label: link.targetKind.replace(/_/g, " "),
        href: detailHref,
      },
      link.createdFromConversationId
        ? {
            sourceKind: "conversation",
            sourceId: link.createdFromConversationId,
            label: "Created from conversation",
            href: businessConversationDetailHref(link.createdFromConversationId),
          }
        : null,
    ]),
    detailHref,
    defaultLens: detailLens("tracked_link"),
    preview: {
      kind: "qr",
      href: qrHref,
      label: "QR code",
      alt: `QR code for ${link.label}`,
    },
    metrics: [
      { id: "visits", label: "Visits", value: performance.visits },
      { id: "chats", label: "Chats", value: performance.chats },
      { id: "choices", label: "Choices", value: performance.offerChoices },
      { id: "purchases", label: "Purchases", value: performance.simulatedPurchases },
    ],
    primaryAction: { id: "open-link", label: "Open tracked link", href: trackedHref, tone: "primary" },
    secondaryActions: [
      { id: "open-target", label: "Open target", href: link.destinationUrl },
      { id: "download-qr", label: "Download QR", href: qrHref, actionType: "download" },
      {
        id: "copy-link",
        label: "Copy link",
        actionType: "copy",
        payload: { text: trackedHref },
      },
    ],
  };
}

function personStageToStatus(stage: PersonReadModelItem["stage"]): OrdoCardStatus {
  switch (stage) {
    case "lost_or_inactive":
      return "needs_review";
    case "offer_chosen":
      return "needs_review";
    case "purchased_simulated":
    case "customer":
      return "succeeded";
    case "anonymous":
    case "known":
    case "interested":
      return "succeeded";
  }
}

export function projectPersonToOrdoCard(person: PersonReadModelItem): OrdoCard {
  const status = personStageToStatus(person.stage);
  const detailHref = businessPersonDetailHref(person.id);
  const stageSummary = person.nextAction
    ? person.nextAction
    : person.summary;

  return {
    id: person.id,
    kind: "person",
    objectRef: {
      kind: "person",
      id: person.id,
      label: person.displayName,
      href: detailHref,
    },
    bucket: status === "needs_review" ? "needs_attention" : "business_loop",
    status,
    tone: status === "needs_review" ? "warn" : "good",
    title: person.displayName,
    summary: stageSummary,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    ownerUserId: person.ownerUserId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: person.sourceRefs,
    provenanceRefs: person.provenanceRefs,
    detailHref,
    defaultLens: detailLens("person"),
    metrics: [
      { id: "stage", label: "Stage", value: person.stageLabel },
      { id: "conversations", label: "Chats", value: person.conversationIds.length },
      { id: "signals", label: "Signals", value: person.relationshipTrail.length },
      { id: "offers", label: "Offers", value: person.offerIds.length },
    ],
    primaryAction: { id: "open-person", label: "Open person", href: detailHref, tone: "primary" },
    secondaryActions: [
      ...(person.primaryConversationId
        ? [{ id: "open-conversation", label: "Open conversation", href: businessConversationDetailHref(person.primaryConversationId) }]
        : []),
    ],
  };
}

function activityObjectKind(sourceKind: ActivitySourceKind): OrdoCard["kind"] | null {
  switch (sourceKind) {
    case "job":
    case "job_event":
    case "media_workflow":
      return "workflow_run";
    case "operation":
    case "operation_event":
      return "operation";
    case "referral_milestone":
      return "tracked_link";
    case "browser_push_delivery":
    case "runtime_audit_log":
    case "provider_log":
    case "route_metric":
    case "mcp_process_log":
    case "admin_signal":
      return null;
  }
}

function sourceKindForActivity(sourceKind: ActivitySourceKind): OrdoSourceRef["sourceKind"] {
  switch (sourceKind) {
    case "job":
    case "job_event":
    case "media_workflow":
    case "operation":
    case "operation_event":
      return sourceKind;
    case "referral_milestone":
      return "referral_event";
    case "browser_push_delivery":
    case "runtime_audit_log":
    case "provider_log":
    case "route_metric":
    case "mcp_process_log":
    case "admin_signal":
      return "activity";
  }
}

export function projectActivityItemToOrdoCard(item: ActivityItem): OrdoCard | null {
  const definition = ACTIVITY_SOURCE_MAP[item.sourceKind];
  if (definition.projectionMode !== "projectable") {
    return null;
  }

  const kind = activityObjectKind(item.sourceKind);
  if (!kind) {
    return null;
  }

  const status = activityStatusToCardStatus(item);
  const sourceRef: OrdoSourceRef = {
    sourceKind: sourceKindForActivity(item.sourceKind),
    sourceId: item.sourceId,
    label: definition.label,
    href: item.href,
  };
  const activityRef: OrdoSourceRef = {
    sourceKind: "activity",
    sourceId: item.id,
    label: "Activity item",
    href: item.href,
  };

  return {
    id: `${kind}:activity:${item.id}`,
    kind,
    objectRef: {
      kind,
      id: `${item.sourceKind}:${item.sourceId}`,
      label: item.title,
      href: item.href,
    },
    bucket: activityBucketToCardBucket(item.bucket, item.sourceKind),
    status,
    tone: item.severity === "critical" ? "bad" : item.severity === "warning" ? "warn" : statusTone(status),
    title: item.title,
    summary: item.summary,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ownerUserId: item.userId,
    roleVisibility: item.roleVisibility,
    sourceRefs: [sourceRef, activityRef],
    provenanceRefs: [sourceRef, activityRef],
    detailHref: item.href,
    diagnosticHref: item.href,
    defaultLens: detailLens(kind),
    metrics: [{ id: "status", label: "Status", value: item.statusLabel }],
    primaryAction: item.primaryAction
      ? {
          id: item.primaryAction.id,
          label: item.primaryAction.label,
          href: item.primaryAction.href ?? item.href,
          actionType: item.primaryAction.actionType,
          tone: item.primaryAction.tone,
          disabled: item.primaryAction.disabled,
          disabledReason: item.primaryAction.disabledReason,
        }
      : { id: "open", label: "Open", href: item.href, tone: "primary" },
    secondaryActions: item.secondaryActions.map((action) => ({
      id: action.id,
      label: action.label,
      href: action.href,
      actionType: action.actionType,
      tone: action.tone,
      disabled: action.disabled,
      disabledReason: action.disabledReason,
    })),
  };
}

export function projectBusinessWorkflowContextToOrdoCard(context: BusinessWorkflowContext): OrdoCard {
  const blocking = hasBlockingWorkflowHealth(context);
  const detailHref = businessConversationDetailHref(context.conversationId);
  const primaryModeLabel = context.primaryMode.replace(/_/g, " ");
  const relatedCount = context.relatedRefs.length;
  const healthLabel = blocking
    ? "Workflow context needs attention."
    : `Conversation is grounded in ${primaryModeLabel} workflow context.`;

  return {
    id: `conversation:business_workflow_context:${context.id}`,
    kind: "conversation",
    objectRef: {
      kind: "conversation",
      id: context.conversationId,
      label: context.origin?.label ?? "Conversation context",
      href: detailHref,
    },
    bucket: blocking ? "needs_attention" : "business_loop",
    status: blocking ? "blocked" : "succeeded",
    tone: blocking ? "warn" : "good",
    title: context.origin?.label ?? "Business workflow context",
    summary: context.recommendedAction?.label ?? healthLabel,
    updatedAt: context.updatedAt,
    ownerUserId: context.userId,
    roleVisibility: SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "business_workflow_context", sourceId: context.id, label: "Business context", href: detailHref }],
    provenanceRefs: compactRefs([
      { sourceKind: "business_workflow_context", sourceId: context.id, label: "Business context", href: detailHref },
      { sourceKind: "conversation", sourceId: context.conversationId, label: "Conversation", href: detailHref },
      ...context.relatedRefs.map((ref) => ({
        sourceKind: "business_workflow_context" as const,
        sourceId: ref.id,
        label: ref.label ?? ref.kind,
      })),
    ]),
    detailHref,
    defaultLens: detailLens("conversation"),
    metrics: [
      { id: "mode", label: "Mode", value: primaryModeLabel },
      { id: "related", label: "Related", value: relatedCount },
      { id: "health", label: "Health", value: context.healthRefs.length },
    ],
    primaryAction: context.recommendedAction
      ? { id: "recommended-action", label: context.recommendedAction.label, href: detailHref, tone: "primary" }
      : { id: "open-conversation", label: "Open conversation", href: detailHref, tone: "primary" },
  };
}

export function projectOperationSummaryToOrdoCard(
  summary: OperationSummary,
  actions: readonly OperationAction[] = [],
  options: OrdoCardProjectionOptions = {},
): OrdoCard {
  const status = operationStatusToCardStatus(summary.status);
  const detailHref = `/operations/${encodeURIComponent(summary.id)}`;
  const viewerActions = filterActionsForViewer(actions, options.viewerRoles);
  const enabledAction = viewerActions.find((action) => action.enabled);
  const projectedActions = viewerActions.map(actionFromOperationAction);
  const secondaryActions = enabledAction
    ? projectedActions.filter((action) => action.id !== enabledAction.id)
    : projectedActions;

  return {
    id: `operation:${summary.id}`,
    kind: "operation",
    objectRef: {
      kind: "operation",
      id: summary.id,
      label: summary.title,
      href: detailHref,
    },
    bucket: statusBucket(status),
    status,
    tone: summary.riskLevel === "destructive" && status !== "succeeded" ? "warn" : statusTone(status),
    title: summary.title,
    summary: summary.summary ?? `${summary.kind} operation is ${summary.status}.`,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    ownerUserId: summary.createdByUserId,
    roleVisibility: summary.visibility === "admin" || summary.visibility === "system" ? STAFF_OR_ADMIN_ROLES : SIGNED_IN_CARD_ROLES,
    sourceRefs: [{ sourceKind: "operation", sourceId: summary.id, label: summary.kind, href: detailHref }],
    provenanceRefs: compactRefs([
      { sourceKind: "operation", sourceId: summary.id, label: summary.kind, href: detailHref },
      summary.conversationId
        ? { sourceKind: "conversation", sourceId: summary.conversationId, label: "Conversation", href: `/?conversationId=${encodeURIComponent(summary.conversationId)}` }
        : null,
    ]),
    detailHref,
    diagnosticHref: detailHref,
    defaultLens: detailLens("operation"),
    metrics: [
      { id: "risk", label: "Risk", value: summary.riskLevel },
      { id: "steps", label: "Steps", value: summary.stepCount },
      { id: "actions", label: "Actions", value: summary.actionCount },
      { id: "artifacts", label: "Artifacts", value: summary.artifactCount },
    ],
    primaryAction: enabledAction
      ? actionFromOperationAction(enabledAction)
      : { id: "open-operation", label: "Open operation", href: detailHref, tone: "primary" },
    secondaryActions,
  };
}
