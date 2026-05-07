import { describe, expect, it } from "vitest";

import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { Conversation } from "@/core/entities/conversation";
import type { ContentCampaignItem, ContentCampaignReadModel } from "@/core/entities/content-campaign";
import type { Offer, OfferEvent } from "@/core/entities/offer";
import type { TrackedLinkWithPerformance } from "@/core/entities/tracked-link";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import type { UserProfileViewModel } from "@/lib/profile/types";

import {
  projectAdminSystemSectionToOrdoDetail,
  projectBusinessConversationToOrdoDetail,
  projectContentCampaignToOrdoDetail,
  projectContentItemToOrdoDetail,
  projectMediaAssetToOrdoDetail,
  projectOfferToOrdoDetail,
  projectPersonToOrdoDetail,
  projectReferralToOrdoDetail,
  projectWorkflowRunToOrdoDetail,
} from "./ordo-detail-projectors";

const now = "2026-05-04T12:00:00.000Z";

function makeAsset(overrides: Partial<AssetCatalogEntry> = {}): AssetCatalogEntry {
  return {
    assetId: "uf_image_1",
    kind: "image",
    ownerUserId: "usr_1",
    sourceType: "user_file",
    status: "ready",
    label: "Hero image",
    fileName: "hero.png",
    mimeType: "image/png",
    source: "generated",
    retentionClass: "durable",
    createdAt: now,
    updatedAt: now,
    conversationId: "conv_1",
    producedByJobId: "job_image",
    materializationKey: "mat_image",
    toolName: "generate_blog_image",
    width: 1200,
    height: 800,
    ...overrides,
  };
}

function makeJob(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_image",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "generate_blog_image",
    label: "Generate image",
    title: "Hero image",
    subtitle: undefined,
    status: "succeeded",
    sequence: 1,
    progressPercent: 100,
    progressLabel: "Complete",
    summary: "Image generated successfully.",
    createdAt: now,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: "usr_1", visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Mission short",
    requestedDeliverable: "video",
    status: "succeeded",
    stage: { key: "succeeded", label: "Video ready", progressPercent: 100 },
    steps: [
      { stepId: "step_image", kind: "generate_image", status: "ready", jobId: "job_image", assetId: "uf_image_1", label: "Prepare image" },
    ],
    finalArtifact: { assetId: "uf_video_1", kind: "video" },
    failure: { code: null, message: null },
    linkedJobIds: ["job_image"],
    linkedJobs: [makeJob()],
    operation: null,
    originMessageId: "msg_1",
    originTurnId: "turn_1",
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfileViewModel> = {}): UserProfileViewModel {
  return {
    id: "usr_1",
    email: "keith@example.com",
    name: "Keith",
    credential: "Founder",
    pushNotificationsEnabled: true,
    affiliateEnabled: true,
    referralCode: "KEITH",
    referralUrl: "https://ordo.test/r/KEITH",
    qrCodeUrl: "/api/qr/KEITH",
    roles: ["AUTHENTICATED"],
    ...overrides,
  };
}

function makeConversation(): Conversation {
  return {
    id: "conv_1",
    userId: "usr_1",
    title: "Referral conversation",
    status: "active",
    createdAt: now,
    updatedAt: now,
    convertedFrom: null,
    messageCount: 3,
    firstMessageAt: now,
    lastToolUsed: null,
    sessionSource: "web",
    promptVersion: null,
    routingSnapshot: {
      lane: "uncertain",
      confidence: null,
      recommendedNextStep: null,
      detectedNeedSummary: null,
      lastAnalyzedAt: null,
    },
    referralId: null,
    referralSource: null,
  };
}

