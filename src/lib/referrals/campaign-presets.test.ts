import { describe, expect, it, vi } from "vitest";

import {
  buildCampaignPresetCoachPayload,
  buildCampaignPresetCoachPayloadFromCorpus,
  buildReferralIntroductionCoachPayload,
  CAMPAIGN_PRESETS,
  getCampaignPreset,
  isCampaignPresetKey,
  parseCampaignCorpusSlug,
} from "./campaign-presets";
import { Section } from "@/core/entities/corpus";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";

describe("campaign-presets (Phase 3)", () => {
  it("ships at least three typed presets with stable shapes", () => {
    expect(CAMPAIGN_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of CAMPAIGN_PRESETS) {
      expect(preset.key).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.summary).toBeTruthy();
      expect(preset.steps.length).toBeGreaterThan(0);
      expect(preset.corpusSlug).toMatch(/^campaign\//);
    }
  });

  it("exposes each expected preset key", () => {
    const keys = CAMPAIGN_PRESETS.map((p) => p.key).sort();
    expect(keys).toEqual(
      ["friends_and_family", "local_flyers", "lightweight_paid_outreach"].sort(),
    );
  });

  it("getCampaignPreset returns null for unknown keys", () => {
    expect(getCampaignPreset("not_a_real_preset")).toBeNull();
  });

  it("getCampaignPreset round-trips every shipped preset", () => {
    for (const preset of CAMPAIGN_PRESETS) {
      expect(getCampaignPreset(preset.key)?.key).toBe(preset.key);
    }
  });

  it("isCampaignPresetKey narrows only known keys", () => {
    expect(isCampaignPresetKey("friends_and_family")).toBe(true);
    expect(isCampaignPresetKey("nonsense")).toBe(false);
  });

  it("buildCampaignPresetCoachPayload marks step 0 active and rest pending", () => {
    const preset = CAMPAIGN_PRESETS[0];
    const payload = buildCampaignPresetCoachPayload(preset);

    expect(payload.variant).toBe("campaign_picked");
    expect(payload.title).toBe(preset.title);
    expect(payload.currentStep).toBe(0);
    expect(payload.steps[0].status).toBe("active");
    expect(payload.steps.slice(1).every((s) => s.status === "pending")).toBe(true);
    expect(payload.actions[0]?.kind).toBe("navigate");
    expect(payload.actions[0]?.href).toBe("/referrals");
  });

  it("buildReferralIntroductionCoachPayload personalizes title when referrer name present", () => {
    const payload = buildReferralIntroductionCoachPayload("Dr. Smith");
    expect(payload.variant).toBe("campaign_introduction");
    expect(payload.title).toContain("Dr. Smith");
    expect(payload.steps[0].status).toBe("active");
    expect(payload.actions[0]?.href).toBe("/library");
  });

  it("buildReferralIntroductionCoachPayload falls back for missing referrer name", () => {
    const payload = buildReferralIntroductionCoachPayload(undefined);
    expect(payload.title.toLowerCase()).toContain("referral");
    expect(payload.steps.length).toBeGreaterThan(0);
  });

  it("buildReferralIntroductionCoachPayload never promises premium-only surfaces", () => {
    const payload = buildReferralIntroductionCoachPayload("Dr. Smith");
    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toContain("premium");
    expect(serialized).not.toContain("admin");
    expect(serialized).not.toContain("staff");
  });
});

describe("parseCampaignCorpusSlug (Phase 4)", () => {
  it("splits a valid two-segment slug", () => {
    expect(parseCampaignCorpusSlug("campaign/friends-and-family")).toEqual({
      documentSlug: "campaign",
      sectionSlug: "friends-and-family",
    });
  });

  it("returns null for single-segment slugs", () => {
    expect(parseCampaignCorpusSlug("campaign")).toBeNull();
  });

  it("returns null for three-or-more-segment slugs", () => {
    expect(parseCampaignCorpusSlug("campaign/a/b")).toBeNull();
  });

  it("returns null when either segment is empty", () => {
    expect(parseCampaignCorpusSlug("/b")).toBeNull();
    expect(parseCampaignCorpusSlug("a/")).toBeNull();
    expect(parseCampaignCorpusSlug("")).toBeNull();
  });
});

