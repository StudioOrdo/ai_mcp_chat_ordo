import { describe, expect, it, vi } from "vitest";

import type { SectionBrief, StoredSectionBrief } from "@/core/entities/brief";

import {
  CANONICAL_SECTION_BRIEF_INVENTORY,
  resolveSectionBrief,
  type SectionBriefStore,
} from "./section-brief-resolver";

function fallbackBrief(overrides: Partial<SectionBrief> = {}): SectionBrief {
  return {
    id: "offers-brief-fallback",
    sectionId: "offers",
    status: "limited",
    title: "Offer Brief",
    summary: "Deterministic offer evidence is available.",
    bullets: ["No accepted offer evidence exists yet."],
    recommendedAction: { label: "Ask Ordo", href: "/" },
    evidenceRefs: [],
    limitations: ["Offer performance is limited until durable events exist."],
    version: 1,
    ...overrides,
  };
}

function storedBrief(overrides: Partial<StoredSectionBrief> = {}): StoredSectionBrief {
  const fallback = fallbackBrief({
    id: "offers-brief-stored",
    status: "fresh",
    summary: "Stored brief wins over deterministic fallback.",
    evidenceRefs: [{
      kind: "offer_event",
      id: "offer_evt_1",
      label: "Offer accepted",
      visibility: "owner",
    }],
    limitations: [],
    version: 3,
    priorBriefId: "offers-brief-v2",
  });

  return {
    ...fallback,
    ownerUserId: "usr_1",
    visibilityPolicy: "owner",
    generatedAt: "2026-05-07T10:00:00.000Z",
    generatedBy: "brief-executor:deterministic",
    manifest: {
      schemaVersion: "1",
      briefId: fallback.id,
      briefVersion: fallback.version ?? 1,
      generatedAt: "2026-05-07T10:00:00.000Z",
      generatedBy: "brief-executor:deterministic",
      ownerUserId: "usr_1",
      sectionId: "offers",
      visibilityPolicy: "owner",
      includedSourceRefs: fallback.evidenceRefs,
      excludedSourceRefs: [],
      claims: [{
        id: "claim_1",
        text: fallback.bullets[0] ?? fallback.summary,
        evidenceRefIds: ["offer_event:offer_evt_1"],
      }],
      limitations: [],
      executorMetadata: { kind: "deterministic" },
      warnings: [],
    },
    isCurrent: true,
    ...overrides,
  };
}

describe("resolveSectionBrief", () => {
  it("prefers a stored current brief when the durable mapper has one", async () => {
    const briefs: SectionBriefStore = {
      findCurrentSectionBrief: vi.fn(async () => storedBrief()),
    };

    const resolved = await resolveSectionBrief({
      briefs,
      sectionId: "offers",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      fallback: fallbackBrief(),
    });

    expect(resolved.source).toBe("stored");
    expect(resolved.mapperUnavailable).toBe(false);
    expect(resolved.brief.id).toBe("offers-brief-stored");
    expect(resolved.brief.priorBriefId).toBe("offers-brief-v2");
    expect(briefs.findCurrentSectionBrief).toHaveBeenCalledWith("offers", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
  });

  it("uses a deterministic fallback when no stored brief exists", async () => {
    const resolved = await resolveSectionBrief({
      briefs: {
        findCurrentSectionBrief: vi.fn(async () => null),
      },
      sectionId: "offers",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      fallback: fallbackBrief(),
    });

    expect(resolved.source).toBe("deterministic_fallback");
    expect(resolved.mapperUnavailable).toBe(false);
    expect(resolved.brief).toEqual(fallbackBrief());
  });

  it("keeps sections usable when the stored mapper is unavailable", async () => {
    const resolved = await resolveSectionBrief({
      briefs: {
        findCurrentSectionBrief: vi.fn(async () => {
          throw new Error("db unavailable");
        }),
      },
      sectionId: "offers",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      fallback: fallbackBrief({ status: "fresh", limitations: [] }),
    });

    expect(resolved.source).toBe("deterministic_fallback");
    expect(resolved.mapperUnavailable).toBe(true);
    expect(resolved.brief.status).toBe("limited");
    expect(resolved.brief.limitations).toContain(
      "Stored brief read model is unavailable, so this section is showing deterministic evidence only.",
    );
  });

  it("tracks every canonical section that needs a brief path", () => {
    expect(CANONICAL_SECTION_BRIEF_INVENTORY.map((entry) => entry.sectionId)).toEqual([
      "conversations",
      "today",
      "studio",
      "people",
      "offers",
      "about",
      "knowledge-base",
      "account",
      "admin-system",
    ]);
  });
});
