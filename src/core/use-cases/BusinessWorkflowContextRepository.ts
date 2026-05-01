import type { BusinessWorkflowContext } from "../entities/business-workflow-context";

export interface BusinessWorkflowContextReader {
  findById(id: string): Promise<BusinessWorkflowContext | null>;
  findByConversationId(conversationId: string): Promise<BusinessWorkflowContext | null>;
}

export interface BusinessWorkflowContextWriter {
  upsert(context: BusinessWorkflowContext): Promise<BusinessWorkflowContext>;
  deleteByConversationId(conversationId: string): Promise<void>;
}

export interface BusinessWorkflowContextRepository extends BusinessWorkflowContextReader, BusinessWorkflowContextWriter {}