import type { BusinessWorkflowContext } from "@/core/entities/business-workflow-context";
import type { Message } from "@/core/entities/conversation";
import type { WorkspaceSnapshot } from "@/core/entities/conversation-workspace";
import type { ConversationMediaAssetCandidate } from "@/lib/media/media-asset-projection";
import type { IdentityMigrationEvent } from "@/core/entities/identity-migration";
import type { OperatorTransitionProfile } from "@/core/entities/operator-transition";
import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import type { TrustDistributionContext } from "@/core/entities/trust-distribution";
import type { CanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

import type { WorkspaceRestorePayload } from "./WorkspaceRestore";

export interface WorkspaceRestoreProjectionInput {
  workspace: WorkspaceSnapshot | null;
  activeJobs: readonly CanonicalJobSnapshot[];
  attentionNeededJobs: readonly CanonicalJobSnapshot[];
  workflow?: BusinessWorkflowContext | null;
  reusableMediaAssets?: readonly ConversationMediaAssetCandidate[];
  operatorTransition?: OperatorTransitionProfile | null;
  trustDistribution?: TrustDistributionContext | null;
  memory?: RelationshipMemoryRecord | null;
  migration?: IdentityMigrationEvent | null;
  recentTranscript: readonly Message[];
  restoredAt: string;
}

export function projectWorkspaceRestorePayload(
  input: WorkspaceRestoreProjectionInput,
): WorkspaceRestorePayload {
  return {
    workspace: input.workspace,
    activeJobs: input.activeJobs,
    attentionNeededJobs: input.attentionNeededJobs,
    assets: input.workspace?.importantAssetRefs ?? [],
    reusableMediaAssets: input.reusableMediaAssets ?? [],
    workflow: input.workflow ?? null,
    operatorTransition: input.operatorTransition ?? null,
    trustDistribution: input.trustDistribution ?? null,
    memory: input.memory ?? null,
    recentTranscript: input.recentTranscript,
    migration: input.migration ?? null,
    restoreMeta: {
      schemaVersion: 1,
      restoredAt: input.restoredAt,
      source: "durable_read_model",
    },
  };
}
