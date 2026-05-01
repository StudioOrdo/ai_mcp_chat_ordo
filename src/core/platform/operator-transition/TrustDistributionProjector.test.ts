import { describe, expect, it } from "vitest";

import type { RoleName } from "@/core/entities/user";
import { projectTrustDistributionContext } from "./TrustDistributionProjector";

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
    roles: ["AUTHENTICATED"] as RoleName[],
    ...overrides,
  };
}

describe("projectTrustDistributionContext", () => {
  it("returns share-ready context for an enabled affiliate", () => {
    const context = projectTrustDistributionContext({
      userId: "usr_1",
      conversationId: "conv_1",
      profile: makeProfile(),
      recentActivity: [],
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(context.referralCode).toBe("ORDO-42");
    expect(context.referralUrl).toBe("/r/ORDO-42");
    expect(context.qrCodeUrl).toBe("/api/qr/ORDO-42");
    expect(context.recommendedAction).toEqual(expect.objectContaining({ kind: "share" }));
  });

  it("returns setup guidance when affiliate sharing is unavailable", () => {
    const context = projectTrustDistributionContext({
      userId: "usr_1",
      conversationId: null,
      profile: makeProfile({
        affiliateEnabled: false,
        referralCode: null,
        referralUrl: null,
        qrCodeUrl: null,
      }),
      recentActivity: [],
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(context.referralCode).toBeNull();
    expect(context.recommendedAction).toEqual(expect.objectContaining({ kind: "resolve_setup" }));
  });

  it("projects recent referral activity into compact refs and follow-up guidance", () => {
    const context = projectTrustDistributionContext({
      userId: "usr_1",
      conversationId: "conv_1",
      profile: makeProfile(),
      recentActivity: [{
        id: "evt_1",
        referralId: "ref_1",
        referralCode: "ORDO-42",
        milestone: "qualified_opportunity",
        title: "Qualified opportunity",
        description: "A referred conversation reached a downstream milestone.",
        occurredAt: "2026-04-28T11:59:00.000Z",
        href: "/referrals",
      }],
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(context.recentReferralRefs).toEqual([
      expect.objectContaining({ kind: "referral", id: "ref_1", status: "qualified_opportunity" }),
    ]);
    expect(context.recommendedAction).toEqual(expect.objectContaining({ kind: "follow_up" }));
  });
});
