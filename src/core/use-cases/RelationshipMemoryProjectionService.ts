export interface RelationshipMemoryProjectionService {
  projectConversation(params: { conversationId: string; userId: string; sourcePromptBindingId?: string | null }): Promise<void>;
}