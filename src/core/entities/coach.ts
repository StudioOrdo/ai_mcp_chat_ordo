import type { CapabilityResultEnvelope } from "./capability-result";
import type { CampaignVariant } from "./campaign";
import type { LifecycleVariant } from "./lifecycle";

/**
 * Coach envelopes represent a multi-step guided sequence delivered inside
 * chat as a system-authored card. They ride on `role: "system"` messages
 * via `ChatMessageMetadata.coach` and render through `CoachCard`.
 *
 * A coach envelope is distinct from a lifecycle envelope: a lifecycle
 * envelope marks that a milestone *happened*; a coach envelope gives the
 * user the next set of steps to take *because of* that milestone. They
 * typically appear together: lifecycle card first, coach card immediately
 * after.
 *
 * Coach envelopes inherit the system envelope contract documented in
 * `docs/_specs/codebase-health/f7-system-envelope-contract.md`:
 * - family: "system"
 * - cardKind: "lifecycle" (the resolver already routes this kind)
 * - not registered in CAPABILITY_CATALOG (system-authored, not LLM-tool)
 */

export type CoachActionKind = "navigate" | "run_tool" | "dismiss";

export interface CoachAction {
  /** Stable key used by the renderer for list keys and test anchors. */
  key: string;
  kind: CoachActionKind;
  label: string;
  /** For kind === "navigate", the href to link to. */
  href?: string;
  /** For kind === "run_tool", the tool name to trigger. */
  toolName?: string;
}

export type CoachStepStatus = "pending" | "active" | "succeeded";

export interface CoachStep {
  key: string;
  label: string;
  status: CoachStepStatus;
  /** Optional one-line detail shown beneath the label. */
  detail?: string;
}

/**
 * The trigger that produced a coach sequence. Unioned over lifecycle and
 * campaign variants so a single `CoachPayload` shape can serve both
 * Phase 2 (lifecycle-driven coach) and Phase 3 (campaign-driven coach)
 * without duplicating the renderer or the metadata passthrough.
 *
 * Lifecycle variants render with a sibling `LifecycleCard` on the same
 * turn. Campaign variants render standalone.
 */
export type CoachVariant = LifecycleVariant | CampaignVariant;

export interface CoachPayload {
  /**
   * The variant that triggered this coach sequence. Used by the card to
   * render a consistent eyebrow and, for lifecycle variants, to pair with
   * a sibling lifecycle card on the same turn.
   */
  variant: CoachVariant;
  /** Short card title, e.g. "Finish setting up your workspace". */
  title: string;
  /** Optional one-line subtitle shown beneath the title. */
  subtitle?: string;
  /** The ordered steps for this sequence. */
  steps: CoachStep[];
  /** Index (zero-based) of the current active step. */
  currentStep: number;
  /** Primary next-action affordances for the user. */
  actions: CoachAction[];
}

export type CoachEnvelope = CapabilityResultEnvelope<CoachPayload>;

export const COACH_TOOL_NAME = "coach_sequence";
