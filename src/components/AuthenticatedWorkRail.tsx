"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { User as SessionUser } from "@/core/entities/user";
import { useJobsRailController } from "@/frameworks/ui/jobs-rail/useJobsRailController";
import {
  isShellRouteActive,
  resolveAuthenticatedAdminRailRoutes,
  resolveAuthenticatedWorkRailRoutes,
  type ShellRouteDefinition,
} from "@/lib/shell/shell-navigation";

interface AuthenticatedWorkRailProps {
  user: Pick<SessionUser, "id" | "roles">;
}

interface InboxPayload {
  unreadCount?: number;
}

function isAnonymousUser(user: Pick<SessionUser, "roles">): boolean {
  return user.roles.length === 0 || user.roles.every((role) => role === "ANONYMOUS");
}

function formatBadgeCount(count: number): string {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

function useAttentionInboxCount(userId: string | null): number {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!userId || typeof fetch !== "function") {
      setCount(0);
      return;
    }

    const controller = new AbortController();

    async function refreshCount() {
      try {
        const response = await fetch("/api/activity?inbox=true&limit=1", {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as InboxPayload | null;
        if (!response.ok || !payload) {
          setCount(0);
          return;
        }
        setCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCount(0);
        }
      }
    }

    void refreshCount();

    return () => controller.abort();
  }, [userId]);

  return count;
}

function routeLabel(route: ShellRouteDefinition): string {
  if (route.id === "admin-dashboard") return "Admin";
  if (route.id === "admin-jobs") return "Jobs";
  if (route.id === "admin-system") return "System";
  return route.label;
}

function routeBadgeCount(route: ShellRouteDefinition, counts: {
  activeJobs: number;
  attentionJobs: number;
  unreadAttention: number;
}): number {
  if (route.id === "workspace-overview") {
    return counts.unreadAttention + counts.attentionJobs;
  }

  if (route.id === "studio" || route.id === "admin-jobs") {
    return counts.activeJobs + counts.attentionJobs;
  }

  return 0;
}

function RouteIcon({ routeId }: { routeId: string }) {
  if (routeId === "ordo-chat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-4 4v-4.2A3.5 3.5 0 0 1 5 11.5z" />
        <path d="M9 8h6" />
        <path d="M9 11h4" />
      </svg>
    );
  }

  if (routeId === "workspace-overview") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 12h4l2-7 3 14 2-7h3" />
      </svg>
    );
  }

  if (routeId === "studio") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 7h16" />
        <path d="M6 7v12h12V7" />
        <path d="m9 13 2 2 4-5" />
      </svg>
    );
  }

  if (routeId === "business") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M16 11a4 4 0 1 0-8 0" />
        <path d="M4 20a8 8 0 0 1 16 0" />
        <path d="M18 5v4" />
        <path d="M20 7h-4" />
      </svg>
    );
  }

  if (routeId === "offers") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 6h16v12H4z" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    );
  }

  if (routeId === "business-about") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <path d="M12 7h.01" />
      </svg>
    );
  }

  if (routeId === "knowledge-base") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H19v15H8.5A2.5 2.5 0 0 0 6 20.5z" />
        <path d="M6 5.5v15" />
        <path d="M10 7h5" />
        <path d="M10 10h6" />
      </svg>
    );
  }

  if (routeId === "admin-jobs") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 7h14" />
        <path d="M5 12h14" />
        <path d="M5 17h14" />
        <path d="M8 7v10" />
      </svg>
    );
  }

  if (routeId === "admin-system") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5h14v14H5z" />
      <path d="M9 9h6v6H9z" />
    </svg>
  );
}

function RailLinks({
  routes,
  pathname,
  counts,
  group,
}: {
  routes: ShellRouteDefinition[];
  pathname: string;
  counts: {
    activeJobs: number;
    attentionJobs: number;
    unreadAttention: number;
  };
  group: "owner" | "admin";
}) {
  return (
    <div className="authenticated-work-rail-links" data-authenticated-work-rail-links={group}>
      {routes.map((route) => {
        const active = isShellRouteActive(route, pathname);
        const label = routeLabel(route);
        const badgeCount = routeBadgeCount(route, counts);
        const badgeLabel = formatBadgeCount(badgeCount);

        return (
          <Link
            key={route.id}
            href={route.href}
            aria-current={active ? "page" : undefined}
            className="authenticated-work-rail-link focus-ring"
            data-authenticated-work-rail-route={route.id}
            data-authenticated-work-rail-group={group}
            data-authenticated-work-rail-active={active ? "true" : undefined}
            title={route.description}
          >
            <span className="authenticated-work-rail-icon" aria-hidden="true">
              <RouteIcon routeId={route.id} />
              {badgeCount > 0 ? (
                <span
                  className="authenticated-work-rail-badge"
                  data-authenticated-work-rail-badge={route.id}
                  data-authenticated-work-rail-badge-count={badgeCount}
                  aria-hidden="true"
                >
                  {badgeLabel}
                </span>
              ) : null}
            </span>
            <span className="authenticated-work-rail-label">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AuthenticatedWorkRail({ user }: AuthenticatedWorkRailProps) {
  const pathname = usePathname();
  const isAnonymous = isAnonymousUser(user);
  const routes = isAnonymous ? [] : resolveAuthenticatedWorkRailRoutes(user);
  const adminRoutes = isAnonymous ? [] : resolveAuthenticatedAdminRailRoutes(user);
  const jobsRail = useJobsRailController();
  const unreadAttention = useAttentionInboxCount(isAnonymous ? null : user.id);
  const counts = {
    activeJobs: jobsRail.model.activeCount ?? 0,
    attentionJobs: jobsRail.model.attentionCount ?? 0,
    unreadAttention,
  };

  if (isAnonymous) {
    return null;
  }

  if (routes.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Workspace"
      className="authenticated-work-rail"
      data-authenticated-work-rail="true"
    >
      <div className="authenticated-work-rail-frame">
        <div
          className="authenticated-work-rail-body"
          data-authenticated-work-rail-desktop="true"
        >
          <RailLinks routes={routes} pathname={pathname} counts={counts} group="owner" />
          {adminRoutes.length > 0 ? (
            <div className="authenticated-work-rail-admin" data-authenticated-work-rail-admin="true">
              <span className="authenticated-work-rail-group-label">Admin</span>
              <RailLinks routes={adminRoutes} pathname={pathname} counts={counts} group="admin" />
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
