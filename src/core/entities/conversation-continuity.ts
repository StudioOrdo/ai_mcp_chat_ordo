export type ContinuitySourceKind =
  | "conversation"
  | "message"
  | "user_profile"
  | "lead"
  | "consultation"
  | "deal"
  | "training_path"
  | "journal_item"
  | "work_order"
  | "job"
  | "job_event"
  | "user_file"
  | "blog_asset"
  | "embedding_source"
  | "prompt_provenance"
  | "referral"
  | "referral_event"
  | "conversation_event"
  | "workspace_snapshot"
  | "business_workflow_context"
  | "operator_transition_profile"
  | "trust_distribution_context"
  | "relationship_memory"
  | "materialization_record"
  | "prompt_binding"
  | "identity_migration_event";

export type BusinessObjectKind =
  | "lead"
  | "consultation"
  | "deal"
  | "training_path"
  | "referral"
  | "journal_item"
  | "work_order"
  | "conversation";

export type CanonicalOwnerScope = "user" | "anonymous_session" | "system" | "role";

export type CanonicalDeletionState = "visible" | "soft_deleted" | "purge_requested" | "purged" | "audit_retained";

export interface ContinuitySourceRef {
  sourceKind: ContinuitySourceKind;
  sourceId: string;
  userId: string | null;
  conversationId: string | null;
}

export interface BusinessObjectRef {
  kind: BusinessObjectKind;
  id: string;
  userId: string | null;
  conversationId: string | null;
  label: string | null;
  status: string | null;
}

export interface CanonicalEvidenceRef {
  source: ContinuitySourceRef;
  observedAt: string;
  summary: string | null;
}

export interface CanonicalOwnership {
  scope: CanonicalOwnerScope;
  userId: string | null;
  role: string | null;
}

export interface CanonicalLifecycle {
  createdAt: string;
  updatedAt: string;
  deletionState: CanonicalDeletionState;
  deletedAt: string | null;
}

export function createSourceRef(input: ContinuitySourceRef): ContinuitySourceRef {
  return { ...input };
}

export function isUserOwned(ownership: CanonicalOwnership): boolean {
  return ownership.scope === "user" && ownership.userId !== null;
}