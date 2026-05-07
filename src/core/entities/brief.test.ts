import { describe, expect, it } from "vitest";

import {
  createBriefEvidenceManifest,
  listBriefEvidenceManifestValidationErrors,
  listSectionBriefValidationErrors,
  type BriefEvidenceManifest,
  type SectionBrief,
} from "./brief";

function brief(overrides: Partial<SectionBrief> = {}): SectionBrief {
  return {
    id: "brief_today_v1",
    sectionId: "today",
    asOf: "2026-05-06T12:00:00.000Z",
    status: "fresh",
    title: "Today Brief",
    summary: "One decision needs owner judgment.",
    bullets: ["Review the offer before publishing."],
    recommendedAction: { label: "Review offer", href: "/offers?offer=offer_1" },
    evidenceRefs: [{
      kind: "offer",
      id: "offer_1",
      label: "Strategy offer",
      href: "/offers?offer=offer_1",
      visibility: "owner",
    }],
    limitations: [],
    version: 1,
    ...overrides,
  };
}

function manifest(overrides: Partial<BriefEvidenceManifest> = {}): BriefEvidenceManifest {
  const sourceBrief = brief();
  return {
    ...createBriefEvidenceManifest({
      brief: sourceBrief,
      generatedAt: "2026-05-06T12:00:00.000Z",
      generatedBy: "deterministic:test",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    }),
    ...overrides,
  };
}

describe("brief entity contract", () => {
  it("accepts evidence-backed deterministic briefs and manifests", () => {
    const sourceBrief = brief();
    const sourceManifest = createBriefEvidenceManifest({
      brief: sourceBrief,
      generatedAt: "2026-05-06T12:00:00.000Z",
      generatedBy: "deterministic:test",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(listSectionBriefValidationErrors(sourceBrief, {
      visibilityPolicy: "owner",
      requireDurableFields: true,
    })).toEqual([]);
    expect(listBriefEvidenceManifestValidationErrors(sourceManifest)).toEqual([]);
  });

  it("requires every claim to have evidence or an explicit limitation", () => {
    const errors = listBriefEvidenceManifestValidationErrors(manifest({
      includedSourceRefs: [],
      claims: [{
        id: "claim_1",
        text: "Revenue improved 40%.",
        evidenceRefIds: [],
      }],
    }));

    expect(errors).toContain("BriefEvidenceManifest.claims[0] must have evidence refs or a limitation.");
  });

  it("rejects raw job/provider/log copy in owner-visible briefs", () => {
    const errors = listSectionBriefValidationErrors(brief({
      summary: "job_123 failed because provider logs changed.",
    }), {
      visibilityPolicy: "owner",
      requireDurableFields: true,
    });

    expect(errors).toContain("Owner/public-safe briefs cannot expose raw job, provider, log, or payload details.");
  });

  it("allows owner-safe labels for job evidence without raw implementation copy", () => {
    const errors = listSectionBriefValidationErrors(brief({
      evidenceRefs: [{
        kind: "job_event",
        id: "job_123",
        label: "Work event",
        visibility: "owner",
      }],
    }), {
      visibilityPolicy: "owner",
      requireDurableFields: true,
    });

    expect(errors).toEqual([]);
  });

  it("prevents public-safe briefs from including private evidence", () => {
    const errors = listBriefEvidenceManifestValidationErrors(manifest({
      visibilityPolicy: "public-safe",
      includedSourceRefs: [{
        kind: "conversation",
        id: "conv_private",
        label: "Private conversation",
        visibility: "private",
      }],
      claims: [{
        id: "claim_private",
        text: "A private conversation happened.",
        evidenceRefIds: ["conversation:conv_private"],
      }],
    }));

    expect(errors).toContain("Public-safe briefs cannot include private, owner-only, or admin evidence.");
  });

  it("allows limited briefs when missing evidence is explicit", () => {
    const limitedBrief = brief({
      status: "limited",
      evidenceRefs: [],
      limitations: ["There is not enough activity evidence to summarize results yet."],
    });
    const limitedManifest = createBriefEvidenceManifest({
      brief: limitedBrief,
      generatedAt: "2026-05-06T12:00:00.000Z",
      generatedBy: "deterministic:test",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(listBriefEvidenceManifestValidationErrors(limitedManifest)).toEqual([]);
  });
});
