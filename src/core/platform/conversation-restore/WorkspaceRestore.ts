import type { Message } from "@/core/entities/conversation";
import type { WorkspaceAssetRef, WorkspaceSnapshot } from "@/core/entities/conversation-workspace";
import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { ConversationMediaAssetCandidate } from "@/lib/media/media-asset-projection";
import type { OperatorTransitionProfile } from "@/core/entities/operator-transition";
import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import type { IdentityMigrationEvent } from "@/core/entities/identity-migration";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

export interface WorkspaceRestorePayload {
  workspace: WorkspaceSnapshot | null;
  activeJobs: readonly CanonicalJobSnapshot[];
  attentionNeededJobs: readonly CanonicalJobSnapshot[];
  assets: readonly WorkspaceAssetRef[];
  reusableMediaAssets: readonly ConversationMediaAssetCandidate[];
  workflow: BusinessWorkflowContext | null;
  operatorTransition: OperatorTransitionProfile | null;
  trustDistribution: TrustDistributionContext | null;
  memory: RelationshipMemoryRecord | null;
  recentTranscript: readonly Message[];
  migration: IdentityMigrationEvent | null;
  restoreMeta: {
    schemaVersion: 1;
    restoredAt: string;
    source: "durable_read_model";
  };
}
