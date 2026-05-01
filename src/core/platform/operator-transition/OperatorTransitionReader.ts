import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { OperatorTransitionReader } from "@/core/use-cases/OperatorTransitionRepository";
import type { OperatorTransitionProfile } from "@/core/entities/operator-transition";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";
import type { UserProfileViewModel } from "@/lib/profile/types";
import type { AdminReferralExceptionsResult } from "@/lib/referrals/admin-referral-analytics";

import {
  projectOperatorTransitionProfile,
  type OperatorTransitionProjectionInput,
} from "./OperatorTransitionProjector";

export interface OperatorTransitionProfileReader {
  getProfile(userId: string): Promise<UserProfileViewModel | null>;
}

export interface OperatorTransitionAdminPressureReader {
  getExceptions(): Promise<AdminReferralExceptionsResult>;
}

export interface OperatorTransitionReadinessProbe {
  getReadiness(): Promise<{ status: "ok" | "error"; details?: string } | null> | { status: "ok" | "error"; details?: string } | null;
}

export interface RepositoryBackedOperatorTransitionReaderDeps {
  conversationRepository?: ConversationRepository;
  profileReader: OperatorTransitionProfileReader;
  trustDistributionReader: TrustDistributionReader;
  businessWorkflowContextReader?: BusinessWorkflowContextReader;
  adminPressureReader?: OperatorTransitionAdminPressureReader;
  readinessProbe?: OperatorTransitionReadinessProbe;
}

export class RepositoryBackedOperatorTransitionReader implements OperatorTransitionReader {
  constructor(private readonly deps: RepositoryBackedOperatorTransitionReaderDeps) {}

  async findById(id: string): Promise<OperatorTransitionProfile | null> {
    if (!id.startsWith("otp_")) {
      return null;
    }

    return this.findByUserId(id.slice("otp_".length));
  }

  async findByUserId(userId: string): Promise<OperatorTransitionProfile | null> {
    const profile = await this.deps.profileReader.getProfile(userId);
    if (!profile) {
      return null;
    }

    const activeConversation = this.deps.businessWorkflowContextReader && this.deps.conversationRepository
      ? await this.deps.conversationRepository.findActiveByUser(userId)
      : null;

    const [trustDistribution, businessWorkflowContext, readiness, adminPressure] = await Promise.all([
      this.deps.trustDistributionReader.findByUserId(userId),
      activeConversation && this.deps.businessWorkflowContextReader
        ? this.deps.businessWorkflowContextReader.findByConversationId(activeConversation.id)
        : Promise.resolve(null),
      this.deps.readinessProbe?.getReadiness() ?? Promise.resolve(null),
      profile.roles.includes("ADMIN") || profile.roles.includes("STAFF")
        ? this.deps.adminPressureReader?.getExceptions() ?? Promise.resolve(null)
        : Promise.resolve(null),
    ]);

    return this.project({
      userId,
      conversationId: null,
      profile,
      trustDistribution,
      businessWorkflowContext,
      adminPressure,
      readiness,
      observedAt: new Date().toISOString(),
    });
  }

  async findByConversationId(conversationId: string): Promise<OperatorTransitionProfile | null> {
    const conversation = await this.deps.conversationRepository?.findById(conversationId);
    if (!conversation) {
      return null;
    }

    const profile = await this.deps.profileReader.getProfile(conversation.userId);
    if (!profile) {
      return null;
    }

    const [trustDistribution, businessWorkflowContext, readiness, adminPressure] = await Promise.all([
      this.deps.trustDistributionReader.findByConversationId(conversationId),
      this.deps.businessWorkflowContextReader?.findByConversationId(conversationId) ?? Promise.resolve(null),
      this.deps.readinessProbe?.getReadiness() ?? Promise.resolve(null),
      profile.roles.includes("ADMIN") || profile.roles.includes("STAFF")
        ? this.deps.adminPressureReader?.getExceptions() ?? Promise.resolve(null)
        : Promise.resolve(null),
    ]);

    return this.project({
      userId: conversation.userId,
      conversationId,
      profile,
      trustDistribution,
      businessWorkflowContext,
      adminPressure,
      readiness,
      observedAt: new Date().toISOString(),
    });
  }

  private project(input: OperatorTransitionProjectionInput): OperatorTransitionProfile {
    return projectOperatorTransitionProfile(input);
  }
}

export function createOperatorTransitionReader(
  deps: RepositoryBackedOperatorTransitionReaderDeps,
): OperatorTransitionReader {
  return new RepositoryBackedOperatorTransitionReader(deps);
}