function makeContentItem(overrides: Partial<ContentCampaignItem> = {}): ContentCampaignItem {
  const post = {
    id: "blogpost_1",
    slug: "launch-note",
    title: "Launch Note",
    description: "A public launch note.",
    content: "## Launch",
    standfirst: null,
    section: "essay" as const,
    heroImageAssetId: null,
    status: "published" as const,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    createdByUserId: "usr_1",
    publishedByUserId: "usr_1",
  };

  return {
    post,
    heroAsset: null,
    assets: [],
    artifacts: [{
      id: "artifact_qa",
      postId: post.id,
      artifactType: "article_qa_report",
      payload: { passed: true, providerModel: "hidden" },
      createdByUserId: "usr_1",
      createdAt: now,
    }],
    trackedLinks: [{
      link: {
        id: "tl_content",
        code: "CONTENT1",
        ownerUserId: "usr_1",
        targetKind: "content_item",
        targetId: post.id,
        destinationUrl: "/feed/launch-note?tl=CONTENT1",
        label: "Launch Note QR",
        purpose: "content",
        status: "active",
        createdFromConversationId: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
      performance: {
        visits: 2,
        chats: 1,
        signups: 1,
        offerViews: 0,
        offerChoices: 0,
        simulatedPurchases: 0,
        conversions: 0,
      },
    }],
    performance: {
      links: 1,
      visits: 2,
      chats: 1,
      signups: 1,
      offerViews: 0,
      offerChoices: 0,
      simulatedPurchases: 0,
      conversions: 0,
    },
    publicHref: "/feed/launch-note",
    detailHref: "/studio/content/blogpost_1",
    isPublic: true,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer_1",
    slug: "workflow-audit",
    ownerUserId: "usr_1",
    title: "Workflow audit",
    summary: "A focused workflow audit.",
    description: "We inspect the workflow and recommend next steps.",
    audience: "Solo operators",
    promise: "Clear operational next step",
    priceCents: 120000,
    currency: "USD",
    billingKind: "fixed",
    estimatedMinutes: 90,
    status: "published",
    visibility: "public",
    ctaLabel: "Choose audit",
    createdFromConversationId: "conv_1",
    createdFromMessageId: "msg_1",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    archivedAt: null,
    ...overrides,
  };
}

function makeOfferEvent(overrides: Partial<OfferEvent> = {}): OfferEvent {
  return {
    id: "offer_evt_1",
    offerId: "offer_1",
    eventType: "chosen",
    actorUserId: "usr_1",
    personRef: "person:lead:lead_1",
    conversationId: "conv_1",
    messageId: "msg_1",
    trackedLinkId: "tl_offer",
    metadata: {},
    createdAt: now,
    ...overrides,
  };
}

function makeTrackedLink(overrides: Partial<TrackedLinkWithPerformance> = {}): TrackedLinkWithPerformance {
  return {
    link: {
      id: "tl_offer",
      code: "OFFER1",
      ownerUserId: "usr_1",
      targetKind: "offer",
      targetId: "offer_1",
      destinationUrl: "/offers/workflow-audit?tl=OFFER1",
      label: "Workflow audit QR",
      purpose: "offer",
      status: "active",
      createdFromConversationId: "conv_1",
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
      conversions: 1,
    },
    ...overrides,
  };
}

describe("ordo detail projectors", () => {
  it("projects media asset provenance from real catalog/job/workflow refs", () => {
    const detail = projectMediaAssetToOrdoDetail({
      entry: makeAsset(),
      producingJob: makeJob(),
      workflow: makeWorkflow(),
    });

    expect(detail.object.kind).toBe("media_asset");
    expect(detail.defaultLens).toBe("provenance");
    expect(detail.primaryCard.detailHref).toBe("/studio/media/uf_image_1");
    expect(detail.diagnosticHref).toBe("/my/media?assetId=uf_image_1");
    expect(detail.adminDiagnostic).toBeNull();
    expect(detail.relatedCards).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "workflow_run", detailHref: "/jobs?jobId=job_image" }),
    ]));
    expect(detail.provenanceLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Media workflow", href: "/studio/workflows/mwf_1" }),
      expect.objectContaining({ label: "Producing job", unavailableReason: expect.any(String) }),
    ]));
    expect(detail.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "job", sourceId: "job_image" }),
      expect.objectContaining({ sourceKind: "media_workflow", sourceId: "mwf_1" }),
      expect.objectContaining({ sourceKind: "conversation", sourceId: "conv_1" }),
    ]));
  });

  it("keeps missing media provenance honest", () => {
    const detail = projectMediaAssetToOrdoDetail({
      entry: makeAsset({
        producedByJobId: null,
        materializationKey: null,
        conversationId: null,
      }),
    });

    const provenance = detail.lenses.find((lens) => lens.lens === "provenance");

    expect(provenance?.emptyState).toContain("no producing workflow");
    expect(detail.provenanceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "job" }),
    ]));
  });

  it("projects workflow details with linked job and final artifact provenance", () => {
    const detail = projectWorkflowRunToOrdoDetail(makeWorkflow(), { canViewAdminDiagnostics: true });

    expect(detail.object.kind).toBe("workflow_run");
    expect(detail.primaryCard.detailHref).toBe("/studio/workflows/mwf_1");
    expect(detail.adminDiagnostic).toEqual(expect.objectContaining({ href: "/jobs?sourceKind=media_workflow&sourceId=mwf_1" }));
    expect(detail.relatedCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "workflow_run", detailHref: "/jobs?jobId=job_image" }),
    ]));
    expect(detail.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "artifact", sourceId: "uf_video_1" }),
    ]));
  });

  it("projects content details with provenance and performance lenses", () => {
    const detail = projectContentItemToOrdoDetail(makeContentItem());

    expect(detail.object.kind).toBe("content_item");
    expect(detail.defaultLens).toBe("performance");
    expect(detail.primaryCard.detailHref).toBe("/studio/content/blogpost_1");
    expect(detail.lenses.find((lens) => lens.lens === "performance")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Visits", value: "2" }),
      expect.objectContaining({ label: "Chats", value: "1" }),
    ]));
    expect(detail.lenses.find((lens) => lens.lens === "provenance")?.summary).not.toContain("provider");
    expect(JSON.stringify(detail)).not.toContain("providerModel");
  });

  it("projects campaign details as one performance loop", () => {
    const item = makeContentItem();
    const campaign: ContentCampaignReadModel = {
      id: "content-performance",
      ownerUserId: "usr_1",
      title: "Content performance loop",
      summary: "One measurable content loop.",
      items: [item],
      offers: [],
      trackedLinks: item.trackedLinks,
      performance: item.performance,
      createdAt: now,
      updatedAt: now,
    };

    const detail = projectContentCampaignToOrdoDetail(campaign);

    expect(detail.object.kind).toBe("campaign");
    expect(detail.defaultLens).toBe("performance");
    expect(detail.lenses.find((lens) => lens.lens === "overview")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Content items", value: "1" }),
      expect.objectContaining({ label: "Tracked links", value: "1" }),
    ]));
    expect(detail.relatedCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "content_item" }),
    ]));
  });

  it("projects referral performance and funnel details from affiliate analytics", () => {
    const detail = projectReferralToOrdoDetail({
      profile: makeProfile(),
      overview: {
        introductions: 5,
        startedChats: 4,
        registered: 2,
        qualifiedOpportunities: 1,
        creditStatusLabel: "1 pending review",
        creditStatusCounts: { tracked: 1, pending_review: 1, approved: 0, paid: 0, void: 0 },
        narrative: "One opportunity is pending review.",
      },
      pipeline: {
        stages: [{ stage: "introductions", label: "Introductions", count: 5, conversionRate: 100 }],
        outcomes: [{ outcome: "lead_submitted", label: "Lead submitted", count: 1 }],
      },
      timeseries: [{ date: "2026-05-04", introductions: 5, startedChats: 4, registered: 2, qualifiedOpportunities: 1 }],
      recentActivity: [{
        id: "evt_1",
        referralId: "ref_1",
        referralCode: "KEITH",
        milestone: "credit_pending_review",
        title: "Credit pending review",
        description: "A referred opportunity is waiting for credit review.",
        occurredAt: now,
        href: "/business/referrals/KEITH",
      }],
      updatedAt: now,
    });

    expect(detail?.object.kind).toBe("tracked_link");
    expect(detail?.defaultLens).toBe("performance");
    expect(detail?.primaryCard.detailHref).toBe("/business/referrals/KEITH");
    expect(detail?.lenses.find((lens) => lens.lens === "funnel")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Introductions", value: "5 (100%)" }),
    ]));
  });

  it("keeps missing referral performance honest instead of presenting measured zeroes", () => {
    const detail = projectReferralToOrdoDetail({
      profile: makeProfile(),
      overview: null,
      pipeline: null,
      timeseries: [],
      recentActivity: [],
    });

    const performance = detail?.lenses.find((lens) => lens.lens === "performance");

    expect(performance?.facts).toEqual([]);
    expect(performance?.emptyState).toBe("No referral performance has been recorded yet.");
  });

  it("projects conversation business context without inventing a person index", () => {
    const context: BusinessWorkflowContext = {
      id: "bwc_conv_1",
      userId: "usr_1",
      conversationId: "conv_1",
      primaryMode: "revenue",
      origin: null,
      relatedRefs: [{ kind: "referral", id: "ref_1", userId: "usr_1", conversationId: "conv_1", label: "Referral KEITH", status: "visited:tracked" }],
      lifecycleRefs: [],
      notificationRefs: [],
      interruptedTurnRefs: [],
      healthRefs: [],
      recommendedAction: { kind: "follow_up", label: "Follow up", targetRef: null },
      updatedAt: now,
    };

    const detail = projectBusinessConversationToOrdoDetail({
      conversation: makeConversation(),
      context,
    });

    expect(detail.object.kind).toBe("conversation");
    expect(detail.defaultLens).toBe("funnel");
    expect(detail.primaryCard.detailHref).toBe("/business/conversations/conv_1");
    expect(detail.lenses.find((lens) => lens.lens === "funnel")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "referral", value: "Referral KEITH - visited:tracked" }),
    ]));
  });

  it("projects person details with relationship trail and funnel lenses", () => {
    const detail = projectPersonToOrdoDetail({
      id: "person:lead:lead_1",
      ownerUserId: "usr_1",
      stage: "offer_chosen",
      stageLabel: "Offer",
      displayName: "Avery Lead",
      email: "avery@example.com",
      organization: "Avery Co",
      summary: "Avery chose the launch offer.",
      nextAction: "Follow up on the selected offer.",
      sourceLabels: ["Direct conversation"],
      sourceCategories: ["direct_conversation"],
      offerLabels: ["Launch offer"],
      relationshipRole: "Prospect",
      affiliate: false,
      isAnonymous: false,
      createdAt: now,
      updatedAt: now,
      detailHref: "/business/people/person%3Alead%3Alead_1",
      primaryConversationId: "conv_1",
      conversationIds: ["conv_1"],
      leadIds: ["lead_1"],
      consultationRequestIds: [],
      dealIds: [],
      referralIds: ["ref_1"],
      referralCodes: ["KEITH"],
      offerIds: ["offer_1"],
      sourceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
      provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
      relationshipTrail: [
        {
          id: "conversation:conv_1",
          label: "Conversation started",
          summary: "Initial conversation.",
          occurredAt: now,
          sourceRef: { sourceKind: "conversation", sourceId: "conv_1", label: "Conversation", href: "/business/conversations/conv_1" },
          sourceActionLabel: "Open conversation",
        },
        {
          id: "lead:lead_1",
          label: "Contact captured",
          summary: "Submitted.",
          occurredAt: now,
          sourceRef: { sourceKind: "lead", sourceId: "lead_1", label: "Lead" },
        },
        {
          id: "offer_event:offer_evt_1",
          label: "Offer accepted",
          summary: "Launch offer was accepted.",
          occurredAt: now,
          sourceRef: { sourceKind: "offer_event", sourceId: "offer_evt_1", label: "Launch offer", href: "/offers/launch-offer" },
          sourceActionLabel: "View offer",
        },
      ],
    });

    expect(detail.object.kind).toBe("person");
    expect(detail.defaultLens).toBe("funnel");
    expect(detail.primaryCard.kind).toBe("person");
    expect(detail.personHeader).toEqual(expect.objectContaining({
      displayName: "Avery Lead",
      organization: "Avery Co",
      stageLabel: "Offer",
      primaryConversationHref: "/business/conversations/conv_1",
    }));
    expect(detail.personHeader?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Introduced by", value: "Referral KEITH" }),
      expect.objectContaining({ label: "Came from", value: "Direct conversation" }),
      expect.objectContaining({ label: "Last conversation", value: "May 4 at 12:00 PM" }),
      expect.objectContaining({ label: "Next follow-up", value: "Follow up on the selected offer." }),
    ]));
    const relationshipTrail = detail.lenses.find((lens) => lens.label === "Relationship Trail")?.timeline;
    expect(relationshipTrail).toHaveLength(3);
    expect(relationshipTrail).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Offer accepted",
        sourceRef: expect.objectContaining({ href: "/offers/launch-offer" }),
        sourceActionLabel: "View offer",
      }),
    ]));
    expect(detail.lenses.find((lens) => lens.lens === "related")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Offer", value: "offer_1" }),
      expect.objectContaining({ label: "Referral", value: "KEITH" }),
    ]));
  });

  it("projects offer detail with source conversation, visibility, and measured link performance", () => {
    const detail = projectOfferToOrdoDetail({
      offer: makeOffer(),
      events: [makeOfferEvent()],
      trackedLinks: [makeTrackedLink()],
    });

    expect(detail.object.kind).toBe("offer");
    expect(detail.defaultLens).toBe("performance");
    expect(detail.sourceLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Created from conversation", href: "/business/conversations/conv_1" }),
      expect.objectContaining({ label: "Public offer", href: "/offers/workflow-audit" }),
    ]));
    expect(detail.lenses.find((lens) => lens.lens === "visibility")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Visibility", value: "public" }),
      expect.objectContaining({ label: "Public page", value: "/offers/workflow-audit" }),
    ]));
    expect(detail.lenses.find((lens) => lens.lens === "provenance")?.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Offer accepted",
        sourceRef: expect.objectContaining({ href: "/business/conversations/conv_1" }),
        sourceActionLabel: "Open conversation",
      }),
    ]));
    expect(detail.lenses.find((lens) => lens.lens === "performance")?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Visits", value: "3" }),
      expect.objectContaining({ label: "Conversions", value: "1" }),
    ]));
  });

  it("keeps private offer visibility honest without inventing public performance", () => {
    const detail = projectOfferToOrdoDetail({
      offer: makeOffer({ visibility: "private", status: "ready", publishedAt: null }),
      events: [],
      trackedLinks: [],
    });

    expect(detail.defaultLens).toBe("visibility");
    expect(detail.lenses.find((lens) => lens.lens === "visibility")?.emptyState).toBe("This offer has no public offer page yet.");
    expect(detail.lenses.find((lens) => lens.lens === "performance")?.emptyState).toBe("Create or attach a tracked link before performance can be measured.");
  });

  it("projects system section diagnostics only for authorized admins", () => {
    const section = {
      id: "backups",
      title: "Backups",
      summary: "Recent appliance backups and warnings.",
      href: "/admin/system?section=backups",
      targetHref: "/admin/system/backups",
      targetLabel: "Open full backup page",
      statusLabel: "Ready",
      countLabel: "2",
      iconLabel: "B",
    };

    const authorized = projectAdminSystemSectionToOrdoDetail({
      section,
      canViewAdminDiagnostics: true,
      updatedAt: now,
    });
    const unauthorized = projectAdminSystemSectionToOrdoDetail({
      section,
      canViewAdminDiagnostics: false,
      updatedAt: now,
    });

    expect(authorized.object.kind).toBe("system");
    expect(authorized.adminDiagnostic).toEqual(expect.objectContaining({
      label: "Open full backup page",
      href: "/admin/system/backups",
    }));
    expect(unauthorized.adminDiagnostic).toBeNull();
    expect(unauthorized.primaryActions).toEqual([]);
    expect(unauthorized.lenses.find((lens) => lens.lens === "actions")?.emptyState).toContain("unavailable");
  });
});
