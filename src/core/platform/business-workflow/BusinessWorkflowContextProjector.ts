import type { BusinessWorkflowContext, BusinessWorkflowMode, WorkflowRecommendedAction } from "@/core/entities/business-workflow-context";
import type { BusinessObjectRef, ContinuitySourceRef, CanonicalEvidenceRef } from "@/core/entities/conversation-continuity";
import type { ConsultationRequest } from "@/core/entities/consultation-request";
import type { Conversation } from "@/core/entities/conversation";
import type { DealRecord } from "@/core/entities/deal-record";
import type { JobEvent } from "@/core/entities/job";
import type { LeadRecord } from "@/core/entities/lead-record";
import type { Referral } from "@/core/entities/Referral";
import type { ReferralEvent } from "@/core/entities/ReferralEvent";
import type { TrainingPathRecord } from "@/core/entities/training-path-record";

export interface WorkflowReadinessProbeResult {
  status: "ok" | "error";
  details?: string;
}

export interface BusinessWorkflowContextProjectionInput {
  conversation: Conversation;
  lead?: LeadRecord | null;
  consultation?: ConsultationRequest | null;
  deal?: DealRecord | null;
  trainingPath?: TrainingPathRecord | null;
  referral?: Referral | null;
  referralEvents?: readonly ReferralEvent[];
  jobNotificationEvents?: readonly JobEvent[];
  readiness?: WorkflowReadinessProbeResult | null;
  observedAt?: string;
}

const REFERRAL_NOTIFICATION_EVENT_TYPES = new Set([
  "validated_visit",
  "conversation_started",
  "registered",
  "qualified_opportunity",
  "credit_pending_review",
  "credit_approved",
  "credit_paid",
]);

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function sourceRef(input: ContinuitySourceRef): ContinuitySourceRef {
  return { ...input };
}

function conversationSource(conversation: Conversation): ContinuitySourceRef {
  return sourceRef({
    sourceKind: "conversation",
    sourceId: conversation.id,
    userId: conversation.userId,
    conversationId: conversation.id,
  });
}

function businessObjectSource(ref: BusinessObjectRef): ContinuitySourceRef {
  return sourceRef({
    sourceKind: ref.kind,
    sourceId: ref.id,
    userId: ref.userId,
    conversationId: ref.conversationId,
  });
}

function referralSource(referral: Referral): ContinuitySourceRef {
  return sourceRef({
    sourceKind: "referral",
    sourceId: referral.id,
    userId: referral.referredUserId ?? referral.referrerUserId,
    conversationId: referral.conversationId,
  });
}

function referralEventSource(event: ReferralEvent): ContinuitySourceRef {
  return sourceRef({
    sourceKind: "referral_event",
    sourceId: event.id,
    userId: null,
    conversationId: event.conversationId,
  });
}

function jobEventSource(event: JobEvent): ContinuitySourceRef {
  return sourceRef({
    sourceKind: "job_event",
    sourceId: event.id,
    userId: null,
    conversationId: event.conversationId,
  });
}

function evidence(source: ContinuitySourceRef, observedAt: string, summary: string | null): CanonicalEvidenceRef {
  return {
    source,
    observedAt,
    summary,
  };
}

function toLeadRef(lead: LeadRecord): BusinessObjectRef {
  return {
    kind: "lead",
    id: lead.id,
    userId: null,
    conversationId: lead.conversationId,
    label: trimToNull(lead.organization)
      ?? trimToNull(lead.name)
      ?? trimToNull(lead.problemSummary)
      ?? trimToNull(lead.trainingGoal),
    status: `${lead.captureStatus}:${lead.triageState}`,
  };
}

function toConsultationRef(consultation: ConsultationRequest): BusinessObjectRef {
  return {
    kind: "consultation",
    id: consultation.id,
    userId: consultation.userId,
    conversationId: consultation.conversationId,
    label: trimToNull(consultation.requestSummary),
    status: consultation.status,
  };
}

function toDealRef(deal: DealRecord): BusinessObjectRef {
  return {
    kind: "deal",
    id: deal.id,
    userId: deal.userId,
    conversationId: deal.conversationId,
    label: trimToNull(deal.title) ?? trimToNull(deal.organizationName) ?? trimToNull(deal.problemSummary),
    status: deal.status,
  };
}

