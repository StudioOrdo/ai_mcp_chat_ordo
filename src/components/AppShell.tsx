"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { AuthenticatedWorkRail } from "@/components/AuthenticatedWorkRail";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { PublicMobileRouteDock } from "@/components/public/PublicRouteLinks";
import type { User as SessionUser } from "@/core/entities/user";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";

interface AppShellProps {
  user: SessionUser;
  navigationContext?: ShellNavigationContext;
  children: React.ReactNode;
}

export function AppShell({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const isHomeRoute = pathname === "/";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isFeedRoute = pathname === "/feed"
    || pathname.startsWith("/feed/");
  const isOperationsRoute = pathname === "/operations" || pathname.startsWith("/operations/");
  const isDocumentFlowRoute = !isHomeRoute;
  const routeSurface = isHomeRoute
    ? "home"
    : isAdminRoute
      ? "admin"
      : isFeedRoute
        ? "feed"
        : isOperationsRoute
          ? "operations"
          : "default";
  const shellClasses =
    "flex min-h-(--viewport-block-size) flex-col overflow-x-hidden bg-background text-foreground transition-colors duration-300";
  const homeMainClasses = "relative flex min-h-0 flex-1 flex-col overflow-hidden";
  const contentMainClasses = "relative flex min-h-0 flex-1 flex-col";
  const floatingChatClearance = isDocumentFlowRoute && !isAdminRoute ? "true" : undefined;
  const hasPublicMobileNav = user.roles.every((role) => role === "ANONYMOUS");
  const hasOwnerWorkspace = user.roles.some((role) => role !== "ANONYMOUS");

  if (isDocumentFlowRoute) {
    return (
      <div
        className={shellClasses}
        data-shell-scroll-owner="document"
        data-shell-route-mode="document-flow"
        data-shell-route-surface={routeSurface}
        data-shell-public-mobile-nav={hasPublicMobileNav ? "true" : undefined}
        data-shell-authenticated-workspace={hasOwnerWorkspace ? "true" : undefined}
      >
        <div className="flex-none">
          <SiteNav user={user} navigationContext={navigationContext} />
        </div>

        <div
          className={hasOwnerWorkspace ? "shell-authenticated-layout" : "contents"}
          data-shell-authenticated-layout={hasOwnerWorkspace ? "true" : undefined}
        >
          <AuthenticatedWorkRail user={user} />

          <div
            className={hasOwnerWorkspace ? "shell-authenticated-content" : "contents"}
            data-shell-authenticated-content={hasOwnerWorkspace ? "true" : undefined}
          >
            <main
              className={contentMainClasses}
              data-shell-main-surface={routeSurface}
              data-shell-floating-chat-clearance={floatingChatClearance}
            >
              {children}
            </main>

            <div className="flex-none">
              <SiteFooter user={user} navigationContext={navigationContext} />
            </div>

            <PublicMobileRouteDock user={user} navigationContext={navigationContext} />
          </div>
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
      data-shell-public-mobile-nav={hasPublicMobileNav ? "true" : undefined}
      data-shell-authenticated-workspace={hasOwnerWorkspace ? "true" : undefined}
    >
      <div
        className="relative flex h-(--viewport-block-size) min-h-(--viewport-block-size) flex-none flex-col"
        data-shell-viewport-stage="true"
      >
        <div className="flex-none">
          <SiteNav user={user} navigationContext={navigationContext} />
        </div>

        <div
          className={hasOwnerWorkspace ? "shell-authenticated-layout min-h-0 flex-1" : "contents"}
          data-shell-authenticated-layout={hasOwnerWorkspace ? "true" : undefined}
        >
          <AuthenticatedWorkRail user={user} />

          <div
            className={hasOwnerWorkspace ? "shell-authenticated-content min-h-0" : "contents"}
            data-shell-authenticated-content={hasOwnerWorkspace ? "true" : undefined}
          >
            <main
              className={homeMainClasses}
              data-home-chat-route={isHomeRoute ? "true" : undefined}
              data-shell-main-surface={routeSurface}
            >
              {children}
            </main>
          </div>
        </div>
      </div>

      <div className="flex-none">
        <SiteFooter user={user} navigationContext={navigationContext} />
      </div>

      <PublicMobileRouteDock user={user} navigationContext={navigationContext} />
    </div>
  );
}
