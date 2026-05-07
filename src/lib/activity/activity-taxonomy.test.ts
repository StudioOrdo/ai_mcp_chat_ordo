import { describe, expect, it } from "vitest";
import {
  ACTIVITY_CONTRACT_FIELDS,
  ACTIVITY_SOURCE_KINDS,
  ACTIVITY_SOURCE_MAP,
  canProjectSourceToRegularUserActivity,
  getBrowserPushDeliveryActivityBucket,
  getDefaultRoleVisibilityForSourceKind,
  getJobEventActivityBucket,
  getJobStatusActivityBucket,
  getMediaWorkflowStatusActivityBucket,
  getOperationStatusActivityBucket,
  getOperationVisibilityRoles,
  getReferralMilestoneActivityBucket,
  isDiagnosticOnlySourceKind,
  isPrivilegedOnlySourceKind,
  isRegularUserVisibleRoleSet,
  shouldSuppressRegularActivityForJobEvent,
} from "./activity-taxonomy";

describe("activity taxonomy", () => {
  it("keeps every known source kind in the source map", () => {
    expect(Object.keys(ACTIVITY_SOURCE_MAP).sort()).toEqual([...ACTIVITY_SOURCE_KINDS].sort());
  });

  it("defines the normalized activity fields required by later phases", () => {
    expect(ACTIVITY_CONTRACT_FIELDS).toEqual([
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
    ]);
  });

  it("maps queued and running jobs to running activity", () => {
    expect(getJobStatusActivityBucket("queued")).toBe("running");
    expect(getJobStatusActivityBucket("running")).toBe("running");
  });

  it("maps failed and dead-letter jobs to needs-attention activity", () => {
    expect(getJobStatusActivityBucket("failed")).toBe("needs_attention");
    expect(getJobStatusActivityBucket("dead_letter")).toBe("needs_attention");
  });

  it("maps terminal successful and canceled jobs without inflating attention", () => {
    expect(getJobStatusActivityBucket("succeeded")).toBe("completed");
    expect(getJobStatusActivityBucket("canceled")).toBe("history");
  });

  it("suppresses audit-only job notification events as standalone user activity", () => {
    expect(shouldSuppressRegularActivityForJobEvent("notification_sent")).toBe(true);
    expect(shouldSuppressRegularActivityForJobEvent("notification_failed")).toBe(true);
    expect(shouldSuppressRegularActivityForJobEvent("ownership_transferred")).toBe(true);
    expect(getJobEventActivityBucket("notification_sent")).toBeNull();
    expect(getJobEventActivityBucket("notification_failed")).toBeNull();
    expect(getJobEventActivityBucket("ownership_transferred")).toBeNull();
  });

  it("maps renderable job events into user-facing buckets", () => {
    expect(getJobEventActivityBucket("started")).toBe("running");
    expect(getJobEventActivityBucket("result")).toBe("completed");
    expect(getJobEventActivityBucket("retry_exhausted")).toBe("needs_attention");
    expect(getJobEventActivityBucket("canceled")).toBe("history");
  });

  it("maps blocked media workflows to needs-attention activity", () => {
    expect(getMediaWorkflowStatusActivityBucket("blocked")).toBe("needs_attention");
    expect(getMediaWorkflowStatusActivityBucket("failed")).toBe("needs_attention");
  });

  it("maps media workflow lifecycle states into stable buckets", () => {
    expect(getMediaWorkflowStatusActivityBucket("queued")).toBe("running");
    expect(getMediaWorkflowStatusActivityBucket("running")).toBe("running");
    expect(getMediaWorkflowStatusActivityBucket("succeeded")).toBe("completed");
    expect(getMediaWorkflowStatusActivityBucket("canceled")).toBe("history");
  });

  it("maps operation confirmations, blocked operations, and failures to needs attention", () => {
    expect(getOperationStatusActivityBucket("awaiting_confirmation")).toBe("needs_attention");
    expect(getOperationStatusActivityBucket("blocked")).toBe("needs_attention");
    expect(getOperationStatusActivityBucket("failed")).toBe("needs_attention");
    expect(getOperationStatusActivityBucket("running", { hasEnabledConfirmationAction: true }))
      .toBe("needs_attention");
  });

  it("maps non-attention operation lifecycle states into stable buckets", () => {
    expect(getOperationStatusActivityBucket("queued")).toBe("running");
    expect(getOperationStatusActivityBucket("running")).toBe("running");
    expect(getOperationStatusActivityBucket("succeeded")).toBe("completed");
    expect(getOperationStatusActivityBucket("draft")).toBe("history");
    expect(getOperationStatusActivityBucket("cancelled")).toBe("history");
    expect(getOperationStatusActivityBucket("expired")).toBe("history");
  });

  it("maps operation visibility to regular, staff, admin, and system role boundaries", () => {
    expect(getOperationVisibilityRoles("user")).toContain("AUTHENTICATED");
    expect(getOperationVisibilityRoles("staff")).toEqual(["STAFF", "ADMIN"]);
    expect(getOperationVisibilityRoles("admin")).toEqual(["ADMIN"]);
    expect(getOperationVisibilityRoles("system")).toEqual(["STAFF", "ADMIN"]);
  });

  it("never includes anonymous users in authenticated activity visibility", () => {
    for (const sourceKind of ACTIVITY_SOURCE_KINDS) {
      expect(getDefaultRoleVisibilityForSourceKind(sourceKind)).not.toContain("ANONYMOUS");
    }

    expect(getOperationVisibilityRoles("conversation")).not.toContain("ANONYMOUS");
    expect(getOperationVisibilityRoles("user")).not.toContain("ANONYMOUS");
    expect(getOperationVisibilityRoles("staff")).not.toContain("ANONYMOUS");
    expect(getOperationVisibilityRoles("admin")).not.toContain("ANONYMOUS");
    expect(getOperationVisibilityRoles("system")).not.toContain("ANONYMOUS");
  });

  it("maps referral milestones to completed or needs-attention activity", () => {
    expect(getReferralMilestoneActivityBucket("validated_visit")).toBe("completed");
    expect(getReferralMilestoneActivityBucket("registered")).toBe("completed");
    expect(getReferralMilestoneActivityBucket("qualified_opportunity")).toBe("completed");
    expect(getReferralMilestoneActivityBucket("credit_pending_review")).toBe("needs_attention");
    expect(getReferralMilestoneActivityBucket("credit_approved")).toBe("completed");
    expect(getReferralMilestoneActivityBucket("credit_paid")).toBe("completed");
    expect(getReferralMilestoneActivityBucket("credit_state_changed")).toBe("history");
  });

  it("keeps raw diagnostics out of regular user activity", () => {
    expect(isDiagnosticOnlySourceKind("runtime_audit_log")).toBe(true);
    expect(isDiagnosticOnlySourceKind("provider_log")).toBe(true);
    expect(isDiagnosticOnlySourceKind("route_metric")).toBe(true);
    expect(isDiagnosticOnlySourceKind("mcp_process_log")).toBe(true);
    expect(canProjectSourceToRegularUserActivity("runtime_audit_log")).toBe(false);
  });

  it("keeps admin-only signals out of regular authenticated activity", () => {
    expect(isDiagnosticOnlySourceKind("admin_signal")).toBe(false);
    expect(isPrivilegedOnlySourceKind("admin_signal")).toBe(true);
    expect(canProjectSourceToRegularUserActivity("admin_signal")).toBe(false);
    expect(isRegularUserVisibleRoleSet(getDefaultRoleVisibilityForSourceKind("admin_signal"))).toBe(false);
  });

  it("allows current durable user sources to project into regular user activity", () => {
    expect(canProjectSourceToRegularUserActivity("job")).toBe(true);
    expect(canProjectSourceToRegularUserActivity("media_workflow")).toBe(true);
    expect(canProjectSourceToRegularUserActivity("operation")).toBe(true);
    expect(canProjectSourceToRegularUserActivity("referral_milestone")).toBe(true);
  });

  it("keeps browser push delivery separate unless the failure is user-actionable", () => {
    expect(canProjectSourceToRegularUserActivity("browser_push_delivery")).toBe(false);
    expect(getBrowserPushDeliveryActivityBucket({ status: "suppressed" })).toBeNull();
    expect(getBrowserPushDeliveryActivityBucket({ status: "sent" })).toBeNull();
    expect(getBrowserPushDeliveryActivityBucket({ status: "failed" })).toBeNull();
    expect(getBrowserPushDeliveryActivityBucket({ status: "failed", userActionable: true }))
      .toBe("needs_attention");
  });
});
