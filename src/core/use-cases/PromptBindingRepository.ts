import type { PromptBinding } from "../entities/prompt-binding";

export interface PromptBindingReader {
  findById(id: string): Promise<PromptBinding | null>;
  findByTarget(targetKind: PromptBinding["targetKind"], targetId: string): Promise<PromptBinding | null>;
  listByConversation(conversationId: string, options?: { limit?: number }): Promise<PromptBinding[]>;
  listBySourcePromptBinding(sourcePromptBindingId: string, options?: { limit?: number }): Promise<PromptBinding[]>;
}

export interface PromptBindingWriter {
  record(binding: PromptBinding): Promise<PromptBinding>;
  transferOwnershipForConversations?(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
  }): Promise<PromptBinding[]>;
}

export interface PromptBindingRepository extends PromptBindingReader, PromptBindingWriter {}
