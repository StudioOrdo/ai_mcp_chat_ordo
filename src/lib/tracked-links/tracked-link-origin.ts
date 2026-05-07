import { resolveReferralPublicOrigin } from "@/lib/referrals/referral-origin";

export function buildTrackedLinkPath(code: string): string {
  return `/t/${encodeURIComponent(code)}`;
}

export function buildTrackedLinkQrPath(code: string): string {
  return `/api/qr/tracked/${encodeURIComponent(code)}`;
}

export function buildPublicTrackedLinkUrl(code: string): string {
  return new URL(buildTrackedLinkPath(code), `${resolveReferralPublicOrigin().origin}/`).toString();
}
