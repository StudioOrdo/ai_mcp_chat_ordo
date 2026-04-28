import type { ChatMessage } from "@/core/entities/chat-message";
import type { MessagePart } from "@/core/entities/message-parts";
import type { UserFile } from "@/core/entities/user-file";
import { resolveGenerateChartPayload } from "@/core/use-cases/tools/chart-payload";
import { resolveGenerateGraphPayload } from "@/core/use-cases/tools/graph-payload";
import type {
  CanonicalizeMediaCompositionPlanOptions,
  MediaCompositionAssetIdentityCandidate,
} from "@/lib/media/ffmpeg/media-composition-plan";
import { extractJobStatusSnapshots } from "@/lib/jobs/job-status-snapshots";
import {
  projectUserFileToConversationMediaAssetCandidate,
  type ConversationMediaAssetCandidate,
} from "./media-asset-projection";

function isCompositionEligibleAssetKind(
  kind: ConversationMediaAssetCandidate["assetKind"],
): kind is MediaCompositionAssetIdentityCandidate["kind"] {
  return kind === "image"
    || kind === "video"
    || kind === "audio"
    || kind === "chart"
    || kind === "graph";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stripExtension(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, "");
}

function slugifyAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function collectAliasVariants(values: Array<string | null | undefined>): string[] {
  const aliases = new Set<string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    aliases.add(trimmed);
    aliases.add(trimmed.toLowerCase());

    const stem = stripExtension(trimmed);
    if (stem && stem !== trimmed) {
      aliases.add(stem);
      aliases.add(stem.toLowerCase());
    }

    const slug = slugifyAlias(trimmed);
    if (slug) {
      aliases.add(slug);
    }
  }

  return [...aliases].filter((alias) => alias.length > 0);
}

function mergeAssetCandidates(
  candidates: readonly MediaCompositionAssetIdentityCandidate[],
): MediaCompositionAssetIdentityCandidate[] {
  const merged = new Map<string, MediaCompositionAssetIdentityCandidate>();

  for (const candidate of candidates) {
    const existing = merged.get(candidate.assetId);
    if (!existing) {
      merged.set(candidate.assetId, {
        assetId: candidate.assetId,
        kind: candidate.kind,
        aliases: [...new Set(candidate.aliases ?? [])],
        ...(candidate.derivativeOfAssetId !== undefined
          ? { derivativeOfAssetId: candidate.derivativeOfAssetId }
          : {}),
      });
      continue;
    }

    merged.set(candidate.assetId, {
      assetId: candidate.assetId,
      kind: existing.kind,
      aliases: [...new Set([...(existing.aliases ?? []), ...(candidate.aliases ?? [])])],
      ...(existing.derivativeOfAssetId !== undefined
        ? { derivativeOfAssetId: existing.derivativeOfAssetId }
        : candidate.derivativeOfAssetId !== undefined
          ? { derivativeOfAssetId: candidate.derivativeOfAssetId }
          : {}),
    });
  }

  return [...merged.values()];
}

export function mergeMediaCompositionCanonicalizationOptions(
  ...options: Array<CanonicalizeMediaCompositionPlanOptions | undefined>
): CanonicalizeMediaCompositionPlanOptions {
  return {
    assetCandidates: mergeAssetCandidates(
      options.flatMap((option) => option?.assetCandidates ?? []),
    ),
    aliasBindings: Object.assign({}, ...options.map((option) => option?.aliasBindings ?? {})),
  };
}

function buildAssetCandidateFromConversationAsset(
  asset: ConversationMediaAssetCandidate,
): MediaCompositionAssetIdentityCandidate | null {
  if (!isCompositionEligibleAssetKind(asset.assetKind)) {
    return null;
  }

  return {
    assetId: asset.assetId,
    kind: asset.assetKind,
    aliases: collectAliasVariants([
      asset.assetId,
      asset.label,
      asset.fileName,
      stripExtension(asset.fileName),
    ]),
    ...(asset.derivativeOfAssetId !== undefined
      ? { derivativeOfAssetId: asset.derivativeOfAssetId }
      : {}),
  };
}

