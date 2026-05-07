import { getInstanceIdentity } from "@/lib/config/instance";
import { resolvePublicOrigin } from "@/lib/appliance/network/public-origin";

import { buildReferralPath } from "@/lib/referrals/referral-links";

export type ReferralOriginSource =
  | "environment"
  | "development-localhost"
  | "instance-domain";

export interface ReferralOriginResolution {
  origin: string;
  source: ReferralOriginSource;
  localhostFallback: boolean;
  invalidConfiguredOrigin: string | null;
}

export function resolveReferralPublicOrigin(): ReferralOriginResolution {
  const resolution = resolvePublicOrigin();
  const configuredOrigin = process.env.ORDO_PUBLIC_ORIGIN?.trim()
    || process.env.PUBLIC_SITE_ORIGIN?.trim()
    || process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim()
    || null;
  const invalidConfiguredOrigin = resolution.errors.some((error) => error.includes("valid absolute URL"))
    ? configuredOrigin
    : null;

  return {
    origin: resolution.origin ?? `https://${getInstanceIdentity().domain}`,
    source: resolution.source === "development_localhost"
      ? "development-localhost"
      : resolution.source === "instance_domain"
        ? "instance-domain"
        : "environment",
    localhostFallback: resolution.source === "development_localhost",
    invalidConfiguredOrigin,
  };
}

export function buildPublicReferralUrl(referralCode: string): string {
  return new URL(buildReferralPath(referralCode), `${resolveReferralPublicOrigin().origin}/`).toString();
}
