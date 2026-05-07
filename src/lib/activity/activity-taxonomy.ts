import type { JobEventType, JobStatus } from "@/core/entities/job";
import type { MediaWorkflowStatus } from "@/lib/media/workflows/types";
import type { OperationStatus, OperationVisibility } from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import type { ReferralActivityMilestone } from "@/lib/referrals/referral-milestones";
import { isAuditOnlyJobEventType } from "@/lib/jobs/job-renderable-event";

export const ACTIVITY_BUCKETS = [
  "needs_attention",
  "running",
  "completed",
  "history",
  "diagnostic",
] as const;

export type ActivityBucket = typeof ACTIVITY_BUCKETS[number];

export const ACTIVITY_SEVERITIES = [
  "info",
  "success",
  "warning",
  "critical",
] as const;

export type ActivitySeverity = typeof ACTIVITY_SEVERITIES[number];

export const ACTIVITY_SOURCE_KINDS = [
  "job",
  "job_event",
  "media_workflow",
  "operation",
  "operation_event",
  "referral_milestone",
  "browser_push_delivery",
  "runtime_audit_log",
  "provider_log",
  "route_metric",
  "mcp_process_log",
  "admin_signal",
] as const;

export type ActivitySourceKind = typeof ACTIVITY_SOURCE_KINDS[number];

export function isActivitySourceKind(value: string): value is ActivitySourceKind {
  return (ACTIVITY_SOURCE_KINDS as readonly string[]).includes(value);
}

export const ACTIVITY_PROJECTION_MODES = [
  "projectable",
  "delivery_only",
  "diagnostic_only",
  "admin_only",
] as const;

export type ActivityProjectionMode = typeof ACTIVITY_PROJECTION_MODES[number];

export const ACTIVITY_CONTRACT_FIELDS = [
  "id",
  "sourceKind",
  "sourceId",
  "userId",
  "roleVisibility",
  "bucket",
  "severity",
  "title",
  "summary",
  "statusLabel",
  "href",
  "primaryAction",
  "secondaryActions",
  "createdAt",
  "updatedAt",
  "dedupeKey",
] as const;

export type ActivityContractField = typeof ACTIVITY_CONTRACT_FIELDS[number];

export interface ActivitySourceDefinition {
  sourceKind: ActivitySourceKind;
  label: string;
  projectionMode: ActivityProjectionMode;
  defaultRoleVisibility: readonly RoleName[];
  sourceOfTruth: readonly string[];
  notes: string;
}

