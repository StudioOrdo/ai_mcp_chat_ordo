"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const MermaidRenderer = dynamic(
  () => import("@/components/MermaidRenderer").then((mod) => mod.MermaidRenderer),
  { ssr: false }
);

const GraphRenderer = dynamic(
  () => import("@/components/GraphRenderer").then((mod) => mod.GraphRenderer),
  { ssr: false }
);

import type { UserMediaFilters, UserMediaItem } from "@/lib/media/user-media";
import type { UserFileStorageSummary } from "@/core/entities/user-file-storage";
import type { MediaQuotaSnapshot } from "@/lib/storage/media-quota-policy";
import type { GraphSpec } from "@/core/entities/rich-content";

interface UserMediaWorkspaceProps {
  userName: string;
  items: UserMediaItem[];
  filters: UserMediaFilters;
  summary: UserFileStorageSummary;
  quota: MediaQuotaSnapshot;
  hasMore: boolean;
}

function formatBytes(bytes: number): string {
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

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatDuration(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function quotaMessage(quota: MediaQuotaSnapshot): string {
  if (quota.status === "over_quota") {
    return quota.hardBlockUploadsAtQuota
      ? "Uploads are configured to stop above quota."
      : "Display-only in this phase. Uploads are not blocked automatically yet.";
  }

  if (quota.status === "warning") {
    return "Approaching your storage budget. Cleanup tools and automatic enforcement are still rolling out.";
  }

  return quota.hardBlockUploadsAtQuota
    ? `Uploads stop at ${formatPercent(quota.warnAtPercent)} warning threshold visibility.`
    : "Display-only budget for governed media in this phase.";
}

function SummaryCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{primary}</div>
      <div className="mt-1 text-sm text-foreground/65">{secondary}</div>
    </div>
  );
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
        if (!res.ok) throw new Error("Failed to load asset data");
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
    return <div className="animate-pulse rounded-lg bg-surface-muted p-8 text-center text-sm text-foreground/50">Loading asset data...</div>;
  }

  if (error || !data) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700">Error loading asset: {error}</div>;
  }

  if (item.fileType === "chart" || item.mimeType === "text/vnd.mermaid") {
    return (
      <div className="rounded-lg border border-border/60 bg-white dark:bg-black p-4">
        <MermaidRenderer code={data} />
      </div>
    );
  }

  if (item.fileType === "graph" || item.mimeType === "application/json") {
    let actualGraph: GraphSpec;
    try {
      const graphData = JSON.parse(data);
      actualGraph = (graphData.graph ? graphData.graph : graphData) as GraphSpec;
    } catch {
      return <div className="rounded-lg border border-red-500/20 p-4 text-sm text-red-700">Invalid graph JSON</div>;
    }

    return (
      <div className="rounded-lg border border-border/60 bg-white dark:bg-black p-4">
        <GraphRenderer graph={actualGraph} />
      </div>
    );
  }

  // Fallback for document or text
  if (item.fileType === "document" || item.mimeType.startsWith("text/")) {
    return (
      <div className="max-h-96 overflow-auto rounded-lg border border-border/60 bg-surface-muted p-4">
        <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-mono">
          {data}
        </pre>
      </div>
    );
  }

  return null;
}

