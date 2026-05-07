import type { CreditStatus } from "@/core/entities/Referral";
import type { FeedNotification } from "@/lib/notifications/feed-notification";
import { businessReferralDetailHref } from "@/lib/ordo-details/ordo-detail-routes";

export type ReferralNotificationMilestone =
  | "validated_visit"
  | "conversation_started"
  | "registered"
  | "qualified_opportunity"
  | "credit_pending_review"
  | "credit_approved"
  | "credit_paid";

export type ReferralActivityMilestone =
  | ReferralNotificationMilestone
  | "lead_submitted"
  | "consultation_requested"
  | "deal_created"
  | "training_path_created"
  | "credit_state_changed";

export interface ReferralMilestoneEventRecord {
  eventId: string;
  referralId: string;
  referralCode: string;
  eventType: string;
  createdAt: string;
  conversationId: string | null;
  payload: Record<string, unknown>;
}

export interface ReferralActivityItem {
  id: string;
  referralId: string;
  referralCode: string;
  milestone: ReferralActivityMilestone;
  title: string;
  description: string;
  occurredAt: string;
  href: string;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function maybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCreditStatus(value: unknown): CreditStatus | null {
  switch (value) {
    case "tracked":
    case "pending_review":
    case "approved":
    case "paid":
    case "void":
      return value;
    default:
      return null;
  }
}

function getQualifiedOpportunityTriggerLabel(record: ReferralMilestoneEventRecord): string {
  const triggerEventType = maybeString(record.payload.triggerEventType);
  switch (triggerEventType) {
    case "lead_submitted":
      return "lead submitted";
    case "consultation_requested":
      return "consultation requested";
    case "deal_created":
      return "deal created";
    case "training_path_created":
      return "training path created";
    default:
      return "a downstream milestone";
  }
}

export function getReferralNotificationMilestone(
  record: ReferralMilestoneEventRecord,
): ReferralNotificationMilestone | null {
  switch (record.eventType) {
    case "validated_visit":
    case "conversation_started":
    case "registered":
    case "qualified_opportunity":
    case "credit_pending_review":
    case "credit_approved":
    case "credit_paid":
      return record.eventType;
    case "credit_state_changed": {
      const creditStatus = normalizeCreditStatus(record.payload.creditStatus);
      if (creditStatus === "pending_review") {
        return "credit_pending_review";
      }
      if (creditStatus === "approved") {
        return "credit_approved";
      }
      if (creditStatus === "paid") {
        return "credit_paid";
      }
      return null;
    }
    default:
      return null;
  }
}

export function getReferralActivityMilestone(
  record: ReferralMilestoneEventRecord,
): ReferralActivityMilestone | null {
  const notificationMilestone = getReferralNotificationMilestone(record);
  if (notificationMilestone) {
    return notificationMilestone;
  }

  switch (record.eventType) {
    case "lead_submitted":
    case "consultation_requested":
    case "deal_created":
    case "training_path_created":
    case "credit_state_changed":
      return record.eventType;
    default:
      return null;
  }
}

function buildReferralActivityTitle(
  record: ReferralMilestoneEventRecord,
  milestone: ReferralActivityMilestone,
): string {
  switch (milestone) {
    case "validated_visit":
      return "Introduction validated";
    case "conversation_started":
      return "Started chat";
    case "registered":
      return "Registered account";
    case "qualified_opportunity":
      return "Qualified opportunity";
    case "lead_submitted":
      return "Lead submitted";
    case "consultation_requested":
      return "Consultation requested";
    case "deal_created":
      return "Deal created";
    case "training_path_created":
      return "Training path created";
    case "credit_pending_review":
      return "Credit pending review";
    case "credit_approved":
      return "Credit approved";
    case "credit_paid":
      return "Credit paid";
    case "credit_state_changed": {
      const creditStatus = normalizeCreditStatus(record.payload.creditStatus);
      if (creditStatus === "void") {
        return "Credit voided";
      }
      return "Credit status changed";
    }
  }
}

function buildReferralActivityDescription(
  record: ReferralMilestoneEventRecord,
  milestone: ReferralActivityMilestone,
): string {
  switch (milestone) {
    case "validated_visit":
      return `A new introduction used referral code ${record.referralCode}.`;
    case "conversation_started":
      return `One of your introductions started a chat using ${record.referralCode}.`;
    case "registered":
      return `A referred visitor completed registration after starting from ${record.referralCode}.`;
    case "qualified_opportunity":
      return `A referred conversation reached a qualified opportunity through ${getQualifiedOpportunityTriggerLabel(record)}.`;
    case "lead_submitted":
      return `A referred conversation submitted a lead record.`;
    case "consultation_requested":
      return `A referred conversation requested a consultation.`;
    case "deal_created":
      return `A referred workflow created a deal record.`;
    case "training_path_created":
      return `A referred workflow created a training path.`;
    case "credit_pending_review":
      return `A referred opportunity is waiting for credit review.`;
    case "credit_approved":
      return `A referred opportunity was approved for credit.`;
    case "credit_paid":
      return `A referral credit was marked paid.`;
    case "credit_state_changed": {
      const creditStatus = normalizeCreditStatus(record.payload.creditStatus);
      const reason = maybeString(record.payload.reason);
      const statusLabel = creditStatus ? creditStatus.replace(/_/g, " ") : "updated";
      return reason
        ? `Credit status changed to ${statusLabel}: ${reason}.`
        : `Credit status changed to ${statusLabel}.`;
    }
  }
}

export function toReferralActivityItem(
  record: ReferralMilestoneEventRecord,
): ReferralActivityItem | null {
  const milestone = getReferralActivityMilestone(record);
  if (!milestone) {
    return null;
  }

  return {
    id: record.eventId,
    referralId: record.referralId,
    referralCode: record.referralCode,
    milestone,
    title: buildReferralActivityTitle(record, milestone),
    description: buildReferralActivityDescription(record, milestone),
    occurredAt: record.createdAt,
    href: businessReferralDetailHref(record.referralCode),
  };
}

export function toReferralFeedNotification(
  record: ReferralMilestoneEventRecord,
): FeedNotification | null {
  const activityItem = toReferralActivityItem(record);
  if (!activityItem) {
    return null;
  }

  if (!getReferralNotificationMilestone(record)) {
    return null;
  }

  return {
    id: `notif_${activityItem.id}`,
    title: activityItem.title,
    body: activityItem.description,
    href: activityItem.href,
    scope: "user",
    unread: true,
    createdAt: activityItem.occurredAt,
  };
}

export function buildCreditStatusLabel(counts: Record<CreditStatus, number>): string {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return "No credited referrals yet";
  }

  const segments: string[] = [];
  if (counts.pending_review > 0) {
    segments.push(`${counts.pending_review} ${pluralize(counts.pending_review, "pending review")}`);
  }

  const approvedOrPaid = counts.approved + counts.paid;
  if (approvedOrPaid > 0) {
    segments.push(`${approvedOrPaid} approved or paid`);
  }

  if (counts.tracked > 0) {
    segments.push(`${counts.tracked} tracked`);
  }

  if (counts.void > 0) {
    segments.push(`${counts.void} void`);
  }

  return segments.join(" | ");
}
