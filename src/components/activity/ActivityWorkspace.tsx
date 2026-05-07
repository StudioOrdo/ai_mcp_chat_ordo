"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivityCard, EmptyActivityState } from "@/components/activity/ActivityCard";
import { ActivityReceiptControls } from "@/components/activity/ActivityReceiptControls";
import type { ActivityItem, ActivityPageInfo, ActivitySourceKind } from "@/lib/activity";

export interface ActivityWorkspaceQuery {
  bucket?: string;
  sourceKind?: ActivitySourceKind;
  q?: string;
  page: number;
  includeDismissed: boolean;
  inbox: boolean;
}

export interface ActivityWorkspaceResult {
  items: ActivityItem[];
  pageInfo: ActivityPageInfo;
  unreadCount?: number;
}

interface ActivityWorkspaceProps {
  initialResult: ActivityWorkspaceResult;
  query: ActivityWorkspaceQuery;
}

const FILTERS: Array<{ label: string; params: Record<string, string> }> = [
  { label: "All", params: {} },
  { label: "Inbox", params: { inbox: "true" } },
  { label: "Needs attention", params: { bucket: "needs_attention" } },
  { label: "Running", params: { bucket: "running" } },
  { label: "Completed", params: { bucket: "completed" } },
  { label: "Jobs", params: { sourceKind: "job" } },
  { label: "Workflows", params: { sourceKind: "media_workflow" } },
  { label: "Referrals", params: { sourceKind: "referral_milestone" } },
  { label: "System", params: { sourceKind: "operation" } },
  { label: "History", params: { includeDismissed: "true" } },
];

function buildHref(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `/activity?${queryString}` : "/activity";
}

function pageHref(page: number, query: ActivityWorkspaceQuery): string {
  return buildHref({
    bucket: query.bucket,
    sourceKind: query.sourceKind,
    q: query.q,
    page: String(page),
    includeDismissed: query.includeDismissed ? "true" : undefined,
    inbox: query.inbox ? "true" : undefined,
  });
}

function isFilterActive(filter: Record<string, string>, query: ActivityWorkspaceQuery): boolean {
  const hasFilter = Object.keys(filter).length > 0;
  if (!hasFilter) {
    return !query.bucket && !query.sourceKind && !query.includeDismissed && !query.inbox;
  }

  return Object.entries(filter).every(([key, value]) => {
    if (key === "bucket") return query.bucket === value;
    if (key === "sourceKind") return query.sourceKind === value;
    if (key === "includeDismissed") return query.includeDismissed === (value === "true");
    if (key === "inbox") return query.inbox === (value === "true");
    return false;
  });
}

async function markInboxRead(): Promise<ActivityWorkspaceResult> {
  const response = await fetch("/api/activity/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark_read", inbox: true }),
  });
  const payload = await response.json().catch(() => null) as {
    activity?: ActivityItem[];
    pageInfo?: ActivityPageInfo;
    unreadCount?: number;
    error?: string;
  } | null;

  if (!response.ok || !payload?.activity || !payload.pageInfo) {
    throw new Error(payload?.error ?? "Unable to mark inbox read.");
  }

  return {
    items: payload.activity,
    pageInfo: payload.pageInfo,
    unreadCount: payload.unreadCount,
  };
}

