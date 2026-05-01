import type { OperatorTransitionProfile } from "../entities/operator-transition";

export interface OperatorTransitionReader {
  findById(id: string): Promise<OperatorTransitionProfile | null>;
  findByUserId(userId: string): Promise<OperatorTransitionProfile | null>;
  findByConversationId(conversationId: string): Promise<OperatorTransitionProfile | null>;
}

export interface OperatorTransitionWriter {
  upsert(profile: OperatorTransitionProfile): Promise<OperatorTransitionProfile>;
}

export interface OperatorTransitionRepository extends OperatorTransitionReader, OperatorTransitionWriter {}