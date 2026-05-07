import { describe, expect, it } from "vitest";

import type { AssetCatalogEntry } from "@/core/entities/asset-catalog";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { ContentCampaignItem, ContentCampaignReadModel } from "@/core/entities/content-campaign";
import type { Offer } from "@/core/entities/offer";
import type { OperationAction } from "@/core/entities/operation";
import type { OperationSummary } from "@/core/use-cases/operations/OperationRepository";
import type { ActivityItem } from "@/lib/activity/activity-types";
import type { PersonReadModelItem } from "@/lib/business/people-read-model";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { ReferralActivityItem } from "@/lib/referrals/referral-milestones";

import {
  projectActivityItemToOrdoCard,
  projectAssetCatalogEntryToOrdoCard,
  projectBusinessWorkflowContextToOrdoCard,
  projectContentCampaignToOrdoCard,
  projectContentItemToOrdoCard,
  projectJobSnapshotToOrdoCard,
  projectMediaWorkflowToOrdoCard,
  projectOperationSummaryToOrdoCard,
  projectOfferToOrdoCard,
  projectPersonToOrdoCard,
  projectReferralActivityToOrdoCard,
  projectReferralLinkToOrdoCard,
  projectTrackedLinkToOrdoCard,
} from "./ordo-card-projectors";

const now = "2026-05-04T12:00:00.000Z";

function makeJob(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_audio",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "generate_audio",
    label: "Generate audio",
    title: "Founder note audio",
    subtitle: "Audio draft",
    status: "succeeded",
    sequence: 3,
    progressPercent: 100,
    progressLabel: "Complete",
    summary: "Audio generated successfully.",
    createdAt: now,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
    origin: { fallback: "job_created_at" },
    inputSnapshot: { prompt: "hello", secret: "[redacted]" },
    resultEnvelope: {
      schemaVersion: 1,
      toolName: "generate_audio",
      family: "media",
      cardKind: "media_render",
      executionMode: "deferred",
      inputSnapshot: { prompt: "hello", secret: "[redacted]" },
      summary: { title: "Founder note audio" },
      payload: null,
    },
    artifactRefs: [{
      kind: "audio",
      label: "Audio file",
      mimeType: "audio/mpeg",
      assetId: "uf_audio_1",
      durationSeconds: 14,
    }],
    materializationRefs: ["mat_audio_1"],
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
    workflowId: "mwf_video",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Mission short",
    requestedDeliverable: "video",
    status: "succeeded",
    stage: { key: "succeeded", label: "Video ready", progressPercent: 100 },
    steps: [
      { stepId: "step_audio", kind: "generate_audio", status: "ready", jobId: "job_audio", assetId: "uf_audio_1", label: "Generate audio" },
      { stepId: "step_video", kind: "compose_media", status: "ready", jobId: "job_video", assetId: "uf_video_1", label: "Compose video" },
    ],
    finalArtifact: { assetId: "uf_video_1", kind: "video" },
    failure: { code: null, message: null },
    linkedJobIds: ["job_audio", "job_video"],
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

function makeActivity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "job:job_audio",
    sourceKind: "job",
    sourceId: "job_audio",
    userId: "usr_1",
    roleVisibility: ["AUTHENTICATED", "APPRENTICE"],
    bucket: "completed",
    severity: "success",
    title: "Audio ready",
    summary: "Generated audio is ready.",
    statusLabel: "Succeeded",
    sourceStatus: "succeeded",
    href: "/jobs?jobId=job_audio",
    primaryAction: { id: "open", label: "Open", href: "/jobs?jobId=job_audio" },
    secondaryActions: [],
    createdAt: now,
    updatedAt: now,
    dedupeKey: "job:job_audio",
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

function makeOperationSummary(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: "op_restore",
    kind: "restore_execute",
    title: "Restore appliance",
    status: "awaiting_confirmation",
    riskLevel: "destructive",
    revision: 2,
    conversationId: "conv_1",
    currentStepId: "step_1",
    summary: "Ready for confirmation.",
    createdByUserId: "usr_1",
    createdByRole: "ADMIN",
    visibility: "user",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    stepCount: 3,
    actionCount: 1,
    artifactCount: 1,
    eventCount: 5,
    latestEventType: "action_exposed",
    latestEventAt: now,
    progress: {
      totalSteps: 3,
      pendingSteps: 0,
      readySteps: 1,
      runningSteps: 0,
      blockedSteps: 0,
      succeededSteps: 2,
      failedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percentComplete: 66,
    },
    ...overrides,
  };
}

