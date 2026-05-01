import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { UserFile } from "@/core/entities/user-file";
import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";
import { buildUserFileMetadata } from "@/lib/media/media-asset-projection";
import {
  buildMediaQuotaSnapshot,
  type MediaQuotaPolicy,
  type MediaQuotaSnapshot,
} from "@/lib/storage/media-quota-policy";

export function getDataRootPath(): string {
  const configured = process.env.DATA_DIR?.trim();
  const relativePath = configured && configured.length > 0 ? configured : ".data";
  return path.resolve(process.cwd(), relativePath);
}

export function getUserFilesRootPath(): string {
  return path.join(getDataRootPath(), "user-files");
}

export function getUserFilePath(userId: string, fileName: string): string {
  return path.join(getUserFilesRootPath(), userId, fileName);
}

export function contentHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export function binaryContentHash(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 32);
}

export const CHAT_UPLOAD_REAPER_TTL_MINUTES = 60;

export class UserFileQuotaExceededError extends Error {
  readonly errorCode = "QUOTA_EXCEEDED";

  constructor(
    message: string,
    readonly quota: MediaQuotaSnapshot,
    readonly incomingBytes: number,
  ) {
    super(message);
    this.name = "UserFileQuotaExceededError";
  }
}

interface PreparedBinaryUserFile {
  record: Omit<UserFile, "createdAt">;
  data: Buffer;
  diskPath: string;
  wroteToDisk: boolean;
}

interface StoreBinaryWithinQuotaInput {
  fileType: UserFile["fileType"];
  mimeType: string;
  extension: string;
  data: Buffer;
  metadata?: Partial<UserFile["metadata"]>;
}

export interface StoreBinaryBatchWithinQuotaParams {
  userId: string;
  conversationId: string | null;
  quotaPolicy: MediaQuotaPolicy;
  files: StoreBinaryWithinQuotaInput[];
}

export interface StoreBinaryBatchWithinQuotaResult {
  files: UserFile[];
  quota: MediaQuotaSnapshot;
  incomingBytes: number;
}

