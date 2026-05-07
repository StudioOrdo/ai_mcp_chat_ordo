"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { UserMediaFilters, UserMediaItem } from "@/lib/media/user-media";
import type { UserFileStorageSummary } from "@/core/entities/user-file-storage";
import type { MediaQuotaSnapshot } from "@/lib/storage/media-quota-policy";
import {
  formatMediaBytes,
  formatMediaDate,
  formatMediaPercent,
  MediaAssetDetail,
  mediaAttachmentLabel,
} from "@/components/media/MediaAssetDetail";

interface UserMediaWorkspaceProps {
  userName: string;
  items: UserMediaItem[];
  filters: UserMediaFilters;
  summary: UserFileStorageSummary;
  quota: MediaQuotaSnapshot;
  hasMore: boolean;
}

function quotaMessage(quota: MediaQuotaSnapshot): string {
  if (quota.status === "over_quota") {
    return quota.hardBlockUploadsAtQuota
      ? "Storage limit reached. Uploads are paused until space is available."
      : "Storage limit reached. Review media before creating more large assets.";
  }

  if (quota.status === "warning") {
    return "Storage is close to the warning level.";
  }

  return "Storage is healthy. Uploads are still available.";
}

function MediaFilterForm({ filters }: { filters: UserMediaFilters }) {
  return (
    <form className="grid gap-(--space-2)" aria-label="Filter media">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-(--space-2)">
        <label className="sr-only" htmlFor="media-search">
          Search media
        </label>
        <input
          id="media-search"
          type="search"
          name="q"
          defaultValue={filters.search}
          placeholder="Search media..."
          className="focus-ring min-h-12 rounded-lg border border-border/70 bg-background/72 px-(--space-3) text-sm text-foreground shadow-none outline-none placeholder:text-foreground/42"
        />
        <details className="group relative">
          <summary className="focus-ring flex min-h-12 cursor-pointer list-none items-center justify-center rounded-lg border border-border/70 bg-background/72 px-(--space-3) text-xs font-semibold text-foreground/64 transition hover:bg-foreground/5">
            Filter
          </summary>
          <div className="absolute right-0 z-20 mt-(--space-2) grid w-[min(18rem,calc(100vw-2rem))] gap-(--space-2) rounded-lg border border-border/70 bg-background p-(--space-3) shadow-[0_18px_45px_rgba(15,23,42,0.12)] lg:left-0 lg:right-auto">
        <label className="sr-only" htmlFor="media-type">
          Media type
        </label>
        <select
          id="media-type"
          name="type"
          defaultValue={filters.fileType ?? ""}
          className="focus-ring min-h-10 rounded-lg border border-border/70 bg-background/72 px-(--space-2) text-xs text-foreground/72"
        >
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

        <label className="sr-only" htmlFor="media-source">
          Media source
        </label>
        <select
          id="media-source"
          name="source"
          defaultValue={filters.source ?? ""}
          className="focus-ring min-h-10 rounded-lg border border-border/70 bg-background/72 px-(--space-2) text-xs text-foreground/72"
        >
          <option value="">All sources</option>
          <option value="uploaded">Uploaded</option>
          <option value="generated">Generated</option>
          <option value="derived">Derived</option>
        </select>

        <label className="sr-only" htmlFor="media-retention">
          Retention state
        </label>
        <select
          id="media-retention"
          name="retention"
          defaultValue={filters.retentionClass ?? ""}
          className="focus-ring min-h-10 rounded-lg border border-border/70 bg-background/72 px-(--space-2) text-xs text-foreground/72"
        >
          <option value="">All retention</option>
          <option value="ephemeral">Ephemeral</option>
          <option value="conversation">Conversation</option>
          <option value="durable">Durable</option>
        </select>

        <label className="sr-only" htmlFor="media-attached">
          Attachment state
        </label>
        <select
          id="media-attached"
          name="attached"
          defaultValue={filters.attached === null ? "" : filters.attached ? "attached" : "unattached"}
          className="focus-ring min-h-10 rounded-lg border border-border/70 bg-background/72 px-(--space-2) text-xs text-foreground/72"
        >
          <option value="">All states</option>
          <option value="attached">Attached</option>
          <option value="unattached">Unattached</option>
        </select>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-(--space-2)">
              <button type="submit" className="btn-primary min-h-10 justify-center text-xs">
                Apply filters
              </button>
              <a
                href="/studio?kind=media_asset"
                className="focus-ring inline-flex min-h-10 items-center justify-center rounded-full border border-border/70 px-(--space-3) text-xs font-semibold text-foreground/68 transition hover:bg-foreground/5"
              >
                Reset
              </a>
            </div>
          </div>
        </details>
      </div>
    </form>
  );
}

