import { describe, expect, it } from "vitest";

import type { ConsultationRequest } from "@/core/entities/consultation-request";
import type { Conversation } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { DealRecord } from "@/core/entities/deal-record";
import type { JobEvent } from "@/core/entities/job";
import type { LeadRecord } from "@/core/entities/lead-record";
import type { Referral } from "@/core/entities/Referral";
import type { ReferralEvent } from "@/core/entities/ReferralEvent";
import type { TrainingPathRecord } from "@/core/entities/training-path-record";
import { projectBusinessWorkflowContext } from "./BusinessWorkflowContextProjector";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv_1",
    userId: "usr_1",
    title: "Launch work",
    status: "active",
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:01:00.000Z",
    convertedFrom: null,
    messageCount: 3,
    firstMessageAt: "2026-04-28T10:00:00.000Z",
    lastToolUsed: null,
    sessionSource: "chat",
    promptVersion: null,
    routingSnapshot: createConversationRoutingSnapshot(),
    referralId: null,
    referralSource: null,
    ...overrides,
  };
}

function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead_1",
    conversationId: "conv_1",
    lane: "organization",
    name: "Ada",
    email: "ada@example.com",
    organization: "Ada Studio",
    roleOrTitle: "Founder",
    trainingGoal: null,
    authorityLevel: "decision_maker",
    urgency: "this_quarter",
    budgetSignal: "likely",
    technicalEnvironment: null,
    trainingFit: null,
    problemSummary: "Needs a launch system.",
    recommendedNextAction: "Follow up on the launch workshop.",
    captureStatus: "submitted",
    triageState: "qualified",
    founderNote: null,
    lastContactedAt: null,
    createdAt: "2026-04-28T10:02:00.000Z",
    updatedAt: "2026-04-28T10:03:00.000Z",
    submittedAt: "2026-04-28T10:02:00.000Z",
    triagedAt: null,
    ...overrides,
  };
}

function makeConsultation(overrides: Partial<ConsultationRequest> = {}): ConsultationRequest {
  return {
    id: "cr_1",
    conversationId: "conv_1",
    userId: "usr_1",
    lane: "organization",
    requestSummary: "Scope the launch workflow.",
    status: "pending",
    founderNote: null,
    createdAt: "2026-04-28T10:04:00.000Z",
    updatedAt: "2026-04-28T10:04:00.000Z",
    ...overrides,
  };
}

function makeDeal(overrides: Partial<DealRecord> = {}): DealRecord {
  return {
    id: "deal_1",
    conversationId: "conv_1",
    consultationRequestId: "cr_1",
    leadRecordId: null,
    userId: "usr_1",
    lane: "organization",
    title: "Launch workflow package",
    organizationName: "Ada Studio",
    problemSummary: "Needs a launch workflow.",
    proposedScope: "Build the system.",
    recommendedServiceType: "implementation",
    estimatedHours: 12,
    estimatedTrainingDays: null,
    estimatedPrice: 4800,
    status: "qualified",
    nextAction: "Send the estimate.",
    assumptions: null,
    openQuestions: null,
    founderNote: null,
    customerResponseNote: null,
    createdAt: "2026-04-28T10:05:00.000Z",
    updatedAt: "2026-04-28T10:06:00.000Z",
    ...overrides,
  };
}

function makeTrainingPath(overrides: Partial<TrainingPathRecord> = {}): TrainingPathRecord {
  return {
    id: "training_1",
    conversationId: "conv_1",
    leadRecordId: null,
    consultationRequestId: "cr_1",
    userId: "usr_1",
    lane: "individual",
    currentRoleOrBackground: "Operations manager",
    technicalDepth: null,
    primaryGoal: "Learn AI operations",
    preferredFormat: null,
    apprenticeshipInterest: "maybe",
    recommendedPath: "operator_lab",
    fitRationale: null,
    customerSummary: "Operator training path",
    status: "recommended",
    nextAction: "Review the training path.",
    founderNote: null,
    createdAt: "2026-04-28T10:05:00.000Z",
    updatedAt: "2026-04-28T10:07:00.000Z",
    ...overrides,
  };
}

function makeReferral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "ref_1",
    referrerUserId: "usr_referrer",
    referredUserId: "usr_1",
    conversationId: "conv_1",
    referralCode: "ORDO-42",
    visitId: "visit_1",
    status: "lead",
    creditStatus: "pending_review",
    scannedAt: "2026-04-28T09:59:00.000Z",
    convertedAt: null,
    lastValidatedAt: "2026-04-28T10:00:00.000Z",
    lastEventAt: "2026-04-28T10:08:00.000Z",
    outcome: null,
    metadataJson: "{}",
    createdAt: "2026-04-28T09:59:00.000Z",
    ...overrides,
  };
}

