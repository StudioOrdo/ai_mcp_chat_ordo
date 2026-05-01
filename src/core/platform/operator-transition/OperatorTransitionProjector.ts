import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type {
  OperatorMode,
  OperatorTransitionAction,
  OperatorTransitionProfile,
  OperatorTransitionStatus,
} from "@/core/entities/operator-transition";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { AdminReferralExceptionsResult } from "@/lib/referrals/admin-referral-analytics";

export interface OperatorTransitionProjectionInput {
  userId: string;
  conversationId: string | null;
  profile: UserProfileViewModel;
  trustDistribution: TrustDistributionContext | null;
  businessWorkflowContext?: BusinessWorkflowContext | null;
  adminPressure?: AdminReferralExceptionsResult | null;
  readiness?: { status: "ok" | "error"; details?: string } | null;
  observedAt: string;
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function hasRole(profile: UserProfileViewModel, role: "ADMIN" | "STAFF"): boolean {
  return profile.roles.includes(role);
}

function chooseOperatorMode(input: OperatorTransitionProjectionInput): OperatorMode {
  if (hasRole(input.profile, "ADMIN") || hasRole(input.profile, "STAFF")) {
    return "internal_admin";
  }

  if (input.profile.affiliateEnabled && input.profile.referralCode) {
    return "community_affiliate";
  }

  if (input.businessWorkflowContext && ["revenue", "service", "operations"].includes(input.businessWorkflowContext.primaryMode)) {
    return "existing_business";
  }

  if (trimToNull(input.profile.credential)) {
    return "career_transition";
  }

  return "new_solo_offer";
}

function chooseStatus(input: OperatorTransitionProjectionInput): OperatorTransitionStatus {
  if (input.trustDistribution && input.trustDistribution.recentReferralRefs.length > 0) {
    return "following_up";
  }

  if (input.businessWorkflowContext && ["revenue", "service", "operations"].includes(input.businessWorkflowContext.primaryMode)) {
    return "operating";
  }

  if (input.trustDistribution && (input.trustDistribution.referralUrl || input.trustDistribution.qrCodeUrl)) {
    return "sharing";
  }

  if (trimToNull(input.profile.credential)) {
    return "discovering_offer";
  }

  return "not_started";
}

function buildRecommendedAction(input: OperatorTransitionProjectionInput): OperatorTransitionAction | null {
  if (input.readiness?.status === "error") {
    return {
      kind: "resolve_setup",
      label: trimToNull(input.readiness.details) ?? "Resolve setup blocker",
      targetRef: {
        sourceKind: "operator_transition_profile",
        sourceId: `otp_${input.userId}`,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  if ((input.adminPressure?.total ?? 0) > 0 && (hasRole(input.profile, "ADMIN") || hasRole(input.profile, "STAFF"))) {
    return {
      kind: "operate",
      label: "Review affiliate exceptions",
      targetRef: {
        sourceKind: "operator_transition_profile",
        sourceId: `otp_${input.userId}`,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  if (input.trustDistribution?.recommendedAction) {
    return input.trustDistribution.recommendedAction;
  }

  if (input.businessWorkflowContext?.recommendedAction) {
    const kind = input.businessWorkflowContext.recommendedAction.kind;
    return {
      kind: kind === "continue" || kind === "review" || kind === "retry" || kind === "configure"
        ? "operate"
        : kind,
      label: input.businessWorkflowContext.recommendedAction.label,
      targetRef: input.businessWorkflowContext.recommendedAction.targetRef,
    };
  }

  if (trimToNull(input.profile.credential)) {
    return {
      kind: "clarify_offer",
      label: "Clarify your first offer",
      targetRef: {
        sourceKind: "operator_transition_profile",
        sourceId: `otp_${input.userId}`,
        userId: input.userId,
        conversationId: input.conversationId,
      },
    };
  }

  return null;
}

export function projectOperatorTransitionProfile(
  input: OperatorTransitionProjectionInput,
): OperatorTransitionProfile {
  const credential = trimToNull(input.profile.credential);

  return {
    id: `otp_${input.userId}`,
    userId: input.userId,
    conversationId: input.conversationId,
    status: chooseStatus(input),
    operatorMode: chooseOperatorMode(input),
    expertiseRefs: credential
      ? [{
          id: `expertise_${input.userId}_credential`,
          label: credential,
          evidenceRefs: [{
            source: {
              sourceKind: "user_profile",
              sourceId: input.userId,
              userId: input.userId,
              conversationId: input.conversationId,
            },
            observedAt: input.observedAt,
            summary: "Profile credential",
          }],
        }]
      : [],
    audienceRefs: [],
    offerRefs: [],
    trustDistributionRef: input.trustDistribution?.id ?? null,
    recommendedAction: buildRecommendedAction(input),
    updatedAt: input.observedAt,
  };
}