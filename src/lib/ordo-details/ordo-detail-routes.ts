export function studioMediaDetailHref(assetId: string): string {
  return `/studio/media/${encodeURIComponent(assetId)}`;
}

export function studioWorkflowDetailHref(workflowId: string): string {
  return `/studio/workflows/${encodeURIComponent(workflowId)}`;
}

export function studioContentDetailHref(contentId: string): string {
  return `/studio/content/${encodeURIComponent(contentId)}`;
}

export function studioCampaignDetailHref(campaignId: string): string {
  return `/studio/campaigns/${encodeURIComponent(campaignId)}`;
}

export function businessReferralDetailHref(referralCode: string): string {
  return `/business/referrals/${encodeURIComponent(referralCode)}`;
}

export function businessConversationDetailHref(conversationId: string): string {
  return `/business/conversations/${encodeURIComponent(conversationId)}`;
}

export function businessPersonDetailHref(personId: string): string {
  return `/business/people/${encodeURIComponent(personId)}`;
}

export function businessOfferDetailHref(offerId: string): string {
  return `/offers?offerId=${encodeURIComponent(offerId)}`;
}
