import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import type { MessageRepository } from "@/core/use-cases/MessageRepository";
import type { OperatorTransitionReader } from "@/core/use-cases/OperatorTransitionRepository";
import type { RelationshipMemoryReader } from "@/core/use-cases/RelationshipMemoryRepository";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";
import type { WorkspaceSnapshotReader } from "@/core/use-cases/WorkspaceSnapshotRepository";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { IdentityMigrationReader } from "@/core/use-cases/IdentityMigrationRepository";
import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import { projectAssetCatalogEntryToConversationMediaAssetCandidate } from "@/core/platform/asset-catalog/AssetCatalogProjector";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";

import type { WorkspaceRestorePayload } from "./WorkspaceRestore";
import {
  projectWorkspaceRestorePayload,
  type WorkspaceRestoreProjectionInput,
} from "./WorkspaceRestoreProjector";

const ATTENTION_NEEDED_JOB_STATUSES = ["failed", "canceled", "dead_letter"] as const;
const DEFAULT_RECENT_TRANSCRIPT_LIMIT = 30;

export interface WorkspaceRestoreReaderDeps {
  workspaceSnapshotReader: WorkspaceSnapshotReader;
  jobStatusQuery: JobStatusQuery;
  messageRepository: MessageRepository;
  assetCatalogReader?: AssetCatalogReader;
  workflowReader?: BusinessWorkflowContextReader;
  operatorTransitionReader?: OperatorTransitionReader;
  trustDistributionReader?: TrustDistributionReader;
  relationshipMemoryReader?: RelationshipMemoryReader;
  identityMigrationReader?: IdentityMigrationReader;
  recentTranscriptLimit?: number;
}

export interface WorkspaceRestoreReader {
  findActiveByUser(userId: string): Promise<WorkspaceRestorePayload>;
  findByConversationId(userId: string, conversationId: string): Promise<WorkspaceRestorePayload | null>;
}

async function safeOptionalRead<T>(
  load: (() => Promise<T>) | undefined,
  fallback: T,
): Promise<T> {
  if (!load) {
    return fallback;
  }

  try {
    return await load();
  } catch {
    return fallback;
  }
}

function pickLatestMemory(records: readonly RelationshipMemoryRecord[]): RelationshipMemoryRecord | null {
  if (records.length === 0) {
    return null;
  }

  return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export class RepositoryBackedWorkspaceRestoreReader implements WorkspaceRestoreReader {
  constructor(private readonly deps: WorkspaceRestoreReaderDeps) {}

  async findActiveByUser(userId: string): Promise<WorkspaceRestorePayload> {
    const workspace = await this.deps.workspaceSnapshotReader.findActiveByUser(userId);
    if (!workspace) {
      return this.project({
        workspace: null,
        activeJobs: [],
        attentionNeededJobs: [],
        reusableMediaAssets: [],
        migration: await safeOptionalRead(
          this.deps.identityMigrationReader
            ? () => this.deps.identityMigrationReader!.findLatestForTargetIdentity(userId)
            : undefined,
          null,
        ),
        recentTranscript: [],
        restoredAt: new Date().toISOString(),
      });
    }

    return this.loadWorkspace(workspace.conversationId, workspace, new Date().toISOString());
  }

  async findByConversationId(userId: string, conversationId: string): Promise<WorkspaceRestorePayload | null> {
    const workspace = await this.deps.workspaceSnapshotReader.findByConversationId(conversationId);
    if (!workspace || workspace.userId !== userId) {
      return null;
    }

    return this.loadWorkspace(conversationId, workspace, new Date().toISOString());
  }

  private async loadWorkspace(
    conversationId: string,
    workspace: NonNullable<Awaited<ReturnType<WorkspaceSnapshotReader["findByConversationId"]>>>,
    restoredAt: string,
  ): Promise<WorkspaceRestorePayload> {
    const [
      activeJobs,
      attentionNeededJobs,
      workflow,
      operatorTransition,
      trustDistribution,
      memoryRecords,
      recentTranscript,
      reusableAssetEntries,
      migration,
    ] = await Promise.all([
      this.deps.jobStatusQuery.listConversationJobSnapshots(conversationId, {
        statuses: getActiveJobStatuses(),
        limit: 25,
      }),
      this.deps.jobStatusQuery.listConversationJobSnapshots(conversationId, {
        statuses: [...ATTENTION_NEEDED_JOB_STATUSES],
        limit: 25,
      }),
      safeOptionalRead(
        this.deps.workflowReader
          ? () => this.deps.workflowReader!.findByConversationId(conversationId)
          : undefined,
        null,
      ),
      safeOptionalRead(
        this.deps.operatorTransitionReader
          ? () => this.deps.operatorTransitionReader!.findByConversationId(conversationId)
          : undefined,
        null,
      ),
      safeOptionalRead(
        this.deps.trustDistributionReader
          ? () => this.deps.trustDistributionReader!.findByConversationId(conversationId)
          : undefined,
        null,
      ),
      safeOptionalRead(
        this.deps.relationshipMemoryReader
          ? () => this.deps.relationshipMemoryReader!.listActiveByConversation(conversationId)
          : undefined,
        [],
      ),
      this.deps.messageRepository.listRecentByConversation(
        conversationId,
        this.deps.recentTranscriptLimit ?? DEFAULT_RECENT_TRANSCRIPT_LIMIT,
      ),
      safeOptionalRead(
        this.deps.assetCatalogReader
          ? () => this.deps.assetCatalogReader!.listReusableMediaAssets({
              conversationId,
              userId: workspace.userId,
              limit: 25,
            })
          : undefined,
        [],
      ),
      safeOptionalRead(
        this.deps.identityMigrationReader
          ? () => this.deps.identityMigrationReader!.findLatestForTargetIdentity(workspace.userId)
          : undefined,
        null,
      ),
    ]);

    return this.project({
      workspace,
      activeJobs,
      attentionNeededJobs,
      workflow,
      operatorTransition,
      trustDistribution,
      memory: pickLatestMemory(memoryRecords),
      reusableMediaAssets: reusableAssetEntries
        .map(projectAssetCatalogEntryToConversationMediaAssetCandidate)
        .filter((asset): asset is NonNullable<typeof asset> => asset !== null),
      migration,
      recentTranscript,
      restoredAt,
    });
  }

  private project(input: WorkspaceRestoreProjectionInput): WorkspaceRestorePayload {
    return projectWorkspaceRestorePayload(input);
  }
}

export function createWorkspaceRestoreReader(
  deps: WorkspaceRestoreReaderDeps,
): WorkspaceRestoreReader {
  return new RepositoryBackedWorkspaceRestoreReader(deps);
}
