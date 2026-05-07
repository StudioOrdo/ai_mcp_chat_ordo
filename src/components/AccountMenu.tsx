"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useTheme } from "./ThemeProvider";
import { useMockAuth } from "@/hooks/useMockAuth";
import {
  isShellRouteActive,
  resolveAccountMenuRoutes,
  type ShellRouteDefinition,
} from "@/lib/shell/shell-navigation";
import type { RoleName, User as SessionUser } from "@/core/entities/user";

interface AccountMenuProps {
  user?: SessionUser;
  role?: string;
}

const GUEST_ACCESS_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
] as const;

function isAuthenticated(user: Pick<SessionUser, "roles">): boolean {
  return user.roles.some((roleName) => roleName !== "ANONYMOUS");
}

function getRoleLabel(user: Pick<SessionUser, "roles">): string {
  if (user.roles.includes("ADMIN")) {
    return "Admin";
  }

  if (user.roles.includes("STAFF")) {
    return "Staff";
  }

  if (user.roles.includes("APPRENTICE")) {
    return "Apprentice";
  }

  if (user.roles.includes("AUTHENTICATED")) {
    return "Owner";
  }

  return "Visitor";
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "O";
}

function routeMatchesPath(route: ShellRouteDefinition, currentLocation: string): boolean {
  const [hrefPath, hrefQuery] = route.href.split("?");
  const [pathname, searchQuery = ""] = currentLocation.split("?");

  if (hrefQuery) {
    return hrefPath === pathname && hrefQuery === searchQuery;
  }

  if (searchQuery) {
    return false;
  }

  return isShellRouteActive({ ...route, href: hrefPath }, pathname);
}

function AccountRouteIcon({ routeId }: { routeId: string }) {
  if (routeId === "profile") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  if (routeId === "referrals") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M17 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M7 21.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="m9.6 7.1 4.8 2.3" />
        <path d="m9.4 17.1 5.2-4.2" />
      </svg>
    );
  }

  if (routeId === "preferences") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M4.6 7.5 7 9" />
        <path d="m17 15 2.4 1.5" />
        <path d="m4.6 16.5 2.4-1.5" />
        <path d="M17 9l2.4-1.5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  if (routeId === "theme") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" />
      </svg>
    );
  }

  if (routeId === "sign-out") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M10 5H6v14h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </svg>
    );
  }

  if (routeId === "login" || routeId === "register") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5h6v14h-6" />
        <path d="M5 12h10" />
        <path d="m11 8 4 4-4 4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5h14v14H5z" />
    </svg>
  );
}

function AccountMenuIcon({ routeId }: { routeId: string }) {
  return (
    <span className="shell-account-menu-icon" data-account-menu-icon={routeId} aria-hidden="true">
      <AccountRouteIcon routeId={routeId} />
    </span>
  );
}

function AccountMenuLink({
  route,
  currentLocation,
  onNavigate,
}: {
  route: ShellRouteDefinition;
  currentLocation: string;
  onNavigate: () => void;
}) {
  const active = routeMatchesPath(route, currentLocation);

  return (
    <Link
      href={route.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`shell-account-label flex min-h-11 items-center gap-(--space-2) rounded-theme px-(--space-inset-default) py-(--space-2) transition-all haptic-press hover-surface focus-ring ${
        active ? "ui-shell-menu-link-active" : ""
      }`}
      data-account-menu-route={route.id}
    >
      <AccountMenuIcon routeId={route.id} />
      <span className="min-w-0 truncate">{route.label}</span>
    </Link>
  );
}

function AccountMenuGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-(--space-1)" data-account-menu-group={label.toLowerCase().replaceAll(" ", "-")}>
      <p className="shell-micro-text ml-(--space-1) opacity-60">{label}</p>
      {children}
    </div>
  );
}

function ThemeToggleButton({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="shell-theme-toggle focus-ring"
      aria-label={isDark ? "Theme: dark. Switch to light theme" : "Theme: light. Switch to dark theme"}
      aria-pressed={isDark}
      data-shell-theme-toggle="true"
    >
      <span className="shell-theme-toggle-label">{isDark ? "Dark" : "Light"}</span>
      <span className="shell-theme-toggle-track" aria-hidden="true">
        <span className="shell-theme-toggle-thumb" />
      </span>
    </button>
  );
}