export function buildMediaCompositionCanonicalizationOptionsFromConversationAssets(
  assets: readonly ConversationMediaAssetCandidate[],
): CanonicalizeMediaCompositionPlanOptions {
  return {
    assetCandidates: mergeAssetCandidates(
      assets.flatMap((asset) => {
        const candidate = buildAssetCandidateFromConversationAsset(asset);
        return candidate ? [candidate] : [];
      }),
    ),
  };
}

export function buildMediaCompositionCanonicalizationOptionsFromUserFiles(
  files: readonly UserFile[],
): CanonicalizeMediaCompositionPlanOptions {
  return buildMediaCompositionCanonicalizationOptionsFromConversationAssets(
    files
      .map(projectUserFileToConversationMediaAssetCandidate)
      .filter((asset): asset is ConversationMediaAssetCandidate => Boolean(asset)),
  );
}

type SupportedAliasToolName = "generate_audio" | "generate_chart" | "generate_graph" | "generate_blog_image";

type ToolCallAliasSeed = {
  toolName: SupportedAliasToolName;
  aliases: string[];
};

function buildToolCallAliasSeed(part: Extract<MessagePart, { type: "tool_call" }>): ToolCallAliasSeed | null {
  if (part.name === "generate_chart") {
    return {
      toolName: part.name,
      aliases: collectAliasVariants([
        readString(part.args.title),
        readString(part.args.downloadFileName),
      ]),
    };
  }

  if (part.name === "generate_graph") {
    return {
      toolName: part.name,
      aliases: collectAliasVariants([
        readString(part.args.title),
        readString(part.args.caption),
        readString(part.args.downloadFileName),
      ]),
    };
  }

  if (part.name === "generate_audio") {
    return {
      toolName: part.name,
      aliases: collectAliasVariants([readString(part.args.title)]),
    };
  }

  if (part.name === "generate_blog_image") {
    return {
      toolName: part.name,
      aliases: collectAliasVariants([
        readString(part.args.prompt),
        readString(part.args.alt_text),
      ]),
    };
  }

  return null;
}

function resolveFallbackFileType(toolName: SupportedAliasToolName): UserFile["fileType"] | "image" {
  switch (toolName) {
    case "generate_chart":
      return "chart";
    case "generate_graph":
      return "graph";
    case "generate_audio":
      return "audio";
    case "generate_blog_image":
      return "image";
  }
}

export function buildMediaCompositionCanonicalizationOptionsFromChatMessagesAndUserFiles(
  messages: readonly ChatMessage[],
  files: readonly UserFile[],
): CanonicalizeMediaCompositionPlanOptions {
  const seeds = new Map<SupportedAliasToolName, ToolCallAliasSeed[]>();

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool_call") {
        continue;
      }

      const seed = buildToolCallAliasSeed(part);
      if (!seed || seed.aliases.length === 0) {
        continue;
      }

      const existing = seeds.get(seed.toolName) ?? [];
      existing.push(seed);
      seeds.set(seed.toolName, existing);
    }
  }

  const candidates: MediaCompositionAssetIdentityCandidate[] = [];

  for (const [toolName, toolSeeds] of seeds) {
    if (toolSeeds.length !== 1) {
      continue;
    }

    const expectedFileType = resolveFallbackFileType(toolName);
    const matchingFiles = files.filter((file) => file.fileType === expectedFileType);
    if (matchingFiles.length !== 1 && toolName !== "generate_blog_image") {
      continue;
    }

    // For generate_blog_image, it uses blogasset_ not user files, so we handle it separately below.
    if (toolName !== "generate_blog_image") {
      const asset = projectUserFileToConversationMediaAssetCandidate(matchingFiles[0]);
      if (!asset || !isCompositionEligibleAssetKind(asset.assetKind)) {
        continue;
      }

      candidates.push({
        assetId: asset.assetId,
        kind: asset.assetKind,
        aliases: collectAliasVariants([
          asset.assetId,
          asset.label,
          asset.fileName,
          ...toolSeeds[0].aliases,
        ]),
      });
    }
  }

  return {
    assetCandidates: mergeAssetCandidates(candidates),
  };
}

