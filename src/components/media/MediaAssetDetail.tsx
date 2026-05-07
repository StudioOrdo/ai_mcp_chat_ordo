"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";

import type { GraphSpec } from "@/core/entities/rich-content";
import type { UserMediaItem } from "@/lib/media/user-media";
import { formatStableDateTimeOrValue } from "@/lib/format/stable-date";

const MermaidRenderer = dynamic(
  () => import("@/components/MermaidRenderer").then((mod) => mod.MermaidRenderer),
  { ssr: false },
);

const GraphRenderer = dynamic(
  () => import("@/components/GraphRenderer").then((mod) => mod.GraphRenderer),
  { ssr: false },
);

export interface MediaRelatedLink {
  id: string;
  label: string;
  href?: string;
}

interface MediaAssetDetailProps {
  item: UserMediaItem;
  relatedLinks?: readonly MediaRelatedLink[];
  onDeleted?: () => void;
  showSectionChrome?: boolean;
}

export function formatMediaBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function formatMediaDate(value: string): string {
  return formatStableDateTimeOrValue(value);
}

export function formatMediaDuration(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatMediaPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function mediaAttachmentLabel(item: UserMediaItem): string {
  return item.conversationId ? "Attached" : "Unattached";
}

function DataAssetPreview({ item }: { item: UserMediaItem }) {
  const [state, setState] = useState<{
    previewUrl: string;
    data: string | null;
    error: string | null;
    loading: boolean;
  }>({
    previewUrl: item.previewUrl,
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    fetch(item.previewUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load asset data");
        }
        return res.text();
      })
      .then((text) => {
        if (active) {
          setState({ previewUrl: item.previewUrl, data: text, error: null, loading: false });
        }
      })
      .catch((err) => {
        if (active) {
          setState({
            previewUrl: item.previewUrl,
            data: null,
            error: err instanceof Error ? err.message : "Failed to load asset data",
            loading: false,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [item.previewUrl]);

  const loading = state.previewUrl !== item.previewUrl || state.loading;
  const data = state.previewUrl === item.previewUrl ? state.data : null;
  const error = state.previewUrl === item.previewUrl ? state.error : null;

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-surface-muted p-(--space-6) text-center text-sm text-foreground/50">
        Loading asset data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-(--space-4) text-sm text-red-700">
        Error loading asset: {error}
      </div>
    );
  }

  if (item.fileType === "chart" || item.mimeType === "text/vnd.mermaid") {
    return (
      <div className="rounded-lg border border-border/60 bg-white p-(--space-4) dark:bg-black">
        <MermaidRenderer code={data} />
      </div>
    );
  }

  if (item.fileType === "graph" || item.mimeType === "application/json") {
    let graph: GraphSpec;
    try {
      const graphData = JSON.parse(data);
      graph = (graphData.graph ? graphData.graph : graphData) as GraphSpec;
    } catch {
      return (
        <div className="rounded-lg border border-red-500/20 p-(--space-4) text-sm text-red-700">
          Invalid graph JSON
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border/60 bg-white p-(--space-4) dark:bg-black">
        <GraphRenderer graph={graph} />
      </div>
    );
  }

  if (item.fileType === "document" || item.mimeType.startsWith("text/")) {
    return (
      <div className="max-h-96 overflow-auto rounded-lg border border-border/60 bg-surface-muted p-(--space-4)">
        <pre className="whitespace-pre-wrap font-mono text-xs text-foreground/80">
          {data}
        </pre>
      </div>
    );
  }

  return null;
}

export function MediaPreviewPane({ item }: { item: UserMediaItem }) {
  if (item.fileType === "image") {
    return (
      <Image
        src={item.previewUrl}
        alt={item.fileName}
        width={item.width ?? 1200}
        height={item.height ?? 800}
        unoptimized
        className="max-h-64 w-full rounded-lg bg-black/5 object-contain"
      />
    );
  }

  if (item.fileType === "video") {
    return (
      <video
        controls
        src={item.previewUrl}
        className="max-h-64 w-full rounded-lg bg-black"
        preload="metadata"
      />
    );
  }

  if (item.fileType === "audio") {
    return <audio controls src={item.previewUrl} className="w-full" preload="metadata" />;
  }

  if (item.fileType === "chart" || item.fileType === "graph" || item.fileType === "document") {
    return <DataAssetPreview item={item} />;
  }

  return (
    <a
      href={item.previewUrl}
      target="_blank"
      rel="noreferrer"
      className="focus-ring inline-flex min-h-10 w-fit items-center justify-center rounded-full border border-border/70 px-(--space-4) text-sm font-medium text-foreground transition hover:bg-foreground/5"
    >
      Open asset preview
    </a>
  );
}

function MediaDeleteControl({
  item,
  onDeleted,
}: {
  item: UserMediaItem;
  onDeleted?: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!item.canDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(item.previewUrl, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to delete this asset right now.");
      }

      onDeleted?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete this asset right now.");
      setIsDeleting(false);
      return;
    }

    setIsDeleting(false);
  }

  if (!item.canDelete) {
    return <div className="text-xs text-foreground/55">Attached media is locked.</div>;
  }

  return (
    <div className="flex flex-col items-start gap-(--space-2)">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="focus-ring rounded-full border border-red-500/35 px-(--space-4) py-(--space-2) text-sm font-medium text-red-700 transition hover:bg-red-500/8 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Deleting..." : "Delete asset"}
      </button>
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}

export function MediaAssetFacts({ item }: { item: UserMediaItem }) {
  return (
    <dl className="grid gap-(--space-3) rounded-lg border border-border/50 bg-background/68 p-(--space-4) sm:grid-cols-2">
      <div>
        <dt className="theme-label tier-micro uppercase text-foreground/42">Created</dt>
        <dd className="mt-(--space-1) text-sm text-foreground">{formatMediaDate(item.createdAt)}</dd>
      </div>
      <div>
        <dt className="theme-label tier-micro uppercase text-foreground/42">Size</dt>
        <dd className="mt-(--space-1) text-sm text-foreground">{formatMediaBytes(item.fileSize)}</dd>
      </div>
      <div>
        <dt className="theme-label tier-micro uppercase text-foreground/42">Dimensions</dt>
        <dd className="mt-(--space-1) text-sm text-foreground">
          {item.width && item.height ? `${item.width}x${item.height}` : "Not available"}
        </dd>
      </div>
      <div>
        <dt className="theme-label tier-micro uppercase text-foreground/42">Duration</dt>
        <dd className="mt-(--space-1) text-sm text-foreground">
          {formatMediaDuration(item.durationSeconds) ?? "Not available"}
        </dd>
      </div>
    </dl>
  );
}

function RelatedLinks({ links }: { links: readonly MediaRelatedLink[] }) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border/50 bg-background/68 p-(--space-4)" aria-label="Related Studio evidence">
      <p className="theme-label tier-micro uppercase text-foreground/42">Related evidence</p>
      <div className="mt-(--space-3) flex flex-wrap gap-(--space-2)">
        {links.map((link) => link.href ? (
          <a
            key={link.id}
            href={link.href}
            className="focus-ring inline-flex min-h-9 items-center rounded-full border border-border/70 px-(--space-3) text-xs font-semibold text-foreground/64 transition hover:bg-foreground/5"
          >
            {link.label}
          </a>
        ) : (
          <span
            key={link.id}
            className="inline-flex min-h-9 items-center rounded-full border border-border/50 px-(--space-3) text-xs font-semibold text-foreground/48"
          >
            {link.label}
          </span>
        ))}
      </div>
    </section>
  );
}

export function MediaAssetDetail({
  item,
  relatedLinks = [],
  onDeleted,
  showSectionChrome = true,
}: MediaAssetDetailProps) {
  return (
    <section
      className={showSectionChrome
        ? "grid gap-(--space-5) rounded-lg border border-border/60 bg-background/64 p-(--space-4) shadow-[0_18px_40px_rgba(15,23,42,0.04)]"
        : "grid gap-(--space-5)"}
      aria-label="Selected media asset"
      data-media-asset-detail="true"
    >
      <header className="grid gap-(--space-2)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Selected media</p>
        <div className="flex flex-col gap-(--space-2) sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-tight text-foreground">{item.fileName}</h2>
            <div className="mt-(--space-2) flex flex-wrap gap-(--space-2) text-xs text-foreground/52">
              <span>{item.fileType}</span>
              <span>{item.mimeType}</span>
              <span>{item.source}</span>
              <span>{item.retentionClass}</span>
              <span>{mediaAttachmentLabel(item)}</span>
            </div>
          </div>
          <a
            href={item.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-border/70 px-(--space-4) text-sm font-semibold text-foreground transition hover:bg-foreground/5"
          >
            Open governed preview
          </a>
        </div>
      </header>

      <MediaPreviewPane item={item} />
      <MediaAssetFacts item={item} />
      <RelatedLinks links={relatedLinks} />

      <div className="rounded-lg border border-border/50 bg-background/68 p-(--space-4)">
        <MediaDeleteControl item={item} onDeleted={onDeleted} />
      </div>
    </section>
  );
}
