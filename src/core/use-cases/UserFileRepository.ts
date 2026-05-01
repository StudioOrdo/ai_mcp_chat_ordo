import type { UserFile } from "../entities/user-file";
import type { AdminUserFileFilters, AdminUserFileListFilters, UserFileListFilters, UserFileListPage } from "../entities/user-file-query";
import type { FleetUserFileStorageSummary, UserFileStorageSummary, UserStorageLeaderboardEntry } from "../entities/user-file-storage";

export interface CreateUserFileBatchWithinQuotaOptions {
  userId: string;
  quotaBytes: number;
  hardBlockUploadsAtQuota: boolean;
}

export interface CreateUserFileBatchWithinQuotaResult {
  files: UserFile[];
  insertedBytes: number;
  projectedTotalBytes: number;
  quotaExceeded: boolean;
}

export interface UserFileRepository {
  create(file: Omit<UserFile, "createdAt">): Promise<UserFile>;
  createBatchWithinQuota?(
    files: Array<Omit<UserFile, "createdAt">>,
    options: CreateUserFileBatchWithinQuotaOptions,
  ): Promise<CreateUserFileBatchWithinQuotaResult>;
  findById(id: string): Promise<UserFile | null>;
  findByHash(userId: string, contentHash: string, fileType: UserFile["fileType"]): Promise<UserFile | null>;
  listByConversation(conversationId: string): Promise<UserFile[]>;
  listByUser(userId: string): Promise<UserFile[]>;
  listForUser(userId: string, filters: UserFileListFilters): Promise<UserFileListPage>;
  getUserStorageSummary(userId: string): Promise<UserFileStorageSummary>;
  listForAdmin(filters: AdminUserFileListFilters): Promise<UserFile[]>;
  countForAdmin(filters?: AdminUserFileFilters): Promise<number>;
  getFleetStorageSummary(filters?: AdminUserFileFilters): Promise<FleetUserFileStorageSummary>;
  listLargestUsersByStorage(limit: number): Promise<UserStorageLeaderboardEntry[]>;
  listUnattachedCreatedBefore(cutoffIso: string, options?: {
    userId?: string;
    fileType?: UserFile["fileType"];
  }): Promise<UserFile[]>;
  assignConversation(fileIds: string[], userId: string, conversationId: string): Promise<void>;
  transferOwnershipForConversations?(input: {
    conversationIds: readonly string[];
    previousUserId: string;
    userId: string;
  }): Promise<UserFile[]>;
  deleteIfUnattached(id: string, userId: string): Promise<UserFile | null>;
  delete(id: string): Promise<void>;
}
