import type { CanonicalEvidenceRef, ContinuitySourceRef } from "./conversation-continuity";

export type PromptBindingSurface = "chat_stream" | "direct_turn" | "job_execution" | "memory_projection" | "materialization_decision" | "workspace_projection";
export type PromptBindingTargetKind = "conversation" | "message" | "job" | "materialization_record" | "relationship_memory";

export interface PromptSlotVersionRef {
  slotId: string;
  version: number | null;
  effectiveHash: string | null;
}

export interface PromptOverlayRef {
  overlayId: string;
  label: string;
  effectiveHash: string | null;
}

export interface PromptRequestRef {
  requestId: string;
  label: string;
  sourceKind: "request" | "override";
  effectiveHash: string | null;
}

export interface PromptBinding {
  id: string;
  userId: string;
  conversationId: string | null;
  surface: PromptBindingSurface;
  targetKind: PromptBindingTargetKind;
  targetId: string;
  sourcePromptBindingId: string | null;
  effectiveHash: string;
  slotRefs: readonly PromptSlotVersionRef[];
  overlayRefs: readonly PromptOverlayRef[];
  requestRefs?: readonly PromptRequestRef[];
  decisionSourceRefs: readonly ContinuitySourceRef[];
  evidenceRefs: readonly CanonicalEvidenceRef[];
  createdAt: string;
}

export function hasPromptBindingProvenance(binding: PromptBinding): boolean {
  return binding.effectiveHash.trim().length > 0 && binding.slotRefs.length > 0;
}
