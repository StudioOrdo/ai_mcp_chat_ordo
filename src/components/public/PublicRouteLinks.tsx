"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { User as SessionUser } from "@/core/entities/user";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  isShellRouteActive,
  resolvePrimaryNavRoutes,
  resolveRailMenuRoutes,
  type ShellNavigationContext,
  type ShellRouteDefinition,
} from "@/lib/shell/shell-navigation";

type PublicRouteVariant = "desktop" | "mobile-dock";

interface PublicRouteLinksProps {
  user: Pick<SessionUser, "roles">;
  navigationContext?: ShellNavigationContext;
  variant?: PublicRouteVariant;
}

function isAnonymousUser(user: Pick<SessionUser, "roles">): boolean {
  return user.roles.length === 0 || user.roles.every((role) => role === "ANONYMOUS");
}

function getRouteLabel(route: ShellRouteDefinition, variant: PublicRouteVariant): string {
  if (variant === "mobile-dock" && route.id === "home") {
    return "Chat";
  }

  return route.label;
}

function getRoutes(
  user: Pick<SessionUser, "roles">,
  navigationContext: ShellNavigationContext,
  variant: PublicRouteVariant,
): ShellRouteDefinition[] {
  const routes = variant === "mobile-dock"
    ? resolveRailMenuRoutes(user, navigationContext)
    : resolvePrimaryNavRoutes(user, navigationContext);

  if (variant === "desktop") {
    return routes.filter((route) => route.id !== "home");
  }

  return routes;
}

export function PublicRouteLinks({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
  variant = "desktop",
}: PublicRouteLinksProps) {
  const pathname = usePathname();
  const routes = getRoutes(user, navigationContext, variant);

  if (routes.length === 0) {
    return null;
  }

  if (variant === "mobile-dock") {
    return (
      <div className="public-mobile-route-dock-links" data-public-route-links="mobile-dock">
        {routes.map((route) => {
          const active = isShellRouteActive(route, pathname);
          const label = getRouteLabel(route, variant);

          return (
            <Link
              key={route.id}
              href={route.href}
              aria-current={active ? "page" : undefined}
              className="public-mobile-route-dock-link focus-ring"
              data-public-route-link={route.id}
              data-public-route-active={active ? "true" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="ui-shell-nav-links shell-nav-primary-links"
      data-shell-nav-region="primary-links"
      data-public-route-links="desktop"
    >
      {routes.map((route) => {
        const active = isShellRouteActive(route, pathname);
        const label = getRouteLabel(route, variant);

        return (
          <Link
            key={route.id}
            href={route.href}
            aria-current={active ? "page" : undefined}
            className={`shell-nav-public-link shell-nav-label rounded-lg px-(--space-3) py-(--space-2) transition-all focus-ring ${
              active ? "ui-shell-nav-item-active" : "ui-shell-nav-item-idle"
            }`}
            data-public-route-link={route.id}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function PublicMobileRouteDock({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
}: PublicRouteLinksProps) {
  if (!isAnonymousUser(user)) {
    return null;
  }

  return (
    <nav
      aria-label="Public navigation"
      className="public-mobile-route-dock"
      data-public-mobile-route-dock="true"
    >
      <PublicRouteLinks
        user={user}
        navigationContext={navigationContext}
        variant="mobile-dock"
      />
    </nav>
  );
}
