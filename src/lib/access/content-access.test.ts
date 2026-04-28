import { describe, expect, it } from "vitest";

import {
  canAccessAudience,
  canUserAccessAudience,
  getAllowedAudiencesForUser,
  getDeniedAudienceForRole,
  getDeniedAudienceForUser,
  ACCOUNT_TIER_PREFERENCE_KEY,
} from "@/lib/access/content-access";

describe("canUserAccessAudience (Phase 1)", () => {
  it("matches canAccessAudience when tier is undefined", () => {
    const audiences = ["public", "account", "premium", "apprentice", "staff", "admin"] as const;
    const roles = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"] as const;
    for (const audience of audiences) {
      for (const role of roles) {
        expect(canUserAccessAudience({ audience, role })).toBe(
          canAccessAudience(audience, role),
        );
      }
    }
  });

  it("widens premium access for AUTHENTICATED and APPRENTICE users on premium tier", () => {
    expect(canUserAccessAudience({ audience: "premium", role: "AUTHENTICATED", tier: "premium" })).toBe(true);
    expect(canUserAccessAudience({ audience: "premium", role: "APPRENTICE", tier: "premium" })).toBe(true);
  });

  it("does not widen non-premium audiences for premium tier", () => {
    expect(canUserAccessAudience({ audience: "admin", role: "AUTHENTICATED", tier: "premium" })).toBe(false);
    expect(canUserAccessAudience({ audience: "staff", role: "AUTHENTICATED", tier: "premium" })).toBe(false);
    expect(canUserAccessAudience({ audience: "apprentice", role: "AUTHENTICATED", tier: "premium" })).toBe(false);
  });

  it("does not grant premium access for account tier", () => {
    expect(canUserAccessAudience({ audience: "premium", role: "AUTHENTICATED", tier: "account" })).toBe(false);
  });

  it("does not grant any audience to anonymous regardless of tier", () => {
    expect(canUserAccessAudience({ audience: "premium", role: "ANONYMOUS", tier: "premium" })).toBe(false);
    expect(canUserAccessAudience({ audience: "account", role: "ANONYMOUS", tier: "premium" })).toBe(false);
  });

  it("preserves the legacy canAccessAudience contract (premium restricted to STAFF+ADMIN)", () => {
    expect(canAccessAudience("premium", "STAFF")).toBe(true);
    expect(canAccessAudience("premium", "ADMIN")).toBe(true);
    expect(canAccessAudience("premium", "AUTHENTICATED")).toBe(false);
    expect(canAccessAudience("premium", "APPRENTICE")).toBe(false);
  });
});

describe("getDeniedAudienceForUser (Phase 1)", () => {
  it("skips premium denial when user is on premium tier", () => {
    const audiences = ["premium", "admin"] as const;
    expect(getDeniedAudienceForRole(audiences, "AUTHENTICATED")).toBe("premium");
    expect(getDeniedAudienceForUser(audiences, "AUTHENTICATED", "premium")).toBe("admin");
  });

  it("still reports premium denial when tier is account or undefined", () => {
    const audiences = ["premium"] as const;
    expect(getDeniedAudienceForUser(audiences, "AUTHENTICATED", "account")).toBe("premium");
    expect(getDeniedAudienceForUser(audiences, "AUTHENTICATED")).toBe("premium");
  });
});

describe("ACCOUNT_TIER_PREFERENCE_KEY (Phase 1 security pin)", () => {
  it("exports the expected storage key", () => {
    expect(ACCOUNT_TIER_PREFERENCE_KEY).toBe("account_tier");
  });
});

describe("getAllowedAudiencesForUser (Phase 4)", () => {
  it("returns only public for anonymous sessions", () => {
    expect(getAllowedAudiencesForUser({ role: "ANONYMOUS" })).toEqual(["public"]);
    expect(getAllowedAudiencesForUser({ role: "ANONYMOUS", tier: "premium" })).toEqual([
      "public",
    ]);
  });

  it("returns public+account for authenticated on account tier", () => {
    const allowed = getAllowedAudiencesForUser({ role: "AUTHENTICATED", tier: "account" });
    expect(allowed).toEqual(["public", "account"]);
  });

  it("widens premium for authenticated on premium tier", () => {
    const allowed = getAllowedAudiencesForUser({ role: "AUTHENTICATED", tier: "premium" });
    expect(allowed).toEqual(["public", "account", "premium"]);
  });

  it("returns every audience for admin", () => {
    const allowed = getAllowedAudiencesForUser({ role: "ADMIN" });
    expect(allowed).toEqual([
      "public",
      "account",
      "premium",
      "apprentice",
      "staff",
      "admin",
    ]);
  });

  it("mirrors canUserAccessAudience for every (role, tier, audience) combination", () => {
    const roles = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"] as const;
    const tiers = [undefined, "account", "premium"] as const;
    const audiences = ["public", "account", "premium", "apprentice", "staff", "admin"] as const;
    for (const role of roles) {
      for (const tier of tiers) {
        const allowed = new Set(getAllowedAudiencesForUser({ role, tier }));
        for (const audience of audiences) {
          expect(allowed.has(audience)).toBe(
            canUserAccessAudience({ audience, role, tier }),
          );
        }
      }
    }
  });
});