function toTrainingPathRef(trainingPath: TrainingPathRecord): BusinessObjectRef {
  return {
    kind: "training_path",
    id: trainingPath.id,
    userId: trainingPath.userId,
    conversationId: trainingPath.conversationId,
    label: trimToNull(trainingPath.customerSummary)
      ?? trimToNull(trainingPath.primaryGoal)
      ?? trainingPath.recommendedPath,
    status: trainingPath.status,
  };
}

function toReferralRef(referral: Referral): BusinessObjectRef {
  return {
    kind: "referral",
    id: referral.id,
    userId: referral.referredUserId ?? referral.referrerUserId,
    conversationId: referral.conversationId,
    label: `Referral ${referral.referralCode}`,
    status: `${referral.status}:${referral.creditStatus}`,
  };
}

function getRelatedRefs(input: BusinessWorkflowContextProjectionInput): BusinessObjectRef[] {
  const refs: BusinessObjectRef[] = [];
  if (input.lead) refs.push(toLeadRef(input.lead));
  if (input.consultation) refs.push(toConsultationRef(input.consultation));
  if (input.deal) refs.push(toDealRef(input.deal));
  if (input.trainingPath) refs.push(toTrainingPathRef(input.trainingPath));
  if (input.referral) refs.push(toReferralRef(input.referral));
  return refs;
}

function choosePrimaryMode(input: BusinessWorkflowContextProjectionInput): BusinessWorkflowMode {
  if (input.readiness?.status === "error" && !input.deal && !input.trainingPath) {
    return "setup";
  }
  if (input.deal) {
    return "revenue";
  }
  if (input.trainingPath) {
    return "training";
  }
  if (input.consultation) {
    return input.consultation.lane === "individual" ? "training" : "service";
  }
  if (input.lead) {
    if (input.lead.lane === "individual" || input.lead.trainingGoal || input.lead.trainingFit) {
      return "training";
    }
    if (input.lead.lane === "organization" || input.lead.budgetSignal === "confirmed" || input.lead.budgetSignal === "likely") {
      return "revenue";
    }
    return "service";
  }
  if (input.referral) {
    return "revenue";
  }
  if ((input.jobNotificationEvents ?? []).length > 0) {
    return "operations";
  }
  return "general";
}