describe("buildCampaignPresetCoachPayloadFromCorpus (Phase 4)", () => {
  function makeRepo(
    getSection: (doc: string, section: string) => Promise<Section>,
  ): CorpusRepository {
    return {
      getAllDocuments: vi.fn(),
      getDocument: vi.fn(),
      getAllSections: vi.fn(),
      getSectionsByDocument: vi.fn(),
      getSection: vi.fn(getSection),
    };
  }

  const preset = CAMPAIGN_PRESETS[0];

  it("appends a read-full-guide action for a public guide section", async () => {
    const repo = makeRepo(async () =>
      new Section(
        "campaign",
        "friends-and-family",
        "Friends and family",
        "Tell five people you trust.",
        [],
        [],
        [],
        "public",
        "guide",
      ),
    );
    const payload = await buildCampaignPresetCoachPayloadFromCorpus(preset, repo);
    const templated = buildCampaignPresetCoachPayload(preset);
    expect(payload.variant).toBe(templated.variant);
    expect(payload.steps).toEqual(templated.steps);
    expect(payload.currentStep).toBe(templated.currentStep);
    expect(payload.actions).toHaveLength(templated.actions.length + 1);
    const added = payload.actions[payload.actions.length - 1];
    expect(added.key).toBe("read-full-guide");
    expect(added.kind).toBe("navigate");
    expect(added.href).toBe("/library/campaign/friends-and-family");
  });

  it("appends when the guide is account-gated but within the scope fence", async () => {
    const repo = makeRepo(async () =>
      new Section(
        "campaign",
        "friends-and-family",
        "Friends and family",
        "…",
        [],
        [],
        [],
        "account",
        "guide",
      ),
    );
    const payload = await buildCampaignPresetCoachPayloadFromCorpus(preset, repo);
    expect(payload.actions.some((a) => a.key === "read-full-guide")).toBe(true);
  });

  it("falls back to the templated payload when the section is not a guide", async () => {
    const repo = makeRepo(async () =>
      new Section(
        "campaign",
        "friends-and-family",
        "Friends and family",
        "…",
        [],
        [],
        [],
        "public",
        "reference",
      ),
    );
    const payload = await buildCampaignPresetCoachPayloadFromCorpus(preset, repo);
    const templated = buildCampaignPresetCoachPayload(preset);
    expect(payload.actions).toEqual([
      ...templated.actions,
      {
        key: "read-full-guide",
        kind: "navigate",
        label: "Read the full guide",
        href: "/library/campaign/friends-and-family",
      },
    ]);
  });

  it("falls back when the section audience exceeds account", async () => {
    const repo = makeRepo(async () =>
      new Section(
        "campaign",
        "friends-and-family",
        "Friends and family",
        "…",
        [],
        [],
        [],
        "premium",
        "guide",
      ),
    );
    const payload = await buildCampaignPresetCoachPayloadFromCorpus(preset, repo);
    expect(payload.actions.some((a) => a.key === "read-full-guide")).toBe(false);
  });

  it("falls back when the repository throws (section missing)", async () => {
    const repo = makeRepo(async () => {
      throw new Error("not found");
    });
    const payload = await buildCampaignPresetCoachPayloadFromCorpus(preset, repo);
    const templated = buildCampaignPresetCoachPayload(preset);
    expect(payload.actions).toEqual(templated.actions);
  });

  it("falls back for an unparsable corpusSlug without calling the repository", async () => {
    const getSection = vi.fn();
    const repo: CorpusRepository = {
      getAllDocuments: vi.fn(),
      getDocument: vi.fn(),
      getAllSections: vi.fn(),
      getSectionsByDocument: vi.fn(),
      getSection,
    };
    const malformed = { ...preset, corpusSlug: "not-a-valid-slug" };
    const payload = await buildCampaignPresetCoachPayloadFromCorpus(malformed, repo);
    const templated = buildCampaignPresetCoachPayload(preset);
    expect(payload.actions).toEqual(templated.actions);
    expect(getSection).not.toHaveBeenCalled();
  });
});
