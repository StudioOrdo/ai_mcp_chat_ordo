import {
  getBusinessWorkflowContextReader,
  getConversationDataMapper,
} from "@/adapters/RepositoryFactory";
import type { SessionUser } from "@/lib/auth";
import { sessionHasRole } from "@/lib/auth";
import { loadPersonReadModelItem } from "@/lib/business/people-read-model";
import { createProfileService } from "@/lib/profile/profile-service";
import { createReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import { getActiveReferralSnapshot } from "@/lib/referrals/referral-resolver";

import {
  projectBusinessConversationToOrdoDetail,
  projectPersonToOrdoDetail,
  projectReferralToOrdoDetail,
} from "./ordo-detail-projectors";
import type { OrdoObjectDetailModel } from "./ordo-detail-types";

function canReadOwnerScopedObject(user: SessionUser, ownerUserId: string): boolean {
  return user.id === ownerUserId || sessionHasRole(user, ["STAFF", "ADMIN"]);
}

export async function loadBusinessReferralDetail(
  user: SessionUser,
  referralCode: string,
): Promise<OrdoObjectDetailModel | null> {
  const snapshot = getActiveReferralSnapshot(referralCode);
  if (!snapshot || !canReadOwnerScopedObject(user, snapshot.userId)) {
    return null;
  }

  const [profile, overview, timeseries, pipeline, recentActivity] = await Promise.all([
    createProfileService().getProfile(snapshot.userId),
    createReferralAnalyticsService().getOverview(snapshot.userId),
    createReferralAnalyticsService().getTimeseries(snapshot.userId),
    createReferralAnalyticsService().getPipeline(snapshot.userId),
    createReferralAnalyticsService().getRecentActivity(snapshot.userId, 12),
  ]);

  return projectReferralToOrdoDetail({
    profile,
    overview,
    timeseries,
    pipeline,
    recentActivity,
  });
}

export async function loadBusinessConversationDetail(
  user: SessionUser,
  conversationId: string,
): Promise<OrdoObjectDetailModel | null> {
  const conversation = await getConversationDataMapper().findById(conversationId);
  if (!conversation || !canReadOwnerScopedObject(user, conversation.userId)) {
    return null;
  }

  const context = await getBusinessWorkflowContextReader().findByConversationId(conversationId);
  return projectBusinessConversationToOrdoDetail({
    conversation,
    context: context && canReadOwnerScopedObject(user, context.userId) ? context : null,
  });
}

export async function loadBusinessPersonDetail(
  user: SessionUser,
  personId: string,
): Promise<OrdoObjectDetailModel | null> {
  const person = await loadPersonReadModelItem(user.id, personId);
  if (!person || !canReadOwnerScopedObject(user, person.ownerUserId)) {
    return null;
  }

  return projectPersonToOrdoDetail(person);
}