function MediaSelectionColumn({
  filters,
  hasMore,
  items,
  mobileDetailOpen,
  selectedItem,
  quota,
  summary,
  onSelect,
  onSelectOverview,
}: {
  filters: UserMediaFilters;
  hasMore: boolean;
  items: UserMediaItem[];
  mobileDetailOpen: boolean;
  selectedItem: UserMediaItem | null;
  quota: MediaQuotaSnapshot;
  summary: UserFileStorageSummary;
  onSelect: (id: string) => void;
  onSelectOverview: () => void;
}) {
  const overviewActive = selectedItem === null;

  return (
    <aside
      className={`content-start gap-(--space-4) border-b border-border/60 bg-background/35 px-(--space-frame-default) py-(--space-4) lg:border-b-0 lg:border-r lg:py-(--space-section-loose) ${
        mobileDetailOpen ? "hidden lg:grid" : "grid"
      }`}
      aria-label="Media selection"
      data-media-selection-column="true"
    >
      <header className="grid gap-(--space-2)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Media</p>
        <p className="max-w-[18rem] text-xs leading-5 text-foreground/52">
          Select governed assets. Chat remains the operating interface; this column keeps the evidence inspectable.
        </p>
      </header>

      <button
        type="button"
        onClick={onSelectOverview}
        aria-pressed={overviewActive}
        className={`focus-ring relative grid gap-(--space-2) rounded-lg border p-(--space-3) text-left transition ${
          overviewActive
            ? "border-[color-mix(in_oklab,var(--accent)_42%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--background))]"
            : "border-border/55 hover:border-border/80 hover:bg-foreground/[0.035]"
        }`}
        data-media-overview-row="true"
      >
        {overviewActive ? (
          <span className="absolute left-0 top-(--space-3) h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-accent" aria-hidden="true" />
        ) : null}
        <span className="grid gap-(--space-1) pl-(--space-2)">
          <span className="text-sm font-semibold text-foreground">Overview</span>
          <span className="text-xs leading-5 text-foreground/52">
            {summary.totalFiles} {summary.totalFiles === 1 ? "asset" : "assets"} · {summary.attachedFiles} attached · {summary.unattachedFiles} safe delete · {formatMediaPercent(quota.percentUsed)} quota
          </span>
        </span>
      </button>

      <MediaFilterForm filters={filters} />

      <section className="grid gap-(--space-2)" aria-label="Media assets">
        <p className="theme-label tier-micro uppercase text-foreground/42">Assets</p>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-(--space-4) text-sm text-foreground/56">
            No media matched the current filter.
          </div>
        ) : (
          items.map((item) => {
            const active = selectedItem?.id === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={active}
                className={`focus-ring group relative grid min-h-[4.75rem] gap-(--space-2) rounded-lg border p-(--space-3) text-left transition ${
                  active
                    ? "border-[color-mix(in_oklab,var(--accent)_42%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,var(--background))]"
                    : "border-transparent hover:border-border/70 hover:bg-foreground/[0.035]"
                }`}
                data-media-row={item.id}
                data-selected={active ? "true" : undefined}
              >
                {active ? (
                  <span className="absolute left-0 top-(--space-3) h-[calc(100%-1.5rem)] w-[2px] rounded-full bg-accent" aria-hidden="true" />
                ) : null}
                <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-(--space-3) pl-(--space-2)">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-[0.68rem] font-semibold uppercase text-foreground/62">
                    {item.fileType.slice(0, 1)}
                  </span>
                  <span className="grid min-w-0 gap-(--space-1)">
                    <span className="flex items-start justify-between gap-(--space-2)">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground/88" title={item.fileName}>{item.fileName}</span>
                    <span className="shrink-0 rounded-full border border-border/70 px-(--space-2) py-[0.15rem] text-[0.68rem] font-semibold text-foreground/56">
                      {item.fileType}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-(--space-2) gap-y-(--space-1) text-xs text-foreground/50">
                    <span>{item.source}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.retentionClass}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mediaAttachmentLabel(item)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-(--space-3) text-xs text-foreground/50">
                    <span>{formatMediaDate(item.createdAt)}</span>
                    <span>{formatMediaBytes(item.fileSize)}</span>
                  </span>
                  </span>
                </span>
              </button>
            );
          })
        )}
      </section>

      <footer className="border-t border-border/55 pt-(--space-3) text-xs leading-5 text-foreground/46">
        <p>
          Showing {items.length} of {summary.totalFiles} media assets.
        </p>
        {hasMore ? <p>More assets exist. Narrow filters to inspect them.</p> : null}
      </footer>
    </aside>
  );
}