function buildChartCandidate(payload: unknown, args: Record<string, unknown>): MediaCompositionAssetIdentityCandidate | null {
  const raw = {
    ...args,
    ...(isRecord(payload) ? payload : {}),
  };
  const assetId = readString(raw.assetId);
  if (!assetId) {
    return null;
  }

  let title = readString(raw.title);
  let downloadFileName = readString(raw.downloadFileName);

  try {
    const chart = resolveGenerateChartPayload(raw);
    title = chart.title ?? title;
    downloadFileName = chart.downloadFileName ?? downloadFileName;
  } catch {
    // Resolved payloads may already be in output form; assetId is sufficient.
  }

  return {
    assetId,
    kind: "chart",
    aliases: collectAliasVariants([assetId, title, downloadFileName]),
  };
}

function buildGraphCandidate(payload: unknown, args: Record<string, unknown>): MediaCompositionAssetIdentityCandidate | null {
  const raw = {
    ...args,
    ...(isRecord(payload) ? payload : {}),
  };
  const assetId = readString(raw.assetId);
  if (!assetId) {
    return null;
  }

  let title = readString(raw.title);
  let caption = readString(raw.caption);
  let downloadFileName = readString(raw.downloadFileName);

  try {
    const graph = resolveGenerateGraphPayload(raw);
    title = graph.title ?? title;
    caption = graph.caption ?? caption;
    downloadFileName = graph.downloadFileName ?? downloadFileName;
  } catch {
    // Resolved payloads may already be in output form; assetId is sufficient.
  }

  return {
    assetId,
    kind: "graph",
    aliases: collectAliasVariants([assetId, title, caption, downloadFileName]),
  };
}

function buildAudioCandidate(
  payload: unknown,
  args: Record<string, unknown>,
  part: Extract<MessagePart, { type: "job_status" }> | Extract<MessagePart, { type: "tool_result" }>,
): MediaCompositionAssetIdentityCandidate | null {
  if (!isRecord(payload)) {
    return null;
  }

  const assetId = readString(payload.assetId);
  if (!assetId) {
    return null;
  }

  const title = readString(payload.title);
  const requestedTitle = readString(args.title);
  const label = part.type === "job_status" ? readString(part.title) ?? readString(part.label) : null;

  return {
    assetId,
    kind: "audio",
    aliases: collectAliasVariants([assetId, title, requestedTitle, label]),
  };
}

function buildBlogImageCandidate(
  payload: unknown,
  args: Record<string, unknown>,
): MediaCompositionAssetIdentityCandidate | null {
  if (!isRecord(payload)) {
    return null;
  }

  const assetId = readString(payload.assetId) ?? readString(payload.heroImageAssetId);
  if (!assetId) {
    return null;
  }

  const prompt = readString(args.prompt);
  const altText = readString(args.alt_text);

  return {
    assetId,
    kind: "image",
    aliases: collectAliasVariants([assetId, prompt, altText]),
  };
}

function buildAttachmentCandidate(part: Extract<MessagePart, { type: "attachment" }>): MediaCompositionAssetIdentityCandidate | null {
  if (!part.assetKind || !isCompositionEligibleAssetKind(part.assetKind)) {
    return null;
  }

  return {
    assetId: part.assetId,
    kind: part.assetKind,
    aliases: collectAliasVariants([part.assetId, part.fileName, stripExtension(part.fileName)]),
  };
}

function buildConversationAssetCandidate(value: unknown): MediaCompositionAssetIdentityCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const assetId = readString(value.assetId);
  const assetKind = readString(value.assetKind);
  if (!assetId || !assetKind || !isCompositionEligibleAssetKind(assetKind as ConversationMediaAssetCandidate["assetKind"])) {
    return null;
  }

  const label = readString(value.label);
  const fileName = readString(value.fileName);

  return {
    assetId,
    kind: assetKind as MediaCompositionAssetIdentityCandidate["kind"],
    aliases: collectAliasVariants([assetId, label, fileName]),
    ...(typeof value.derivativeOfAssetId === "string" && value.derivativeOfAssetId.trim().length > 0
      ? { derivativeOfAssetId: value.derivativeOfAssetId.trim() }
      : {}),
  };
}