export function AccountMenu({ user: userProp, role }: AccountMenuProps) {
  const user: SessionUser = userProp ?? {
    id: "",
    email: "",
    name: role === "ADMIN" ? "Admin" : "Guest",
    roles: role ? [role as RoleName] : ["ANONYMOUS"],
  };
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [isDesktopSurface, setIsDesktopSurface] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathname = useRef(pathname);
  const { logout } = useMockAuth();
  const { isDark, setIsDark } = useTheme();

  const isAuth = isAuthenticated(user);
  const roleLabel = getRoleLabel(user);
  const initials = getInitials(user.name);
  const accountRoutes = resolveAccountMenuRoutes(user);
  const searchQuery = searchParams.toString();
  const currentLocation = searchQuery ? `${pathname}?${searchQuery}` : pathname;
  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    let frameId: number | null = null;

    if (!open) {
      previousPathname.current = pathname;
      return;
    }

    if (previousPathname.current !== pathname) {
      frameId = window.requestAnimationFrame(() => {
        closeMenu();
      });
    }

    previousPathname.current = pathname;

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [closeMenu, open, pathname]);

  useEffect(() => {
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || surfaceRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncSurface = () => setIsDesktopSurface(mediaQuery.matches);

    syncSurface();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncSurface);
      return () => mediaQuery.removeEventListener("change", syncSurface);
    }

    mediaQuery.addListener(syncSurface);
    return () => mediaQuery.removeListener(syncSurface);
  }, []);

  const renderRouteLinks = (routes: readonly ShellRouteDefinition[]) =>
    routes.map((route) => (
      <AccountMenuLink
        key={route.id}
        route={route}
        currentLocation={currentLocation}
        onNavigate={closeMenu}
      />
    ));

  const renderMenuContent = (surface: "dropdown" | "sheet") => (
    <>
      <div className={`ui-shell-dropdown-header px-(--space-inset-default) py-(--space-inset-compact) flex items-center justify-between ${surface === "dropdown" ? "mb-(--space-2) rounded-t-2xl" : "border-b border-foreground/8"}`}>
        <div className="flex min-w-0 items-center gap-(--space-3)">
          <div className="ui-shell-account-avatar shell-account-avatar rounded-full font-bold" aria-hidden="true">
            {isAuth ? initials : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 13.5a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 13.5Z" />
                <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="shell-panel-heading truncate">{isAuth ? user.name : "Account"}</p>
            <p className="shell-meta-text truncate opacity-50 normal-case tracking-[0.04em]">
              {isAuth ? roleLabel : "Login or register"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-(--space-2)">
          <ThemeToggleButton isDark={isDark} onToggle={() => setIsDark(!isDark)} />
          {surface === "sheet" ? (
            <button
              type="button"
              onClick={closeMenu}
              className="p-(--space-2) rounded-lg opacity-60 transition-all hover:opacity-100 focus-ring"
              aria-label="Close account menu"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          ) : null}
        </div>
      </div>

      {isAuth ? (
        <div className={`flex flex-col gap-(--space-4) ${surface === "sheet" ? "px-(--space-4) py-(--space-4)" : "px-(--space-inset-default)"}`}>
          {accountRoutes.length > 0 ? (
            <AccountMenuGroup label="Account">
              {renderRouteLinks(accountRoutes)}
            </AccountMenuGroup>
          ) : null}

        </div>
      ) : (
        <div className={`flex flex-col gap-(--space-1) ${surface === "sheet" ? "px-(--space-4) py-(--space-4)" : "px-(--space-inset-default)"}`}>
          <AccountMenuGroup label="Access">
            {GUEST_ACCESS_LINKS.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  aria-current={active ? "page" : undefined}
                  className={`shell-account-label flex min-h-11 items-center gap-(--space-2) rounded-theme px-(--space-inset-default) py-(--space-2) transition-all haptic-press hover-surface focus-ring ${active ? "ui-shell-menu-link-active" : ""}`}
                >
                  <AccountMenuIcon routeId={item.href === "/login" ? "login" : "register"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </AccountMenuGroup>
        </div>
      )}

      {isAuth ? (
        <>
          <div className="ui-shell-divider h-px mx-(--space-2) my-(--space-2)" />

          <div className={surface === "sheet" ? "px-(--space-4) pb-(--space-4)" : ""}>
            <button
              type="button"
              onClick={logout}
              className="shell-account-label shell-section-heading flex min-h-11 w-full items-center justify-center gap-(--space-2) rounded-theme px-(--space-inset-default) py-(--space-2) text-status-error/80 transition-opacity hover:opacity-100 focus-ring"
            >
              <AccountMenuIcon routeId="sign-out" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="relative" data-shell-account-rail={isAuth ? "authenticated" : "anonymous"}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ui-shell-account-trigger group shell-account-trigger rounded-full transition-all focus-ring hover:ui-shell-account-trigger-hover"
        aria-label={isAuth ? `${user.name} account menu` : "Open account menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        data-shell-account-trigger="true"
      >
        <div className="hidden min-w-0 flex-col items-end xl:flex">
          <span className="shell-account-label truncate leading-none text-foreground/78">
            {isAuth ? user.name : "Account"}
          </span>
          <span className="shell-micro-text opacity-40">
            {isAuth ? roleLabel : "Guest"}
          </span>
        </div>
        <div className="ui-shell-account-avatar shell-account-avatar rounded-full font-bold group-hover:bg-surface-hover transition-colors">
          {isAuth ? initials : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 13.5a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 13.5Z" />
              <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
            </svg>
          )}
        </div>
      </button>

      {open && (
        isDesktopSurface ? (
          <>
            <button
              type="button"
              aria-label="Close account menu"
              className="fixed inset-0 z-90 bg-transparent"
              onClick={closeMenu}
            />
            <div
              ref={surfaceRef}
              className="ui-shell-dropdown ui-shell-dropdown-anchor absolute right-0 z-100 w-[min(22rem,calc(100vw-var(--space-6)))] max-w-[calc(100vw-var(--space-4))] rounded-2xl p-(--space-inset-compact) flex flex-col gap-(--space-2) animate-in fade-in slide-in-from-top-2 duration-200 shadow-bloom"
              data-shell-dropdown="true"
              data-shell-account-menu="true"
            >
              {renderMenuContent("dropdown")}
            </div>
          </>
        ) : (
          <div className="fixed inset-0 z-100" data-shell-account-sheet="true">
            <button
              type="button"
              aria-label="Close account menu"
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={closeMenu}
            />
            <div
              ref={surfaceRef}
              className="absolute inset-x-(--space-2) bottom-(--space-2) max-h-[min(82vh,42rem)] overflow-y-auto rounded-2xl border border-foreground/10 bg-background shadow-2xl"
              data-shell-account-menu="true"
            >
              {renderMenuContent("sheet")}
            </div>
          </div>
        )
      )}
    </div>
  );
}