function PreviewPane({ item }: { item: UserMediaItem }) {
  if (item.fileType === "image") {
    return (
      <Image
        src={item.previewUrl}
        alt={item.fileName}
        width={item.width ?? 1200}
        height={item.height ?? 800}
        unoptimized
        className="max-h-64 w-full rounded-lg object-contain bg-black/5"
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
      className="inline-flex rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
    >
      Open asset preview
    </a>
  );
}

function DeleteButton({
  item,
  onDeleted,
}: {
  item: UserMediaItem;
  onDeleted: () => void;
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

      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete this asset right now.");
      setIsDeleting(false);
      return;
    }

    setIsDeleting(false);
  }

  if (!item.canDelete) {
    return <div className="text-xs text-foreground/55">Attached media stays locked until later policy phases.</div>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-full border border-red-500/35 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/8 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Deleting…" : "Delete asset"}
      </button>
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}

export function UserMediaWorkspace({
  userName,
  items,
  filters,
  summary,
  quota,
  hasMore,
}: UserMediaWorkspaceProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  function handleDeleted(): void {
    router.refresh();
  }

  return (
    <main className="site-container mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">My media</div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Governed assets for {userName}</h1>
        <p className="max-w-3xl text-sm text-foreground/70">
          Browse, filter, preview, and safely remove your unattached media without bypassing the governed delivery route.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Stored media"
          primary={`${summary.totalFiles}`}
          secondary={`${formatBytes(summary.totalBytes)} across all governed assets`}
        />
        <SummaryCard
          label="Quota usage"
          primary={`${formatPercent(quota.percentUsed)} used`}
          secondary={`${formatBytes(quota.usedBytes)} of ${formatBytes(quota.quotaBytes)} · ${quota.hardBlockUploadsAtQuota ? "enforced" : "display only"}`}
        />
        <SummaryCard
          label="Attached"
          primary={`${summary.attachedFiles}`}
          secondary={`${formatBytes(summary.attachedBytes)} linked to conversations`}
        />
        <SummaryCard
          label="Unattached"
          primary={`${summary.unattachedFiles}`}
          secondary={`${formatBytes(summary.unattachedBytes)} currently eligible for safe deletion`}
        />
      </section>

      <section className={`rounded-2xl border p-4 ${quota.status === "normal" ? "border-border/60 bg-background/70" : quota.status === "warning" ? "border-amber-500/35 bg-amber-500/8" : "border-red-500/35 bg-red-500/8"}`}>
        <div className="flex flex-col gap-1">
          <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Storage budget</div>
          <div className="text-lg font-semibold text-foreground">
            {formatBytes(quota.usedBytes)} of {formatBytes(quota.quotaBytes)} used
          </div>
          <p className="text-sm text-foreground/70">
            {formatPercent(quota.percentUsed)} consumed · warning at {formatPercent(quota.warnAtPercent)} · {quotaMessage(quota)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Search file name or mime type"
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
          <select name="type" defaultValue={filters.fileType ?? ""} className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
            <option value="">All types</option>
            <option value="audio">Audio</option>
            <option value="chart">Chart</option>
            <option value="document">Document</option>
            <option value="graph">Graph</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="subtitle">Subtitle</option>
            <option value="waveform">Waveform</option>
          </select>
          <select name="source" defaultValue={filters.source ?? ""} className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
            <option value="">All sources</option>
            <option value="uploaded">Uploaded</option>
            <option value="generated">Generated</option>
            <option value="derived">Derived</option>
          </select>
          <select name="retention" defaultValue={filters.retentionClass ?? ""} className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
            <option value="">All retention states</option>
            <option value="ephemeral">Ephemeral</option>
            <option value="conversation">Conversation</option>
            <option value="durable">Durable</option>
          </select>
          <select name="attached" defaultValue={filters.attached === null ? "" : filters.attached ? "attached" : "unattached"} className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
            <option value="">All attachment states</option>
            <option value="attached">Attached only</option>
            <option value="unattached">Unattached only</option>
          </select>
          <div className="md:col-span-5 flex flex-wrap gap-2">
            <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Apply filters</button>
            <a href="/my/media" className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5">Reset</a>
          </div>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,1.2fr)]">
        <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Asset list</h2>
              <p className="text-sm text-foreground/65">Latest {items.length} assets matching the current filter.</p>
            </div>
            {hasMore ? <div className="text-xs text-foreground/55">Additional results available. Tighten the filter to narrow the list.</div> : null}
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-sm text-foreground/60">
              No media matched the current filter.
            </div>
          ) : (
            <div className="grid gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`rounded-xl border p-3 text-left transition ${selectedItem?.id === item.id ? "border-foreground/25 bg-foreground/5" : "border-border/50 hover:bg-foreground/4"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{item.fileName}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-foreground/60">
                        <span>{item.fileType}</span>
                        <span>{item.source}</span>
                        <span>{item.retentionClass}</span>
                        <span>{item.conversationId ? "Attached" : "Unattached"}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-foreground/60">{formatBytes(item.fileSize)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          {selectedItem ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{selectedItem.fileName}</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/60">
                  <span>{selectedItem.fileType}</span>
                  <span>{selectedItem.mimeType}</span>
                  <span>{selectedItem.source}</span>
                  <span>{selectedItem.retentionClass}</span>
                  <span>{selectedItem.conversationId ? "Attached" : "Unattached"}</span>
                </div>
              </div>

              <PreviewPane item={selectedItem} />

              <dl className="grid gap-3 rounded-xl border border-border/50 bg-background/70 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-foreground/55">Created</dt>
                  <dd className="mt-1 text-sm text-foreground">{formatDate(selectedItem.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-foreground/55">Size</dt>
                  <dd className="mt-1 text-sm text-foreground">{formatBytes(selectedItem.fileSize)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-foreground/55">Dimensions</dt>
                  <dd className="mt-1 text-sm text-foreground">{selectedItem.width && selectedItem.height ? `${selectedItem.width}x${selectedItem.height}` : "Not available"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-foreground/55">Duration</dt>
                  <dd className="mt-1 text-sm text-foreground">{formatDuration(selectedItem.durationSeconds) ?? "Not available"}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/70 p-4">
                <a
                  href={selectedItem.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
                >
                  Open governed preview
                </a>
                <DeleteButton item={selectedItem} onDeleted={handleDeleted} />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-sm text-foreground/60">
              Select an asset to inspect its preview and metadata.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
