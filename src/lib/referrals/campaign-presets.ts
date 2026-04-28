import type { CoachPayload } from "@/core/entities/coach";
import type { CorpusRepository } from "@/core/use-cases/CorpusRepository";

/**
 * Typed, code-side campaign presets for the Phase 3 referrals surface.
 *
 * Each preset is a minimal, honest, three-step starter plan that uses only
 * product surfaces that exist today (`/referrals`, `/library`, `/`). Longer
 * corpus-sourced campaign guidance is a Phase 4 retrieval concern and is
 * deferred there — the `corpusSlug` field is a forward-looking hint the
 * retrieval slice can pick up without changing this type.
 */

export type CampaignPresetKey =
  | "friends_and_family"
  | "local_flyers"
  | "lightweight_paid_outreach";

export interface CampaignPreset {
  key: CampaignPresetKey;
  /** Short label rendered on preset cards. */
  title: string;
  /** One-line summary rendered beneath the title. */
  summary: string;
  /** Ordered coach steps. Step 0 is always "active"; the rest are "pending". */
  steps: readonly {
    key: string;
    label: string;
    detail?: string;
  }[];
  /**
   * Forward-looking pointer to a `class: "guide"` corpus entry that will
   * carry the longer narrative. Used by the Phase 4 retrieval slice; not
   * required for Phase 3 rendering.
   */
  corpusSlug: string;
}

export const CAMPAIGN_PRESETS: readonly CampaignPreset[] = [
  {
    key: "friends_and_family",
    title: "Friends and family",
    summary: "The warmest, lowest-friction start — tell five people you trust.",
    steps: [
      {
        key: "copy-link",
        label: "Copy your referral link",
        detail: "Use the Copy link button in your share tools.",
      },
      {
        key: "pick-five",
        label: "Pick five people to message directly",
        detail: "People who already know what you do are the best first audience.",
      },
      {
        key: "check-back",
        label: "Check back tomorrow for your first introductions",
      },
    ],
    corpusSlug: "campaign/friends-and-family",
  },
  {
    key: "local_flyers",
    title: "Local flyers",
    summary: "Print your QR where your neighbors already look.",
    steps: [
      {
        key: "download-qr",
        label: "Download your QR code",
        detail: "Use the Download QR button in your share tools.",
      },
      {
        key: "pick-two-spots",
        label: "Pick two physical spots with foot traffic",
        detail: "A coffee shop bulletin board and one other local space is enough to start.",
      },
      {
        key: "review-introductions",
        label: "Review introductions that come in this week",
      },
    ],
    corpusSlug: "campaign/local-flyers",
  },
  {
    key: "lightweight_paid_outreach",
    title: "Lightweight paid outreach",
    summary: "A small test budget to see which channel earns trust fastest.",
    steps: [
      {
        key: "pick-channel",
        label: "Pick one paid channel you already use",
        detail: "Only run this after the warm and local presets have started producing introductions.",
      },
      {
        key: "small-budget",
        label: "Set a small, honest test budget",
        detail: "Enough for a week of signal, not a month of spend.",
      },
      {
        key: "compare",
        label: "Compare introductions against the warm presets",
      },
    ],
    corpusSlug: "campaign/lightweight-paid-outreach",
  },
] as const;

export function getCampaignPreset(
  key: string,
): CampaignPreset | null {
  const found = CAMPAIGN_PRESETS.find((p) => p.key === key);
  return found ?? null;
}

export function isCampaignPresetKey(value: string): value is CampaignPresetKey {
  return CAMPAIGN_PRESETS.some((p) => p.key === value);
}

/**
 * Build a coach payload for the "authenticated user picked a campaign
 * preset" flow. The payload points the user back to `/referrals` so they
 * can use the concrete share tools after reading the coach steps.
 */
export function buildCampaignPresetCoachPayload(
  preset: CampaignPreset,
): CoachPayload {
  return {
    variant: "campaign_picked",
    title: preset.title,
    subtitle: preset.summary,
    steps: preset.steps.map((step, index) => ({
      key: step.key,
      label: step.label,
      status: index === 0 ? "active" : "pending",
      detail: step.detail,
    })),
    currentStep: 0,
    actions: [
      {
        key: "open-referrals",
        kind: "navigate",
        label: "Open referrals workspace",
        href: "/referrals",
      },
    ],
  };
}

/**
 * Build a coach payload for the "anonymous visitor arrived via a signed
 * referral link" flow. Honest scope: the only action it promises is
 * asking a question inside chat, which is always available.
 */
export function buildReferralIntroductionCoachPayload(
  referrerName: string | undefined,
): CoachPayload {
  const trimmedName = referrerName?.trim();
  const title = trimmedName
    ? `Welcome — ${trimmedName} introduced you`
    : "Welcome — you arrived through a referral";
  return {
    variant: "campaign_introduction",
    title,
    subtitle: "Start with any question. Your referral is already recorded.",
    steps: [
      {
        key: "ask",
        label: "Ask your first question",
        status: "active",
        detail: "Anything on your mind — the assistant is ready.",
      },
      {
        key: "browse",
        label: "Browse the public library if you want context first",
        status: "pending",
      },
    ],
    currentStep: 0,
    actions: [
      {
        key: "open-library",
        kind: "navigate",
        label: "Browse library",
        href: "/library",
      },
    ],
  };
}

/**
 * Phase 4 — parse `CampaignPreset.corpusSlug` ("campaign/<section>") into
 * `{ documentSlug, sectionSlug }`. Returns `null` when the slug is not in
 * the expected two-segment shape.
 */
export function parseCampaignCorpusSlug(
  slug: string,
): { documentSlug: string; sectionSlug: string } | null {
  const parts = slug.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { documentSlug: parts[0], sectionSlug: parts[1] };
}

/**
 * Phase 4 — retrieval-backed coach builder.
 *
 * Produces the same `CoachPayload` shape as
 * {@link buildCampaignPresetCoachPayload} and falls back to it when the
 * forward-referenced `class: "guide"` corpus entry is missing or not
 * accessible.
 *
 * When the guide is present, an extra honest-disclosure action is
 * appended pointing at the published library path so the user can read
 * the full narrative. The variant union, step count, step keys, and
 * `currentStep` are untouched — only the `actions` array grows, which
 * is the minimum-drift way to wire retrieval into the coach contract.
 */
export async function buildCampaignPresetCoachPayloadFromCorpus(
  preset: CampaignPreset,
  corpusRepository: CorpusRepository,
): Promise<CoachPayload> {
  const templated = buildCampaignPresetCoachPayload(preset);
  const parsed = parseCampaignCorpusSlug(preset.corpusSlug);
  if (!parsed) return templated;

  try {
    const section = await corpusRepository.getSection(
      parsed.documentSlug,
      parsed.sectionSlug,
    );
    if (section.contentClass && section.contentClass !== "guide") {
      // Defense-in-depth: only `class: "guide"` entries are allowed to
      // back campaign coach copy.
      return templated;
    }
    if (section.audience !== "public" && section.audience !== "account") {
      // Truth-check: campaign guide audiences never exceed `account`.
      return templated;
    }
    return {
      ...templated,
      actions: [
        ...templated.actions,
        {
          key: "read-full-guide",
          kind: "navigate",
          label: "Read the full guide",
          href: `/library/${parsed.documentSlug}/${parsed.sectionSlug}`,
        },
      ],
    };
  } catch {
    return templated;
  }
}
