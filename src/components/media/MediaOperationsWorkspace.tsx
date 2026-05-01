"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

import type { FleetMediaStorageAccount } from "@/lib/storage/media-storage-accounting";
import type { OperationsMediaFilters, OperationsMediaItem } from "@/lib/media/media-operations";
import type { MediaVolumeCapacity } from "@/lib/storage/volume-capacity";

interface MediaOperationsWorkspaceProps {
  userName: string;
  filters: OperationsMediaFilters;
  items: OperationsMediaItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  fleetAccount: FleetMediaStorageAccount;
  hostCapacity: MediaVolumeCapacity;
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

function SummaryCard({ label, primary, secondary }: { label: string; primary: string; secondary: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{primary}</div>
      <div className="mt-1 text-sm text-foreground/65">{secondary}</div>
    </div>
  );
}

function buildOperationsMediaHref(filters: OperationsMediaFilters, page: number): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.fileType) params.set("type", filters.fileType);
  if (filters.source) params.set("source", filters.source);
  if (filters.retentionClass) params.set("retention", filters.retentionClass);
  if (filters.attached === true) params.set("attached", "attached");
  if (filters.attached === false) params.set("attached", "unattached");
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/operations/media?${query}` : "/operations/media";
}

function TextArtifactViewer({ url, fileType }: { url: string; fileType: string }) {
  const [state, setState] = useState<{
    url: string;
    content: string | null;
    loading: boolean;
    error: string | null;
  }>({
    url,
    content: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load asset (HTTP ${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setState({ url, content: text, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            url,
            content: null,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load asset content.",
          });
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  const loading = state.url !== url || state.loading;
  const content = state.url === url ? state.content : null;
  const error = state.url === url ? state.error : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 p-6 text-sm text-foreground/55">
        <span className="animate-pulse">Loading asset content…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-foreground/60">
        <p className="font-medium text-foreground/80">Preview unavailable</p>
        <p className="mt-1">{error}</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-full border border-border/70 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5"
        >
          Open raw file
        </a>
      </div>
    );
  }

  if (fileType === "chart") {
    return (
      <div className="flex flex-col gap-2">
        <div className="rounded-lg border border-border/50 bg-background/80 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-widest text-foreground/50">Mermaid Chart Source</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground/80 leading-relaxed">
            {content}
          </pre>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="self-start rounded-full border border-border/70 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5"
        >
          Download .mmd file
        </a>
      </div>
    );
  }

  if (fileType === "document") {
    return (
      <div className="flex flex-col gap-2">
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-4">
          <pre className="whitespace-pre-wrap break-words text-sm text-foreground/80 leading-relaxed font-sans">
            {content}
          </pre>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="self-start rounded-full border border-border/70 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5"
        >
          Open full document
        </a>
      </div>
    );
  }

  // graph or other text-based types
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-80 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/80 leading-relaxed">
          {content}
        </pre>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="self-start rounded-full border border-border/70 px-4 py-2 text-xs font-medium text-foreground hover:bg-foreground/5"
      >
        Open raw file
      </a>
    </div>
  );
}

function PreviewPane({ item }: { item: OperationsMediaItem }) {
  if (item.fileType === "image") {
    return (
      <Image
        src={item.previewUrl}
        alt={item.fileName}
        width={item.width ?? 1200}
        height={item.height ?? 800}
        unoptimized
        className="max-h-72 w-full rounded-lg object-contain bg-black/5"
      />
    );
  }

  if (item.fileType === "video") {
    return (
      <video controls src={item.previewUrl} className="max-h-72 w-full rounded-lg bg-black" preload="metadata" />
    );
  }

  if (item.fileType === "audio") {
    return <audio controls src={item.previewUrl} className="w-full" preload="metadata" />;
  }

  if (item.fileType === "chart" || item.fileType === "graph" || item.fileType === "document") {
    return <TextArtifactViewer url={item.previewUrl} fileType={item.fileType} />;
  }

  return (
    <a
      href={item.previewUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
    >
      Open governed preview
    </a>
  );
}

export function MediaOperationsWorkspace({
  userName,
  filters,
  items,
  totalCount,
  page,
  pageSize,
  hasPrevPage,
  hasNextPage,
  fleetAccount,
  hostCapacity,
}: MediaOperationsWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  return (
    <main className="site-container mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Operations</div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Media inventory for {userName}</h1>
        <p className="max-w-3xl text-sm text-foreground/70">
          Inspect governed media across the whole system without widening the admin shell. Preview flows stay on the canonical asset route, and conversation deep links remain admin-only.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Governed assets"
          primary={`${fleetAccount.summary.totalFiles}`}
          secondary={`${formatBytes(fleetAccount.summary.totalBytes)} in the current filter scope`}
        />
        <SummaryCard
          label="Users"
          primary={`${fleetAccount.summary.totalUsers}`}
          secondary="Distinct owners covered by the current filter"
        />
        <SummaryCard
          label="Attached"
          primary={`${fleetAccount.summary.attachedFiles}`}
          secondary={`${formatBytes(fleetAccount.summary.attachedBytes)} linked to conversations`}
        />
        <SummaryCard
          label="Unattached"
          primary={`${fleetAccount.summary.unattachedFiles}`}
          secondary={`${formatBytes(fleetAccount.summary.unattachedBytes)} eligible for later cleanup policy`}
        />
      </section>

      <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
        <h2 className="text-lg font-semibold text-foreground">Writable volume capacity</h2>
        <p className="mt-1 text-sm text-foreground/62">Measured from the shared `.data` mount that backs governed media storage.</p>

        {hostCapacity.status === "available" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SummaryCard
              label="Free space"
              primary={formatBytes(hostCapacity.freeBytes)}
              secondary={`${formatBytes(hostCapacity.totalBytes)} total on the writable media volume`}
            />
            <SummaryCard
              label="Used space"
              primary={formatBytes(hostCapacity.usedBytes)}
              secondary={`${formatPercent(hostCapacity.percentUsed)} of the writable volume is consumed`}
            />
            <SummaryCard
              label="Last checked"
              primary={formatDate(hostCapacity.checkedAt)}
              secondary={hostCapacity.rootPath}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border/70 p-4 text-sm text-foreground/65">
            Capacity probe unavailable right now. {hostCapacity.reason}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <h2 className="text-lg font-semibold text-foreground">Top file types in scope</h2>
          <div className="mt-3 grid gap-2 text-sm text-foreground/72">
            {fleetAccount.topFileTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-foreground/60">No file types in the current filter.</div>
            ) : (
              fleetAccount.topFileTypes.map((entry) => (
                <div key={entry.fileType} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                  <div className="font-medium text-foreground">{entry.fileType}</div>
                  <div>{entry.files} files · {formatBytes(entry.bytes)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <h2 className="text-lg font-semibold text-foreground">Global storage leaders</h2>
          <p className="mt-1 text-sm text-foreground/62">This leaderboard stays global so operators can keep fleet hotspots in view while filtering inventory.</p>
          <div className="mt-3 grid gap-2 text-sm text-foreground/72">
            {fleetAccount.topUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-foreground/60">No user storage data is available yet.</div>
            ) : (
              fleetAccount.topUsers.map((entry) => (
                <div key={entry.userId} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                  <div>
                    <div className="font-medium text-foreground">{entry.userId}</div>
                    <div className="text-xs text-foreground/55">{entry.totalFiles} files</div>
                  </div>
                  <div>{formatBytes(entry.totalBytes)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-background/70 p-4">
        <form className="grid gap-3 md:grid-cols-6">
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Search file name or mime type"
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="userId"
            defaultValue={filters.userId}
            placeholder="Filter by exact user id"
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
          <div className="md:col-span-6 flex flex-wrap gap-2">
            <button type="submit" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Apply filters</button>
            <Link href="/operations/media" className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5">Reset</Link>
          </div>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,1.2fr)]">
        <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Inventory</h2>
              <p className="text-sm text-foreground/65">{totalCount} matching assets · page {page} · showing up to {pageSize}</p>
            </div>
            <div className="flex gap-2 text-sm">
              {hasPrevPage ? <Link href={buildOperationsMediaHref(filters, page - 1)} className="rounded-full border border-border/70 px-3 py-1.5 text-foreground hover:bg-foreground/5">Previous</Link> : null}
              {hasNextPage ? <Link href={buildOperationsMediaHref(filters, page + 1)} className="rounded-full border border-border/70 px-3 py-1.5 text-foreground hover:bg-foreground/5">Next</Link> : null}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-sm text-foreground/60">
              No media matched the current operator filter.
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
                        <span>{item.userId}</span>
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
                  <span>{selectedItem.userId}</span>
                  <span>{selectedItem.fileType}</span>
                  <span>{selectedItem.mimeType}</span>
                  <span>{selectedItem.source}</span>
                  <span>{selectedItem.retentionClass}</span>
                </div>
              </div>

              <PreviewPane item={selectedItem} />

              <dl className="grid gap-3 rounded-xl border border-border/50 bg-background/70 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-foreground/55">Owner</dt>
                  <dd className="mt-1 text-sm text-foreground">{selectedItem.userId}</dd>
                </div>
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
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-foreground/55">Conversation</dt>
                  <dd className="mt-1 text-sm text-foreground">{selectedItem.conversationId ?? "Unattached"}</dd>
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

                {selectedItem.conversationHref ? (
                  <Link
                    href={selectedItem.conversationHref}
                    className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
                  >
                    Open conversation detail
                  </Link>
                ) : selectedItem.conversationId ? (
                  <div className="text-xs text-foreground/55">Conversation detail remains admin-only until a shared operator conversation route exists.</div>
                ) : (
                  <div className="text-xs text-foreground/55">No conversation is linked to this asset.</div>
                )}
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