function makeOperationAction(overrides: Partial<OperationAction> = {}): OperationAction {
  return {
    id: "act_execute",
    operationId: "op_restore",
    operationRevision: 2,
    actionType: "execute_restore",
    label: "Execute restore",
    riskLevel: "destructive",
    confirmPolicy: "phrase",
    allowedRoles: ["ADMIN"],
    allowedStatuses: ["awaiting_confirmation"],
    enabled: true,
    disabledReason: null,
    idempotencyKey: "idem_1",
    expiresAt: null,
    payload: {},
    payloadSchemaKey: "restore_execute",
    confirmationText: "RESTORE",
    ...overrides,
  };
}

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer_1",
    slug: "strategy-call",
    ownerUserId: "usr_1",
    title: "Strategy Call",
    summary: "Turn a messy AI workflow into a repeatable process.",
    description: "A focused strategy session.",
    audience: "Solopreneurs",
    promise: "A clear operating process.",
    priceCents: 50_000,
    currency: "USD",
    billingKind: "fixed",
    estimatedMinutes: 90,
    status: "draft",
    visibility: "private",
    ctaLabel: "Start a conversation",
    createdFromConversationId: "conv_1",
    createdFromMessageId: "msg_1",
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function makeContentItem(overrides: Partial<ContentCampaignItem> = {}): ContentCampaignItem {
  const post = {
    id: "blogpost_1",
    slug: "launch-note",
    title: "Launch Note",
    description: "A public update.",
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
      id: "blogartifact_1",
      postId: post.id,
      artifactType: "article_qa_report",
      payload: { passed: true, jobId: "job_content_1", workflowId: "mwf_content_1" },
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
        visits: 3,
        chats: 2,
        signups: 1,
        offerViews: 0,
        offerChoices: 0,
        simulatedPurchases: 0,
        conversions: 0,
      },
    }],
    performance: {
      links: 1,
      visits: 3,
      chats: 2,
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

function makePerson(overrides: Partial<PersonReadModelItem> = {}): PersonReadModelItem {
  return {
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
    referralIds: [],
    referralCodes: [],
    offerIds: ["offer_1"],
    sourceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    provenanceRefs: [{ sourceKind: "lead", sourceId: "lead_1", label: "Lead" }],
    relationshipTrail: [
      {
        id: "lead:lead_1",
        label: "Lead",
        summary: "submitted",
        occurredAt: now,
        sourceRef: { sourceKind: "lead", sourceId: "lead_1", label: "Lead" },
      },
    ],
    ...overrides,
  };
}

describe("Ordo card projectors", () => {
  it("projects person stages as governed relationship cards", () => {
    const card = projectPersonToOrdoCard(makePerson());

    expect(card.kind).toBe("person");
    expect(card.detailHref).toBe("/business/people/person%3Alead%3Alead_1");
    expect(card.bucket).toBe("needs_attention");
    expect(card.primaryAction).toMatchObject({ label: "Open person", href: "/business/people/person%3Alead%3Alead_1" });
    expect(card.secondaryActions).toEqual([
      expect.objectContaining({ label: "Open conversation", href: "/business/conversations/conv_1" }),
    ]);
    expect(card.metrics).toEqual(expect.arrayContaining([
      { id: "stage", label: "Stage", value: "Offer" },
      { id: "offers", label: "Offers", value: 1 },
    ]));
    expect(card.title).not.toContain("job_");
  });

  it("projects offers as governed business objects with conversation provenance", () => {
    const card = projectOfferToOrdoCard(makeOffer());

    expect(card.kind).toBe("offer");
    expect(card.detailHref).toBe("/offers?offerId=offer_1");
    expect(card.primaryAction).toMatchObject({ label: "Review offer", href: "/offers?offerId=offer_1" });
    expect(card.metrics).toEqual(expect.arrayContaining([
      { id: "price", label: "Price", value: "$500" },
      { id: "visibility", label: "Visibility", value: "private" },
      { id: "billing", label: "Billing", value: "fixed" },
    ]));
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "conversation", sourceId: "conv_1" }),
      expect.objectContaining({ sourceKind: "offer_event", sourceId: "msg_1" }),
    ]));
    expect(card.title).not.toContain("job_");
  });

  it("projects published offers with a single public preview action", () => {
    const card = projectOfferToOrdoCard(makeOffer({
      status: "published",
      visibility: "public",
      publishedAt: now,
    }));

    expect(card.bucket).toBe("business_loop");
    expect(card.status).toBe("published");
    expect(card.primaryAction).toMatchObject({
      label: "Preview public page",
      href: "/offers/strategy-call",
    });
    expect(card.secondaryActions).toHaveLength(2);
  });

  it("projects published content as a measurable Studio card", () => {
    const card = projectContentItemToOrdoCard(makeContentItem());

    expect(card).toMatchObject({
      kind: "content_item",
      bucket: "business_loop",
      status: "published",
      detailHref: "/studio/content/blogpost_1",
      primaryAction: { label: "Open feed item", href: "/feed/launch-note" },
    });
    expect(card.metrics).toEqual(expect.arrayContaining([
      { id: "links", label: "Links", value: 1 },
      { id: "visits", label: "Visits", value: 3 },
      { id: "chats", label: "Chats", value: 2 },
    ]));
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "blog_post", sourceId: "blogpost_1" }),
      expect.objectContaining({ sourceKind: "blog_post_artifact", sourceId: "blogartifact_1" }),
      expect.objectContaining({ sourceKind: "job", sourceId: "job_content_1" }),
      expect.objectContaining({ sourceKind: "media_workflow", sourceId: "mwf_content_1" }),
      expect.objectContaining({ sourceKind: "tracked_link", sourceId: "tl_content" }),
    ]));
  });

  it("projects draft content without public or fabricated metrics", () => {
    const card = projectContentItemToOrdoCard(makeContentItem({
      post: {
        ...makeContentItem().post,
        status: "draft",
        publishedAt: null,
      },
      trackedLinks: [],
      performance: {
        links: 0,
        visits: 0,
        chats: 0,
        signups: 0,
        offerViews: 0,
        offerChoices: 0,
        simulatedPurchases: 0,
        conversions: 0,
      },
      publicHref: null,
      isPublic: false,
    }));

    expect(card.status).toBe("draft");
    expect(card.primaryAction).toMatchObject({ label: "Review content", href: "/studio/content/blogpost_1" });
    expect(card.secondaryActions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ actionType: "create_tracked_link" }),
    ]));
    expect(card.metrics).toEqual(expect.arrayContaining([
      { id: "links", label: "Links", value: 0 },
      { id: "visits", label: "Visits", value: 0 },
    ]));
  });

  it("projects a content campaign read model without inventing a durable campaign table", () => {
    const item = makeContentItem();
    const campaign: ContentCampaignReadModel = {
      id: "content-performance",
      ownerUserId: "usr_1",
      title: "Content performance loop",
      summary: "Published content and public offers.",
      items: [item],
      offers: [makeOffer({ status: "published", visibility: "public" })],
      trackedLinks: item.trackedLinks,
      performance: item.performance,
      createdAt: now,
      updatedAt: now,
    };

    const card = projectContentCampaignToOrdoCard(campaign);

    expect(card).toMatchObject({
      kind: "campaign",
      detailHref: "/studio/campaigns/content-performance",
      primaryAction: { label: "Open campaign" },
    });
    expect(card.metrics).toEqual(expect.arrayContaining([
      { id: "content", label: "Content", value: 1 },
      { id: "published", label: "Published", value: 1 },
      { id: "visits", label: "Visits", value: 3 },
    ]));
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "blog_post", sourceId: "blogpost_1" }),
      expect.objectContaining({ sourceKind: "offer", sourceId: "offer_1" }),
      expect.objectContaining({ sourceKind: "tracked_link", sourceId: "tl_content" }),
    ]));
  });

  it("projects media workflows as workflow objects with linked job provenance", () => {
    const card = projectMediaWorkflowToOrdoCard(makeWorkflow());

    expect(card.kind).toBe("workflow_run");
    expect(card.id).toBe("workflow_run:media_workflow:mwf_video");
    expect(card.objectRef.id).toBe("media_workflow:mwf_video");
    expect(card.detailHref).toBe("/studio/workflows/mwf_video");
    expect(card.diagnosticHref).toBe("/jobs?sourceKind=media_workflow&sourceId=mwf_video");
    expect(card.preview).toMatchObject({ kind: "video", href: "/api/user-files/uf_video_1" });
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "media_workflow", sourceId: "mwf_video" }),
      expect.objectContaining({ sourceKind: "job", sourceId: "job_audio" }),
      expect.objectContaining({ sourceKind: "artifact", sourceId: "uf_video_1" }),
    ]));
    expect(card.provenanceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "artifact", sourceId: "job_video" }),
    ]));
  });

  it("handles workflows with linked job ids but no final preview yet", () => {
    const card = projectMediaWorkflowToOrdoCard(makeWorkflow({
      status: "running",
      stage: { key: "compose_media", label: "Compose video", progressPercent: 50 },
      finalArtifact: null,
      completedAt: null,
      linkedJobs: [],
    }));

    expect(card.bucket).toBe("in_motion");
    expect(card.preview).toBeUndefined();
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "job", sourceId: "job_audio" }),
      expect.objectContaining({ sourceKind: "job", sourceId: "job_video" }),
    ]));
  });

  it("projects raw jobs only as workflow-run fallback cards and preserves artifact refs", () => {
    const card = projectJobSnapshotToOrdoCard(makeJob());

    expect(card.kind).toBe("workflow_run");
    expect(card.objectRef.id).toBe("job:job_audio");
    expect(card.preview).toMatchObject({ kind: "audio", href: "/api/user-files/uf_audio_1" });
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "job", sourceId: "job_audio" }),
      expect.objectContaining({ sourceKind: "artifact", sourceId: "uf_audio_1" }),
      expect.objectContaining({ sourceKind: "materialization", sourceId: "mat_audio_1" }),
    ]));
    expect(JSON.stringify(card)).not.toContain("inputSnapshot");
  });

  it("projects asset catalog entries as media assets with production provenance", () => {
    const entry: AssetCatalogEntry = {
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
      width: 1200,
      height: 800,
    };

    const card = projectAssetCatalogEntryToOrdoCard(entry);

    expect(card.kind).toBe("media_asset");
    expect(card.id).toBe("media_asset:uf_image_1");
    expect(card.preview).toMatchObject({ kind: "image", href: "/api/user-files/uf_image_1" });
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "job", sourceId: "job_image" }),
      expect.objectContaining({ sourceKind: "materialization", sourceId: "mat_image" }),
    ]));
  });

  it("projects assets without producing jobs without inventing provenance", () => {
    const entry: AssetCatalogEntry = {
      assetId: "uf_upload_1",
      kind: "document",
      ownerUserId: "usr_1",
      sourceType: "user_file",
      status: "ready",
      label: "Uploaded PDF",
      fileName: "offer.pdf",
      mimeType: "application/pdf",
      source: "uploaded",
      retentionClass: "durable",
      createdAt: now,
      updatedAt: now,
      conversationId: null,
      producedByJobId: null,
      materializationKey: null,
    };

    const card = projectAssetCatalogEntryToOrdoCard(entry);

    expect(card.preview).toMatchObject({ kind: "document" });
    expect(card.provenanceRefs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "job" }),
      expect.objectContaining({ sourceKind: "materialization" }),
    ]));
  });

  it("projects referral QR data as a tracked link compatibility card", () => {
    const profile: UserProfileViewModel = {
      id: "usr_1",
      email: "keith@example.com",
      name: "Keith",
      credential: "Founder",
      pushNotificationsEnabled: true,
      affiliateEnabled: true,
      referralCode: "KEITH",
      referralUrl: "https://ordo.test/r/KEITH",
      qrCodeUrl: "/api/referral/KEITH/qr",
      roles: ["AUTHENTICATED"],
    };

    const card = projectReferralLinkToOrdoCard({
      profile,
      updatedAt: now,
      overview: {
        introductions: 3,
        startedChats: 2,
        registered: 1,
        qualifiedOpportunities: 1,
        creditStatusLabel: "pending review",
        creditStatusCounts: { tracked: 1, pending_review: 0, approved: 0, paid: 0, void: 0 },
        narrative: "One qualified opportunity.",
      },
    });

    expect(card).toMatchObject({
      kind: "tracked_link",
      objectRef: { id: "KEITH" },
      preview: { kind: "qr", href: "/api/referral/KEITH/qr" },
    });
    expect(card?.secondaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "copy-link", actionType: "copy" }),
      expect.objectContaining({ id: "download-qr", href: "/api/referral/KEITH/qr" }),
    ]));
  });

  it("projects generic tracked links as QR attribution cards with performance", () => {
    const card = projectTrackedLinkToOrdoCard({
      link: {
        id: "tl_1",
        code: "TRACKED1",
        ownerUserId: "usr_1",
        targetKind: "offer",
        targetId: "offer_1",
        destinationUrl: "/offers/strategy-call?tl=TRACKED1",
        label: "Strategy Call QR",
        purpose: "offer",
        status: "active",
        createdFromConversationId: "conv_1",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      },
      performance: {
        visits: 2,
        chats: 1,
        signups: 1,
        offerViews: 1,
        offerChoices: 1,
        simulatedPurchases: 0,
        conversions: 1,
      },
    });

    expect(card).toMatchObject({
      kind: "tracked_link",
      id: "tracked_link:tl_1",
      bucket: "business_loop",
      detailHref: "/offers?offerId=offer_1",
      preview: { kind: "qr", href: "/api/qr/tracked/TRACKED1" },
      primaryAction: { href: "/t/TRACKED1" },
    });
    expect(card.metrics).toEqual(expect.arrayContaining([
      { id: "visits", label: "Visits", value: 2 },
      { id: "chats", label: "Chats", value: 1 },
      { id: "choices", label: "Choices", value: 1 },
    ]));
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "tracked_link", sourceId: "tl_1" }),
      expect.objectContaining({ sourceKind: "offer", sourceId: "offer_1" }),
      expect.objectContaining({ sourceKind: "conversation", sourceId: "conv_1" }),
    ]));
  });

  it("projects content tracked links back to the Studio content detail", () => {
    const card = projectTrackedLinkToOrdoCard({
      link: {
        id: "tl_content",
        code: "CONTENT1",
        ownerUserId: "usr_1",
        targetKind: "content_item",
        targetId: "blogpost_1",
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
        visits: 1,
        chats: 0,
        signups: 0,
        offerViews: 0,
        offerChoices: 0,
        simulatedPurchases: 0,
        conversions: 0,
      },
    });

    expect(card.detailHref).toBe("/studio/content/blogpost_1");
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "blog_post", sourceId: "blogpost_1" }),
    ]));
  });

  it("does not project a referral card when referral access is disabled", () => {
    const profile: UserProfileViewModel = {
      id: "usr_1",
      email: "keith@example.com",
      name: "Keith",
      credential: "Founder",
      pushNotificationsEnabled: true,
      affiliateEnabled: false,
      referralCode: null,
      referralUrl: null,
      qrCodeUrl: null,
      roles: ["AUTHENTICATED"],
    };

    expect(projectReferralLinkToOrdoCard({ profile, updatedAt: now })).toBeNull();
  });

  it("projects referral activity milestones as business-loop tracked-link cards", () => {
    const item: ReferralActivityItem = {
      id: "evt_1",
      referralId: "ref_1",
      referralCode: "KEITH",
      milestone: "credit_pending_review",
      title: "Credit pending review",
      description: "A referred opportunity is waiting for credit review.",
      occurredAt: now,
      href: "/business/referrals/KEITH",
    };

    const card = projectReferralActivityToOrdoCard(item, "usr_1");

    expect(card.kind).toBe("tracked_link");
    expect(card.bucket).toBe("needs_attention");
    expect(card.status).toBe("needs_review");
    expect(card.detailHref).toBe("/business/referrals/KEITH");
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "referral_event", sourceId: "evt_1" }),
    ]));
  });

  it("suppresses diagnostic activity and projects regular activity as object cards", () => {
    expect(projectActivityItemToOrdoCard(makeActivity({
      sourceKind: "runtime_audit_log",
      sourceId: "log_1",
      id: "runtime_audit_log:log_1",
      href: "/admin/system",
    }))).toBeNull();

    const card = projectActivityItemToOrdoCard(makeActivity());

    expect(card).toMatchObject({
      kind: "workflow_run",
      objectRef: { id: "job:job_audio" },
      bucket: "produced",
      status: "succeeded",
    });
  });

  it("projects operations with confirmation actions as attention cards", () => {
    const card = projectOperationSummaryToOrdoCard(makeOperationSummary(), [makeOperationAction()]);

    expect(card.kind).toBe("operation");
    expect(card.bucket).toBe("needs_attention");
    expect(card.primaryAction).toMatchObject({
      actionType: "execute_restore",
      requiresConfirmation: true,
      riskLevel: "destructive",
      confirmPolicy: "phrase",
      allowedRoles: ["ADMIN"],
    });
    expect(card.provenanceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "operation", sourceId: "op_restore" }),
      expect.objectContaining({ sourceKind: "conversation", sourceId: "conv_1" }),
    ]));
  });

  it("filters operation actions by viewer role when projecting cards", () => {
    const card = projectOperationSummaryToOrdoCard(
      makeOperationSummary(),
      [makeOperationAction()],
      { viewerRoles: ["AUTHENTICATED"] },
    );

    expect(card.primaryAction).toMatchObject({
      id: "open-operation",
      href: "/operations/op_restore",
    });
    expect(card.secondaryActions).toEqual([]);
  });

  it("filters media workflow operation actions by viewer role", () => {
    const card = projectMediaWorkflowToOrdoCard(
      makeWorkflow({
        operation: {
          operationId: "op_media",
          status: "awaiting_confirmation",
          revision: 1,
          availableActions: [makeOperationAction({ operationId: "op_media", allowedRoles: ["ADMIN"] })],
        },
      }),
      { viewerRoles: ["AUTHENTICATED"] },
    );

    expect(card.secondaryActions).toEqual([
      expect.objectContaining({ id: "inspect-workflow" }),
    ]);
  });

  it("preserves disabled operation action reasons", () => {
    const card = projectOperationSummaryToOrdoCard(makeOperationSummary(), [
      makeOperationAction({
        enabled: false,
        disabledReason: "Action expired",
      }),
    ]);

    expect(card.primaryAction).toMatchObject({
      id: "open-operation",
      href: "/operations/op_restore",
    });
    expect(card.secondaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "act_execute",
        disabled: true,
        disabledReason: "Action expired",
      }),
    ]));
  });

  it("keeps business workflow context as a conversation card beside the derived person index", () => {
    const context: BusinessWorkflowContext = {
      id: "bwc_1",
      userId: "usr_1",
      conversationId: "conv_1",
      primaryMode: "revenue",
      origin: null,
      relatedRefs: [],
      lifecycleRefs: [],
      notificationRefs: [],
      interruptedTurnRefs: [],
      healthRefs: [{ id: "health_1", severity: "blocking", label: "Needs review", source: { sourceKind: "conversation", sourceId: "conv_1", userId: "usr_1", conversationId: "conv_1" } }],
      recommendedAction: { kind: "review", label: "Review next step", targetRef: null },
      updatedAt: now,
    };

    const card = projectBusinessWorkflowContextToOrdoCard(context);

    expect(card.kind).toBe("conversation");
    expect(card.bucket).toBe("needs_attention");
    expect(card.objectRef.id).toBe("conv_1");
    expect(card.detailHref).toBe("/business/conversations/conv_1");
    expect(card.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKind: "business_workflow_context", sourceId: "bwc_1" }),
    ]));
  });
});
