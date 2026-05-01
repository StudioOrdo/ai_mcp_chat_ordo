import type { BusinessWorkflowContextReader } from "@/core/use-cases/BusinessWorkflowContextRepository";
import type { ConversationRepository } from "@/core/use-cases/ConversationRepository";
import type { OperatorTransitionReader } from "@/core/use-cases/OperatorTransitionRepository";
import type { PromptBindingReader } from "@/core/use-cases/PromptBindingRepository";
import type { RelationshipMemoryReader } from "@/core/use-cases/RelationshipMemoryRepository";
import type { TrustDistributionReader } from "@/core/use-cases/TrustDistributionRepository";
import type { AssetCatalogReader } from "@/core/use-cases/AssetCatalogReader";
import type { WorkspaceSnapshot } from "@/core/entities/conversation-workspace";
import type { WorkspaceSnapshotReader } from "@/core/use-cases/WorkspaceSnapshotRepository";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import { projectAssetCatalogEntryToWorkspaceAssetRef } from "@/core/platform/asset-catalog/AssetCatalogProjector";

import {
  projectWorkspaceSnapshot,
  type WorkspaceSnapshotProjectionInput,
} from "./WorkspaceSnapshotProjector";

export interface RepositoryBackedWorkspaceSnapshotReaderDeps {
  conversationRepository: ConversationRepository;
  jobQueueRepository: JobQueueRepository;
  assetCatalogReader: AssetCatalogReader;
  workflowContextReader?: BusinessWorkflowContextReader;
  operatorTransitionReader?: OperatorTransitionReader;
  trustDistributionReader?: TrustDistributionReader;
  relationshipMemoryReader?: RelationshipMemoryReader;
  promptBindingReader?: PromptBindingReader;
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

export class RepositoryBackedWorkspaceSnapshotReader implements WorkspaceSnapshotReader {
  constructor(private readonly deps: RepositoryBackedWorkspaceSnapshotReaderDeps) {}

  async findById(id: string): Promise<WorkspaceSnapshot | null> {
    if (!id.startsWith("workspace:")) {
      return null;
    }

    return this.findByConversationId(id.slice("workspace:".length));
  }

  async findByConversationId(conversationId: string): Promise<WorkspaceSnapshot | null> {
    const conversation = await this.deps.conversationRepository.findById(conversationId);
    if (!conversation) {
      return null;
    }

    const [
      activeJobs,
      conversationAssets,
      workflowContext,
      operatorTransition,
      trustDistribution,
      activeMemory,
      promptBindings,
    ] = await Promise.all([
      this.deps.jobQueueRepository.listJobsByConversation(conversationId, {
        statuses: getActiveJobStatuses(),
        limit: 50,
      }),
      this.deps.assetCatalogReader.listConversationAssets({
        conversationId,
        userId: conversation.userId,
      }),
      safeOptionalRead(
        this.deps.workflowContextReader
          ? () => this.deps.workflowContextReader!.findByConversationId(conversationId)
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
      safeOptionalRead(
        this.deps.promptBindingReader
          ? () => this.deps.promptBindingReader!.listByConversation(conversationId, { limit: 10 })
          : undefined,
        [],
      ),
    ]);

    return this.project({
      conversation,
      activeJobs,
      userFiles: [],
      importantAssetRefs: conversationAssets.map(projectAssetCatalogEntryToWorkspaceAssetRef),
      workflowContext,
      operatorTransition,
      trustDistribution,
      activeMemory,
      promptBindings,
    });
  }

  async findActiveByUser(userId: string): Promise<WorkspaceSnapshot | null> {
    const conversation = await this.deps.conversationRepository.findActiveByUser(userId);
    if (!conversation) {
      return null;
    }

    return this.findByConversationId(conversation.id);
  }

  private project(input: WorkspaceSnapshotProjectionInput): WorkspaceSnapshot {
    return projectWorkspaceSnapshot(input);
  }
}

export function createWorkspaceSnapshotReader(
  deps: RepositoryBackedWorkspaceSnapshotReaderDeps,
): WorkspaceSnapshotReader {
  return new RepositoryBackedWorkspaceSnapshotReader(deps);
}