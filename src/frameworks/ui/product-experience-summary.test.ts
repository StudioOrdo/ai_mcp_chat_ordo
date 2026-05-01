import { describe, expect, it } from "vitest";

import type { WorkspaceRestorePayload } from "@/core/platform/conversation-restore/WorkspaceRestore";

import { buildProductExperienceSummary } from "./product-experience-summary";

function createRestorePayload(overrides: Partial<WorkspaceRestorePayload> = {}): WorkspaceRestorePayload {
  return {
    workspace: {
      id: "workspace_conv_1",
      userId: "usr_1",
      conversationId: "conv_1",
      status: "active",
      title: "Launch workspace",
      currentObjective: "Review the launch workflow",
      recommendedNextStep: "Open the jobs workspace",
      openLoops: [],
      activeJobRefs: [],
      importantAssetRefs: [],
      workflowContextRef: "bwc_conv_1",
      operatorTransitionRef: "otp_usr_1",
      trustDistributionRef: "tdc_usr_1",
      relatedBusinessRefs: [],
      latestMemoryRef: "mem_1",
      latestPromptBindingRef: null,
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    activeJobs: [],
    attentionNeededJobs: [],
    assets: [
      {
        assetId: "asset_1",
        kind: "image",
        status: "ready",
        producedByJobId: "job_1",
        materializationKey: null,
        updatedAt: "2026-04-29T16:00:00.000Z",
      },
    ],
    reusableMediaAssets: [],
    workflow: {
      id: "bwc_conv_1",
      userId: "usr_1",
      conversationId: "conv_1",
      primaryMode: "revenue",
      origin: {
        kind: "referral",
        label: "Referral workspace",
        source: {
          sourceKind: "referral",
          sourceId: "ref_1",
          userId: "usr_1",
          conversationId: "conv_1",
        },
      },
      relatedRefs: [
        {
          kind: "referral",
          id: "ref_1",
          userId: "usr_1",
          conversationId: "conv_1",
          label: "Affiliate launch",
          status: "active",
        },
      ],
      lifecycleRefs: [],
      notificationRefs: [],
      interruptedTurnRefs: [],
      healthRefs: [],
      recommendedAction: {
        kind: "share",
        label: "Open referrals workspace",
        targetRef: {
          sourceKind: "referral",
          sourceId: "ref_1",
          userId: "usr_1",
          conversationId: "conv_1",
        },
      },
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    operatorTransition: {
      id: "otp_usr_1",
      userId: "usr_1",
      conversationId: "conv_1",
      status: "sharing",
      operatorMode: "community_affiliate",
      expertiseRefs: [],
      audienceRefs: [],
      offerRefs: [],
      trustDistributionRef: "tdc_usr_1",
      recommendedAction: {
        kind: "share",
        label: "Share your referral QR",
        targetRef: {
          sourceKind: "trust_distribution_context",
          sourceId: "tdc_usr_1",
          userId: "usr_1",
          conversationId: "conv_1",
        },
      },
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    trustDistribution: {
      id: "tdc_usr_1",
      userId: "usr_1",
      conversationId: "conv_1",
      referralCode: "ORDO-42",
      referralUrl: "/referrals",
      qrCodeUrl: "/api/qr/ORDO-42",
      physicalShareAssets: [],
      introScripts: [],
      activeCampaignRefs: [],
      recentReferralRefs: [],
      recommendedAction: {
        kind: "share",
        label: "Share your referral QR",
        targetRef: {
          sourceKind: "trust_distribution_context",
          sourceId: "tdc_usr_1",
          userId: "usr_1",
          conversationId: "conv_1",
        },
      },
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    memory: {
      id: "mem_1",
      userId: "usr_1",
      conversationId: "conv_1",
      memoryType: "preference",
      summary: "Keep the launch offer concise.",
      evidenceRefs: [],
      status: "active",
      confidence: 0.88,
      createdAt: "2026-04-29T16:00:00.000Z",
      updatedAt: "2026-04-29T16:00:00.000Z",
    },
    recentTranscript: [],
    migration: null,
    restoreMeta: {
      schemaVersion: 1,
      restoredAt: "2026-04-29T16:00:00.000Z",
      source: "durable_read_model",
    },
    ...overrides,
  };
}

describe("buildProductExperienceSummary", () => {
  it("returns null when restore has no meaningful product state", () => {
    const summary = buildProductExperienceSummary({
      workspaceRestore: createRestorePayload({
        workspace: {
          ...createRestorePayload().workspace!,
          currentObjective: null,
          recommendedNextStep: null,
          openLoops: [],
        },
        assets: [],
        workflow: null,
        operatorTransition: null,
        trustDistribution: null,
        memory: null,
      }),
      jobStateEntries: [],
      currentConversationTitle: null,
      viewerRole: "ANONYMOUS",
    });

    expect(summary).toBeNull();
  });

  it("suppresses low-signal anonymous restore summaries", () => {
    const summary = buildProductExperienceSummary({
      workspaceRestore: createRestorePayload({
        workspace: {
          ...createRestorePayload().workspace!,
          title: "can you search",
          currentObjective: "Current signals are insufficient to determine whether the need is a workflow question, implementation task, or training need.",
          recommendedNextStep: "Ask one clarifying question to determine whether the need is a customer workflow, technical implementation, or training outcome.",
        },
        assets: [],
        workflow: {
          ...createRestorePayload().workflow!,
          primaryMode: "general",
          origin: {
            kind: "chat",
            label: "can you search",
            source: {
              sourceKind: "conversation",
              sourceId: "conv_1",
              userId: "usr_1",
              conversationId: "conv_1",
            },
          },
          relatedRefs: [],
          healthRefs: [],
          recommendedAction: null,
        },
        operatorTransition: {
          ...createRestorePayload().operatorTransition!,
          status: "not_started",
          operatorMode: "new_solo_offer",
          recommendedAction: null,
        },
        trustDistribution: {
          ...createRestorePayload().trustDistribution!,
          referralCode: null,
          referralUrl: null,
          qrCodeUrl: null,
          recentReferralRefs: [],
          recommendedAction: {
            kind: "resolve_setup",
            label: "Enable referral sharing",
            targetRef: {
              sourceKind: "trust_distribution_context",
              sourceId: "tdc_usr_1",
              userId: "usr_1",
              conversationId: "conv_1",
            },
          },
        },
        memory: null,
      }),
      jobStateEntries: [],
      currentConversationTitle: "can you search",
      viewerRole: "ANONYMOUS",
    });

    expect(summary).toBeNull();
  });

  it("builds canonical workflow, transition, jobs, assets, and memory sections", () => {
    const summary = buildProductExperienceSummary({
      workspaceRestore: createRestorePayload(),
      jobStateEntries: [
        {
          jobId: "job_1",
          conversationId: "conv_1",
          userId: "usr_1",
          toolName: "compose_media",
          label: "Render launch plan",
          title: "Render launch plan",
          status: "failed",
          sequence: 1,
          summary: "Export step failed",
          createdAt: "2026-04-29T16:00:00.000Z",
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-04-29T16:01:00.000Z",
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
        },
      ],
      currentConversationTitle: null,
      viewerRole: "AUTHENTICATED",
    });

    expect(summary?.headline).toBe("Launch workspace");
    expect(summary?.workflow?.modeLabel).toBe("Revenue");
    expect(summary?.workflow?.action?.value).toBe("/referrals");
    expect(summary?.transition?.referralCode).toBe("ORDO-42");
    expect(summary?.transition?.action?.value).toBe("/referrals");
    expect(summary?.jobs?.attentionCount).toBe(1);
    expect(summary?.jobs?.items[0]?.action?.actionType).toBe("job");
    expect(summary?.assets?.action.value).toBe("/my/media");
    expect(summary?.memory?.summary).toBe("Keep the launch offer concise.");
  });

  it("builds a returning-user fallback summary when no restore payload exists", () => {
    const summary = buildProductExperienceSummary({
      workspaceRestore: null,
      jobStateEntries: [],
      currentConversationTitle: null,
      viewerRole: "AUTHENTICATED",
    });

    expect(summary?.objective).toBe("No active work in progress");
    expect(summary?.nextStep).toContain("dedicated workspace");
  });
});
