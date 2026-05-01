import { describe, expect, it, vi } from "vitest";

import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";

import { RepositoryBackedTrustDistributionReader } from "./TrustDistributionReader";

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

describe("RepositoryBackedTrustDistributionReader", () => {
  it("returns null when the profile does not exist", async () => {
    const reader = new RepositoryBackedTrustDistributionReader({
      profileReader: { getProfile: vi.fn().mockResolvedValue(null) },
      activityReader: { getRecentActivity: vi.fn().mockResolvedValue([]) },
    });

    await expect(reader.findByUserId("missing")).resolves.toBeNull();
  });

  it("hydrates a conversation-scoped trust context from the conversation owner", async () => {
    const reader = new RepositoryBackedTrustDistributionReader({
      conversationRepository: {
        findById: vi.fn().mockResolvedValue({ id: "conv_1", userId: "usr_1" }),
      } as unknown as ConversationRepository,
      profileReader: { getProfile: vi.fn().mockResolvedValue(makeProfile()) },
      activityReader: {
        getRecentActivity: vi.fn().mockResolvedValue([{ 
          id: "evt_1",
          referralId: "ref_1",
          referralCode: "ORDO-42",
          milestone: "conversation_started",
          title: "Started chat",
          description: "A referred visitor started a chat.",
          occurredAt: "2026-04-28T12:00:00.000Z",
          href: "/referrals",
        }]),
      },
    });

    const context = await reader.findByConversationId("conv_1");

    expect(context).toEqual(expect.objectContaining({
      userId: "usr_1",
      conversationId: "conv_1",
    }));
    expect(context?.recentReferralRefs).toEqual([
      expect.objectContaining({ id: "ref_1", status: "conversation_started" }),
    ]);
    expect(context?.recommendedAction).toEqual(expect.objectContaining({
      targetRef: expect.objectContaining({
        conversationId: "conv_1",
      }),
    }));
  });
});