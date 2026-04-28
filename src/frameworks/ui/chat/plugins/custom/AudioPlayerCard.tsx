"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { CapabilityArtifactRef } from "@/core/entities/capability-result";
import type { ToolPluginProps } from "../../registry/types";
import { resolveCapabilityDisplayLabel } from "../../registry/capability-presentation-registry";
import { resolveCanonicalMediaAssetId } from "@/lib/media/media-asset-id";
import { CapabilityActionRail } from "../../primitives/CapabilityActionRail";
import { CapabilityCardHeader } from "../../primitives/CapabilityCardHeader";
import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import { CapabilityContextPanel } from "../../primitives/CapabilityContextPanel";
import { CapabilityMetricStrip } from "../../primitives/CapabilityMetricStrip";
import { JobStatusFallbackCard } from "../system/JobStatusFallbackCard";

const AudioPlayer = dynamic(
  () => import("@/components/AudioPlayer").then((mod) => mod.AudioPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="h-18 w-full max-w-sm flex items-center justify-center text-xs opacity-50 animate-pulse bg-surface-muted rounded-theme border-theme my-(--space-2)">
        Loading Audio Engine...
      </div>
    ),
  },
);

type GenerateAudioResultPayload = {
  action: "generate_audio";
  title: string;
  text: string;
  assetId?: string | null;
  provider?: string;
  generationStatus?: string;
  estimatedDurationSeconds?: number;
  estimatedGenerationSeconds?: number;
};

function isGenerateAudioResultPayload(value: unknown): value is GenerateAudioResultPayload {
  return (
    typeof value === "object"
    && value !== null
    && (value as { action?: unknown }).action === "generate_audio"
    && typeof (value as { text?: unknown }).text === "string"
    && typeof (value as { title?: unknown }).title === "string"
  );
}

