import {
  getConversationDataMapper,
  getIdentityMigrationRepository,
  getJobQueueRepository,
  getMaterializationRepository,
  getPromptBindingRepository,
  getPromptProvenanceDataMapper,
  getRelationshipMemoryRepository,
  getUserFileDataMapper,
} from "@/adapters/RepositoryFactory";
import { IdentityMigrationService } from "@/core/use-cases/IdentityMigrationService";
import { getReferralLedgerService } from "@/lib/referrals/referral-ledger";

import { repairConversationOwnershipIndex } from "./embed-conversation";
import { getConversationInteractor } from "./conversation-root";

function requireOwnershipTransfer<T extends { transferOwnershipForConversations?: unknown }>(
  repository: T,
  name: string,
): T & { transferOwnershipForConversations: NonNullable<T["transferOwnershipForConversations"]> } {
  if (!repository.transferOwnershipForConversations) {
    throw new Error(`${name} does not support identity ownership transfer.`);
  }
  return repository as T & {
    transferOwnershipForConversations: NonNullable<T["transferOwnershipForConversations"]>;
  };
}

export function createIdentityMigrationService(): IdentityMigrationService {
  return new IdentityMigrationService({
    identityMigrationRepository: getIdentityMigrationRepository(),
    conversationMigrator: getConversationInteractor(),
    convertedConversationRecovery: getConversationDataMapper(),
    jobQueueRepository: getJobQueueRepository(),
    userFileRepository: requireOwnershipTransfer(getUserFileDataMapper(), "UserFileDataMapper"),
    materializationRepository: requireOwnershipTransfer(getMaterializationRepository(), "MaterializationRepository"),
    relationshipMemoryRepository: requireOwnershipTransfer(getRelationshipMemoryRepository(), "RelationshipMemoryRepository"),
    promptBindingRepository: requireOwnershipTransfer(getPromptBindingRepository(), "PromptBindingRepository"),
    promptProvenancePolicy: getPromptProvenanceDataMapper(),
    referralRepair: getReferralLedgerService(),
    repairConversationOwnershipIndex,
  });
}
