import React from "react";
import type { CapabilityResultEnvelope, CapabilityArtifactRef } from "@/core/entities/capability-result";

interface MediaRenderCardProps {
  envelope: CapabilityResultEnvelope;
  posterUrl?: string | null;
}

function RouteLabel({ mode }: { mode: CapabilityResultEnvelope["executionMode"] }) {
  const label = mode === "browser" ? "WASM" : mode === "hybrid" ? "HYBRID" : "SERVER";
  const style =
    mode === "browser" || mode === "hybrid"
      ? "bg-brand/10 text-brand"
      : "bg-surface-muted text-text-secondary";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${style}`}>
      {label}
    </span>
  );
}

function resolveVideoDimensions(envelope: CapabilityResultEnvelope, artifact?: CapabilityArtifactRef): { width: number; height: number } | null {
  if (typeof artifact?.width === "number" && typeof artifact?.height === "number") {
    return { width: artifact.width, height: artifact.height };
  }

  const replayResolution = (envelope.replaySnapshot as { resolution?: { width?: unknown; height?: unknown } } | null)?.resolution;
  if (typeof replayResolution?.width === "number" && typeof replayResolution?.height === "number") {
    return { width: replayResolution.width, height: replayResolution.height };
  }

  const inputResolution = (envelope.inputSnapshot as { resolution?: { width?: unknown; height?: unknown } } | null)?.resolution;
  if (typeof inputResolution?.width === "number" && typeof inputResolution?.height === "number") {
    return { width: inputResolution.width, height: inputResolution.height };
  }

  return null;
}

function formatResolutionLabel(dimensions: { width: number; height: number } | null): string | null {
  if (!dimensions) {
    return null;
  }

  const orientation = dimensions.height > dimensions.width ? "Portrait" : dimensions.width > dimensions.height ? "Landscape" : "Square";
  return `${dimensions.width}x${dimensions.height} · ${orientation}`;
}

function VideoArtifactRow({
  artifact,
  dimensions,
  progressLabel,
  posterUrl,
}: {
  artifact: CapabilityArtifactRef;
  dimensions: { width: number; height: number } | null;
  progressLabel?: string;
  posterUrl?: string | null;
}) {
  const label = artifact.label || artifact.kind;
  const href = artifact.uri ?? (artifact.assetId ? `/api/user-files/${artifact.assetId}` : null);
  const isPortrait = Boolean(dimensions && dimensions.height > dimensions.width);
  const aspectRatio = dimensions ? `${dimensions.width} / ${dimensions.height}` : undefined;
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setIsReady(false);
  }, [href]);

  if (!href) {
    return null;
  }

  return (
    <div className={`mt-2 ${isPortrait ? "mx-auto w-full max-w-56 sm:max-w-64" : "w-full"}`}>
      <div className="relative overflow-hidden rounded-lg bg-black/80">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          controls={isReady}
          src={href}
          poster={posterUrl ?? undefined}
          className={`w-full bg-black/80 object-contain transition-opacity duration-300 ${isReady ? "opacity-100" : "opacity-0"}`}
          preload="auto"
          aria-label={label}
          style={aspectRatio ? { aspectRatio } : undefined}
          onLoadedData={() => setIsReady(true)}
          onCanPlay={() => setIsReady(true)}
        />
        {!isReady && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/90 px-4 text-center"
            style={aspectRatio ? { aspectRatio } : undefined}
          >
            <span className="text-white/70 text-xs tracking-widest uppercase font-bold">
              {progressLabel ?? "Preparing playback..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: CapabilityArtifactRef }) {
  const label = artifact.label || artifact.kind;
  const href = artifact.uri ?? (artifact.assetId ? `/api/user-files/${artifact.assetId}` : null);

  return (
    <div className="flex items-center justify-between mt-1 text-[11px]">
      <span className="text-text-secondary truncate pr-4">{label}</span>
      {href && (
        <a
          href={href}
          download
          className="text-brand hover:underline whitespace-nowrap"
          aria-label={`Download ${label}`}
        >
          Download
        </a>
      )}
    </div>
  );
}

export function MediaRenderCard({ envelope, posterUrl }: MediaRenderCardProps) {
  const isTerminalFailure =
    envelope.summary.statusLine === "failed" ||
    envelope.summary.statusLine === "canceled";

  if (isTerminalFailure) {
    return (
      <div
        className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl"
        role="alert"
        aria-label="Media composition failed"
      >
        <h4 className="text-red-600 font-semibold text-sm">Media Composition Failed</h4>
        <p className="text-xs text-red-500 mt-1">
          {envelope.summary.message ?? envelope.summary.statusLine ?? "An error occurred."}
        </p>
        {envelope.replaySnapshot?.route != null && (
          <p className="text-[10px] text-red-400 mt-0.5">
            Route: {String(envelope.replaySnapshot.route)}
          </p>
        )}
      </div>
    );
  }

  const artifacts = envelope.artifacts ?? [];
  const primaryVideo = artifacts.find((a) => a.kind === "video");
  const auxiliaryArtifacts = artifacts.filter((a) => a.kind !== "video");
  const videoDimensions = resolveVideoDimensions(envelope, primaryVideo);
  const resolutionLabel = formatResolutionLabel(videoDimensions);
  const isPortrait = Boolean(videoDimensions && videoDimensions.height > videoDimensions.width);

  return (
    <div
      className={`bg-surface-elevated border border-border/50 rounded-xl overflow-hidden pt-4 px-4 pb-3 w-full flex flex-col gap-2 ${isPortrait ? "max-w-88" : "max-w-sm"}`}
      aria-label="Media render result"
    >
      {/* Header */}
      <div className="flex items-center justify-between opacity-80">
        <span className="text-xs uppercase tracking-wider font-semibold">
          {envelope.summary.title ?? "Render Result"}
        </span>
        <RouteLabel mode={envelope.executionMode} />
      </div>

      {/* Subtitle / status line */}
      {envelope.summary.subtitle && (
        <p className="text-[11px] text-text-secondary">{envelope.summary.subtitle}</p>
      )}

      {resolutionLabel && (
        <p className="text-[11px] text-text-secondary/80">{resolutionLabel}</p>
      )}

      {/* Primary video output */}
      {primaryVideo ? (
        <VideoArtifactRow
          artifact={primaryVideo}
          dimensions={videoDimensions}
          progressLabel={envelope.progress?.label ?? undefined}
          posterUrl={posterUrl}
        />
      ) : (
        /* Placeholder when artifact not yet available (in-progress or pruned) */
        <div
          className={`bg-black/80 rounded-lg flex items-center justify-center relative overflow-hidden group ${isPortrait ? "mx-auto w-full max-w-56 sm:max-w-64" : "aspect-video"}`}
          style={videoDimensions ? { aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` } : undefined}
        >
          <span className="text-white/30 text-xs tracking-widest uppercase z-10 font-bold group-hover:scale-110 transition-transform duration-300">
            {envelope.progress?.label ?? "Processing…"}
          </span>
          <div className="absolute inset-0 bg-linear-to-t from-brand/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Auxiliary artifacts (subtitle, waveform, etc.) */}
      {auxiliaryArtifacts.length > 0 && (
        <div className="border-t border-border/30 pt-2 flex flex-col gap-1">
          {auxiliaryArtifacts.map((artifact, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable render order
            <ArtifactRow key={i} artifact={artifact} />
          ))}
        </div>
      )}

      {/* Footer: asset ID for debugging / honest history */}
      {primaryVideo?.assetId && (
        <p className="text-[10px] text-text-secondary/50 mt-0.5 truncate">
          ID: {primaryVideo.assetId}
        </p>
      )}
    </div>
  );
}
