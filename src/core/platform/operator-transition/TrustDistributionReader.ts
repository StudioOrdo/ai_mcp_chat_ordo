import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { AdminReferralExceptionsResult } from "@/lib/referrals/admin-referral-analytics";
import type { ReferralActivityItem } from "@/lib/referrals/referral-milestones";

import {
  projectTrustDistributionContext,
  type TrustDistributionProjectionInput,
} from "./TrustDistributionProjector";

export interface TrustDistributionProfileReader {
  getProfile(userId: string): Promise<UserProfileViewModel | null>;
}

export interface TrustDistributionActivityReader {
  getRecentActivity(userId: string, limit?: number): Promise<ReferralActivityItem[]>;
}

export interface TrustDistributionAdminPressureReader {
  getExceptions(): Promise<AdminReferralExceptionsResult>;
}

export interface TrustDistributionReadinessProbe {
  getReadiness(): Promise<{ status: "ok" | "error"; details?: string } | null> | { status: "ok" | "error"; details?: string } | null;
}

export interface RepositoryBackedTrustDistributionReaderDeps {
  conversationRepository?: ConversationRepository;
  profileReader: TrustDistributionProfileReader;
  activityReader: TrustDistributionActivityReader;
  adminPressureReader?: TrustDistributionAdminPressureReader;
  readinessProbe?: TrustDistributionReadinessProbe;
}

export class RepositoryBackedTrustDistributionReader implements TrustDistributionReader {
  constructor(private readonly deps: RepositoryBackedTrustDistributionReaderDeps) {}

  async findById(id: string): Promise<TrustDistributionContext | null> {
    if (!id.startsWith("tdc_")) {
      return null;
    }

    return this.findByUserId(id.slice("tdc_".length));
  }

  async findByUserId(userId: string): Promise<TrustDistributionContext | null> {
    const profile = await this.deps.profileReader.getProfile(userId);
    if (!profile) {
      return null;
    }

    const [recentActivity, readiness, adminPressure] = await Promise.all([
      this.deps.activityReader.getRecentActivity(userId, 12),
      this.deps.readinessProbe?.getReadiness() ?? Promise.resolve(null),
      profile.roles.includes("ADMIN") || profile.roles.includes("STAFF")
        ? this.deps.adminPressureReader?.getExceptions() ?? Promise.resolve(null)
        : Promise.resolve(null),
    ]);

    return this.project({
      userId,
      conversationId: null,
      profile,
      recentActivity,
      adminPressure,
      readiness,
      observedAt: new Date().toISOString(),
    });
  }

  async findByConversationId(conversationId: string): Promise<TrustDistributionContext | null> {
    const conversation = await this.deps.conversationRepository?.findById(conversationId);
    if (!conversation) {
      return null;
    }

    const context = await this.findByUserId(conversation.userId);
    if (!context) {
      return null;
    }

    return {
      ...context,
      conversationId,
      recommendedAction: context.recommendedAction
        ? {
            ...context.recommendedAction,
            targetRef: context.recommendedAction.targetRef
              ? {
                  ...context.recommendedAction.targetRef,
                  conversationId,
                }
              : null,
          }
        : null,
    };
  }

  private project(input: TrustDistributionProjectionInput): TrustDistributionContext {
    return projectTrustDistributionContext(input);
  }
}

export function createTrustDistributionReader(
  deps: RepositoryBackedTrustDistributionReaderDeps,
): TrustDistributionReader {
  return new RepositoryBackedTrustDistributionReader(deps);
}