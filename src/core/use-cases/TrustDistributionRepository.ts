import type { TrustDistributionContext } from "../entities/trust-distribution";

export interface TrustDistributionReader {
  findById(id: string): Promise<TrustDistributionContext | null>;
  findByUserId(userId: string): Promise<TrustDistributionContext | null>;
  findByConversationId(conversationId: string): Promise<TrustDistributionContext | null>;
}

export interface TrustDistributionWriter {
  upsert(context: TrustDistributionContext): Promise<TrustDistributionContext>;
}

export interface TrustDistributionRepository extends TrustDistributionReader, TrustDistributionWriter {}