function humanizeToken(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function findAudioArtifact(artifacts: CapabilityArtifactRef[] | undefined): CapabilityArtifactRef | undefined {
  return artifacts?.find((artifact) => artifact.kind === "audio");
}

function resolveAudioData(
  result: unknown,
  toolArgs: Record<string, unknown> | undefined,
  artifact: CapabilityArtifactRef | undefined,
): GenerateAudioResultPayload | null {
  if (isGenerateAudioResultPayload(result)) {
    return {
      ...result,
      assetId: result.assetId ?? artifact?.assetId ?? null,
      generationStatus: result.generationStatus ?? (artifact?.assetId ? "cached_asset" : undefined),
    };
  }

  if (
    typeof toolArgs?.text === "string"
    && toolArgs.text.trim().length > 0
    && typeof toolArgs.title === "string"
    && toolArgs.title.trim().length > 0
  ) {
    // Validate assetId from args before using it
    const validatedAssetId = typeof toolArgs.assetId === "string" 
      ? resolveCanonicalMediaAssetId(toolArgs.assetId)
      : null;
    
    return {
      action: "generate_audio",
      text: toolArgs.text,
      title: toolArgs.title,
      assetId: validatedAssetId ?? artifact?.assetId ?? null,
      generationStatus: artifact?.assetId ? "cached_asset" : undefined,
    };
  }

  return null;
}

function resolveStatusLabel(props: ToolPluginProps, audio: GenerateAudioResultPayload | null): string {
  const { part, resultEnvelope } = props;

  const hasDurableAudioAsset = Boolean(audio?.assetId)
    || part?.lifecyclePhase === "durable_asset_available";

  if (hasDurableAudioAsset) {
    return "Ready";
  }

  switch (part?.status) {
    case "queued":
      return "Queued";
    case "running":
      return "Generating";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
  }

  switch (part?.lifecyclePhase) {
    case "pending_local_generation":
      return "Generating";
    case "durable_asset_available":
      return "Ready";
    case "generation_failed_terminal":
    case "compose_failed_terminal":
      return "Failed";
  }

  if (audio?.generationStatus === "client_fetch_pending") {
    return "Generating";
  }

  if (audio?.generationStatus === "cached_asset" || audio?.assetId) {
    return "Ready";
  }

  return resultEnvelope?.summary.statusLine
    ? humanizeToken(resultEnvelope.summary.statusLine)
    : "Ready";
}

export const AudioPlayerCard: React.FC<ToolPluginProps> = (props) => {
  const { toolCall, resultEnvelope, part, computedActions = [], onActionClick, isStreaming } = props;

  const label = resolveCapabilityDisplayLabel({
    toolName: toolCall?.name ?? part?.toolName ?? "generate_audio",
    explicitLabel: part?.label,
    descriptorLabel: props.descriptor?.label,
    fallbackLabel: "Audio",
  });

  const result = resultEnvelope?.payload ?? toolCall?.result;
  const audioArtifact = findAudioArtifact(resultEnvelope?.artifacts);
  const audio = resolveAudioData(result, toolCall?.args, audioArtifact);
  const hasDurableAudioAsset = Boolean(audio?.assetId ?? audioArtifact?.assetId)
    || part?.lifecyclePhase === "durable_asset_available";
  const statusLabel = resolveStatusLabel(props, audio);
  const failureMessage = part?.error ?? part?.summary ?? resultEnvelope?.summary.message ?? "Audio generation did not complete.";
  const isTerminalFailure = (part?.status === "failed" || part?.status === "canceled") && !hasDurableAudioAsset;

  if (isTerminalFailure) {
    return (
      <CapabilityCardShell
        descriptor={props.descriptor}
        state={part?.status}
        role="alert"
        ariaLabel={`${label} result`}
      >
        <CapabilityCardHeader
          eyebrow={label}
          title={audio?.title ?? part?.title ?? resultEnvelope?.summary.title ?? "Audio"}
          statusLabel={statusLabel}
        />
        <p className="px-(--space-inset-compact) text-sm text-red-600">{failureMessage}</p>
        <CapabilityContextPanel
          items={[
            { label: "Failure stage", value: part?.failureStage ? humanizeToken(part.failureStage) : null },
            { label: "Failure code", value: part?.failureCode ?? null },
            { label: "Lifecycle", value: part?.lifecyclePhase ? humanizeToken(part.lifecyclePhase) : null },
            { label: "Asset id", value: audio?.assetId ?? audioArtifact?.assetId ?? null },
          ]}
        />
        <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
      </CapabilityCardShell>
    );
  }

  if (audio) {
    return (
      <CapabilityCardShell
        descriptor={props.descriptor}
        state={part?.status ?? "succeeded"}
        ariaLabel={`${label} result`}
      >
        <CapabilityCardHeader eyebrow={label} statusLabel={statusLabel} />
        <CapabilityMetricStrip
          items={[
            { label: "Duration", value: typeof audio.estimatedDurationSeconds === "number" ? `${Math.round(audio.estimatedDurationSeconds)}s` : null },
            { label: "Generation", value: typeof audio.estimatedGenerationSeconds === "number" ? `${Math.round(audio.estimatedGenerationSeconds)}s` : null },
          ]}
        />
        <CapabilityContextPanel
          items={[
            { label: "Provider", value: audio.provider ?? null },
            { label: "Generation status", value: audio.generationStatus ? humanizeToken(audio.generationStatus) : null },
            { label: "Lifecycle", value: part?.lifecyclePhase ? humanizeToken(part.lifecyclePhase) : null },
            { label: "Asset id", value: audio.assetId ?? audioArtifact?.assetId ?? null },
          ]}
        />
        <AudioPlayer
          text={audio.text}
          title={audio.title}
          assetId={audio.assetId ?? audioArtifact?.assetId ?? undefined}
          provider={audio.provider}
          generationStatus={audio.generationStatus}
          estimatedDurationSeconds={audio.estimatedDurationSeconds}
          estimatedGenerationSeconds={audio.estimatedGenerationSeconds}
          autoPlay={part ? false : isStreaming && !part}
        />
        <CapabilityActionRail actions={computedActions} onActionClick={onActionClick} />
      </CapabilityCardShell>
    );
  }

  return <JobStatusFallbackCard {...props} />;
};
