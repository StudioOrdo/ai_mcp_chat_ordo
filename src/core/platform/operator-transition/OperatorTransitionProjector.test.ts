import { describe, expect, it } from "vitest";

import type { RoleName } from "@/core/entities/user";
import { projectOperatorTransitionProfile } from "./OperatorTransitionProjector";

function makeProfile(overrides: Partial<import("@/lib/profile/types").UserProfileViewModel> = {}) {
  return {
    id: "usr_1",
    email: "user@example.com",
    name: "Operator",
    credential: "Operations consultant",
    pushNotificationsEnabled: true,
    affiliateEnabled: false,
    referralCode: null,
    referralUrl: null,
    qrCodeUrl: null,
    roles: ["AUTHENTICATED"] as RoleName[],
    ...overrides,
  };
}

describe("projectOperatorTransitionProfile", () => {
  it("starts a credentialed user in discovering-offer mode when no share or workflow evidence exists", () => {
    const profile = projectOperatorTransitionProfile({
      userId: "usr_1",
      conversationId: null,
      profile: makeProfile(),
      trustDistribution: null,
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(profile.operatorMode).toBe("career_transition");
    expect(profile.status).toBe("discovering_offer");
    expect(profile.recommendedAction).toEqual(expect.objectContaining({ kind: "clarify_offer" }));
  });

  it("moves a share-ready affiliate into sharing mode", () => {
    const profile = projectOperatorTransitionProfile({
      userId: "usr_1",
      conversationId: "conv_1",
      profile: makeProfile({
        affiliateEnabled: true,
        referralCode: "ORDO-42",
        referralUrl: "/r/ORDO-42",
        qrCodeUrl: "/api/qr/ORDO-42",
      }),
      trustDistribution: {
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
        recommendedAction: {
          kind: "share",
          label: "Share your referral QR",
          targetRef: null,
        },
        updatedAt: "2026-04-28T12:00:00.000Z",
      },
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(profile.operatorMode).toBe("community_affiliate");
    expect(profile.status).toBe("sharing");
    expect(profile.recommendedAction).toEqual(expect.objectContaining({ kind: "share" }));
  });

  it("surfaces admin pressure as an operate recommendation", () => {
    const profile = projectOperatorTransitionProfile({
      userId: "usr_admin",
      conversationId: null,
      profile: makeProfile({ roles: ["ADMIN"] }),
      trustDistribution: null,
      adminPressure: {
        total: 2,
        counts: {
          invalid_referral_source: 0,
          missing_referral_join: 0,
          disabled_referral_code: 0,
          credit_review_backlog: 2,
        },
        items: [],
      },
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(profile.operatorMode).toBe("internal_admin");
    expect(profile.recommendedAction).toEqual(expect.objectContaining({ kind: "operate" }));
  });

  it("backs expertise evidence with the profile authority instead of the projection itself", () => {
    const profile = projectOperatorTransitionProfile({
      userId: "usr_1",
      conversationId: "conv_1",
      profile: makeProfile(),
      trustDistribution: null,
      observedAt: "2026-04-28T12:00:00.000Z",
    });

    expect(profile.expertiseRefs).toEqual([
      expect.objectContaining({
        evidenceRefs: [
          expect.objectContaining({
            source: expect.objectContaining({
              sourceKind: "user_profile",
              sourceId: "usr_1",
              conversationId: "conv_1",
            }),
          }),
        ],
      }),
    ]);
  });
});
