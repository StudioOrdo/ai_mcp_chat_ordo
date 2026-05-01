import type { BusinessObjectRef, CanonicalEvidenceRef, ContinuitySourceRef } from "./conversation-continuity";

export type BusinessWorkflowMode = "revenue" | "service" | "training" | "operations" | "setup" | "general";
export type WorkflowOriginKind = "chat" | "page" | "job" | "referral" | "admin" | "import";
export type LifecycleProgressStatus = "not_started" | "active" | "blocked" | "completed" | "superseded";
export type WorkflowNotificationStatus = "pending" | "sent" | "failed" | "acknowledged";
export type WorkflowHealthSeverity = "info" | "warning" | "blocking";
export type WorkflowRecommendedActionKind = "continue" | "review" | "retry" | "share" | "follow_up" | "configure";

export interface WorkflowOriginContext {
  kind: WorkflowOriginKind;
  source: ContinuitySourceRef;
  label: string;
}

export interface LifecycleProgressRef {
  lifecycleId: string;
  status: LifecycleProgressStatus;
  label: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface WorkflowNotificationRef {
  notificationId: string;
  status: WorkflowNotificationStatus;
  channel: string;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface InterruptedTurnRef {
  turnId: string;
  conversationId: string;
  recoveredAt: string | null;
  evidenceRefs: readonly CanonicalEvidenceRef[];
}

export interface WorkflowHealthRef {
  id: string;
  severity: WorkflowHealthSeverity;
  label: string;
  source: ContinuitySourceRef;
}

export interface WorkflowRecommendedAction {
  kind: WorkflowRecommendedActionKind;
  label: string;
  targetRef: ContinuitySourceRef | null;
}

export interface BusinessWorkflowContext {
  id: string;
  userId: string;
  conversationId: string;
  primaryMode: BusinessWorkflowMode;
  origin: WorkflowOriginContext | null;
  relatedRefs: readonly BusinessObjectRef[];
  lifecycleRefs: readonly LifecycleProgressRef[];
  notificationRefs: readonly WorkflowNotificationRef[];
  interruptedTurnRefs: readonly InterruptedTurnRef[];
  healthRefs: readonly WorkflowHealthRef[];
  recommendedAction: WorkflowRecommendedAction | null;
  updatedAt: string;
}

export function hasBlockingWorkflowHealth(context: BusinessWorkflowContext): boolean {
  return context.healthRefs.some((healthRef) => healthRef.severity === "blocking");
}