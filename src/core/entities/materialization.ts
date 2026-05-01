import type { CanonicalEvidenceRef, ContinuitySourceRef } from "./conversation-continuity";

export type MaterializationStatus = "ready" | "superseded" | "invalidated";
export type MaterializationReusePolicy = "never" | "same_user" | "same_conversation" | "global_if_public";
export type MaterializationOutputKind = "asset" | "job" | "work_order";

export interface MaterializationOutputRef {
  kind: MaterializationOutputKind;
  id: string;
  userId: string | null;
  conversationId: string | null;
}

export interface MaterializationRecord {
  id: string;
  userId: string | null;
  conversationId: string | null;
  materializationKey: string;
  toolName: string;
  pipelineVersion: string | null;
  status: MaterializationStatus;
  reusePolicy: MaterializationReusePolicy;
  inputSourceRefs: readonly ContinuitySourceRef[];
  outputRefs: readonly MaterializationOutputRef[];
  evidenceRefs: readonly CanonicalEvidenceRef[];
  producedByJobId: string | null;
  supersededByRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isReusableMaterialization(record: MaterializationRecord): boolean {
  return record.status === "ready" && record.reusePolicy !== "never" && record.outputRefs.length > 0;
}