function getUpdatedAt(input: BusinessWorkflowContextProjectionInput): string {
  const candidates = [
    input.conversation.updatedAt,
    input.lead?.updatedAt,
    input.consultation?.updatedAt,
    input.deal?.updatedAt,
    input.trainingPath?.updatedAt,
    input.referral?.lastEventAt,
    input.referral?.lastValidatedAt,
    input.referral?.createdAt,
    ...(input.referralEvents ?? []).map((event) => event.createdAt),
    ...(input.jobNotificationEvents ?? []).map((event) => event.createdAt),
    input.observedAt,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return candidates.sort().at(-1) ?? input.conversation.updatedAt;
}

function buildOrigin(input: BusinessWorkflowContextProjectionInput, relatedRefs: readonly BusinessObjectRef[]) {
  if (input.referral) {
    return {
      kind: "referral" as const,
      source: referralSource(input.referral),
      label: `Trusted introduction ${input.referral.referralCode}`,
    };
  }

  const firstRef = relatedRefs[0];
  if (firstRef) {
    return {
      kind: "page" as const,
      source: businessObjectSource(firstRef),
      label: firstRef.label ?? firstRef.kind.replace(/_/g, " "),
    };
  }

  return {
    kind: "chat" as const,
    source: conversationSource(input.conversation),
    label: trimToNull(input.conversation.title) ?? "Conversation",
  };
}

function buildHealthRefs(input: BusinessWorkflowContextProjectionInput) {
  if (input.readiness?.status !== "error") {
    return [];
  }

  return [{
    id: `health_readiness_${input.conversation.id}`,
    severity: "blocking" as const,
    label: trimToNull(input.readiness.details) ?? "Readiness check failed.",
    source: sourceRef({
      sourceKind: "business_workflow_context",
      sourceId: `bwc_${input.conversation.id}`,
      userId: input.conversation.userId,
      conversationId: input.conversation.id,
    }),
  }];
}

function isReferralNotificationEvent(event: ReferralEvent): boolean {
  if (REFERRAL_NOTIFICATION_EVENT_TYPES.has(event.eventType)) {
    return true;
  }
  return event.eventType === "credit_state_changed"
    && ["pending_review", "approved", "paid"].includes(String(event.payload.creditStatus ?? ""));
}

function buildNotificationRefs(input: BusinessWorkflowContextProjectionInput, observedAt: string) {
  const jobRefs = (input.jobNotificationEvents ?? []).map((event) => ({
    notificationId: event.id,
    status: event.eventType === "notification_failed" ? "failed" as const : "sent" as const,
    channel: "push",
    evidenceRefs: [evidence(jobEventSource(event), event.createdAt, `Deferred job ${event.eventType.replace(/_/g, " ")}.`)],
  }));

  const referralRefs = (input.referralEvents ?? [])
    .filter(isReferralNotificationEvent)
    .map((event) => ({
      notificationId: event.id,
      status: "sent" as const,
      channel: "referral_feed",
      evidenceRefs: [evidence(referralEventSource(event), event.createdAt || observedAt, `Referral milestone ${event.eventType.replace(/_/g, " ")}.`)],
    }));

  return [...referralRefs, ...jobRefs];
}

function buildRecommendedAction(input: BusinessWorkflowContextProjectionInput, relatedRefs: readonly BusinessObjectRef[]): WorkflowRecommendedAction | null {
  if (input.readiness?.status === "error") {
    return {
      kind: "configure",
      label: "Resolve setup blocker",
      targetRef: sourceRef({
        sourceKind: "business_workflow_context",
        sourceId: `bwc_${input.conversation.id}`,
        userId: input.conversation.userId,
        conversationId: input.conversation.id,
      }),
    };
  }

  if (input.deal?.nextAction) {
    return { kind: "follow_up", label: input.deal.nextAction, targetRef: conversationSource(input.conversation) };
  }
  if (input.trainingPath?.nextAction) {
    return { kind: "continue", label: input.trainingPath.nextAction, targetRef: conversationSource(input.conversation) };
  }
  if (input.lead?.recommendedNextAction) {
    return { kind: "follow_up", label: input.lead.recommendedNextAction, targetRef: conversationSource(input.conversation) };
  }
  if (input.consultation) {
    return { kind: "review", label: "Review consultation request", targetRef: conversationSource(input.conversation) };
  }

  const failedJobNotification = (input.jobNotificationEvents ?? []).find((event) => event.eventType === "notification_failed");
  if (failedJobNotification) {
    return { kind: "review", label: "Review failed notification", targetRef: jobEventSource(failedJobNotification) };
  }

  const sentJobNotification = (input.jobNotificationEvents ?? []).find((event) => event.eventType === "notification_sent");
  if (sentJobNotification) {
    return { kind: "review", label: "Review completed work", targetRef: jobEventSource(sentJobNotification) };
  }

  if (input.referral) {
    return {
      kind: input.referral.status === "visited" ? "share" : "follow_up",
      label: input.referral.status === "visited" ? "Continue sharing referral link" : "Follow up on trusted introduction",
      targetRef: referralSource(input.referral),
    };
  }

  if (relatedRefs.length > 0) {
    return { kind: "continue", label: "Continue business workflow", targetRef: conversationSource(input.conversation) };
  }

  return null;
}

export function projectBusinessWorkflowContext(input: BusinessWorkflowContextProjectionInput): BusinessWorkflowContext {
  const observedAt = input.observedAt ?? input.conversation.updatedAt;
  const relatedRefs = getRelatedRefs(input);
  const healthRefs = buildHealthRefs(input);

  return {
    id: `bwc_${input.conversation.id}`,
    userId: input.conversation.userId,
    conversationId: input.conversation.id,
    primaryMode: choosePrimaryMode(input),
    origin: buildOrigin(input, relatedRefs),
    relatedRefs,
    lifecycleRefs: [],
    notificationRefs: buildNotificationRefs(input, observedAt),
    interruptedTurnRefs: [],
    healthRefs,
    recommendedAction: buildRecommendedAction(input, relatedRefs),
    updatedAt: getUpdatedAt(input),
  };
}