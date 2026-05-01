import type { BusinessObjectRef } from "@/core/entities/conversation-continuity";
import type { OperatorTransitionAction } from "@/core/entities/operator-transition";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { AdminReferralExceptionsResult } from "@/lib/referrals/admin-referral-analytics";
import type { ReferralActivityItem } from "@/lib/referrals/referral-milestones";

export interface TrustDistributionProjectionInput {
  userId: string;
  conversationId: string | null;
  profile: UserProfileViewModel;
  recentActivity: readonly ReferralActivityItem[];
  adminPressure?: AdminReferralExceptionsResult | null;
  readiness?: { status: "ok" | "error"; details?: string } | null;
  observedAt: string;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function buildRecentReferralRefs(activity: readonly ReferralActivityItem[]): BusinessObjectRef[] {
  return activity.map((item) => ({
    kind: "referral",
    id: item.referralId,
    userId: null,
    conversationId: null,
    label: trimToNull(item.title) ?? `Referral ${item.referralCode}`,
    status: item.milestone,
  }));
}

function buildRecommendedAction(input: TrustDistributionProjectionInput): OperatorTransitionAction | null {
  if (input.readiness?.status === "error") {
    return {
      kind: "resolve_setup",
      label: trimToNull(input.readiness.details) ?? "Resolve setup blocker",
      targetRef: {
        sourceKind: "trust_distribution_context",
        sourceId: `tdc_${input.userId}`,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  if (!input.profile.affiliateEnabled || !input.profile.referralCode || !input.profile.referralUrl || !input.profile.qrCodeUrl) {
    return {
      kind: "resolve_setup",
      label: "Enable referral sharing",
      targetRef: {
        sourceKind: "trust_distribution_context",
        sourceId: `tdc_${input.userId}`,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  if ((input.adminPressure?.total ?? 0) > 0) {
    return {
      kind: "follow_up",
      label: "Review affiliate exceptions",
      targetRef: {
        sourceKind: "trust_distribution_context",
        sourceId: `tdc_${input.userId}`,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  if (input.recentActivity.length > 0) {
    const latest = input.recentActivity[0];
    return {
      kind: "follow_up",
      label: latest.title,
      targetRef: {
        sourceKind: "referral",
        sourceId: latest.referralId,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  return {
    kind: "share",
    label: "Share your referral QR",
    targetRef: {
      sourceKind: "trust_distribution_context",
      sourceId: `tdc_${input.userId}`,
      userId: input.userId,
      conversationId: input.conversationId,
    },
  };
}

export function projectTrustDistributionContext(
  input: TrustDistributionProjectionInput,
): TrustDistributionContext {
  return {
    id: `tdc_${input.userId}`,
    userId: input.userId,
    conversationId: input.conversationId,
    referralCode: input.profile.affiliateEnabled ? input.profile.referralCode : null,
    referralUrl: input.profile.affiliateEnabled ? input.profile.referralUrl : null,
    qrCodeUrl: input.profile.affiliateEnabled ? input.profile.qrCodeUrl : null,
    physicalShareAssets: [],
    introScripts: [],
    activeCampaignRefs: [],
    recentReferralRefs: buildRecentReferralRefs(input.recentActivity),
    recommendedAction: buildRecommendedAction(input),
    updatedAt: input.observedAt,
  };
}