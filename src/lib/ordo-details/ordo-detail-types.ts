import type { OrdoDetailLens, OrdoObjectKind } from "@/core/entities/ordo-object";
import type { RoleName } from "@/core/entities/user";
import type {
  OrdoCard,
  OrdoCardAction,
  OrdoSourceRef,
} from "@/lib/ordo-cards";

export interface OrdoDetailFact {
  id: string;
  label: string;
  value: string;
  sourceRef?: OrdoSourceRef;
}

export type OrdoDetailBadgeTone = "neutral" | "active" | "good" | "warn" | "bad";

export interface OrdoDetailBadge {
  id: string;
  label: string;
  tone?: OrdoDetailBadgeTone;
}

export interface OrdoDetailLink {
  id: string;
  label: string;
  href?: string;
  summary?: string;
  unavailableReason?: string;
}

export interface OrdoDetailAdminDiagnosticLink {
  label: string;
  href: string;
  summary?: string;
}

export interface OrdoDetailTimelineItem {
  id: string;
  label: string;
  occurredAt: string;
  summary?: string;
  sourceRef?: OrdoSourceRef;
  sourceActionLabel?: string;
  diagnostic?: boolean;
}

export interface OrdoDetailLensModel {
  lens: OrdoDetailLens;
  label: string;
  summary?: string;
  facts?: readonly OrdoDetailFact[];
  cards?: readonly OrdoCard[];
  timeline?: readonly OrdoDetailTimelineItem[];
  actions?: readonly OrdoCardAction[];
  emptyState?: string;
}

export interface OrdoPersonDetailHeaderModel {
  displayName: string;
  organization: string | null;
  stageLabel: string;
  primaryConversationHref: string | null;
  facts: readonly OrdoDetailFact[];
}

export interface OrdoObjectDetailModel {
  object: {
    kind: OrdoObjectKind;
    id: string;
    label: string;
    status?: string;
    ownerUserId?: string | null;
  };
  title: string;
  summary: string;
  defaultLens: OrdoDetailLens;
  availableLenses: readonly OrdoDetailLens[];
  primaryCard: OrdoCard;
  badges?: readonly OrdoDetailBadge[];
  headerFacts?: readonly OrdoDetailFact[];
  primaryActions?: readonly OrdoCardAction[];
  sourceLinks?: readonly OrdoDetailLink[];
  provenanceLinks?: readonly OrdoDetailLink[];
  sourceRefs: readonly OrdoSourceRef[];
  provenanceRefs: readonly OrdoSourceRef[];
  relatedCards: readonly OrdoCard[];
  lenses: readonly OrdoDetailLensModel[];
  personHeader?: OrdoPersonDetailHeaderModel;
  adminDiagnostic?: OrdoDetailAdminDiagnosticLink | null;
  diagnosticHref?: string;
  roleVisibility: readonly RoleName[];
}
