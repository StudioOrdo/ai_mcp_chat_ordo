import { describe, expect, it, vi } from "vitest";

import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { Conversation } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";

import { RepositoryBackedWorkspaceSnapshotReader } from "./WorkspaceSnapshotReader";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv_1",
    userId: "usr_1",
    title: "Workspace",
    status: "active",
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:01:00.000Z",
    convertedFrom: null,
    messageCount: 1,
    firstMessageAt: "2026-04-28T10:00:00.000Z",
    lastToolUsed: null,
    sessionSource: "chat",
    promptVersion: null,
    routingSnapshot: createConversationRoutingSnapshot({
      detectedNeedSummary: "Need a workspace snapshot",
      recommendedNextStep: "Review the queue",
    }),
    referralSource: null,
    ...overrides,
  };
}

describe("RepositoryBackedWorkspaceSnapshotReader", () => {
  it("returns null when the user has no active conversation", async () => {
    const reader = new RepositoryBackedWorkspaceSnapshotReader({
      conversationRepository: {
        findActiveByUser: vi.fn().mockResolvedValue(null),
      } as unknown as ConversationRepository,
      jobQueueRepository: { listJobsByConversation: vi.fn() } as unknown as JobQueueRepository,
      assetCatalogReader: { listConversationAssets: vi.fn() } as unknown as AssetCatalogReader,
    });

    await expect(reader.findActiveByUser("usr_missing")).resolves.toBeNull();
  });

  it("hydrates a workspace snapshot from conversation, active jobs, files, and optional refs", async () => {
    const reader = new RepositoryBackedWorkspaceSnapshotReader({
      conversationRepository: {
        findById: vi.fn().mockResolvedValue(makeConversation()),
      } as unknown as ConversationRepository,
      jobQueueRepository: {
        listJobsByConversation: vi.fn().mockResolvedValue([
          {
            id: "job_1",
            conversationId: "conv_1",
            userId: "usr_1",
            toolName: "compose_media",
            status: "queued",
            priority: 0,
            dedupeKey: null,
            initiatorType: "user",
            requestPayload: {},
            resultPayload: null,
            errorMessage: null,
            progressPercent: null,
            progressLabel: null,
            attemptCount: 0,
            leaseExpiresAt: null,
            claimedBy: null,
            failureClass: null,
            nextRetryAt: null,
            recoveryMode: null,
            lastCheckpointId: null,
            replayedFromJobId: null,
            supersededByJobId: null,
            createdAt: "2026-04-28T10:02:00.000Z",
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-04-28T10:02:00.000Z",
          },
        ]),
      } as unknown as JobQueueRepository,
      assetCatalogReader: {
        listConversationAssets: vi.fn().mockResolvedValue([
          {
            assetId: "file_1",
            kind: "image",
            status: "ready",
            label: "asset.png",
            fileName: "asset.png",
            mimeType: "image/png",
            source: "uploaded",
            retentionClass: "conversation",
            createdAt: "2026-04-28T10:03:00.000Z",
            updatedAt: "2026-04-28T10:03:00.000Z",
            conversationId: "conv_1",
            producedByJobId: "job_1",
            materializationKey: "compose_media:key_1",
          },
        ]),
      } as unknown as AssetCatalogReader,
      workflowContextReader: {
        findById: vi.fn(),
        findByConversationId: vi.fn().mockResolvedValue({
          id: "bwc_conv_1",
          userId: "usr_1",
          conversationId: "conv_1",
          primaryMode: "revenue",
          origin: null,
          relatedRefs: [],
          lifecycleRefs: [],
          notificationRefs: [],
          interruptedTurnRefs: [],
          healthRefs: [],
          recommendedAction: null,
          updatedAt: "2026-04-28T10:04:00.000Z",
        }),
      },
      operatorTransitionReader: {
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findByConversationId: vi.fn().mockResolvedValue({
          id: "otp_usr_1",
          userId: "usr_1",
          conversationId: "conv_1",
          status: "sharing",
          operatorMode: "community_affiliate",
          expertiseRefs: [],
          audienceRefs: [],
          offerRefs: [],
          trustDistributionRef: null,
          recommendedAction: null,
          updatedAt: "2026-04-28T10:05:00.000Z",
        }),
      },
      trustDistributionReader: {
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findByConversationId: vi.fn().mockResolvedValue({
          id: "tdc_usr_1",
          userId: "usr_1",
          conversationId: "conv_1",
          referralCode: null,
          referralUrl: null,
          qrCodeUrl: null,
          physicalShareAssets: [],
          introScripts: [],
          activeCampaignRefs: [],
          recentReferralRefs: [],
          recommendedAction: null,
          updatedAt: "2026-04-28T10:06:00.000Z",
        }),
      },
      promptBindingReader: {
        findById: vi.fn(),
        findByTarget: vi.fn(),
        listByConversation: vi.fn().mockResolvedValue([
          {
            id: "pb_1",
            userId: "usr_1",
            conversationId: "conv_1",
            surface: "chat_stream",
            targetKind: "message",
            targetId: "msg_1",
            sourcePromptBindingId: null,
            effectiveHash: "hash_1",
            slotRefs: [],
            overlayRefs: [],
            requestRefs: [],
            decisionSourceRefs: [],
            evidenceRefs: [],
            createdAt: "2026-04-28T10:07:00.000Z",
          },
        ]),
        listBySourcePromptBinding: vi.fn(),
      },
    });

    const snapshot = await reader.findByConversationId("conv_1");

    expect(snapshot).toEqual(expect.objectContaining({
      id: "workspace:conv_1",
      conversationId: "conv_1",
      workflowContextRef: "bwc_conv_1",
      operatorTransitionRef: "otp_usr_1",
      trustDistributionRef: "tdc_usr_1",
      latestPromptBindingRef: "pb_1",
    }));
    expect(snapshot?.activeJobRefs).toEqual([
      expect.objectContaining({ jobId: "job_1", status: "queued" }),
    ]);
    expect(snapshot?.importantAssetRefs).toEqual([
      expect.objectContaining({ assetId: "file_1", kind: "image", producedByJobId: "job_1", materializationKey: "compose_media:key_1" }),
    ]);
  });

  it("includes conversation-linked materialized assets even when the file belongs to another conversation", async () => {
    const reader = new RepositoryBackedWorkspaceSnapshotReader({
      conversationRepository: {
        findById: vi.fn().mockResolvedValue(makeConversation()),
      } as unknown as ConversationRepository,
      jobQueueRepository: {
        listJobsByConversation: vi.fn().mockResolvedValue([]),
      } as unknown as JobQueueRepository,
      assetCatalogReader: {
        listConversationAssets: vi.fn().mockResolvedValue([
          {
            assetId: "file_reused_1",
            kind: "video",
            status: "ready",
            label: "reused.mp4",
            fileName: "reused.mp4",
            mimeType: "video/mp4",
            source: "generated",
            retentionClass: "conversation",
            createdAt: "2026-04-28T09:00:00.000Z",
            updatedAt: "2026-04-28T10:10:00.000Z",
            conversationId: "conv_source",
            producedByJobId: "job_completed_1",
            materializationKey: "compose_media:key_reused",
          },
        ]),
      } as unknown as AssetCatalogReader,
    });

    const snapshot = await reader.findByConversationId("conv_1");

    expect(snapshot?.importantAssetRefs).toEqual([
      expect.objectContaining({
        assetId: "file_reused_1",
        kind: "video",
        producedByJobId: "job_completed_1",
        materializationKey: "compose_media:key_reused",
        updatedAt: "2026-04-28T10:10:00.000Z",
      }),
    ]);
  });

  it("supports deterministic workspace-prefixed ids", async () => {
    const findById = vi.fn().mockResolvedValue(makeConversation());
    const reader = new RepositoryBackedWorkspaceSnapshotReader({
      conversationRepository: { findById } as unknown as ConversationRepository,
      jobQueueRepository: { listJobsByConversation: vi.fn().mockResolvedValue([]) } as unknown as JobQueueRepository,
      assetCatalogReader: { listConversationAssets: vi.fn().mockResolvedValue([]) } as unknown as AssetCatalogReader,
    });

    await expect(reader.findById("not-a-workspace-id")).resolves.toBeNull();
    await expect(reader.findById("workspace:conv_1")).resolves.toEqual(expect.objectContaining({
      conversationId: "conv_1",
    }));
    expect(findById).toHaveBeenCalledWith("conv_1");
  });

  it("degrades gracefully when optional enrichment readers fail", async () => {
    const reader = new RepositoryBackedWorkspaceSnapshotReader({
      conversationRepository: {
        findById: vi.fn().mockResolvedValue(makeConversation()),
      } as unknown as ConversationRepository,
      jobQueueRepository: {
        listJobsByConversation: vi.fn().mockResolvedValue([]),
      } as unknown as JobQueueRepository,
      assetCatalogReader: {
        listConversationAssets: vi.fn().mockResolvedValue([]),
      } as unknown as AssetCatalogReader,
      workflowContextReader: {
        findById: vi.fn(),
        findByConversationId: vi.fn().mockRejectedValue(new Error("workflow unavailable")),
      },
      operatorTransitionReader: {
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findByConversationId: vi.fn().mockRejectedValue(new Error("operator unavailable")),
      },
      trustDistributionReader: {
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findByConversationId: vi.fn().mockRejectedValue(new Error("trust unavailable")),
      },
      relationshipMemoryReader: {
        findById: vi.fn(),
        listActiveByConversation: vi.fn().mockRejectedValue(new Error("memory unavailable")),
        listActiveByUser: vi.fn(),
      },
      promptBindingReader: {
        findById: vi.fn(),
        findByTarget: vi.fn(),
        listByConversation: vi.fn().mockRejectedValue(new Error("binding unavailable")),
        listBySourcePromptBinding: vi.fn(),
      },
    });

    await expect(reader.findByConversationId("conv_1")).resolves.toEqual(
      expect.objectContaining({
        id: "workspace:conv_1",
        workflowContextRef: null,
        operatorTransitionRef: null,
        trustDistributionRef: null,
        latestMemoryRef: null,
        latestPromptBindingRef: null,
      }),
    );
  });
});
