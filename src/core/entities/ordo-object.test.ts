import { describe, expect, it } from "vitest";

import {
  OBJECT_CENTERED_PRIMARY_SURFACES,
  ORDO_OBJECT_KIND_CONTRACTS,
  ORDO_OBJECT_KINDS,
} from "./ordo-object";

describe("Ordo object taxonomy", () => {
  it("defines a contract for every object kind", () => {
    expect(Object.keys(ORDO_OBJECT_KIND_CONTRACTS).sort()).toEqual([...ORDO_OBJECT_KINDS].sort());
  });

  it("keeps Studio and Business objects explicit for card projection", () => {
    expect(OBJECT_CENTERED_PRIMARY_SURFACES).toEqual([
      "dashboard",
      "studio",
      "business",
      "offers",
      "knowledge_base",
      "profile_settings",
      "admin",
    ]);
    expect(ORDO_OBJECT_KIND_CONTRACTS.media_asset.defaultLens).toBe("provenance");
    expect(ORDO_OBJECT_KIND_CONTRACTS.offer.targetSurface).toBe("offers");
    expect(ORDO_OBJECT_KIND_CONTRACTS.tracked_link.defaultLens).toBe("performance");
    expect(ORDO_OBJECT_KIND_CONTRACTS.person.knownGap).toContain("derived person index");
  });
});