const REGULAR_USER_ROLES: readonly RoleName[] = ["AUTHENTICATED", "APPRENTICE"];
const STAFF_OR_ADMIN_ROLES: readonly RoleName[] = ["STAFF", "ADMIN"];
const ALL_SIGNED_IN_ROLES: readonly RoleName[] = [
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

export const ACTIVITY_SOURCE_MAP: Record<ActivitySourceKind, ActivitySourceDefinition> = {
  job: {
    sourceKind: "job",
    label: "Deferred job",
    projectionMode: "projectable",
    defaultRoleVisibility: ALL_SIGNED_IN_ROLES,
    sourceOfTruth: ["jobs", "job_events"],
    notes: "Durable execution record for background work owned by a user or visible role.",
  },
  job_event: {
    sourceKind: "job_event",
    label: "Job event",
    projectionMode: "projectable",
    defaultRoleVisibility: ALL_SIGNED_IN_ROLES,
    sourceOfTruth: ["job_events"],
    notes: "Renderable job events can enrich a job activity card; audit-only events stay suppressed.",
  },
  media_workflow: {
    sourceKind: "media_workflow",
    label: "Media workflow",
    projectionMode: "projectable",
    defaultRoleVisibility: ALL_SIGNED_IN_ROLES,
    sourceOfTruth: ["media_workflows", "media_workflow_steps", "media_workflow_events"],
    notes: "Higher-level media work card that can own linked job rows to avoid duplicate user cards.",
  },
  operation: {
    sourceKind: "operation",
    label: "Operation",
    projectionMode: "projectable",
    defaultRoleVisibility: ALL_SIGNED_IN_ROLES,
    sourceOfTruth: ["operations", "operation_actions", "operation_artifacts"],
    notes: "Governed multi-step work with confirmation, risk, action, and artifact policy.",
  },
  operation_event: {
    sourceKind: "operation_event",
    label: "Operation event",
    projectionMode: "projectable",
    defaultRoleVisibility: ALL_SIGNED_IN_ROLES,
    sourceOfTruth: ["operation_events"],
    notes: "Timeline detail for operation cards; raw event streams are not a standalone user inbox.",
  },
  referral_milestone: {
    sourceKind: "referral_milestone",
    label: "Referral milestone",
    projectionMode: "projectable",
    defaultRoleVisibility: ALL_SIGNED_IN_ROLES,
    sourceOfTruth: ["referrals", "referral_events"],
    notes: "Business-loop events for QR/referral progress and credit milestones.",
  },
  browser_push_delivery: {
    sourceKind: "browser_push_delivery",
    label: "Browser push delivery",
    projectionMode: "delivery_only",
    defaultRoleVisibility: REGULAR_USER_ROLES,
    sourceOfTruth: ["push_subscriptions", "user_preferences", "job_events"],
    notes: "Delivery channel state. It is not durable activity unless a user-actionable delivery failure exists.",
  },
  runtime_audit_log: {
    sourceKind: "runtime_audit_log",
    label: "Runtime audit log",
    projectionMode: "diagnostic_only",
    defaultRoleVisibility: STAFF_OR_ADMIN_ROLES,
    sourceOfTruth: ["runtime_audit_logs"],
    notes: "Diagnostic evidence for staff/admin. Never part of the regular user activity feed.",
  },
  provider_log: {
    sourceKind: "provider_log",
    label: "Provider log",
    projectionMode: "diagnostic_only",
    defaultRoleVisibility: STAFF_OR_ADMIN_ROLES,
    sourceOfTruth: ["provider/runtime logs"],
    notes: "Provider-level diagnostics may contain sensitive operational detail.",
  },
  route_metric: {
    sourceKind: "route_metric",
    label: "Route metric",
    projectionMode: "diagnostic_only",
    defaultRoleVisibility: STAFF_OR_ADMIN_ROLES,
    sourceOfTruth: ["route metrics", "structured logs"],
    notes: "Health and performance telemetry for diagnostics.",
  },
  mcp_process_log: {
    sourceKind: "mcp_process_log",
    label: "MCP/native process log",
    projectionMode: "diagnostic_only",
    defaultRoleVisibility: STAFF_OR_ADMIN_ROLES,
    sourceOfTruth: ["MCP logs", "native process logs"],
    notes: "Native/runtime process diagnostics are not user-facing activity.",
  },
  admin_signal: {
    sourceKind: "admin_signal",
    label: "Admin signal",
    projectionMode: "admin_only",
    defaultRoleVisibility: STAFF_OR_ADMIN_ROLES,
    sourceOfTruth: ["admin notification evaluators", "admin analytics"],
    notes: "Admin-only attention signal. It must be intentionally projected before regular users can see it.",
  },
};

export function getJobStatusActivityBucket(status: JobStatus): ActivityBucket {
  switch (status) {
    case "queued":
    case "running":
      return "running";
    case "succeeded":
      return "completed";
    case "failed":
    case "dead_letter":
      return "needs_attention";
    case "canceled":
      return "history";
  }
}

export function getJobEventActivityBucket(eventType: JobEventType): ActivityBucket | null {
  if (isAuditOnlyJobEventType(eventType)) {
    return null;
  }

  switch (eventType) {
    case "queued":
    case "started":
    case "progress":
    case "requeued":
    case "retry_scheduled":
    case "lease_recovered":
      return "running";
    case "result":
      return "completed";
    case "failed":
    case "retry_exhausted":
      return "needs_attention";
    case "canceled":
      return "history";
    case "notification_sent":
    case "notification_failed":
    case "ownership_transferred":
      return null;
  }
}

export function getMediaWorkflowStatusActivityBucket(status: MediaWorkflowStatus): ActivityBucket {
  switch (status) {
    case "queued":
    case "running":
      return "running";
    case "blocked":
    case "failed":
      return "needs_attention";
    case "succeeded":
      return "completed";
    case "canceled":
      return "history";
  }
}

export function getOperationStatusActivityBucket(
  status: OperationStatus,
  options: { hasEnabledConfirmationAction?: boolean } = {},
): ActivityBucket {
  if (options.hasEnabledConfirmationAction) {
    return "needs_attention";
  }

  switch (status) {
    case "awaiting_confirmation":
    case "blocked":
    case "failed":
      return "needs_attention";
    case "queued":
    case "running":
      return "running";
    case "succeeded":
      return "completed";
    case "draft":
    case "cancelled":
    case "expired":
      return "history";
  }
}

export function getReferralMilestoneActivityBucket(
  milestone: ReferralActivityMilestone,
): ActivityBucket {
  switch (milestone) {
    case "credit_pending_review":
      return "needs_attention";
    case "credit_state_changed":
      return "history";
    case "validated_visit":
    case "conversation_started":
    case "registered":
    case "qualified_opportunity":
    case "credit_approved":
    case "credit_paid":
    case "lead_submitted":
    case "consultation_requested":
    case "deal_created":
    case "training_path_created":
      return "completed";
  }
}

export function getOperationVisibilityRoles(
  visibility: OperationVisibility,
): readonly RoleName[] {
  switch (visibility) {
    case "conversation":
    case "user":
      return ALL_SIGNED_IN_ROLES;
    case "staff":
      return STAFF_OR_ADMIN_ROLES;
    case "admin":
      return ["ADMIN"];
    case "system":
      return STAFF_OR_ADMIN_ROLES;
  }
}

export function getDefaultRoleVisibilityForSourceKind(
  sourceKind: ActivitySourceKind,
): readonly RoleName[] {
  return ACTIVITY_SOURCE_MAP[sourceKind].defaultRoleVisibility;
}

export function isDiagnosticOnlySourceKind(sourceKind: ActivitySourceKind): boolean {
  return ACTIVITY_SOURCE_MAP[sourceKind].projectionMode === "diagnostic_only";
}

export function isPrivilegedOnlySourceKind(sourceKind: ActivitySourceKind): boolean {
  const mode = ACTIVITY_SOURCE_MAP[sourceKind].projectionMode;
  return mode === "diagnostic_only" || mode === "admin_only";
}

export function canProjectSourceToRegularUserActivity(sourceKind: ActivitySourceKind): boolean {
  const definition = ACTIVITY_SOURCE_MAP[sourceKind];
  if (definition.projectionMode !== "projectable") {
    return false;
  }

  return definition.defaultRoleVisibility.some((role) => REGULAR_USER_ROLES.includes(role));
}

export function isRegularUserVisibleRoleSet(roleVisibility: readonly RoleName[]): boolean {
  return roleVisibility.some((role) => REGULAR_USER_ROLES.includes(role));
}

export function shouldSuppressRegularActivityForJobEvent(eventType: JobEventType): boolean {
  return isAuditOnlyJobEventType(eventType);
}

export function getBrowserPushDeliveryActivityBucket(input: {
  status: "suppressed" | "sent" | "failed";
  userActionable?: boolean;
}): ActivityBucket | null {
  if (input.status === "failed" && input.userActionable === true) {
    return "needs_attention";
  }

  return null;
}
