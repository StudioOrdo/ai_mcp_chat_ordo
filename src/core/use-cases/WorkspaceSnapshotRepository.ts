import type { WorkspaceSnapshot } from "../entities/conversation-workspace";

export interface WorkspaceSnapshotReader {
  findById(id: string): Promise<WorkspaceSnapshot | null>;
  findByConversationId(conversationId: string): Promise<WorkspaceSnapshot | null>;
  findActiveByUser(userId: string): Promise<WorkspaceSnapshot | null>;
}

export interface WorkspaceSnapshotWriter {
  upsert(snapshot: WorkspaceSnapshot): Promise<WorkspaceSnapshot>;
  markDeleted(id: string, deletedAt: string): Promise<WorkspaceSnapshot | null>;
}

export interface WorkspaceSnapshotRepository extends WorkspaceSnapshotReader, WorkspaceSnapshotWriter {}