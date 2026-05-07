import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import type { MediaAssetRetentionClass, MediaAssetSource } from "@/core/entities/media-asset";
import type { UserFile, UserFileType } from "@/core/entities/user-file";
import type { UserFileStorageSummary } from "@/core/entities/user-file-storage";
import { resolveUserFileRetentionClass, resolveUserFileSource } from "@/lib/media/media-asset-projection";
import { getUserMediaStorageAccount } from "@/lib/storage/media-storage-accounting";
import { buildMediaQuotaSnapshot, type MediaQuotaSnapshot } from "@/lib/storage/media-quota-policy";

const USER_MEDIA_PAGE_LIMIT = 50;

const USER_MEDIA_FILE_TYPES: readonly UserFileType[] = [
  "audio",
  "chart",
  "document",
  "graph",
  "image",
  "video",
  "subtitle",
  "waveform",
] as const;

const USER_MEDIA_SOURCES: readonly MediaAssetSource[] = ["uploaded", "generated", "derived"] as const;
const USER_MEDIA_RETENTION_CLASSES: readonly MediaAssetRetentionClass[] = ["ephemeral", "conversation", "durable"] as const;

export interface UserMediaFilters {
  search: string;
  fileType: UserFileType | null;
  source: MediaAssetSource | null;
  retentionClass: MediaAssetRetentionClass | null;
  attached: boolean | null;
}

export interface UserMediaItem {
  id: string;
  fileName: string;
  mimeType: string;
  fileType: UserFileType;
  fileSize: number;
  createdAt: string;
  previewUrl: string;
  conversationId: string | null;
  source: MediaAssetSource;
  retentionClass: MediaAssetRetentionClass;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  canDelete: boolean;
}

export interface UserMediaWorkspaceData {
  filters: UserMediaFilters;
  items: UserMediaItem[];
  summary: UserFileStorageSummary;
  quota: MediaQuotaSnapshot;
  hasMore: boolean;
}

function normalizeEnumValue<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return allowed.includes(trimmed as T) ? (trimmed as T) : null;
}

function normalizeSearch(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() ?? "";
}

function normalizeAttached(value: string | string[] | undefined): boolean | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return null;
  }

  if (candidate === "attached") {
    return true;
  }

  if (candidate === "unattached") {
    return false;
  }

  return null;
}

export function parseUserMediaFilters(
  rawSearchParams: Record<string, string | string[] | undefined> = {},
): UserMediaFilters {
  return {
    search: normalizeSearch(rawSearchParams.q),
    fileType: normalizeEnumValue(rawSearchParams.type, USER_MEDIA_FILE_TYPES),
    source: normalizeEnumValue(rawSearchParams.source, USER_MEDIA_SOURCES),
    retentionClass: normalizeEnumValue(rawSearchParams.retention, USER_MEDIA_RETENTION_CLASSES),
    attached: normalizeAttached(rawSearchParams.attached),
  };
}

export function projectUserFileToUserMediaItem(item: UserFile): UserMediaItem {
  return {
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    fileType: item.fileType,
    fileSize: item.fileSize,
    createdAt: item.createdAt,
    previewUrl: `/api/user-files/${item.id}`,
    conversationId: item.conversationId,
    source: resolveUserFileSource(item),
    retentionClass: resolveUserFileRetentionClass(item),
    width: typeof item.metadata.width === "number" ? item.metadata.width : null,
    height: typeof item.metadata.height === "number" ? item.metadata.height : null,
    durationSeconds: typeof item.metadata.durationSeconds === "number"
      ? item.metadata.durationSeconds
      : null,
    canDelete: item.conversationId === null,
  };
}

export async function loadUserMediaWorkspace(
  userId: string,
  rawSearchParams: Record<string, string | string[] | undefined> = {},
): Promise<UserMediaWorkspaceData> {
  const filters = parseUserMediaFilters(rawSearchParams);
  const repo = getUserFileDataMapper();

  const [page, summary] = await Promise.all([
    repo.listForUser(userId, {
      limit: USER_MEDIA_PAGE_LIMIT,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.fileType ? { fileType: filters.fileType } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.retentionClass ? { retentionClass: filters.retentionClass } : {}),
      ...(filters.attached !== null ? { attached: filters.attached } : {}),
    }),
    getUserMediaStorageAccount(repo, userId),
  ]);

  return {
    filters,
    items: page.items.map(projectUserFileToUserMediaItem),
    summary,
    quota: buildMediaQuotaSnapshot(summary.totalBytes),
    hasMore: page.nextCursor !== null,
  };
}
