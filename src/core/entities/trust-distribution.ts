import type { BusinessObjectRef, CanonicalEvidenceRef, ContinuitySourceRef } from "./conversation-continuity";
import type { OperatorTransitionAction } from "./operator-transition";

export type TrustShareAssetKind = "qr_code" | "referral_link" | "physical_card" | "image" | "document";
export type TrustCampaignStatus = "draft" | "active" | "paused" | "completed" | "retired";

export interface TrustShareAssetRef {
  assetId: string;
  kind: TrustShareAssetKind;
  label: string;
  source: ContinuitySourceRef;
}

export interface TrustIntroScript {
  id: string;
  label: string;
  text: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface TrustCampaignRef {
  campaignId: string;
  status: TrustCampaignStatus;
  label: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface TrustDistributionContext {
  id: string;
  userId: string;
  conversationId: string | null;
  referralCode: string | null;
  referralUrl: string | null;
  qrCodeUrl: string | null;
  physicalShareAssets: readonly TrustShareAssetRef[];
  introScripts: readonly TrustIntroScript[];
  activeCampaignRefs: readonly TrustCampaignRef[];
  recentReferralRefs: readonly BusinessObjectRef[];
  recommendedAction: OperatorTransitionAction | null;
  updatedAt: string;
}

export function canShareTrustDistribution(context: TrustDistributionContext): boolean {
  return Boolean(context.referralUrl || context.qrCodeUrl || context.physicalShareAssets.length > 0);
}