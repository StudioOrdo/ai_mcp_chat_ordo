import type { OperationAction } from "@/core/entities/operation";
import type { OperationSummary } from "@/core/use-cases/operations/OperationRepository";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import type { ReferralActivityItem } from "@/lib/referrals/referral-milestones";
import {
  getDefaultRoleVisibilityForSourceKind,
  getJobStatusActivityBucket,
  getMediaWorkflowStatusActivityBucket,
  getOperationStatusActivityBucket,
  getOperationVisibilityRoles,
  getReferralMilestoneActivityBucket,
  type ActivitySeverity,
} from "@/lib/activity/activity-taxonomy";
import {
  buildActivityId,
  EMPTY_ACTIVITY_RECEIPT,
  type ActivityAction,
  type ActivityItem,
} from "@/lib/activity/activity-types";

function humanizeStatus(status: string): string {
  return status
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function jobSeverity(status: CanonicalJobSnapshot["status"]): ActivitySeverity {
  if (status === "dead_letter") return "critical";
  if (status === "failed") return "warning";
  if (status === "succeeded") return "success";
  return "info";
}

function workflowSeverity(status: CanonicalMediaWorkflowSnapshot["status"]): ActivitySeverity {
  if (status === "failed") return "critical";
  if (status === "blocked") return "warning";
  if (status === "succeeded") return "success";
  return "info";
}

function operationSeverity(status: OperationSummary["status"]): ActivitySeverity {
  if (status === "failed") return "critical";
  if (status === "blocked" || status === "awaiting_confirmation") return "warning";
  if (status === "succeeded") return "success";
  return "info";
}

function referralSeverity(milestone: ReferralActivityItem["milestone"]): ActivitySeverity {
  return milestone === "credit_pending_review" ? "warning" : "success";
}

function truncateSummary(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "";
}

export function projectJobActivity(snapshot: CanonicalJobSnapshot): ActivityItem | null {
  if (!snapshot.userId) {
    return null;
  }

  const source = { sourceKind: "job" as const, sourceId: snapshot.jobId };
  const statusLabel = humanizeStatus(snapshot.status);
  const title = snapshot.title ?? snapshot.label;
  const summary = truncateSummary(snapshot.error ?? snapshot.summary ?? snapshot.subtitle)
    || `${snapshot.label} is ${statusLabel.toLowerCase()}.`;

  return {
    id: buildActivityId(source),
    ...source,
    userId: snapshot.userId,
    roleVisibility: getDefaultRoleVisibilityForSourceKind("job"),
    bucket: getJobStatusActivityBucket(snapshot.status),
    severity: jobSeverity(snapshot.status),
    title,
    summary,
    statusLabel,
    sourceStatus: snapshot.status,
    href: `/jobs?jobId=${encodeURIComponent(snapshot.jobId)}`,
    primaryAction: {
      id: "open_job",
      label: "Open work",
      href: `/jobs?jobId=${encodeURIComponent(snapshot.jobId)}`,
      tone: "primary",
    },
    secondaryActions: [
      {
        id: "open_conversation",
        label: "Open conversation",
        href: `/?conversationId=${encodeURIComponent(snapshot.conversationId)}`,
        tone: "secondary",
      },
    ],
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    dedupeKey: `job:${snapshot.jobId}`,
    receipt: EMPTY_ACTIVITY_RECEIPT,
  };
}

export function projectMediaWorkflowActivity(
  snapshot: CanonicalMediaWorkflowSnapshot,
): ActivityItem {
  const source = { sourceKind: "media_workflow" as const, sourceId: snapshot.workflowId };
  const statusLabel = humanizeStatus(snapshot.status);
  const finalArtifactHref = snapshot.finalArtifact
    ? `/my/media?assetId=${encodeURIComponent(snapshot.finalArtifact.assetId)}`
    : null;
  const summary = truncateSummary(snapshot.failure.message ?? snapshot.stage.label)
    || `${snapshot.requestedDeliverable} workflow is ${statusLabel.toLowerCase()}.`;

  return {
    id: buildActivityId(source),
    ...source,
    userId: snapshot.userId,
    roleVisibility: getDefaultRoleVisibilityForSourceKind("media_workflow"),
    bucket: getMediaWorkflowStatusActivityBucket(snapshot.status),
    severity: workflowSeverity(snapshot.status),
    title: snapshot.title,
    summary,
    statusLabel,
    sourceStatus: snapshot.status,
    href: finalArtifactHref ?? `/jobs?workflowId=${encodeURIComponent(snapshot.workflowId)}`,
    primaryAction: finalArtifactHref
      ? {
          id: "open_asset",
          label: "Open media",
          href: finalArtifactHref,
          tone: "primary",
        }
      : {
          id: "open_workflow",
          label: "Open workflow",
          href: `/jobs?workflowId=${encodeURIComponent(snapshot.workflowId)}`,
          tone: "primary",
        },
    secondaryActions: [
      {
        id: "open_conversation",
        label: "Open conversation",
        href: `/?conversationId=${encodeURIComponent(snapshot.conversationId)}`,
        tone: "secondary",
      },
    ],
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    dedupeKey: `media_workflow:${snapshot.workflowId}`,
    receipt: EMPTY_ACTIVITY_RECEIPT,
  };
}

export function projectReferralActivity(item: ReferralActivityItem, userId: string): ActivityItem {
  const source = { sourceKind: "referral_milestone" as const, sourceId: item.id };
  return {
    id: buildActivityId(source),
    ...source,
    userId,
    roleVisibility: getDefaultRoleVisibilityForSourceKind("referral_milestone"),
    bucket: getReferralMilestoneActivityBucket(item.milestone),
    severity: referralSeverity(item.milestone),
    title: item.title,
    summary: item.description,
    statusLabel: humanizeStatus(item.milestone),
    sourceStatus: item.milestone,
    href: item.href,
    primaryAction: {
      id: "open_referrals",
      label: "Open referrals",
      href: item.href,
      tone: "primary",
    },
    secondaryActions: [],
    createdAt: item.occurredAt,
    updatedAt: item.occurredAt,
    dedupeKey: `referral_milestone:${item.referralId}:${item.milestone}`,
    receipt: EMPTY_ACTIVITY_RECEIPT,
  };
}

function operationActions(actions: readonly OperationAction[]): ActivityAction[] {
  return actions.map((action) => ({
    id: action.id,
    label: action.label,
    actionType: action.actionType,
    tone: action.riskLevel === "destructive" ? "destructive" : "secondary",
    disabled: !action.enabled,
    disabledReason: action.disabledReason,
  }));
}

export function projectOperationActivity(
  summary: OperationSummary,
  availableActions: readonly OperationAction[] = [],
): ActivityItem | null {
  if (!summary.createdByUserId) {
    return null;
  }

  const source = { sourceKind: "operation" as const, sourceId: summary.id };
  const enabledConfirmationAction = availableActions.some((action) =>
    action.enabled && action.confirmPolicy !== "none",
  );
  const statusLabel = humanizeStatus(summary.status);
  const actions = operationActions(availableActions);

  return {
    id: buildActivityId(source),
    ...source,
    userId: summary.createdByUserId,
    roleVisibility: getOperationVisibilityRoles(summary.visibility),
    bucket: getOperationStatusActivityBucket(summary.status, {
      hasEnabledConfirmationAction: enabledConfirmationAction,
    }),
    severity: operationSeverity(summary.status),
    title: summary.title,
    summary: truncateSummary(summary.summary) || `${humanizeStatus(summary.kind)} is ${statusLabel.toLowerCase()}.`,
    statusLabel,
    sourceStatus: summary.status,
    href: `/operations/${encodeURIComponent(summary.id)}`,
    primaryAction: actions[0] ?? {
      id: "open_operation",
      label: "Open operation",
      href: `/operations/${encodeURIComponent(summary.id)}`,
      tone: "primary",
    },
    secondaryActions: actions.slice(1),
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    dedupeKey: `operation:${summary.id}`,
    receipt: EMPTY_ACTIVITY_RECEIPT,
  };
}