function StorageBudgetCard({ quota }: { quota: MediaQuotaSnapshot }) {
  return (
    <section
      className={`rounded-lg border p-(--space-4) ${
        quota.status === "normal"
          ? "border-border/60 bg-background/62"
          : quota.status === "warning"
            ? "border-amber-500/35 bg-amber-500/8"
            : "border-red-500/35 bg-red-500/8"
      }`}
      aria-label="Storage budget"
    >
      <div className="grid gap-(--space-1)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Storage budget</p>
        <p className="text-lg font-semibold text-foreground">
          {formatMediaBytes(quota.usedBytes)} of {formatMediaBytes(quota.quotaBytes)} used
        </p>
        <p className="text-sm leading-6 text-foreground/62">
          {formatMediaPercent(quota.percentUsed)} consumed · warning at {formatMediaPercent(quota.warnAtPercent)} · {quotaMessage(quota)}
        </p>
      </div>
    </section>
  );
}

function MediaOverviewDetail({
  items,
  quota,
  summary,
  userName,
}: {
  items: UserMediaItem[];
  quota: MediaQuotaSnapshot;
  summary: UserFileStorageSummary;
  userName: string;
}) {
  const recentItems = items.slice(0, 4);

  return (
    <section
      className="grid gap-(--space-5)"
      aria-label="Media overview"
      data-media-overview-detail="true"
    >
      <header className="grid gap-(--space-3)">
        <p className="theme-label tier-micro uppercase text-foreground/42">Media overview</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Governed media</h1>
        <p className="max-w-3xl text-sm leading-6 text-foreground/62">
          Review the media Ordo has produced or stored for {userName}. Select an asset in the media column to inspect one object.
        </p>
      </header>

      <section className="grid gap-(--space-3) sm:grid-cols-2 xl:grid-cols-4" aria-label="Media overview metrics">
        <div className="rounded-lg border border-border/60 bg-background/62 p-(--space-4)">
          <div className="theme-label tier-micro uppercase text-foreground/42">Governed assets</div>
          <div className="mt-(--space-2) text-2xl font-semibold text-foreground">{summary.totalFiles}</div>
          <div className="mt-(--space-1) text-sm text-foreground/62">{formatMediaBytes(summary.totalBytes)} stored</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/62 p-(--space-4)">
          <div className="theme-label tier-micro uppercase text-foreground/42">Attached</div>
          <div className="mt-(--space-2) text-2xl font-semibold text-foreground">{summary.attachedFiles}</div>
          <div className="mt-(--space-1) text-sm text-foreground/62">Linked to conversations</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/62 p-(--space-4)">
          <div className="theme-label tier-micro uppercase text-foreground/42">Safe deletion</div>
          <div className="mt-(--space-2) text-2xl font-semibold text-foreground">{summary.unattachedFiles}</div>
          <div className="mt-(--space-1) text-sm text-foreground/62">Unattached candidates</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/62 p-(--space-4)">
          <div className="theme-label tier-micro uppercase text-foreground/42">Quota</div>
          <div className="mt-(--space-2) text-2xl font-semibold text-foreground">{formatMediaPercent(quota.percentUsed)}</div>
          <div className="mt-(--space-1) text-sm text-foreground/62">{quotaMessage(quota)}</div>
        </div>
      </section>

      <StorageBudgetCard quota={quota} />

      <section className="rounded-lg border border-border/60 bg-background/64 p-(--space-4)" aria-label="Recent media">
        <div className="flex items-center justify-between gap-(--space-3)">
          <div>
            <p className="theme-label tier-micro uppercase text-foreground/42">Recent assets</p>
            <h2 className="mt-(--space-1) text-xl font-semibold text-foreground">Latest governed media</h2>
          </div>
        </div>
        <div className="mt-(--space-4) grid gap-(--space-2)">
          {recentItems.length === 0 ? (
            <p className="text-sm text-foreground/56">No media matched the current filter.</p>
          ) : (
            recentItems.map((item) => (
              <div key={item.id} className="grid gap-(--space-1) rounded-lg border border-border/50 bg-background/60 p-(--space-3)">
                <p className="truncate text-sm font-semibold text-foreground" title={item.fileName}>{item.fileName}</p>
                <p className="text-xs text-foreground/50">
                  {item.fileType} · {item.source} · {formatMediaDate(item.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

function SelectedMediaDetail({
  item,
  onDeleted,
}: {
  item: UserMediaItem | null;
  onDeleted: () => void;
}) {
  if (!item) {
    return (
      <section className="rounded-lg border border-dashed border-border/70 bg-background/45 p-(--space-6) text-sm text-foreground/56">
        Select an asset to inspect its preview, metadata, and governed actions.
      </section>
    );
  }

  return <MediaAssetDetail item={item} onDeleted={onDeleted} />;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const selectedItem = useMemo(
    () => selectedId ? items.find((item) => item.id === selectedId) ?? null : null,
    [items, selectedId],
  );

  function handleDeleted(): void {
    router.refresh();
  }

  function handleSelect(id: string): void {
    setSelectedId(id);
    setMobileDetailOpen(true);
  }

  function handleSelectOverview(): void {
    setSelectedId(null);
    setMobileDetailOpen(true);
  }

  return (
    <main
      className="shell-governance-grid grid w-full max-w-none gap-0 px-0 py-0"
      data-user-media-workspace="true"
      data-media-mobile-state={mobileDetailOpen ? "detail" : "list"}
    >
      <MediaSelectionColumn
        filters={filters}
        hasMore={hasMore}
        items={items}
        mobileDetailOpen={mobileDetailOpen}
        selectedItem={selectedItem}
        quota={quota}
        summary={summary}
        onSelect={handleSelect}
        onSelectOverview={handleSelectOverview}
      />

      <section
        className={`min-w-0 px-(--space-frame-default) py-(--space-section-loose) sm:py-(--space-frame-wide) ${
          mobileDetailOpen || items.length === 0 ? "grid" : "hidden lg:grid"
        } gap-(--space-5)`}
        aria-label="Media detail"
        data-media-detail-column="true"
      >
        {mobileDetailOpen ? (
          <button
            type="button"
            onClick={() => setMobileDetailOpen(false)}
            className="focus-ring inline-flex w-fit items-center rounded-full border border-border/70 px-(--space-3) py-(--space-2) text-xs font-semibold text-foreground/66 transition hover:bg-foreground/5 lg:hidden"
          >
            Back to media
          </button>
        ) : null}

        {selectedItem ? (
          <SelectedMediaDetail item={selectedItem} onDeleted={handleDeleted} />
        ) : (
          <MediaOverviewDetail items={items} quota={quota} summary={summary} userName={userName} />
        )}
      </section>
    </main>
  );
}
