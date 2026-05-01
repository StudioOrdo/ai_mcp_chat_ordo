import type { CanonicalEvidenceRef, ContinuitySourceRef } from "./conversation-continuity";

export type OperatorTransitionStatus =
  | "not_started"
  | "discovering_offer"
  | "building_first_motion"
  | "sharing"
  | "following_up"
  | "operating";

export type OperatorMode =
  | "existing_business"
  | "new_solo_offer"
  | "career_transition"
  | "community_affiliate"
  | "internal_admin";

export type OperatorTransitionActionKind = "clarify_offer" | "prepare_share" | "share" | "follow_up" | "resolve_setup" | "operate";

export interface OperatorExpertiseRef {
  id: string;
  label: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface OperatorAudienceRef {
  id: string;
  label: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface OperatorOfferRef {
  id: string;
  label: string;
  status: "draft" | "ready" | "shared" | "retired";
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface OperatorTransitionAction {
  kind: OperatorTransitionActionKind;
  label: string;
  targetRef: ContinuitySourceRef | null;
}

export interface OperatorTransitionProfile {
  id: string;
  userId: string;
  conversationId: string | null;
  status: OperatorTransitionStatus;
  operatorMode: OperatorMode;
  expertiseRefs: readonly OperatorExpertiseRef[];
  audienceRefs: readonly OperatorAudienceRef[];
  offerRefs: readonly OperatorOfferRef[];
  trustDistributionRef: string | null;
  recommendedAction: OperatorTransitionAction | null;
  updatedAt: string;
}

export function isOperatorTransitionInMotion(profile: OperatorTransitionProfile): boolean {
  return profile.status !== "not_started" && profile.status !== "operating";
}