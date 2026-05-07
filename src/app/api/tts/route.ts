import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { getOpenaiApiKey } from "@/lib/config/env";
import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";

import { UserFileSystem } from "@/lib/user-files";
import { TtsRequestSchema } from "./schema";
import {
  createRequestId,
  logEvent,
  logFailure,
} from "@/lib/observability/logger";
import { recordRouteMetric } from "@/lib/observability/metrics";
import { REASON_CODES } from "@/lib/observability/reason-codes";
import { estimateAudioDurationSeconds } from "@/lib/audio/audio-estimates";
import {
  emitProviderEvent,
} from "@/lib/chat/provider-policy";
import {
  isProviderCapabilityUnavailableError,
} from "@/lib/ai/providers/provider-capability-availability";
import {
  assertProviderBackedToolAvailable,
} from "@/lib/tools/tool-provider-capability-policy";

const TTS_FETCH_TIMEOUT_MS = 30_000;
const TTS_MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB
const TTS_ROUTE = "/api/tts";

function durationMs(startedAt: number) {
  return Date.now() - startedAt;
}

function finalizeRequest(
  requestId: string,
  startedAt: number,
  status: number,
  context: Record<string, unknown> = {},
) {
  const elapsed = durationMs(startedAt);
  const isServerError = status >= 500;

  recordRouteMetric(TTS_ROUTE, elapsed, isServerError);
  logEvent(isServerError ? "error" : "info", status >= 400 ? "tts.request.error" : "tts.request.success", {
    route: TTS_ROUTE,
    requestId,
    durationMs: elapsed,
    status,
    ...context,
  });
}

function jsonError(requestId: string, error: string, status: number) {
  return NextResponse.json(
    { error, requestId },
    {
      status,
      headers: { "X-Request-Id": requestId },
    },
  );
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = createRequestId(req.headers);

  logEvent("info", "request.start", {
    route: TTS_ROUTE,
    requestId,
  });

  try {
    const user = await getSessionUser();
    if (user.roles[0] === "ANONYMOUS") {
      finalizeRequest(requestId, startedAt, 403, { outcome: "auth_required" });
      return jsonError(requestId, "Audio generation requires authentication", 403);
    }

    const raw = await req.json();
    const parseResult = TtsRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      finalizeRequest(requestId, startedAt, 400, { outcome: "validation_failed" });
      return jsonError(requestId, "Text is required for audio generation.", 400);
    }
    const { text, conversationId } = parseResult.data;

    const repo = getUserFileDataMapper();
    const ufs = new UserFileSystem(repo);

    // Check cache — return stored file if it exists
    const cached = await ufs.lookup(user.id, text, "audio");
    if (cached) {
      const data = await readFile(cached.diskPath);
      finalizeRequest(requestId, startedAt, 200, {
        outcome: "cache_hit",
        userFileId: cached.file.id,
        bytes: data.length,
      });
      return new NextResponse(data, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(data.length),
          "Cache-Control": "private, max-age=86400, immutable",
          "X-User-File-Id": cached.file.id,
          "X-Request-Id": requestId,
        },
      });
    }

    // --- OpenAI TTS (default) — generate, cache, and return ---
    try {
      assertProviderBackedToolAvailable("generate_audio");
    } catch (error) {
      if (isProviderCapabilityUnavailableError(error)) {
        finalizeRequest(requestId, startedAt, 503, {
          outcome: error.availability.state,
          capabilitySlot: error.availability.slot,
          capabilityProvider: error.availability.provider,
        });
        return jsonError(requestId, error.message, 503);
      }
      throw error;
    }

    let openaiApiKey: string;
    try {
      openaiApiKey = getOpenaiApiKey();
    } catch {
      finalizeRequest(requestId, startedAt, 500, { outcome: "missing_openai_key" });
      return jsonError(requestId, "No OPENAI_API_KEY configured. Add it to .env.local to enable TTS.", 500);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS);

    const ttsModel = "tts-1";
    const providerStartedAt = Date.now();
    emitProviderEvent({
      kind: "attempt_start",
      provider: "openai",
      surface: "tts",
      model: ttsModel,
      attempt: 1,
    });

    let oaResponse: Response;
    try {
      oaResponse = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ttsModel,
          input: text,
          voice: "alloy",
          response_format: "mp3",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!oaResponse.ok) {
      const _oaError = await oaResponse.text();
      emitProviderEvent({
        kind: "attempt_failure",
        provider: "openai",
        surface: "tts",
        model: ttsModel,
        attempt: 1,
        durationMs: Date.now() - providerStartedAt,
        error: `OpenAI TTS returned ${oaResponse.status}`,
        errorClassification: "transient",
      });
      logFailure(REASON_CODES.TTS_PROVIDER_FAILED, "OpenAI TTS failed", {
        route: TTS_ROUTE,
        requestId,
        status: oaResponse.status,
      });
      finalizeRequest(requestId, startedAt, 502, {
        outcome: "provider_failed",
        providerStatus: oaResponse.status,
      });
      return jsonError(requestId, "OpenAI TTS failed to generate audio.", 502);
    }

    emitProviderEvent({
      kind: "attempt_success",
      provider: "openai",
      surface: "tts",
      model: ttsModel,
      attempt: 1,
      durationMs: Date.now() - providerStartedAt,
    });

    // Buffer the full response with size guard
    const arrayBuffer = await oaResponse.arrayBuffer();
    if (arrayBuffer.byteLength > TTS_MAX_RESPONSE_BYTES) {
      logFailure(REASON_CODES.TTS_PROVIDER_FAILED, "TTS response exceeded size limit", {
        route: TTS_ROUTE,
        requestId,
        bytes: arrayBuffer.byteLength,
        limit: TTS_MAX_RESPONSE_BYTES,
      });
      finalizeRequest(requestId, startedAt, 502, {
        outcome: "provider_response_too_large",
        bytes: arrayBuffer.byteLength,
        limit: TTS_MAX_RESPONSE_BYTES,
      });
      return jsonError(requestId, "TTS response too large.", 502);
    }
    const audioBuffer = Buffer.from(arrayBuffer);

    // Store in user filesystem
    const userFile = await ufs.store({
      userId: user.id,
      conversationId: conversationId ?? null,
      input: text,
      fileType: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: audioBuffer,
      metadata: {
        assetKind: "audio",
        source: "generated",
        retentionClass: conversationId ? "conversation" : "ephemeral",
        durationSeconds: estimateAudioDurationSeconds(text),
      },
    });

    finalizeRequest(requestId, startedAt, 200, {
      outcome: "generated",
      userFileId: userFile.id,
      bytes: audioBuffer.length,
    });

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-User-File-Id": userFile.id,
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logFailure(REASON_CODES.TTS_TIMEOUT, "TTS request timed out", {
        route: TTS_ROUTE,
        requestId,
      });
      finalizeRequest(requestId, startedAt, 504, { outcome: "timeout" });
      return jsonError(requestId, "TTS request timed out", 504);
    }
    logFailure(REASON_CODES.UNKNOWN_ROUTE_ERROR, "TTS route error", {
      route: TTS_ROUTE,
      requestId,
    }, error);
    finalizeRequest(requestId, startedAt, 500, { outcome: "unexpected_error" });
    return jsonError(requestId, "Internal server error during audio generation.", 500);
  }
}
