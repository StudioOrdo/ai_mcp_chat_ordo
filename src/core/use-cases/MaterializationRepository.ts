import type { MaterializationRecord } from "../entities/materialization";

export interface MaterializationReader {
  findById(id: string): Promise<MaterializationRecord | null>;
  findByMaterializationKey(materializationKey: string): Promise<MaterializationRecord | null>;
  findByProducedJobId?(jobId: string): Promise<MaterializationRecord | null>;
  listByConversation(conversationId: string): Promise<readonly MaterializationRecord[]>;
  findLatestByOutputRef(kind: MaterializationRecord["outputRefs"][number]["kind"], id: string): Promise<MaterializationRecord | null>;
  findReusableSuccess(materializationKey: string, userId: string | null, conversationId: string | null): Promise<MaterializationRecord | null>;
}

export interface MaterializationWriter {
  upsert(record: MaterializationRecord): Promise<MaterializationRecord>;
  markSuperseded(id: string, supersededByRecordId: string, updatedAt: string): Promise<MaterializationRecord | null>;
  transferOwnershipForConversations?(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
    transferredAt?: string;
  }): Promise<readonly MaterializationRecord[]>;
}

export interface MaterializationRepository extends MaterializationReader, MaterializationWriter {}
