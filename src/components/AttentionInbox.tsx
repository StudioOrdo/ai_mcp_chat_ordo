"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityReceiptControls } from "@/components/activity/ActivityReceiptControls";
import type { User as SessionUser } from "@/core/entities/user";
import type { ActivityItem, ActivityPageInfo } from "@/lib/activity";
import { formatStableUtcShortDateTime } from "@/lib/format/stable-date";

interface AttentionInboxProps {
  user?: Pick<SessionUser, "id" | "roles">;
}

interface InboxPayload {
  activity?: ActivityItem[];
  pageInfo?: ActivityPageInfo;
  unreadCount?: number;
}

const EMPTY_PAGE_INFO: ActivityPageInfo = {
  page: 1,
  limit: 8,
  total: 0,
  hasNextPage: false,
  nextPage: null,
};

async function fetchInbox(): Promise<{ items: ActivityItem[]; pageInfo: ActivityPageInfo; unreadCount: number }> {
  const response = await fetch("/api/activity?inbox=true&limit=8");
  const payload = await response.json().catch(() => null) as InboxPayload | null;
  if (!response.ok || !payload?.activity || !payload.pageInfo) {
    throw new Error("Unable to load attention inbox.");
  }

  return {
    items: payload.activity,
    pageInfo: payload.pageInfo,
    unreadCount: payload.unreadCount ?? 0,
  };
}

async function markInboxRead(): Promise<{ items: ActivityItem[]; pageInfo: ActivityPageInfo; unreadCount: number }> {
  const response = await fetch("/api/activity/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark_read", inbox: true }),
  });
  const payload = await response.json().catch(() => null) as InboxPayload | null;
  if (!response.ok || !payload?.activity || !payload.pageInfo) {
    throw new Error("Unable to mark attention inbox read.");
  }

  return {
    items: payload.activity,
    pageInfo: payload.pageInfo,
    unreadCount: payload.unreadCount ?? 0,
  };
}

function formatRelative(value: string): string {
  return formatStableUtcShortDateTime(value) ?? "Recently";
}

export function AttentionInbox({ user }: AttentionInboxProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [pageInfo, setPageInfo] = useState<ActivityPageInfo>(EMPTY_PAGE_INFO);
  const [unreadCount, setUnreadCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [markAllPending, setMarkAllPending] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);
  const visibleCount = useMemo(() => Math.min(unreadCount, 99), [unreadCount]);

  const refreshInbox = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const next = await fetchInbox();
      setItems(next.items);
      setPageInfo(next.pageInfo);
      setUnreadCount(next.unreadCount);
      setStatusMessage(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to load attention inbox.");
    } finally {
      setHasLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function handleMarkAllRead() {
    setMarkAllPending(true);
    setStatusMessage(null);
    try {
      const next = await markInboxRead();
      setItems(next.items);
      setPageInfo(next.pageInfo);
      setUnreadCount(next.unreadCount);
      setStatusMessage("Inbox marked read.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to mark attention inbox read.");
    } finally {
      setMarkAllPending(false);
    }
  }

  function handleUpdated() {
    void refreshInbox();
  }

  return (
    <div ref={inboxRef} className="relative" data-attention-inbox="true">
      <button
        type="button"
        className="shell-nav-icon-button focus-ring relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-background/80 text-foreground/60 transition hover:bg-foreground/4 hover:text-foreground sm:h-10 sm:w-10"
        aria-label="Open attention inbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
        </svg>
        {visibleCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {visibleCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          className="fixed inset-x-3 bottom-3 top-24 z-50 overflow-hidden rounded-2xl border border-foreground/12 bg-background shadow-xl sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(90vw,25rem)]"
          aria-label="Attention inbox"
        >
          <div className="flex items-center justify-between border-b border-foreground/8 px-(--space-3) py-(--space-3)">
            <div>
              <p className="text-sm font-semibold text-foreground">Attention inbox</p>
              <p className="text-xs text-foreground/50">Unread decisions, outputs, and business milestones</p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-foreground/54 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
              disabled={markAllPending || unreadCount === 0}
              onClick={() => void handleMarkAllRead()}
            >
              {markAllPending ? "Marking..." : "Mark all read"}
            </button>
          </div>

          <div className="max-h-full overflow-y-auto px-(--space-3) py-(--space-3) sm:max-h-96">
            {statusMessage ? (
              <p className="mb-(--space-2) rounded-lg border border-foreground/10 bg-foreground/[0.025] px-(--space-2) py-(--space-2) text-xs text-foreground/62" role="status">
                {statusMessage}
              </p>
            ) : null}

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-foreground/12 px-(--space-3) py-(--space-4) text-center">
                <p className="text-sm font-semibold text-foreground">{hasLoaded ? "Inbox is clear" : "Loading inbox..."}</p>
                <p className="mt-(--space-1) text-xs leading-5 text-foreground/58">
                  Durable activity still lives on the full Activity page.
                </p>
              </div>
            ) : (
              <ul className="grid gap-(--space-2)">
                {items.map((item) => (
                  <li key={item.id} className="rounded-lg border border-foreground/10 px-(--space-3) py-(--space-3)">
                    <div className="flex items-start justify-between gap-(--space-2)">
                      <div className="min-w-0">
                        <p className="text-[0.7rem] font-semibold uppercase text-foreground/44">{item.statusLabel}</p>
                        <Link
                          href={item.href}
                          className="mt-(--space-1) block text-sm font-semibold leading-5 text-foreground underline-offset-4 hover:underline"
                          onClick={() => void fetch(`/api/activity/${encodeURIComponent(item.id)}/receipt`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "mark_read" }),
                          }).then(() => refreshInbox()).catch(() => undefined)}
                        >
                          {item.title}
                        </Link>
                        <p className="mt-(--space-1) text-xs leading-5 text-foreground/60">{item.summary}</p>
                        <p className="mt-(--space-1) text-[0.7rem] text-foreground/42">{formatRelative(item.updatedAt)}</p>
                      </div>
                      {!item.receipt.readAt ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />
                      ) : null}
                    </div>
                    <ActivityReceiptControls
                      item={item}
                      compact
                      onItemUpdated={handleUpdated}
                      onItemDismissed={handleUpdated}
                      onError={setStatusMessage}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-foreground/8 px-(--space-3) py-(--space-3)">
            <Link
              href="/activity?inbox=true"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-foreground/12 px-(--space-3) py-(--space-2) text-sm font-semibold text-foreground/70 transition hover:border-foreground/20 hover:text-foreground focus-ring"
            >
              Open activity inbox
            </Link>
            {pageInfo.total > items.length ? (
              <p className="mt-(--space-2) text-center text-xs text-foreground/46">
                Showing {items.length} of {pageInfo.total} inbox items.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