export function ActivityWorkspace({ initialResult, query }: ActivityWorkspaceProps) {
  const [items, setItems] = useState(initialResult.items);
  const [pageInfo, setPageInfo] = useState(initialResult.pageInfo);
  const [unreadCount, setUnreadCount] = useState(initialResult.unreadCount ?? 0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [markAllPending, setMarkAllPending] = useState(false);
  const pageCount = Math.max(1, Math.ceil(pageInfo.total / pageInfo.limit));
  const searchHiddenInputs = useMemo(() => ({
    bucket: query.bucket,
    sourceKind: query.sourceKind,
    includeDismissed: query.includeDismissed ? "true" : undefined,
    inbox: query.inbox ? "true" : undefined,
  }), [query.bucket, query.includeDismissed, query.inbox, query.sourceKind]);

  function updateItem(nextItem: ActivityItem) {
    const previousItem = items.find((item) => item.id === nextItem.id);
    const shouldDecrementUnread = Boolean(previousItem && !previousItem.receipt.readAt && nextItem.receipt.readAt);
    setItems((current) => current.map((item) => item.id === nextItem.id ? nextItem : item));
    if (shouldDecrementUnread) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    setStatusMessage("Activity receipt updated.");
  }

  function dismissItem(nextItem: ActivityItem) {
    if (query.includeDismissed) {
      updateItem(nextItem);
      return;
    }

    const previousItem = items.find((item) => item.id === nextItem.id);
    const shouldDecrementUnread = Boolean(previousItem && !previousItem.receipt.readAt);
    setItems((current) => current.filter((item) => item.id !== nextItem.id));
    setPageInfo((current) => ({
      ...current,
      total: Math.max(0, current.total - 1),
    }));
    if (shouldDecrementUnread) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    setStatusMessage("Activity dismissed from this view.");
  }

  async function handleMarkAllRead() {
    setMarkAllPending(true);
    setStatusMessage(null);
    try {
      const result = await markInboxRead();
      const markedAt = new Date().toISOString();
      setItems((current) => query.inbox ? result.items : current.map((item) => ({
        ...item,
        receipt: item.receipt.readAt ? item.receipt : {
          ...item.receipt,
          readAt: markedAt,
        },
      })));
      if (query.inbox) {
        setPageInfo(result.pageInfo);
      }
      setUnreadCount(result.unreadCount ?? 0);
      setStatusMessage("Inbox marked read.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to mark inbox read.");
    } finally {
      setMarkAllPending(false);
    }
  }

  return (
    <section className="grid gap-(--space-4)" data-activity-workspace="true" aria-label="Activity workspace">
      <div className="rounded-lg border border-foreground/10 bg-background px-(--space-3) py-(--space-3)">
        <div className="flex flex-col gap-(--space-3) lg:flex-row lg:items-end lg:justify-between">
          <form action="/activity" className="grid gap-(--space-2) sm:flex sm:items-end" role="search">
            <label className="grid gap-(--space-1) text-sm font-medium text-foreground/70">
              Search activity
              <input
                type="search"
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Title, source id, status..."
                className="min-h-10 rounded-full border border-foreground/10 bg-background px-(--space-3) text-sm text-foreground outline-none transition focus:border-foreground/30"
              />
            </label>
            {Object.entries(searchHiddenInputs).map(([key, value]) => value ? (
              <input key={key} type="hidden" name={key} value={value} />
            ) : null)}
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-foreground/12 bg-foreground px-(--space-3) py-(--space-2) text-sm font-semibold text-background transition hover:opacity-85 focus-ring"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-(--space-2)">
            {unreadCount > 0 ? (
              <span className="rounded-full border border-foreground/10 px-(--space-2) py-(--space-1) text-[0.72rem] font-semibold text-foreground/62">
                {unreadCount} unread
              </span>
            ) : null}
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-foreground/12 px-(--space-3) py-(--space-2) text-sm font-semibold text-foreground/68 transition hover:border-foreground/20 hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-45"
              disabled={markAllPending || unreadCount === 0}
              onClick={() => void handleMarkAllRead()}
            >
              {markAllPending ? "Marking..." : "Mark inbox read"}
            </button>
          </div>
        </div>

        <nav aria-label="Activity filters" className="mt-(--space-3) flex gap-(--space-1) overflow-x-auto pb-(--space-1)">
          {FILTERS.map((filter) => {
            const active = isFilterActive(filter.params, query);
            return (
              <Link
                key={filter.label}
                href={buildHref({ ...filter.params, q: query.q })}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-9 flex-none items-center rounded-full border px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold transition focus-ring ${
                  active
                    ? "border-foreground/24 bg-foreground text-background"
                    : "border-foreground/10 text-foreground/66 hover:border-foreground/18 hover:text-foreground"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {statusMessage ? (
        <p className="rounded-lg border border-foreground/10 bg-foreground/[0.025] px-(--space-3) py-(--space-2) text-sm text-foreground/64" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-(--space-2)">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id}>
              <ActivityCard item={item} />
              <ActivityReceiptControls
                item={item}
                onItemUpdated={updateItem}
                onItemDismissed={dismissItem}
                onError={setStatusMessage}
              />
            </div>
          ))
        ) : (
          <EmptyActivityState
            title={query.inbox ? "Inbox is clear" : "No activity for this view"}
            summary={query.inbox ? "Unread and actionable items will appear here." : "Try another filter or return to the dashboard."}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-(--space-2)">
        <p className="text-[0.78rem] text-foreground/52">
          Page {pageInfo.page} of {pageCount}
        </p>
        <div className="flex gap-(--space-2)">
          {query.page > 1 ? (
            <Link
              href={pageHref(query.page - 1, query)}
              className="inline-flex min-h-9 items-center rounded-full border border-foreground/10 px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold text-foreground/66 transition hover:border-foreground/18 hover:text-foreground focus-ring"
            >
              Previous
            </Link>
          ) : null}
          {pageInfo.hasNextPage && pageInfo.nextPage ? (
            <Link
              href={pageHref(pageInfo.nextPage, query)}
              className="inline-flex min-h-9 items-center rounded-full border border-foreground/10 px-(--space-3) py-(--space-1) text-[0.76rem] font-semibold text-foreground/66 transition hover:border-foreground/18 hover:text-foreground focus-ring"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
