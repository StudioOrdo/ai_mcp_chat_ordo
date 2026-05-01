import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";
import type { MessageRepository } from "@/core/use-cases/MessageRepository";
import type { PromptBindingRepository } from "@/core/use-cases/PromptBindingRepository";
import type { RelationshipMemoryProjectionService } from "@/core/use-cases/RelationshipMemoryProjectionService";
import type { RelationshipMemoryRepository } from "@/core/use-cases/RelationshipMemoryRepository";
import { recordPromptBindingFromSource } from "@/lib/prompts/prompt-binding-service";

import { projectRelationshipMemoryRecords } from "./RelationshipMemoryProjector";

export interface RepositoryBackedRelationshipMemoryProjectionServiceDeps {
  messageRepository: MessageRepository;
  relationshipMemoryRepository: RelationshipMemoryRepository;
  promptBindingRepository?: PromptBindingRepository;
}

function groupByType(records: readonly RelationshipMemoryRecord[]): Map<RelationshipMemoryRecord["memoryType"], RelationshipMemoryRecord[]> {
  const grouped = new Map<RelationshipMemoryRecord["memoryType"], RelationshipMemoryRecord[]>();

  for (const record of records) {
    const current = grouped.get(record.memoryType) ?? [];
    current.push(record);
    grouped.set(record.memoryType, current);
  }

  for (const [memoryType, current] of grouped.entries()) {
    grouped.set(memoryType, [...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }

  return grouped;
}

export class RepositoryBackedRelationshipMemoryProjectionService implements RelationshipMemoryProjectionService {
  constructor(private readonly deps: RepositoryBackedRelationshipMemoryProjectionServiceDeps) {}

  async projectConversation(params: { conversationId: string; userId: string; sourcePromptBindingId?: string | null }): Promise<void> {
    const [messages, existingActive] = await Promise.all([
      this.deps.messageRepository.listByConversation(params.conversationId),
      this.deps.relationshipMemoryRepository.listActiveByConversation(params.conversationId),
    ]);

    const projectedRecords = projectRelationshipMemoryRecords({
      conversationId: params.conversationId,
      userId: params.userId,
      messages,
    });
    const existingByType = groupByType(existingActive);

    for (const record of projectedRecords) {
      const currentRecords = existingByType.get(record.memoryType) ?? [];
      const currentPrimary = currentRecords[0] ?? null;

      const persisted = await this.deps.relationshipMemoryRepository.upsert({
        ...record,
        createdAt: currentPrimary?.id === record.id ? currentPrimary.createdAt : record.createdAt,
      });

      if (params.sourcePromptBindingId) {
        await recordPromptBindingFromSource({
          userId: params.userId,
          conversationId: params.conversationId,
          sourcePromptBindingId: params.sourcePromptBindingId,
          surface: "memory_projection",
          target: {
            targetKind: "relationship_memory",
            targetId: persisted.id,
          },
          decisionSourceRefs: [
            {
              sourceKind: "relationship_memory",
              sourceId: persisted.id,
              userId: params.userId,
              conversationId: params.conversationId,
            },
          ],
          evidenceRefs: [...persisted.evidenceRefs],
          createdAt: persisted.updatedAt,
        }, this.deps.promptBindingRepository);
      }

      for (const current of currentRecords) {
        if (current.id === record.id) {
          continue;
        }

        await this.deps.relationshipMemoryRepository.markSuperseded(current.id, record.id, record.updatedAt);
      }
    }
  }
}

export function createRelationshipMemoryProjectionService(
  deps: RepositoryBackedRelationshipMemoryProjectionServiceDeps,
): RelationshipMemoryProjectionService {
  return new RepositoryBackedRelationshipMemoryProjectionService(deps);
}