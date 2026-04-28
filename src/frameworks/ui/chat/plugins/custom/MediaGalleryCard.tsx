"use client";

import React from "react";
import type { ToolRenderEntry } from "@/adapters/ChatPresenter";
import { captureFirstFrame } from "./captureFirstFrame";
import { MediaRenderCard } from "./MediaRenderCard";

type MediaGalleryEntry = Extract<ToolRenderEntry, { kind: "tool-call" }> & {
  resultEnvelope: NonNullable<Extract<ToolRenderEntry, { kind: "tool-call" }>["resultEnvelope"]>;
};

export function MediaGalleryCard({ entries }: { entries: MediaGalleryEntry[] }) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [posterFrames, setPosterFrames] = React.useState<Record<string, string | null>>({});
  const safeIndex = Math.min(selectedIndex, entries.length - 1);
  const selectedEntry = entries[safeIndex];
  const title = selectedEntry?.resultEnvelope.summary.title ?? selectedEntry?.name ?? "Media Composition";

  React.useEffect(() => {
    let cancelled = false;

    const posterCandidates = entries
      .map((entry) => {
        const artifact = entry.resultEnvelope.artifacts?.find((item) => item.kind === "video");
        const href = artifact?.uri ?? (artifact?.assetId ? `/api/user-files/${artifact.assetId}` : null);

        return href ? { key: href, href } : null;
      })
      .filter((candidate): candidate is { key: string; href: string } => candidate !== null)
      .filter((candidate) => !(candidate.key in posterFrames));

    if (posterCandidates.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      posterCandidates.map(async ({ key, href }) => ({ key, poster: await captureFirstFrame(href) })),
    ).then((resolvedPosters) => {
      const posterUpdates = resolvedPosters.filter((item) => item.poster);

      if (cancelled || posterUpdates.length === 0) {
        return;
      }

      setPosterFrames((current) => {
        const next = { ...current };
        for (const { key, poster } of posterUpdates) {
          if (!(key in next)) {
            next[key] = poster;
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [entries, posterFrames]);

  if (entries.length === 0 || !selectedEntry) {
    return null;
  }

  const selectedArtifact = selectedEntry.resultEnvelope.artifacts?.find((item) => item.kind === "video");
  const selectedHref = selectedArtifact?.uri ?? (selectedArtifact?.assetId ? `/api/user-files/${selectedArtifact.assetId}` : null);
  const selectedPoster = selectedHref ? posterFrames[selectedHref] ?? null : null;

  return (
    <section
      aria-label={`${title} gallery`}
      className="flex flex-col gap-(--space-3) rounded-xl border border-border/50 bg-surface-elevated/90 p-(--space-3)"
      data-capability-tone="media"
      data-media-gallery-card="true"
    >
      <div className="flex items-center justify-between gap-(--space-3)">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/56">Media gallery</p>
          <h3 className="text-sm font-semibold text-foreground">{title} · {entries.length} items</h3>
        </div>
        <p className="text-xs text-foreground/56">Select an item to preview</p>
      </div>

      <div className="flex gap-(--space-2) overflow-x-auto pb-(--space-1)" role="list" aria-label="Media gallery thumbnails">
        {entries.map((entry, index) => {
          const artifact = entry.resultEnvelope.artifacts?.find((item) => item.kind === "video");
          const href = artifact?.uri ?? (artifact?.assetId ? `/api/user-files/${artifact.assetId}` : null);
          const itemLabel = artifact?.label ?? entry.resultEnvelope.summary.title ?? `Media item ${index + 1}`;
          const isSelected = safeIndex === index;
          const poster = href ? posterFrames[href] ?? null : null;

          return (
            <div key={`${artifact?.assetId ?? entry.name}-${index}`} role="listitem">
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`Preview ${itemLabel}`}
                onClick={() => setSelectedIndex(index)}
                className={`min-w-28 rounded-lg border px-(--space-3) py-(--space-2) text-left transition-colors focus-ring ${isSelected ? "border-accent-interactive/40 bg-accent-interactive/10 text-foreground" : "border-border/50 bg-surface-muted/60 text-foreground/70 hover:bg-surface-muted"}`}
              >
                <div className="aspect-video overflow-hidden rounded-md bg-linear-to-br from-brand/12 via-surface-muted/80 to-surface/90" aria-hidden="true">
                  {poster ? (
                    <img src={poster} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-brand/15 via-surface-muted/75 to-surface text-sm font-semibold uppercase tracking-[0.18em] text-foreground/64">
                      <span>Media</span>
                    </div>
                  )}
                </div>
                <p className="mt-(--space-2) text-xs font-semibold leading-tight">{itemLabel}</p>
              </button>
            </div>
          );
        })}
      </div>

      <MediaRenderCard envelope={selectedEntry.resultEnvelope} posterUrl={selectedPoster} />
    </section>
  );
}