function buildListConversationMediaAssetsCandidates(payload: unknown): MediaCompositionAssetIdentityCandidate[] {
  if (!isRecord(payload) || !Array.isArray(payload.assets)) {
    return [];
  }

  return payload.assets.flatMap((asset) => {
    const candidate = buildConversationAssetCandidate(asset);
    return candidate ? [candidate] : [];
  });
}

function buildCandidateFromPart(
  part: MessagePart,
  callArgs: Record<string, unknown>,
): MediaCompositionAssetIdentityCandidate | null {
  if (part.type === "attachment") {
    return buildAttachmentCandidate(part);
  }

  if (part.type === "tool_result") {
    const snapshots = extractJobStatusSnapshots(part.result);
    const snapshot = snapshots.at(-1)?.part;
    const payload = snapshot?.resultEnvelope?.payload ?? snapshot?.resultPayload ?? part.result;

    if (part.name === "list_conversation_media_assets") {
      const candidates = buildListConversationMediaAssetsCandidates(payload);
      return candidates[0] ?? null;
    }

    if (part.name === "generate_chart") {
      return buildChartCandidate(payload, callArgs);
    }

    if (part.name === "generate_graph") {
      return buildGraphCandidate(payload, callArgs);
    }

    if (part.name === "generate_audio") {
      return buildAudioCandidate(payload, callArgs, part);
    }

    if (part.name === "generate_blog_image") {
      return buildBlogImageCandidate(payload, callArgs);
    }
  }

  if (part.type === "job_status") {
    const payload = part.resultEnvelope?.payload ?? part.resultPayload;

    if (part.toolName === "list_conversation_media_assets") {
      const candidates = buildListConversationMediaAssetsCandidates(payload);
      return candidates[0] ?? null;
    }

    if (part.toolName === "generate_chart") {
      return buildChartCandidate(payload, callArgs);
    }

    if (part.toolName === "generate_graph") {
      return buildGraphCandidate(payload, callArgs);
    }

    if (part.toolName === "generate_audio") {
      return buildAudioCandidate(payload, callArgs, part);
    }

    if (part.toolName === "generate_blog_image") {
      return buildBlogImageCandidate(payload, callArgs);
    }
  }

  return null;
}

export function buildMediaCompositionCanonicalizationOptionsFromChatMessages(
  messages: readonly ChatMessage[],
): CanonicalizeMediaCompositionPlanOptions {
  const candidates: MediaCompositionAssetIdentityCandidate[] = [];

  for (const message of messages) {
    const latestToolArgs = new Map<string, Record<string, unknown>>();

    for (const part of message.parts ?? []) {
      if (part.type === "tool_call") {
        latestToolArgs.set(part.name, part.args);
        continue;
      }

      if (
        part.type !== "tool_result"
        && part.type !== "job_status"
        && part.type !== "attachment"
      ) {
        continue;
      }

      const toolName = part.type === "tool_result"
        ? part.name
        : part.type === "job_status"
          ? part.toolName
          : "";
      const callArgs = latestToolArgs.get(toolName) ?? {};
      let candidate: MediaCompositionAssetIdentityCandidate | null = null;

      try {
        if (
          (part.type === "tool_result" && part.name === "list_conversation_media_assets")
          || (part.type === "job_status" && part.toolName === "list_conversation_media_assets")
        ) {
          const payload = part.type === "tool_result"
            ? extractJobStatusSnapshots(part.result).at(-1)?.part?.resultEnvelope?.payload
              ?? extractJobStatusSnapshots(part.result).at(-1)?.part?.resultPayload
              ?? part.result
            : part.resultEnvelope?.payload ?? part.resultPayload;
          candidates.push(...buildListConversationMediaAssetsCandidates(payload));
          continue;
        }

        candidate = buildCandidateFromPart(part, callArgs);
      } catch {
        candidate = null;
      }

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return {
    assetCandidates: mergeAssetCandidates(candidates),
  };
}