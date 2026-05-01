import { randomUUID } from "node:crypto";

import type {
  IdentityMigrationEvent,
  IdentityMigrationObjectCount,
  IdentityMigrationObjectKind,
  IdentityMigrationRepairRef,
  IdentityMigrationStage,
} from "../entities/identity-migration";
import type { IdentityMigrationRepository } from "./IdentityMigrationRepository";
import type { JobQueueRepository } from "./JobQueueRepository";
import type { MaterializationRepository } from "./MaterializationRepository";
import type { PromptBindingRepository } from "./PromptBindingRepository";
import type { RelationshipMemoryRepository } from "./RelationshipMemoryRepository";
import type { UserFileRepository } from "./UserFileRepository";

export type IdentityMigrationSource = "login" | "registration" | "repair";

export interface ConversationMigrationPort {
  migrateAnonymousConversations(sourceUserId: string, targetUserId: string): Promise<string[]>;
}

export interface ConvertedConversationRecoveryPort {
  findIdsByUserAndConvertedFrom(userId: string, anonUserId: string): Promise<string[]>;
}

export interface PromptProvenancePolicyPort {
  countByConversations(conversationIds: readonly string[]): Promise<number>;
}

export interface ReferralRepairPort {
  linkConversationToAuthenticatedUser(input: {
    conversationId: string;
    userId: string;
    source: "login" | "registration";
  }): Promise<unknown>;
}

export interface IdentityMigrationServiceDeps {
  identityMigrationRepository: IdentityMigrationRepository;
  conversationMigrator: ConversationMigrationPort;
  convertedConversationRecovery: ConvertedConversationRecoveryPort;
  jobQueueRepository: JobQueueRepository;
  userFileRepository: UserFileRepository & {
    transferOwnershipForConversations: NonNullable<UserFileRepository["transferOwnershipForConversations"]>;
  };
  materializationRepository: MaterializationRepository & {
    transferOwnershipForConversations: NonNullable<MaterializationRepository["transferOwnershipForConversations"]>;
  };
  relationshipMemoryRepository: RelationshipMemoryRepository & {
    transferOwnershipForConversations: NonNullable<RelationshipMemoryRepository["transferOwnershipForConversations"]>;
  };
  promptBindingRepository: PromptBindingRepository & {
    transferOwnershipForConversations: NonNullable<PromptBindingRepository["transferOwnershipForConversations"]>;
  };
  promptProvenancePolicy?: PromptProvenancePolicyPort;
  referralRepair: ReferralRepairPort;
  repairConversationOwnershipIndex: (
    conversationId: string,
    userId: string,
    previousUserId: string,
  ) => Promise<void>;
  now?: () => string;
  idGenerator?: () => string;
}

