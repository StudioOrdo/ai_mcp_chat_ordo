import { readFile } from "node:fs/promises";

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { resolveCanonicalMediaAssetId } from "@/lib/media/media-asset-id";
import { getOpenaiApiKey, getTtsFetchTimeoutMs } from "@/lib/config/env";
import { UserFileSystem } from "@/lib/user-files";
import { estimateAudioDurationSeconds, estimateAudioGenerationSeconds } from "@/lib/audio/audio-estimates";
import { REASON_CODES } from "@/lib/observability/reason-codes";
import { emitProviderEvent } from "@/lib/chat/provider-policy";
import { AudioGenerationError } from "@/lib/audio/audio-generation-errors";

export const TTS_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const TTS_MIME_TYPE = "audio/mpeg" as const;
export const TTS_PROVIDER = "openai-speech" as const;

export interface GenerateStoredAudioInput {
  userId: string;
  text: string;
  assetId?: string | null;
  conversationId?: string | null;
  toolInvocationId?: string;
  voice?: string | null;
  format?: "mp3" | null;
}

export interface StoredAudioArtifact {
  assetId: string;
  audioBuffer: Buffer;
  provider: string;
  cacheHit: boolean;
  estimatedDurationSeconds: number;
}

export interface GenerateAudioRuntimePayloadInput {
  title: string;
  text: string;
  assetId?: string | null;
  toolInvocationId?: string;
  voice?: string | null;
  format?: "mp3" | null;
}

export interface GenerateAudioRuntimePayload {
  action: "generate_audio";
  title: string;
  text: string;
  assetId: string | null;
  assetKind: "audio";
  mimeType: "audio/mpeg";
  assetSource: "generated";
  provider: string;
  generationStatus: "client_fetch_pending" | "cached_asset" | "completed";
  estimatedDurationSeconds: number;
  estimatedGenerationSeconds: number;
  toolInvocationId?: string;
}

export function resolveCanonicalGeneratedAudioAssetId(value: string | null | undefined): string | null {
  return resolveCanonicalMediaAssetId(value);
}

function isTransientProviderStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function generateStoredAudioArtifact(
  input: GenerateStoredAudioInput,
): Promise<StoredAudioArtifact> {
  const repo = getUserFileDataMapper();
  const ufs = new UserFileSystem(repo);
  const estimatedDurationSeconds = estimateAudioDurationSeconds(input.text);

  const cached = await ufs.lookup(input.userId, input.text, "audio");
  if (cached) {
    try {
      return {
        assetId: cached.file.id,
        audioBuffer: await readFile(cached.diskPath),
        provider: "user-file-cache",
        cacheHit: true,
        estimatedDurationSeconds,
      };
    } catch {
      emitProviderEvent({
        kind: "attempt_failure",
        surface: "tts",
        model: "user-file-cache",
        attempt: 1,
        durationMs: 0,
        error: "Cached generated audio file was missing on disk; regenerating.",
        errorClassification: "transient",
      });
    }
  }

  const openaiApiKey = getOpenaiApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTtsFetchTimeoutMs());
  const ttsModel = "tts-1";
  const providerStartedAt = Date.now();

  emitProviderEvent({
    kind: "attempt_start",
    surface: "tts",
    model: ttsModel,
    attempt: 1,
  });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ttsModel,
        input: input.text,
        voice: input.voice?.trim() || "alloy",
        response_format: input.format ?? "mp3",
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AudioGenerationError(
        "OpenAI TTS timed out while generating audio.",
        "transient",
        REASON_CODES.TTS_TIMEOUT,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const failureClass = isTransientProviderStatus(response.status) ? "transient" : "terminal";
    emitProviderEvent({
      kind: "attempt_failure",
      surface: "tts",
      model: ttsModel,
      attempt: 1,
      durationMs: Date.now() - providerStartedAt,
      error: `OpenAI TTS returned ${response.status}`,
      errorClassification: failureClass === "transient" ? "transient" : "fatal",
    });
    throw new AudioGenerationError(
      `OpenAI TTS failed to generate audio with status ${response.status}.`,
      failureClass,
      REASON_CODES.TTS_PROVIDER_FAILED,
      response.status,
    );
  }

  emitProviderEvent({
    kind: "attempt_success",
    surface: "tts",
    model: ttsModel,
    attempt: 1,
    durationMs: Date.now() - providerStartedAt,
  });

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > TTS_MAX_RESPONSE_BYTES) {
    throw new AudioGenerationError(
      "TTS response too large.",
      "terminal",
      REASON_CODES.TTS_PROVIDER_FAILED,
    );
  }

  const audioBuffer = Buffer.from(arrayBuffer);
  const userFile = await ufs.store({
    id: input.assetId ?? undefined,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    input: input.text,
    fileType: "audio",
    mimeType: TTS_MIME_TYPE,
    extension: "mp3",
    data: audioBuffer,
    metadata: {
      assetKind: "audio",
      source: "generated",
      retentionClass: input.conversationId ? "conversation" : "ephemeral",
      durationSeconds: estimatedDurationSeconds,
      toolName: "generate_audio",
      ...(input.toolInvocationId ? { toolInvocationId: input.toolInvocationId } : {}),
    },
  });

  return {
    assetId: userFile.id,
    audioBuffer,
    provider: TTS_PROVIDER,
    cacheHit: false,
    estimatedDurationSeconds,
  };
}

export function buildGenerateAudioRuntimePayload(
  input: GenerateAudioRuntimePayloadInput,
  resolved?: Pick<StoredAudioArtifact, "assetId" | "provider" | "cacheHit" | "estimatedDurationSeconds">,
): GenerateAudioRuntimePayload {
  const inputAssetId = resolveCanonicalGeneratedAudioAssetId(input.assetId);
  const assetId = inputAssetId ?? resolved?.assetId ?? null;
  const cacheHit = inputAssetId != null || resolved?.cacheHit === true;

  return {
    action: "generate_audio",
    title: input.title,
    text: input.text,
    assetId,
    assetKind: "audio",
    mimeType: TTS_MIME_TYPE,
    assetSource: "generated",
    provider: inputAssetId ? "user-file-cache" : resolved?.provider ?? TTS_PROVIDER,
    generationStatus: inputAssetId
      ? "cached_asset"
      : cacheHit
        ? "cached_asset"
        : assetId
          ? "completed"
          : "client_fetch_pending",
    estimatedDurationSeconds: resolved?.estimatedDurationSeconds ?? estimateAudioDurationSeconds(input.text),
    estimatedGenerationSeconds: estimateAudioGenerationSeconds(input.text),
    ...(input.toolInvocationId ? { toolInvocationId: input.toolInvocationId } : {}),
  };
}