function makeReferralEvent(overrides: Partial<ReferralEvent> = {}): ReferralEvent {
  return {
    id: "refevt_1",
    referralId: "ref_1",
    conversationId: "conv_1",
    eventType: "qualified_opportunity",
    idempotencyKey: "qualified_opportunity:ref_1",
    payload: { triggerEventType: "lead_submitted" },
    createdAt: "2026-04-28T10:08:00.000Z",
    ...overrides,
  };
}

function makeJobEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "jobevt_1",
    jobId: "job_1",
    conversationId: "conv_1",
    sequence: 3,
    eventType: "notification_sent",
    payload: { channel: "push" },
    createdAt: "2026-04-28T10:09:00.000Z",
    ...overrides,
  };
}

describe("projectBusinessWorkflowContext", () => {
  it("returns an empty general context when no workflow sources exist", () => {
    const context = projectBusinessWorkflowContext({ conversation: makeConversation() });

    expect(context).toMatchObject({
      id: "bwc_conv_1",
      userId: "usr_1",
      conversationId: "conv_1",
      primaryMode: "general",
      relatedRefs: [],
      lifecycleRefs: [],
      notificationRefs: [],
      interruptedTurnRefs: [],
      healthRefs: [],
      recommendedAction: null,
    });
    expect(context.origin?.kind).toBe("chat");
  });

  it("projects durable business records into compact refs and revenue next action", () => {
    const context = projectBusinessWorkflowContext({
      conversation: makeConversation(),
      lead: makeLead(),
      consultation: makeConsultation(),
      deal: makeDeal(),
      referral: makeReferral(),
      referralEvents: [makeReferralEvent()],
      jobNotificationEvents: [makeJobEvent()],
    });

    expect(context.primaryMode).toBe("revenue");
    expect(context.origin).toMatchObject({ kind: "referral", label: "Trusted introduction ORDO-42" });
    expect(context.relatedRefs).toEqual([
      expect.objectContaining({ kind: "lead", id: "lead_1", label: "Ada Studio", status: "submitted:qualified" }),
      expect.objectContaining({ kind: "consultation", id: "cr_1", status: "pending" }),
      expect.objectContaining({ kind: "deal", id: "deal_1", label: "Launch workflow package" }),
      expect.objectContaining({ kind: "referral", id: "ref_1", status: "lead:pending_review" }),
    ]);
    expect(context.notificationRefs).toHaveLength(2);
    expect(context.notificationRefs.map((ref) => ref.channel)).toEqual(["referral_feed", "push"]);
    expect(context.recommendedAction).toEqual(expect.objectContaining({
      kind: "follow_up",
      label: "Send the estimate.",
    }));
    expect(JSON.stringify(context)).not.toContain("metadataJson");
    expect(JSON.stringify(context)).not.toContain("requestPayload");
  });

  it("projects training mode and readiness blockers deterministically", () => {
    const context = projectBusinessWorkflowContext({
      conversation: makeConversation(),
      trainingPath: makeTrainingPath(),
      readiness: { status: "error", details: "ANTHROPIC_API_KEY is missing." },
      observedAt: "2026-04-28T11:00:00.000Z",
    });

    expect(context.primaryMode).toBe("training");
    expect(context.healthRefs).toEqual([
      expect.objectContaining({
        id: "health_readiness_conv_1",
        severity: "blocking",
        label: "ANTHROPIC_API_KEY is missing.",
      }),
    ]);
    expect(context.recommendedAction).toEqual(expect.objectContaining({ kind: "configure" }));
    expect(context.updatedAt).toBe("2026-04-28T11:00:00.000Z");
  });

  it("derives non-referral origin from the related business ref instead of the conversation", () => {
    const context = projectBusinessWorkflowContext({
      conversation: makeConversation(),
      lead: makeLead(),
    });

    expect(context.origin).toEqual(expect.objectContaining({
      kind: "page",
      label: "Ada Studio",
      source: expect.objectContaining({
        sourceKind: "lead",
        sourceId: "lead_1",
        conversationId: "conv_1",
      }),
    }));
  });

  it("uses source refs for job evidence instead of pretending jobs are business objects", () => {
    const context = projectBusinessWorkflowContext({
      conversation: makeConversation(),
      jobNotificationEvents: [makeJobEvent({ eventType: "notification_failed" })],
    });

    expect(context.relatedRefs).toEqual([]);
    expect(context.notificationRefs[0]).toEqual(expect.objectContaining({
      notificationId: "jobevt_1",
      status: "failed",
      channel: "push",
    }));
    expect(context.notificationRefs[0]?.evidenceRefs[0]?.source.sourceKind).toBe("job_event");
  });
});