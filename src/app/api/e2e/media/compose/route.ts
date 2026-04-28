import { NextResponse } from "next/server";

import type { MediaCompositionClip, MediaCompositionPlan } from "@/core/entities/media-composition";
import { getSessionUser } from "@/lib/auth";
import {
  InvalidComposeMediaAssetReadinessError,
  executeComposeMediaRemotely,
} from "@/lib/media/server/compose-media-worker-runtime";

const HARNESS_ENABLED = process.env.ORDO_ENABLE_MEDIA_E2E_HARNESS === "1";

function parseClipArray(value: unknown): MediaCompositionClip[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const clips: MediaCompositionClip[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const clip = entry as Record<string, unknown>;
    const assetId = typeof clip.assetId === "string" ? clip.assetId.trim() : "";
    const kind = typeof clip.kind === "string" ? clip.kind : "";
    const sourceAssetId = typeof clip.sourceAssetId === "string" ? clip.sourceAssetId.trim() : undefined;
    const startTime = typeof clip.startTime === "number" ? clip.startTime : undefined;
    const duration = typeof clip.duration === "number" ? clip.duration : undefined;

    if (!assetId || !["image", "video", "audio", "chart", "graph"].includes(kind)) {
      return null;
    }

    clips.push({
      assetId,
      kind: kind as MediaCompositionClip["kind"],
      ...(sourceAssetId ? { sourceAssetId } : {}),
      ...(typeof startTime === "number" ? { startTime } : {}),
      ...(typeof duration === "number" ? { duration } : {}),
    });
  }

  return clips;
}

function parsePlan(value: unknown): MediaCompositionPlan | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const plan = value as Record<string, unknown>;
  const id = typeof plan.id === "string" ? plan.id.trim() : "";
  const conversationId = typeof plan.conversationId === "string" ? plan.conversationId.trim() : "";
  const visualClips = parseClipArray(plan.visualClips);
  const audioClips = parseClipArray(plan.audioClips);
  const subtitlePolicy = plan.subtitlePolicy;
  const waveformPolicy = plan.waveformPolicy;
  const outputFormat = plan.outputFormat;
  const profile = plan.profile;
  const resolution = plan.resolution;

  if (!id || !conversationId || !visualClips || !audioClips) {
    return null;
  }

  if (!["none", "burned", "sidecar", "both"].includes(String(subtitlePolicy))) {
    return null;
  }

  if (!["none", "generate"].includes(String(waveformPolicy))) {
    return null;
  }

  if (outputFormat !== "mp4" && outputFormat !== "webm") {
    return null;
  }

  let parsedResolution: MediaCompositionPlan["resolution"];
  if (resolution !== undefined) {
    if (!resolution || typeof resolution !== "object") {
      return null;
    }

    const width = (resolution as Record<string, unknown>).width;
    const height = (resolution as Record<string, unknown>).height;
    if (typeof width !== "number" || typeof height !== "number") {
      return null;
    }

    parsedResolution = { width, height };
  }

  return {
    id,
    conversationId,
    visualClips,
    audioClips,
    subtitlePolicy: subtitlePolicy as MediaCompositionPlan["subtitlePolicy"],
    waveformPolicy: waveformPolicy as MediaCompositionPlan["waveformPolicy"],
    outputFormat,
    ...(profile === "auto" || profile === "still_image_narration_fast" || profile === "multi_video_standard"
      ? { profile }
      : {}),
    ...(parsedResolution ? { resolution: parsedResolution } : {}),
  };
}

export async function POST(request: Request) {
  if (!HARNESS_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getSessionUser();
  if (user.roles[0] === "ANONYMOUS") {
    return NextResponse.json({ error: "Authentication required." }, { status: 403 });
  }

  try {
    const body = await request.json() as { plan?: unknown };
    const plan = parsePlan(body.plan);

    if (!plan) {
      return NextResponse.json({ error: "A valid media composition plan is required." }, { status: 400 });
    }

    const envelope = await executeComposeMediaRemotely({
      plan,
      userId: user.id,
      conversationId: null,
    });

    const artifact = envelope.artifacts?.[0];
    if (!artifact?.assetId || !artifact.uri) {
      return NextResponse.json({ error: "Compose completed without a persisted artifact." }, { status: 500 });
    }

    return NextResponse.json({
      assetId: artifact.assetId,
      uri: artifact.uri,
      mimeType: artifact.mimeType,
      route: typeof envelope.replaySnapshot?.route === "string" ? envelope.replaySnapshot.route : "deferred_remote",
    });
  } catch (error) {
    if (error instanceof InvalidComposeMediaAssetReadinessError) {
      return NextResponse.json({ error: error.message, failureCode: error.failureCode }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to compose media." },
      { status: 500 },
    );
  }
}