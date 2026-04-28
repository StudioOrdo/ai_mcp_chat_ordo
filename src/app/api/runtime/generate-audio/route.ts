import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  getInternalRuntimeServiceToken,
} from "@/lib/config/env";
import {
  buildGenerateAudioRuntimePayload,
  generateStoredAudioArtifact,
} from "@/lib/audio/audio-generation-service";
import { resolveCanonicalMediaAssetId } from "@/lib/media/media-asset-id";
import { logFailure } from "@/lib/observability/logger";
import { REASON_CODES } from "@/lib/observability/reason-codes";

type RuntimeExecutionContext = {
  userId?: string;
  role?: string;
  conversationId?: string;
  toolInvocationId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function readExecutionContext(value: unknown): RuntimeExecutionContext | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    userId: typeof value.userId === "string" ? value.userId : undefined,
    role: typeof value.role === "string" ? value.role : undefined,
    conversationId: typeof value.conversationId === "string" ? value.conversationId : undefined,
    toolInvocationId: typeof value.toolInvocationId === "string" ? value.toolInvocationId : undefined,
  };
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null) as unknown;
  if (!isRecord(raw) || typeof raw.text !== "string" || raw.text.trim().length === 0 || typeof raw.title !== "string" || raw.title.trim().length === 0) {
    return jsonError("Text and title are required for audio generation.", 400);
  }

  const suppliedToken = req.headers.get("x-ordo-runtime-token");
  const trustedInternalCall = suppliedToken === getInternalRuntimeServiceToken();
  const executionContext = readExecutionContext(raw.__executionContext);

  let userId: string | undefined;
  let conversationId: string | null = typeof raw.conversationId === "string" ? raw.conversationId : null;

  if (trustedInternalCall && executionContext?.userId) {
    userId = executionContext.userId;
    conversationId = executionContext.conversationId ?? conversationId;
  } else {
    const user = await getSessionUser();
    if (user.roles[0] === "ANONYMOUS") {
      return jsonError("Audio generation requires authentication", 403);
    }
    userId = user.id;
  }

  const canonicalAssetId = typeof raw.assetId === "string"
    ? resolveCanonicalMediaAssetId(raw.assetId)
    : null;

  if (canonicalAssetId) {
    return NextResponse.json(
      buildGenerateAudioRuntimePayload({
        title: raw.title,
        text: raw.text,
        assetId: canonicalAssetId,
        toolInvocationId: executionContext?.toolInvocationId,
      }),
      { status: 200 },
    );
  }

  try {
    const resolved = await generateStoredAudioArtifact({
      userId,
      text: raw.text,
      conversationId,
      toolInvocationId: executionContext?.toolInvocationId,
    });

    return NextResponse.json(
      buildGenerateAudioRuntimePayload(
        {
          title: raw.title,
          text: raw.text,
          toolInvocationId: executionContext?.toolInvocationId,
        },
        resolved,
      ),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logFailure(REASON_CODES.TTS_TIMEOUT, "TTS request timed out", {
        route: "/api/runtime/generate-audio",
      });
      return jsonError("TTS request timed out", 504);
    }

    logFailure(REASON_CODES.TTS_PROVIDER_FAILED, "Audio generation failed", {
      route: "/api/runtime/generate-audio",
    }, error);
    return jsonError(
      error instanceof Error ? error.message : "Internal server error during audio generation.",
      500,
    );
  }
}