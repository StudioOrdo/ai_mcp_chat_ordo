"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { User as SessionUser } from "@/core/entities/user";
import type { FeedNotification } from "@/lib/notifications/feed-notification";

interface NotificationFeedProps {
  notifications?: FeedNotification[];
  user?: Pick<SessionUser, "id" | "roles">;
}

const DEFAULT_NOTIFICATIONS: FeedNotification[] = [
  {
    id: "notif-workspace-search",
    title: "Workspace search updated",
    body: "Search now runs through the governed chat workspace, with corpus and conversation recall surfaced in the transcript.",
    href: "/workspace",
    scope: "user",
    unread: true,
  },
  {
    id: "notif-bulk-actions",
    title: "Admin bulk actions available",
    body: "Users and conversations now support selected-row bulk actions from the table footer.",
    href: "/admin/users",
    scope: "admin",
    unread: true,
  },
  {
    id: "notif-deferred-jobs",
    title: "Deferred job notifications routed",
    body: "Deferred-job terminal updates now stay consistent across chat, jobs, and the worker notification path.",
    href: "/admin/jobs",
    scope: "admin",
    unread: true,
  },
];

export function NotificationFeed({
  notifications = DEFAULT_NOTIFICATIONS,
  user,
}: NotificationFeedProps) {
  const [open, setOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const [dynamicNotifications, setDynamicNotifications] = useState<FeedNotification[]>([]);
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => item.scope !== "admin" || user?.roles.includes("ADMIN")),
    [notifications, user],
  );
  const mergedVisibleNotifications = useMemo(() => {
    const visibleDynamicNotifications = dynamicNotifications.filter((item) => item.scope !== "admin" || user?.roles.includes("ADMIN"));
    const merged = new Map<string, FeedNotification>();

    for (const item of [...visibleDynamicNotifications, ...visibleNotifications]) {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    }

    return Array.from(merged.values()).sort((left, right) => {
      if (!left.createdAt && !right.createdAt) {
        return 0;
      }
      if (!left.createdAt) {
        return 1;
      }
      if (!right.createdAt) {
        return -1;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
  }, [dynamicNotifications, user, visibleNotifications]);
  const [items, setItems] = useState(mergedVisibleNotifications);

  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);

  useEffect(() => {
    setItems(mergedVisibleNotifications);
  }, [mergedVisibleNotifications]);

  useEffect(() => {
    if (user?.id == null || notifications !== DEFAULT_NOTIFICATIONS || typeof fetch !== "function") {
      return;
    }

    let active = true;

    void fetch("/api/notifications/feed")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const payload = await response.json().catch(() => null) as { notifications?: FeedNotification[] } | null;
        return payload?.notifications ?? [];
      })
      .then((payload) => {
        if (!active || !payload) {
          return;
        }

        setDynamicNotifications(payload);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [notifications, user?.id]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (feedRef.current && !feedRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={feedRef} className="relative">
      <button
        type="button"
        className="shell-nav-icon-button focus-ring relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-background/80 text-foreground/60 transition hover:bg-foreground/4 hover:text-foreground sm:h-10 sm:w-10"
        aria-label="Open notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(90vw,24rem)] overflow-hidden rounded-2xl border border-foreground/12 bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-foreground/8 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-foreground/50">Recent platform updates</p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-foreground/50 hover:text-foreground"
              onClick={() => setItems(items.map((item) => ({ ...item, unread: false })))}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-foreground/50">No notifications</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="border-b border-foreground/5 last:border-b-0">
                    {item.href ? (
                      <Link
                        href={item.href}
                        className={`block px-4 py-3 transition hover:bg-foreground/4 ${item.unread ? "bg-foreground/2" : ""}`}
                        onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                            {item.scope}
                          </span>
                          {item.unread ? <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" /> : null}
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-foreground/60">{item.body}</p>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`block w-full px-4 py-3 text-left transition hover:bg-foreground/4 ${item.unread ? "bg-foreground/2" : ""}`}
                        onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex rounded-full border border-foreground/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                            {item.scope}
                          </span>
                          {item.unread ? <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" /> : null}
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-foreground/60">{item.body}</p>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
