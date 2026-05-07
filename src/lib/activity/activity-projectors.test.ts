import { describe, expect, it } from "vitest";
import type { OperationSummary } from "@/core/use-cases/operations/OperationRepository";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import {
  projectJobActivity,
  projectMediaWorkflowActivity,
  projectOperationActivity,
  projectReferralActivity,
} from "./activity-projectors";

function job(overrides: Partial<CanonicalJobSnapshot> = {}): CanonicalJobSnapshot {
  return {
    jobId: "job_1",
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "generate_audio",
    label: "Generate Audio",
    title: "Generate narration",
    subtitle: "MP3 audio",
    status: "running",
    sequence: 1,
    progressPercent: 25,
    progressLabel: "Rendering",
    summary: "Audio is rendering.",
    error: undefined,
    createdAt: "2026-05-04T10:00:00.000Z",
    startedAt: "2026-05-04T10:00:01.000Z",
    completedAt: null,
    updatedAt: "2026-05-04T10:00:02.000Z",
    origin: { fallback: "job_created_at" },
    inputSnapshot: {},
    resultPayload: null,
    resultEnvelope: null,
    artifactRefs: [],
    materializationRefs: [],
    ownership: { userId: "usr_1", visibility: "owner", initiatorType: "user" },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
    ...overrides,
  };
}

function workflow(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Create short",
    requestedDeliverable: "video",
    status: "blocked",
    stage: { key: "blocked", label: "Workflow needs attention", progressPercent: null },
    steps: [],
    finalArtifact: null,
    failure: { code: "missing_asset", message: "Image asset is missing." },
    linkedJobIds: ["job_1"],
    linkedJobs: [job()],
    operation: null,
    originMessageId: null,
    originTurnId: null,
    createdAt: "2026-05-04T10:01:00.000Z",
    updatedAt: "2026-05-04T10:01:02.000Z",
    completedAt: null,
    ...overrides,
  };
}

function operation(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: "op_1",
    kind: "media_workflow",
    title: "Approve media workflow",
    status: "awaiting_confirmation",
    riskLevel: "medium",
    revision: 1,
    conversationId: "conv_1",
    currentStepId: null,
    summary: "Confirm before rendering.",
    createdByUserId: "usr_1",
    createdByRole: "AUTHENTICATED",
    visibility: "user",
    createdAt: "2026-05-04T10:02:00.000Z",
    updatedAt: "2026-05-04T10:02:02.000Z",
    completedAt: null,
    stepCount: 1,
    actionCount: 1,
    artifactCount: 0,
    eventCount: 1,
    latestEventType: "action_exposed",
    latestEventAt: "2026-05-04T10:02:02.000Z",
    progress: {
      totalSteps: 1,
      pendingSteps: 0,
      readySteps: 1,
      runningSteps: 0,
      blockedSteps: 0,
      succeededSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percentComplete: 0,
    },
    ...overrides,
  };
}

describe("activity projectors", () => {
  it("projects owner-scoped jobs into activity items", () => {
    const activity = projectJobActivity(job({ status: "failed", error: "Provider failed." }));

    expect(activity).toMatchObject({
      id: "job:job_1",
      sourceKind: "job",
      bucket: "needs_attention",
      severity: "warning",
      title: "Generate narration",
      summary: "Provider failed.",
      href: "/jobs?jobId=job_1",
    });
  });

  it("does not project anonymous jobs into authenticated activity", () => {
    expect(projectJobActivity(job({ userId: null }))).toBeNull();
  });

  it("projects blocked media workflows as attention activity", () => {
    const activity = projectMediaWorkflowActivity(workflow());

    expect(activity).toMatchObject({
      id: "media_workflow:mwf_1",
      sourceKind: "media_workflow",
      bucket: "needs_attention",
      severity: "warning",
      title: "Create short",
      summary: "Image asset is missing.",
    });
  });

  it("projects referral milestones as business-loop activity", () => {
    const activity = projectReferralActivity({
      id: "evt_1",
      referralId: "ref_1",
      referralCode: "mentor-42",
      milestone: "credit_pending_review",
      title: "Credit pending review",
      description: "A referred opportunity is waiting for credit review.",
      occurredAt: "2026-05-04T10:03:00.000Z",
      href: "/referrals",
    }, "usr_1");

    expect(activity).toMatchObject({
      id: "referral_milestone:evt_1",
      bucket: "needs_attention",
      severity: "warning",
      href: "/referrals",
    });
  });

  it("projects operation actions as attention activity", () => {
    const activity = projectOperationActivity(operation(), [
      {
        id: "act_1",
        operationId: "op_1",
        operationRevision: 1,
        actionType: "confirm",
        label: "Confirm render",
        riskLevel: "medium",
        confirmPolicy: "single_click",
        allowedRoles: ["AUTHENTICATED"],
        allowedStatuses: ["awaiting_confirmation"],
        enabled: true,
        disabledReason: null,
        idempotencyKey: "confirm:op_1",
        expiresAt: null,
        payload: {},
        payloadSchemaKey: "confirm",
      },
    ]);

    expect(activity).toMatchObject({
      id: "operation:op_1",
      sourceKind: "operation",
      bucket: "needs_attention",
      primaryAction: {
        id: "act_1",
        label: "Confirm render",
      },
    });
  });

  it("does not project system-owned operations into user activity", () => {
    expect(projectOperationActivity(operation({ createdByUserId: null }))).toBeNull();
  });
});
