import type { RoleName } from "@/core/entities/user";

export type AccountTier = "account" | "premium";

export type ContentAudience =
  | "public"
  | "member"
  | "account"
  | "premium"
  | "apprentice"
  | "staff"
  | "admin";

export const ACCOUNT_TIER_PREFERENCE_KEY = "account_tier";

const AUDIENCE_ROLES: Record<ContentAudience, readonly RoleName[]> = {
  public: ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
  member: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
  account: ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"],
  premium: ["STAFF", "ADMIN"],
  apprentice: ["APPRENTICE", "STAFF", "ADMIN"],
  staff: ["STAFF", "ADMIN"],
  admin: ["ADMIN"],
};

export function getAudienceRoles(audience: ContentAudience): readonly RoleName[] {
  return AUDIENCE_ROLES[audience];
}

export function canAccessAudience(audience: ContentAudience, role: RoleName): boolean {
  return AUDIENCE_ROLES[audience].includes(role);
}

export function isContentAudience(value: string): value is ContentAudience {
  return (
    value === "public" ||
    value === "member" ||
    value === "account" ||
    value === "premium" ||
    value === "apprentice" ||
    value === "staff" ||
    value === "admin"
  );
}

export function getPrimaryRole(roles: readonly RoleName[]): RoleName {
  return roles[0] ?? "ANONYMOUS";
}

const DENIED_AUDIENCE_PRIORITY: Record<RoleName, readonly ContentAudience[]> = {
  ANONYMOUS: ["account", "premium", "apprentice", "member", "staff", "admin"],
  AUTHENTICATED: ["premium", "apprentice", "staff", "admin"],
  APPRENTICE: ["premium", "staff", "admin"],
  STAFF: ["admin"],
  ADMIN: [],
};

export function getDeniedAudienceForRole(
  audiences: readonly ContentAudience[],
  role: RoleName,
): ContentAudience | null {
  const audienceSet = new Set(audiences);
  for (const audience of DENIED_AUDIENCE_PRIORITY[role]) {
    if (audienceSet.has(audience)) {
      return audience;
    }
  }
  return null;
}

const ALL_AUDIENCES: readonly ContentAudience[] = [
  "public",
  "member",
  "account",
  "premium",
  "apprentice",
  "staff",
  "admin",
];

export function canUserAccessAudience({
  audience,
  role,
  tier,
}: {
  audience: ContentAudience;
  role: RoleName;
  tier?: string;
}): boolean {
  if (audience === "premium" && tier === "premium" && (role === "AUTHENTICATED" || role === "APPRENTICE")) {
    return true;
  }
  return canAccessAudience(audience, role);
}

export function getDeniedAudienceForUser(
  audiences: readonly ContentAudience[],
  role: RoleName,
  tier?: string,
): ContentAudience | null {
  const audienceSet = new Set(audiences);
  for (const audience of DENIED_AUDIENCE_PRIORITY[role]) {
    if (!audienceSet.has(audience)) continue;
    if (audience === "premium" && tier === "premium") continue;
    return audience;
  }
  return null;
}

export function getAllowedAudiencesForUser({
  role,
  tier,
}: {
  role: RoleName;
  tier?: string;
}): ContentAudience[] {
  return ALL_AUDIENCES.filter((audience) => canUserAccessAudience({ audience, role, tier }));
}
