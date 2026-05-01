import { describe, expect, it, vi } from "vitest";

import type { Conversation } from "@/core/entities/conversation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { JobEvent, JobRequest } from "@/core/entities/job";
import type { LeadRecord } from "@/core/entities/lead-record";
import type { Referral } from "@/core/entities/Referral";
import type { ReferralEvent } from "@/core/entities/ReferralEvent";
import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { ConsultationRequestRepository } from "@/core/use-cases/ConsultationRequestRepository";
import type { DealRecordRepository } from "@/core/use-cases/DealRecordRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { LeadRecordRepository } from "@/core/use-cases/LeadRecordRepository";
import type { TrainingPathRecordRepository } from "@/core/use-cases/TrainingPathRecordRepository";
import { RepositoryBackedBusinessWorkflowContextReader } from "./BusinessWorkflowContextReader";

function makeConversation(): Conversation {
  return {
    id: "conv_1",
    userId: "usr_1",
    title: "Lead workflow",
    status: "active",
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:01:00.000Z",
    convertedFrom: null,
    messageCount: 1,
    firstMessageAt: "2026-04-28T10:00:00.000Z",
    lastToolUsed: null,
    sessionSource: "chat",
    promptVersion: null,
    routingSnapshot: createConversationRoutingSnapshot(),
    referralId: "ref_1",
    referralSource: "ORDO-42",
  };
}

function makeLead(): LeadRecord {
  return {
    id: "lead_1",
    conversationId: "conv_1",
    lane: "organization",
    name: null,
    email: null,
    organization: "Lead Co",
    roleOrTitle: null,
    trainingGoal: null,
    authorityLevel: null,
    urgency: null,
    budgetSignal: "likely",
    technicalEnvironment: null,
    trainingFit: null,
    problemSummary: "Needs help.",
    recommendedNextAction: "Follow up with Lead Co.",
    captureStatus: "submitted",
    triageState: "new",
    founderNote: null,
    lastContactedAt: null,
    createdAt: "2026-04-28T10:02:00.000Z",
    updatedAt: "2026-04-28T10:02:00.000Z",
    submittedAt: "2026-04-28T10:02:00.000Z",
    triagedAt: null,
  };
}

function makeReferral(): Referral {
  return {
    id: "ref_1",
    referrerUserId: "usr_referrer",
    referredUserId: "usr_1",
    conversationId: "conv_1",
    referralCode: "ORDO-42",
    visitId: "visit_1",
    status: "lead",
    creditStatus: "tracked",
    scannedAt: null,
    convertedAt: null,
    lastValidatedAt: null,
    lastEventAt: "2026-04-28T10:03:00.000Z",
    outcome: null,
    metadataJson: "{}",
    createdAt: "2026-04-28T10:00:00.000Z",
  };
}

function makeReferralEvent(): ReferralEvent {
  return {
    id: "refevt_1",
    referralId: "ref_1",
    conversationId: "conv_1",
    eventType: "qualified_opportunity",
    idempotencyKey: "qualified_opportunity:ref_1",
    payload: {},
    createdAt: "2026-04-28T10:03:00.000Z",
  };
}

function makeJob(status: JobRequest["status"]): JobRequest {
  return {
    id: `job_${status}`,
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "compose_media",
    status,
    priority: 0,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: {},
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: null,
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-28T10:04:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-28T10:04:00.000Z",
  };
}

function makeJobEvent(eventType: JobEvent["eventType"], jobId: string): JobEvent {
  return {
    id: `evt_${eventType}_${jobId}`,
    jobId,
    conversationId: "conv_1",
    sequence: 1,
    eventType,
    payload: {},
    createdAt: "2026-04-28T10:05:00.000Z",
  };
}

describe("RepositoryBackedBusinessWorkflowContextReader", () => {
  it("loads durable workflow sources and filters notifications to terminal jobs", async () => {
    const conversation = makeConversation();
    const lead = makeLead();
    const referral = makeReferral();
    const terminalJob = makeJob("succeeded");
    const runningJob = makeJob("running");
    const jobNotification = makeJobEvent("notification_sent", terminalJob.id);
    const runningJobNotification = makeJobEvent("notification_sent", runningJob.id);

    const reader = new RepositoryBackedBusinessWorkflowContextReader({
      conversationRepository: { findById: vi.fn().mockResolvedValue(conversation) } as unknown as ConversationRepository,
      leadRecordRepository: { findByConversationId: vi.fn().mockResolvedValue(lead) } as unknown as LeadRecordRepository,
      consultationRequestRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as ConsultationRequestRepository,
      dealRecordRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as DealRecordRepository,
      trainingPathRecordRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as TrainingPathRecordRepository,
      referralReader: { findByConversation: vi.fn().mockResolvedValue(referral) },
      referralEventReader: { listByReferralId: vi.fn().mockResolvedValue([makeReferralEvent()]) },
      jobQueueRepository: {
        listJobsByConversation: vi.fn().mockResolvedValue([terminalJob]),
        listConversationEvents: vi.fn().mockResolvedValue([jobNotification, runningJobNotification]),
      } as unknown as JobQueueRepository,
      readinessProbe: { getReadiness: vi.fn().mockReturnValue({ status: "ok" }) },
    });

    const context = await reader.findByConversationId("conv_1");

    expect(context).not.toBeNull();
    expect(context?.id).toBe("bwc_conv_1");
    expect(context?.primaryMode).toBe("revenue");
    expect(context?.relatedRefs.map((ref) => ref.kind)).toEqual(["lead", "referral"]);
    expect(context?.notificationRefs.map((ref) => ref.notificationId)).toEqual(["refevt_1", "evt_notification_sent_job_succeeded"]);
  });

  it("supports deterministic findById over bwc-prefixed ids", async () => {
    const findById = vi.fn().mockResolvedValue(makeConversation());
    const reader = new RepositoryBackedBusinessWorkflowContextReader({
      conversationRepository: { findById } as unknown as ConversationRepository,
      leadRecordRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as LeadRecordRepository,
      consultationRequestRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as ConsultationRequestRepository,
      dealRecordRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as DealRecordRepository,
      trainingPathRecordRepository: { findByConversationId: vi.fn().mockResolvedValue(null) } as unknown as TrainingPathRecordRepository,
    });

    await expect(reader.findById("not-a-workflow-id")).resolves.toBeNull();
    await expect(reader.findById("bwc_conv_1")).resolves.toEqual(expect.objectContaining({ conversationId: "conv_1" }));
    expect(findById).toHaveBeenCalledWith("conv_1");
  });
});