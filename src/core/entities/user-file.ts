import type {
  MediaAssetKind,
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "./media-asset";

/**
 * Domain entity for user-generated files (audio, charts, etc.).
 * Files are cached on disk and tracked in the database so they
 * survive page reloads without regeneration.
 */
export type UserFileType =
  | "audio"
  | "chart"
  | "document"
  | "graph"
  | "image"
  | "video"
  | "subtitle"
  | "waveform";

export const USER_FILE_TYPES = [
  "audio",
  "chart",
  "document",
  "graph",
  "image",
  "video",
  "subtitle",
  "waveform",
] as const satisfies readonly UserFileType[];

export interface UserFileMetadata {
  assetKind?: MediaAssetKind;
  source?: MediaAssetSource;
  width?: number;
  height?: number;
  durationSeconds?: number;
  toolName?: string;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
  retentionClass?: MediaAssetRetentionClass;
  derivativeOfAssetId?: string | null;
  subtitleCueCount?: number;
}

export interface UserFile {
  id: string;
  userId: string;
  conversationId: string | null;
  status: "pending" | "ready" | "failed";
  contentHash: string;
  fileType: UserFileType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  metadata: UserFileMetadata;
  createdAt: string;
}
