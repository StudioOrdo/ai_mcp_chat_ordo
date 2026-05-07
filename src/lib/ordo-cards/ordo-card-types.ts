import type { OrdoObjectKind, OrdoDetailLens } from "@/core/entities/ordo-object";
import type {
  OperationConfirmPolicy,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export type OrdoCardKind = OrdoObjectKind;

export type OrdoCardBucket =
  | "needs_attention"
  | "in_motion"
  | "produced"
  | "business_loop"
  | "history";

export type OrdoCardStatus =
  | "draft"
  | "queued"
  | "running"
  | "needs_review"
  | "blocked"
  | "failed"
  | "succeeded"
  | "published"
  | "archived"
  | "unavailable"
  | "canceled";

export type OrdoCardTone = "neutral" | "active" | "good" | "warn" | "bad";

export type OrdoCardActionTone = "primary" | "secondary" | "destructive";

export type OrdoSourceKind =
  | "activity"
  | "artifact"
  | "asset_catalog"
  | "blog_asset"
  | "blog_post"
  | "blog_post_artifact"
  | "business_workflow_context"
  | "campaign"
  | "capability_result"
  | "conversation"
  | "consultation"
  | "deal"
  | "job"
  | "job_event"
  | "lead"
  | "materialization"
  | "media_workflow"
  | "offer"
  | "offer_event"
  | "operation"
  | "operation_event"
  | "person"
  | "referral"
  | "referral_event"
  | "tracked_link"
  | "tracked_link_event"
  | "user"
  | "user_file";

export type OrdoCardPreviewKind =
  | "audio"
  | "chart"
  | "document"
  | "graph"
  | "image"
  | "qr"
  | "video";

export interface OrdoObjectRef {
  kind: OrdoCardKind;
  id: string;
  label: string;
  href?: string;
}

export interface OrdoSourceRef {
  sourceKind: OrdoSourceKind;
  sourceId: string;
  label?: string;
  href?: string;
}

export interface OrdoCardAction {
  id: string;
  label: string;
  href?: string;
  actionType?: string;
  tone?: OrdoCardActionTone;
  disabled?: boolean;
  disabledReason?: string | null;
  requiresConfirmation?: boolean;
  confirmPolicy?: OperationConfirmPolicy;
  confirmationText?: string | null;
  riskLevel?: OperationRiskLevel;
  allowedRoles?: readonly RoleName[];
  allowedStatuses?: readonly OperationStatus[];
  expiresAt?: string | null;
  payload?: Record<string, unknown>;
}

export interface OrdoCardMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  tone?: OrdoCardTone;
}

export interface OrdoCardPreview {
  kind: OrdoCardPreviewKind;
  href?: string;
  label?: string;
  alt?: string;
  mimeType?: string;
}

export interface OrdoCard {
  id: string;
  kind: OrdoCardKind;
  objectRef: OrdoObjectRef;
  bucket: OrdoCardBucket;
  status: OrdoCardStatus;
  tone: OrdoCardTone;
  title: string;
  summary: string;
  updatedAt: string;
  createdAt?: string;
  ownerUserId?: string | null;
  roleVisibility: readonly RoleName[];
  sourceRefs: readonly OrdoSourceRef[];
  provenanceRefs: readonly OrdoSourceRef[];
  detailHref: string;
  diagnosticHref?: string;
  defaultLens?: OrdoDetailLens;
  preview?: OrdoCardPreview;
  metrics?: readonly OrdoCardMetric[];
  primaryAction?: OrdoCardAction;
  secondaryActions?: readonly OrdoCardAction[];
}

export const SIGNED_IN_CARD_ROLES: readonly RoleName[] = [
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];
