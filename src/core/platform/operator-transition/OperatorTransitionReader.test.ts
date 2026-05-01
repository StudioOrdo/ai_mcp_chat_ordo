import { describe, expect, it, vi } from "vitest";

import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";

import { RepositoryBackedOperatorTransitionReader } from "./OperatorTransitionReader";

function makeProfile(overrides: Partial<import("@/lib/profile/types").UserProfileViewModel> = {}) {
  return {
    id: "usr_1",
    email: "user@example.com",
    name: "Operator",
    credential: "Operations consultant",
    pushNotificationsEnabled: true,
    affiliateEnabled: true,
    referralCode: "ORDO-42",
    referralUrl: "/r/ORDO-42",
    qrCodeUrl: "/api/qr/ORDO-42",
    roles: ["AUTHENTICATED"],
    ...overrides,
  };
}

describe("RepositoryBackedOperatorTransitionReader", () => {
  it("returns null when the profile does not exist", async () => {
    const reader = new RepositoryBackedOperatorTransitionReader({
      profileReader: { getProfile: vi.fn().mockResolvedValue(null) },
      trustDistributionReader: { findByUserId: vi.fn(), findById: vi.fn(), findByConversationId: vi.fn() } as unknown as TrustDistributionReader,
    });

    await expect(reader.findByUserId("missing")).resolves.toBeNull();
  });

  it("hydrates a conversation-scoped operator profile with workflow and trust state", async () => {
    const reader = new RepositoryBackedOperatorTransitionReader({
      conversationRepository: {
        findById: vi.fn().mockResolvedValue({ id: "conv_1", userId: "usr_1" }),
      } as unknown as ConversationRepository,
      profileReader: { getProfile: vi.fn().mockResolvedValue(makeProfile()) },
      trustDistributionReader: {
        findByConversationId: vi.fn().mockResolvedValue({
          id: "tdc_usr_1",
          userId: "usr_1",
          conversationId: "conv_1",
          referralCode: "ORDO-42",
          referralUrl: "/r/ORDO-42",
          qrCodeUrl: "/api/qr/ORDO-42",
          physicalShareAssets: [],
          introScripts: [],
          activeCampaignRefs: [],
          recentReferralRefs: [],
          recommendedAction: { kind: "share", label: "Share your referral QR", targetRef: null },
          updatedAt: "2026-04-28T12:00:00.000Z",
        }),
      } as unknown as TrustDistributionReader,
      businessWorkflowContextReader: {
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
          updatedAt: "2026-04-28T12:00:00.000Z",
        }),
      } as unknown as BusinessWorkflowContextReader,
    });

    const profile = await reader.findByConversationId("conv_1");

    expect(profile).toEqual(expect.objectContaining({
      userId: "usr_1",
      conversationId: "conv_1",
      operatorMode: "community_affiliate",
      status: "operating",
    }));
  });

  it("uses active business workflow context for user-scoped established operators", async () => {
    const reader = new RepositoryBackedOperatorTransitionReader({
      conversationRepository: {
        findActiveByUser: vi.fn().mockResolvedValue({ id: "conv_active", userId: "usr_1" }),
      } as unknown as ConversationRepository,
      profileReader: {
        getProfile: vi.fn().mockResolvedValue(makeProfile({
          affiliateEnabled: false,
          referralCode: null,
          referralUrl: null,
          qrCodeUrl: null,
          credential: undefined,
        })),
      },
      trustDistributionReader: {
        findByUserId: vi.fn().mockResolvedValue(null),
        findById: vi.fn(),
        findByConversationId: vi.fn(),
      } as unknown as TrustDistributionReader,
      businessWorkflowContextReader: {
        findByConversationId: vi.fn().mockResolvedValue({
          id: "bwc_conv_active",
          userId: "usr_1",
          conversationId: "conv_active",
          primaryMode: "service",
          origin: null,
          relatedRefs: [],
          lifecycleRefs: [],
          notificationRefs: [],
          interruptedTurnRefs: [],
          healthRefs: [],
          recommendedAction: null,
          updatedAt: "2026-04-28T12:00:00.000Z",
        }),
      } as unknown as BusinessWorkflowContextReader,
    });

    const profile = await reader.findByUserId("usr_1");

    expect(profile).toEqual(expect.objectContaining({
      userId: "usr_1",
      conversationId: null,
      operatorMode: "existing_business",
      status: "operating",
    }));
  });
});
