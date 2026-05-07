"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { User as SessionUser } from "@/core/entities/user";
import {
  isShellRouteActive,
  resolveAuthenticatedAdminRailRoutes,
  resolveAuthenticatedWorkRailRoutes,
  type ShellRouteDefinition,
} from "@/lib/shell/shell-navigation";

interface ShellMobileMainMenuProps {
  user: Pick<SessionUser, "id" | "roles">;
}

function routeMatchesPath(route: ShellRouteDefinition, pathname: string): boolean {
  const [hrefPath] = route.href.split("?");

  return isShellRouteActive({ ...route, href: hrefPath }, pathname);
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function MenuRouteList({
  label,
  routes,
  pathname,
  onNavigate,
}: {
  label: string;
  routes: readonly ShellRouteDefinition[];
  pathname: string;
  onNavigate: () => void;
}) {
  if (routes.length === 0) {
    return null;
  }

  return (
    <div className="shell-mobile-main-menu-group" data-shell-mobile-main-menu-group={label.toLowerCase()}>
      <p className="shell-micro-text shell-mobile-main-menu-group-label">{label}</p>
      <div className="shell-mobile-main-menu-links">
        {routes.map((route) => {
          const active = routeMatchesPath(route, pathname);

          return (
            <Link
              key={route.id}
              href={route.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="shell-mobile-main-menu-link focus-ring"
              data-shell-mobile-main-menu-route={route.id}
              data-shell-mobile-main-menu-active={active ? "true" : undefined}
            >
              <span className="shell-mobile-main-menu-route-label">{route.label}</span>
              <span className="shell-mobile-main-menu-route-description">{route.description}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ShellMobileMainMenu({ user }: ShellMobileMainMenuProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const ownerRoutes = React.useMemo(() => resolveAuthenticatedWorkRailRoutes(user), [user]);
  const adminRoutes = React.useMemo(() => resolveAuthenticatedAdminRailRoutes(user), [user]);
  const closeMenu = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, open]);

  return (
    <div className="shell-mobile-main-menu" data-shell-mobile-main-menu="true">
      <button
        type="button"
        className="shell-mobile-main-menu-trigger shell-nav-icon-button focus-ring"
        aria-label="Open main menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        data-shell-mobile-main-menu-trigger="true"
      >
        <MenuIcon />
      </button>

      {open ? (
        <div className="shell-mobile-main-menu-layer" data-shell-mobile-main-menu-layer="true">
          <button
            type="button"
            className="shell-mobile-main-menu-backdrop"
            aria-label="Close main menu"
            onClick={closeMenu}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="shell-mobile-main-menu-panel"
            data-shell-mobile-main-menu-panel="true"
          >
            <div className="shell-mobile-main-menu-header">
              <div>
                <p className="shell-micro-text opacity-50">Workspace</p>
                <h2 className="shell-panel-heading">Main menu</h2>
              </div>
              <button
                type="button"
                className="shell-mobile-main-menu-close focus-ring"
                aria-label="Close main menu"
                onClick={closeMenu}
              >
                <CloseIcon />
              </button>
            </div>

            <MenuRouteList
              label="Owner"
              routes={ownerRoutes}
              pathname={pathname}
              onNavigate={closeMenu}
            />

            <MenuRouteList
              label="Admin"
              routes={adminRoutes}
              pathname={pathname}
              onNavigate={closeMenu}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
