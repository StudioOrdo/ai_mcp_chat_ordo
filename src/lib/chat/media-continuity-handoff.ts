import type { ChatMessage } from "@/core/entities/chat-message";
import { buildMediaCompositionCanonicalizationOptionsFromChatMessages } from "@/lib/media/media-composition-asset-identity";

export type MediaContinuityAssetKind = "image" | "video" | "audio" | "chart" | "graph";

export interface MediaContinuityAssetRef {
  assetId: string;
  kind: MediaContinuityAssetKind;
  aliases: string[];
  derivativeOfAssetId?: string | null;
}

export interface MediaContinuityHandoff {
  assets: MediaContinuityAssetRef[];
}

const MAX_MEDIA_CONTINUITY_ASSETS = 8;
const MAX_MEDIA_CONTINUITY_ALIASES = 8;
const MAX_MEDIA_CONTINUITY_ALIAS_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isMediaContinuityAssetKind(value: unknown): value is MediaContinuityAssetKind {
  return value === "image"
    || value === "video"
    || value === "audio"
    || value === "chart"
    || value === "graph";
}

function sanitizeAliases(aliases: unknown): string[] {
  if (!Array.isArray(aliases)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const alias of aliases) {
    const normalized = readString(alias);
    if (!normalized) {
      continue;
    }

    deduped.add(normalized.slice(0, MAX_MEDIA_CONTINUITY_ALIAS_LENGTH));
    if (deduped.size >= MAX_MEDIA_CONTINUITY_ALIASES) {
      break;
    }
  }

  return [...deduped];
}

function sanitizeMediaContinuityAssets(value: unknown): MediaContinuityAssetRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const assets: MediaContinuityAssetRef[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue;
    }

    const assetId = readString(candidate.assetId);
    const kind = candidate.kind;
    if (!assetId || seen.has(assetId) || !isMediaContinuityAssetKind(kind)) {
      continue;
    }

    assets.push({
      assetId,
      kind,
      aliases: sanitizeAliases(candidate.aliases),
      ...(typeof candidate.derivativeOfAssetId === "string" && candidate.derivativeOfAssetId.trim().length > 0
        ? { derivativeOfAssetId: candidate.derivativeOfAssetId.trim() }
        : {}),
    });
    seen.add(assetId);

    if (assets.length >= MAX_MEDIA_CONTINUITY_ASSETS) {
      break;
    }
  }

  return assets;
}

export function normalizeMediaContinuityHandoff(value: unknown): MediaContinuityHandoff | null {
  if (!isRecord(value)) {
    return null;
  }

  const assets = sanitizeMediaContinuityAssets(value.assets);
  if (assets.length === 0) {
    return null;
  }

  return { assets };
}

export function buildMediaContinuityHandoff(
  messages: readonly ChatMessage[],
): MediaContinuityHandoff | null {
  const candidates = (buildMediaCompositionCanonicalizationOptionsFromChatMessages(messages).assetCandidates ?? [])
    .slice(-MAX_MEDIA_CONTINUITY_ASSETS)
    .map((candidate) => ({
      assetId: candidate.assetId,
      kind: candidate.kind,
      aliases: sanitizeAliases(candidate.aliases ?? []),
      ...(candidate.derivativeOfAssetId ? { derivativeOfAssetId: candidate.derivativeOfAssetId } : {}),
    }));

  return candidates.length > 0 ? { assets: candidates } : null;
}

export function buildMediaContinuityContextBlock(handoff: MediaContinuityHandoff): string {
  const lines = [
    "",
    "[Server media continuity handoff]",
    "Treat the following as server-owned reusable media already available in this conversation.",
    "If the user asks to combine, reuse, animate, or add audio to existing media, prefer these assets instead of silently regenerating replacements.",
    "If the available assets seem ambiguous or incomplete, call list_conversation_media_assets before generating new media.",
  ];

  for (const asset of handoff.assets) {
    const aliasText = asset.aliases.length > 0
      ? ` aliases=${JSON.stringify(asset.aliases)}`
      : "";
    const lineageText = asset.derivativeOfAssetId
      ? ` derivativeOfAssetId=${asset.derivativeOfAssetId}`
      : "";
    lines.push(`- ${asset.kind}: ${asset.assetId}${aliasText}${lineageText}`);
  }

  return lines.join("\n");
}

export function mediaContinuityHasVisualAsset(handoff: MediaContinuityHandoff | null | undefined): boolean {
  return Boolean(handoff?.assets.some((asset) => (
    asset.kind === "image"
    || asset.kind === "video"
    || asset.kind === "chart"
    || asset.kind === "graph"
  )));
}

export function mediaContinuityHasAudioAsset(handoff: MediaContinuityHandoff | null | undefined): boolean {
  return Boolean(handoff?.assets.some((asset) => asset.kind === "audio"));
}