function ensureDirectoryForPath(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class UserFileSystem {
  constructor(private repo: UserFileRepository) {}

  private async reuseStoredFile(params: {
    existing: UserFile;
    userId: string;
    conversationId: string | null;
    diskPath: string;
    data: Buffer;
  }): Promise<UserFile> {
    if (!fs.existsSync(params.diskPath)) {
      ensureDirectoryForPath(params.diskPath);
      fs.writeFileSync(params.diskPath, params.data);
    }

    if (params.conversationId && params.existing.conversationId === null) {
      await this.repo.assignConversation([params.existing.id], params.userId, params.conversationId);
      return await this.repo.findById(params.existing.id) ?? params.existing;
    }

    return params.existing;
  }

  private async prepareBinaryFile(params: {
    userId: string;
    conversationId: string | null;
    fileType: UserFile["fileType"];
    mimeType: string;
    extension: string;
    data: Buffer;
    metadata?: Partial<UserFile["metadata"]>;
  }): Promise<PreparedBinaryUserFile> {
    const hash = binaryContentHash(params.data);
    const fileName = `${hash}.${params.extension}`;
    const diskPath = getUserFilePath(params.userId, fileName);

    ensureDirectoryForPath(diskPath);

    let wroteToDisk = false;
    if (!fs.existsSync(diskPath)) {
      fs.writeFileSync(diskPath, params.data);
      wroteToDisk = true;
    }

    return {
      record: {
        id: `uf_${crypto.randomUUID()}`,
        userId: params.userId,
        conversationId: params.conversationId,
        status: "ready",
        contentHash: hash,
        fileType: params.fileType,
        fileName,
        mimeType: params.mimeType,
        fileSize: params.data.length,
        metadata: buildUserFileMetadata(params.metadata),
      },
      data: params.data,
      diskPath,
      wroteToDisk,
    };
  }

  private async cleanupPreparedBinaryFiles(files: PreparedBinaryUserFile[]): Promise<void> {
    for (const file of files) {
      if (!file.wroteToDisk) {
        continue;
      }

      const existing = await this.repo.findByHash(
        file.record.userId,
        file.record.contentHash,
        file.record.fileType,
      );
      if (existing) {
        continue;
      }

      if (fs.existsSync(file.diskPath)) {
        fs.unlinkSync(file.diskPath);
      }
    }
  }

  /**
   * Check if a file already exists for this user + content + type.
   * Returns the UserFile record and on-disk path if cached.
   */
  async lookup(
    userId: string,
    input: string,
    fileType: UserFile["fileType"],
  ): Promise<{ file: UserFile; diskPath: string } | null> {
    const hash = contentHash(input);
    const file = await this.repo.findByHash(userId, hash, fileType);
    if (!file) return null;

    const diskPath = getUserFilePath(userId, file.fileName);
    if (!fs.existsSync(diskPath)) {
      // DB record exists but file was deleted — clean up
      await this.repo.delete(file.id);
      return null;
    }

    return { file, diskPath };
  }

  /**
   * Store generated file bytes and create a DB record.
   * Returns the new UserFile.
   */
  async store(params: {
    id?: string;
    userId: string;
    conversationId: string | null;
    input: string;
    fileType: UserFile["fileType"];
    mimeType: string;
    extension: string;
    data: Buffer;
    metadata?: Partial<UserFile["metadata"]>;
  }): Promise<UserFile> {
    const hash = contentHash(params.input);
    const fileName = `${hash}.${params.extension}`;
    const diskPath = getUserFilePath(params.userId, fileName);

    const existing = await this.repo.findByHash(params.userId, hash, params.fileType);
    const canReuseExisting = existing
      && (
        existing.conversationId === params.conversationId
        || existing.conversationId === null
        || params.conversationId === null
      );

    if (existing && canReuseExisting) {
      return this.reuseStoredFile({
        existing,
        userId: params.userId,
        conversationId: params.conversationId,
        diskPath,
        data: params.data,
      });
    }

    // Ensure user directory exists
    const dir = path.dirname(diskPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(diskPath, params.data);

    const id = params.id ?? `uf_${crypto.randomUUID()}`;
    return this.repo.create({
      id,
      userId: params.userId,
      conversationId: params.conversationId,
      status: "ready",
      contentHash: hash,
      fileType: params.fileType,
      fileName,
      mimeType: params.mimeType,
      fileSize: params.data.length,
      metadata: buildUserFileMetadata(params.metadata),
    });
  }

  async allocatePending(params: {
    userId: string;
    conversationId: string | null;
    fileType: UserFile["fileType"];
    metadata?: Partial<UserFile["metadata"]>;
  }): Promise<UserFile> {
    const id = `uf_${crypto.randomUUID()}`;
    const hash = `pending_${id}`;
    return this.repo.create({
      id,
      userId: params.userId,
      conversationId: params.conversationId,
      status: "pending",
      contentHash: hash,
      fileType: params.fileType,
      fileName: hash,
      mimeType: "application/octet-stream",
      fileSize: 0,
      metadata: buildUserFileMetadata(params.metadata),
    });
  }

  async storeBinary(params: {
    userId: string;
    conversationId: string | null;
    fileType: UserFile["fileType"];
    mimeType: string;
    extension: string;
    data: Buffer;
    metadata?: Partial<UserFile["metadata"]>;
  }): Promise<UserFile> {
    const prepared = await this.prepareBinaryFile(params);
    const existing = await this.repo.findByHash(
      params.userId,
      prepared.record.contentHash,
      params.fileType,
    );
    if (existing) {
      return existing;
    }

    return this.repo.create(prepared.record);
  }

  async storeBinaryBatchWithinQuota(
    params: StoreBinaryBatchWithinQuotaParams,
  ): Promise<StoreBinaryBatchWithinQuotaResult> {
    const preparedFiles = await Promise.all(
      params.files.map((file) =>
        this.prepareBinaryFile({
          userId: params.userId,
          conversationId: params.conversationId,
          ...file,
        }),
      ),
    );

    try {
      if (this.repo.createBatchWithinQuota) {
        const result = await this.repo.createBatchWithinQuota(
          preparedFiles.map((file) => file.record),
          {
            userId: params.userId,
            quotaBytes: params.quotaPolicy.defaultUserQuotaBytes,
            hardBlockUploadsAtQuota: params.quotaPolicy.hardBlockUploadsAtQuota,
          },
        );
        const quota = buildMediaQuotaSnapshot(result.projectedTotalBytes, params.quotaPolicy);

        if (result.quotaExceeded) {
          throw new UserFileQuotaExceededError(
            "This upload would exceed your media quota.",
            quota,
            result.insertedBytes,
          );
        }

        return {
          files: result.files,
          quota,
          incomingBytes: result.insertedBytes,
        };
      }

      const existingSummary = await this.repo.getUserStorageSummary(params.userId);
      const existingByHash = await Promise.all(
        preparedFiles.map(async (file) => this.repo.findByHash(
          file.record.userId,
          file.record.contentHash,
          file.record.fileType,
        )),
      );
      const insertedBytes = preparedFiles.reduce((total, file, index) => (
        existingByHash[index] ? total : total + file.record.fileSize
      ), 0);
      const projectedTotalBytes = existingSummary.totalBytes + insertedBytes;
      const quota = buildMediaQuotaSnapshot(projectedTotalBytes, params.quotaPolicy);

      if (params.quotaPolicy.hardBlockUploadsAtQuota && quota.isOverQuota) {
        throw new UserFileQuotaExceededError(
          "This upload would exceed your media quota.",
          quota,
          insertedBytes,
        );
      }

      const storedFiles: UserFile[] = [];

      for (const [index, file] of preparedFiles.entries()) {
        const existing = existingByHash[index];

        if (existing) {
          storedFiles.push(existing);
          continue;
        }

        storedFiles.push(await this.repo.create(file.record));
      }

      return {
        files: storedFiles,
        quota,
        incomingBytes: insertedBytes,
      };
    } catch (error) {
      await this.cleanupPreparedBinaryFiles(preparedFiles);
      throw error;
    }
  }

  async assignConversation(
    fileIds: string[],
    userId: string,
    conversationId: string,
  ): Promise<void> {
    await this.repo.assignConversation(fileIds, userId, conversationId);
  }

  async deleteIfUnattached(id: string, userId: string): Promise<boolean> {
    const file = await this.repo.deleteIfUnattached(id, userId);
    if (!file) {
      return false;
    }

    const diskPath = getUserFilePath(file.userId, file.fileName);
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }

    return true;
  }

  async reapUnattachedFiles(options: {
    olderThanMinutes?: number;
    userId?: string;
    fileType?: UserFile["fileType"];
  }): Promise<string[]> {
    const olderThanMinutes =
      options.olderThanMinutes ?? CHAT_UPLOAD_REAPER_TTL_MINUTES;
    const cutoffIso = new Date(
      Date.now() - olderThanMinutes * 60 * 1000,
    ).toISOString();
    const candidates = await this.repo.listUnattachedCreatedBefore(cutoffIso, {
      userId: options.userId,
      fileType: options.fileType,
    });
    const deletedIds: string[] = [];

    for (const candidate of candidates) {
      const deleted = await this.repo.deleteIfUnattached(
        candidate.id,
        candidate.userId,
      );
      if (!deleted) {
        continue;
      }

      const diskPath = getUserFilePath(deleted.userId, deleted.fileName);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
      deletedIds.push(deleted.id);
    }

    return deletedIds;
  }

  /**
   * Retrieve a file by its DB id. Returns the record + disk path.
   */
  async getById(
    id: string,
  ): Promise<{ file: UserFile; diskPath: string } | null> {
    const file = await this.repo.findById(id);
    if (!file) return null;

    const diskPath = getUserFilePath(file.userId, file.fileName);
    if (!fs.existsSync(diskPath)) {
      await this.repo.delete(file.id);
      return null;
    }

    return { file, diskPath };
  }
}