export interface ExecuteIdentityMigrationInput {
  sourceUserId: string;
  targetUserId: string;
  source: IdentityMigrationSource;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function count(kind: IdentityMigrationObjectKind, attempted: number, migrated: number, failed = 0): IdentityMigrationObjectCount {
  return { kind, attempted, migrated, failed };
}

function evidence(kind: string, id: string): IdentityMigrationRepairRef["evidenceRefs"][number] {
  return {
    source: {
      sourceKind: "identity_migration_event",
      sourceId: id,
      userId: null,
      conversationId: null,
    },
    observedAt: new Date().toISOString(),
    summary: `Identity migration ${kind} repair`,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class IdentityMigrationService {
  constructor(private readonly deps: IdentityMigrationServiceDeps) {}

  async execute(input: ExecuteIdentityMigrationInput): Promise<IdentityMigrationEvent> {
    const now = this.deps.now ?? (() => new Date().toISOString());
    const id = this.deps.idGenerator?.() ?? `idmig_${randomUUID()}`;
    const createdAt = now();
    let event: IdentityMigrationEvent = {
      id,
      sourceUserId: input.sourceUserId,
      targetUserId: input.targetUserId,
      migratedConversationIds: [],
      migratedJobIds: [],
      migratedAssetIds: [],
      repairedMemoryRefs: [],
      repairedSearchSourceIds: [],
      objectCounts: [],
      repairRefs: [],
      status: "started",
      currentStage: "started",
      failureMessage: null,
      createdAt,
      completedAt: null,
    };

    const persist = async (updates: Partial<IdentityMigrationEvent>) => {
      event = {
        ...event,
        ...updates,
        objectCounts: updates.objectCounts ?? event.objectCounts,
        repairRefs: updates.repairRefs ?? event.repairRefs,
      };
      await this.deps.identityMigrationRepository.update(event);
    };

    const appendCounts = (nextCounts: readonly IdentityMigrationObjectCount[]) => {
      const byKind = new Map<IdentityMigrationObjectKind, IdentityMigrationObjectCount>();
      for (const existing of event.objectCounts) {
        byKind.set(existing.kind, existing);
      }
      for (const next of nextCounts) {
        byKind.set(next.kind, next);
      }
      return Array.from(byKind.values());
    };

    const appendRepairRefs = (nextRefs: readonly IdentityMigrationRepairRef[]) => [
      ...event.repairRefs,
      ...nextRefs,
    ];

    await this.deps.identityMigrationRepository.record(event);

    try {
      await persist({ currentStage: "conversation_transfer" });
      const migratedConversationIds = await this.deps.conversationMigrator.migrateAnonymousConversations(
        input.sourceUserId,
        input.targetUserId,
      );
      const conversationIds = migratedConversationIds.length > 0
        ? unique(migratedConversationIds)
        : unique(await this.deps.convertedConversationRecovery.findIdsByUserAndConvertedFrom(
          input.targetUserId,
          input.sourceUserId,
        ));
      await persist({
        migratedConversationIds: conversationIds,
        objectCounts: appendCounts([count("conversation", conversationIds.length, conversationIds.length)]),
      });

      await persist({ currentStage: "search_repair" });
      const searchRepairRefs: IdentityMigrationRepairRef[] = [];
      for (const conversationId of conversationIds) {
        const sourceId = `${input.sourceUserId}/${conversationId}`;
        try {
          await this.deps.repairConversationOwnershipIndex(
            conversationId,
            input.targetUserId,
            input.sourceUserId,
          );
          searchRepairRefs.push({
            kind: "search_source",
            id: sourceId,
            status: "repaired",
            evidenceRefs: [evidence("search", event.id)],
          });
        } catch {
          searchRepairRefs.push({
            kind: "search_source",
            id: sourceId,
            status: "failed",
            evidenceRefs: [evidence("search", event.id)],
          });
        }
      }
      await persist({
        repairedSearchSourceIds: searchRepairRefs.filter((ref) => ref.status === "repaired").map((ref) => ref.id),
        repairRefs: appendRepairRefs(searchRepairRefs),
        objectCounts: appendCounts([
          count(
            "search_source",
            searchRepairRefs.length,
            searchRepairRefs.filter((ref) => ref.status === "repaired").length,
            searchRepairRefs.filter((ref) => ref.status === "failed").length,
          ),
        ]),
      });

      await persist({ currentStage: "job_transfer" });
      const jobs = await this.deps.jobQueueRepository.transferJobsToUser({
        conversationIds,
        userId: input.targetUserId,
        previousUserId: input.sourceUserId,
        source: input.source,
      });
      await persist({
        migratedJobIds: jobs.map((job) => job.id),
        objectCounts: appendCounts([
          count("job", jobs.length, jobs.length),
          count("job_event", jobs.length, jobs.length),
        ]),
      });

      await persist({ currentStage: "asset_transfer" });
      const files = await this.deps.userFileRepository.transferOwnershipForConversations({
        conversationIds,
        previousUserId: input.sourceUserId,
        userId: input.targetUserId,
      });
      await persist({
        migratedAssetIds: files.map((file) => file.id),
        objectCounts: appendCounts([count("asset", files.length, files.length)]),
      });

      await persist({ currentStage: "materialization_transfer" });
      const materializations = await this.deps.materializationRepository.transferOwnershipForConversations({
        conversationIds,
        previousUserId: input.sourceUserId,
        userId: input.targetUserId,
        transferredAt: now(),
      });
      await persist({
        objectCounts: appendCounts([count("materialization", materializations.length, materializations.length)]),
      });

      await persist({ currentStage: "relationship_memory_transfer" });
      const memories = await this.deps.relationshipMemoryRepository.transferOwnershipForConversations({
        conversationIds,
        previousUserId: input.sourceUserId,
        userId: input.targetUserId,
        transferredAt: now(),
      });
      await persist({
        repairedMemoryRefs: memories.map((memory) => memory.id),
        objectCounts: appendCounts([count("relationship_memory", memories.length, memories.length)]),
      });

      await persist({ currentStage: "prompt_binding_transfer" });
      const promptBindings = await this.deps.promptBindingRepository.transferOwnershipForConversations({
        conversationIds,
        previousUserId: input.sourceUserId,
        userId: input.targetUserId,
      });
      await persist({
        objectCounts: appendCounts([count("prompt_binding", promptBindings.length, promptBindings.length)]),
      });

      await persist({ currentStage: "prompt_provenance_policy" });
      const provenanceCount = this.deps.promptProvenancePolicy
        ? await this.deps.promptProvenancePolicy.countByConversations(conversationIds)
        : 0;
      await persist({
        objectCounts: appendCounts([count("prompt_provenance", provenanceCount, provenanceCount)]),
      });

      await persist({ currentStage: "referral_repair" });
      const referralRefs: IdentityMigrationRepairRef[] = [];
      for (const conversationId of conversationIds) {
        try {
          await this.deps.referralRepair.linkConversationToAuthenticatedUser({
            conversationId,
            userId: input.targetUserId,
            source: input.source === "registration" ? "registration" : "login",
          });
        } catch (error) {
          console.error(
            `Referral linkage failed during ${input.source}:`,
            error,
          );
          throw error;
        }
        referralRefs.push({
          kind: "referral",
          id: conversationId,
          status: "repaired",
          evidenceRefs: [evidence("referral", event.id)],
        });
      }
      await persist({
        repairRefs: appendRepairRefs(referralRefs),
        objectCounts: appendCounts([count("referral", referralRefs.length, referralRefs.length)]),
      });

      await persist({ currentStage: "restore_verification" });
      await persist({
        status: searchRepairRefs.some((ref) => ref.status === "failed") ? "partially_repaired" : "completed",
        currentStage: "completed",
        completedAt: now(),
      });

      return event;
    } catch (error) {
      await persist({
        status: event.migratedConversationIds.length > 0 ? "partially_repaired" : "failed",
        currentStage: "failed",
        failureMessage: errorMessage(error),
        completedAt: now(),
      });
      throw error;
    }
  }
}
