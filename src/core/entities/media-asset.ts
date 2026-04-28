export type MediaAssetKind =
  | "image"
  | "chart"
  | "graph"
  | "audio"
  | "video"
  | "subtitle"
  | "waveform";

export type MediaAssetSource = "generated" | "uploaded" | "derived";

export type MediaAssetRetentionClass = "ephemeral" | "conversation" | "durable";

export interface MediaAssetDescriptor {
  id: string;
  kind: MediaAssetKind;
  mimeType: string;
  source: MediaAssetSource;
  assetId?: string;
  uri?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  conversationId?: string;
  toolName?: string;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
  derivativeOfAssetId?: string | null;
  retentionClass?: MediaAssetRetentionClass;
}
