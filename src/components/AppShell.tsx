"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import type { User as SessionUser } from "@/core/entities/user";

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isHomeRoute = pathname === "/";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isJournalRoute = pathname === "/journal"
    || pathname.startsWith("/journal/");
  const isDocumentFlowRoute = !isHomeRoute;
  const routeSurface = isHomeRoute
    ? "home"
    : isAdminRoute
      ? "admin"
      : isJournalRoute
        ? "journal"
        : "default";
  const shellClasses =
    "flex min-h-(--viewport-block-size) flex-col overflow-x-hidden bg-background text-foreground transition-colors duration-300";
  const homeMainClasses = "relative flex min-h-0 flex-1 flex-col overflow-hidden";
  const contentMainClasses = "relative flex min-h-0 flex-1 flex-col";
  const floatingChatClearance = isDocumentFlowRoute && !isAdminRoute ? "true" : undefined;

  if (isDocumentFlowRoute) {
    return (
      <div
        className={shellClasses}
        data-shell-scroll-owner="document"
        data-shell-route-mode="document-flow"
        data-shell-route-surface={routeSurface}
      >
        <div className="flex-none">
          <SiteNav user={user} />
        </div>

        <main
          className={contentMainClasses}
          data-shell-main-surface={routeSurface}
          data-shell-floating-chat-clearance={floatingChatClearance}
        >
          {children}
        </main>

        <div className="flex-none">
          <SiteFooter user={user} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={shellClasses}
      data-shell-scroll-owner="document"
      data-shell-route-mode="viewport-stage"
      data-shell-route-surface={routeSurface}
    >
      <div
        className="relative flex h-(--viewport-block-size) min-h-(--viewport-block-size) flex-none flex-col"
        data-shell-viewport-stage="true"
      >
        <div className="flex-none">
          <SiteNav user={user} />
        </div>
        <main
          className={homeMainClasses}
          data-home-chat-route={isHomeRoute ? "true" : undefined}
          data-shell-main-surface={routeSurface}
        >
          {children}
        </main>
      </div>

      <div className="flex-none">
        <SiteFooter user={user} />
      </div>
    </div>
  );
}
