"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import { useTheme } from "@/components/ThemeProvider";
import type { AccessibilitySettings, FontSize, SpacingLevel } from "@/components/ThemeProvider";
import type { User as SessionUser, RoleName } from "@/core/entities/user";
import { useMockAuth } from "@/hooks/useMockAuth";
import {
  isAdminNavigationItemActive,
  resolveAdminNavigationGroups,
  resolveAdminWorkspaceContext,
} from "@/lib/admin/admin-navigation";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  isShellRouteActive,
  resolveShellNavDrawerGroups,
  SHELL_BRAND,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";

interface ShellWorkspaceMenuProps {
  user: SessionUser;
  navigationContext?: ShellNavigationContext;
  tone?: "default" | "quiet";
}

const ROLE_CONFIG: Record<
  RoleName,
  { label: string; dot: string; description: string }
> = {
  ANONYMOUS: {
    label: "Anonymous",
    dot: "bg-[color:color-mix(in_oklab,var(--foreground)_38%,transparent)]",
    description: "Public visitor",
  },
  AUTHENTICATED: {
    label: "Authenticated",
    dot: "bg-status-success",
    description: "Signed-in workspace access",
  },
  APPRENTICE: {
    label: "Apprentice",
    dot: "bg-[color:color-mix(in_oklab,var(--status-success)_72%,var(--accent-interactive))]",
    description: "Student workflow access",
  },
  STAFF: {
    label: "Staff",
    dot: "bg-[color:color-mix(in_oklab,var(--accent-interactive)_82%,var(--foreground))]",
    description: "Internal operator access",
  },
  ADMIN: {
    label: "Admin",
    dot: "bg-[color:color-mix(in_oklab,var(--status-error)_55%,var(--accent-interactive))]",
    description: "Global configuration access",
  },
};

const GUEST_ACCESS_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
] as const;

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

const SPACING: { value: SpacingLevel; label: string }[] = [
  { value: "tight", label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];

function SettingBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-2)">
      <div className="shell-micro-text ml-(--space-1) opacity-60">{label}</div>
      <div className="ui-shell-setting-row shell-action-row rounded-theme border-theme p-(--space-1)" data-shell-setting-row="true">
        {children}
      </div>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shell-micro-text flex-1 rounded-lg py-(--space-2) transition-all focus-ring ${
        active
          ? "ui-shell-setting-option-active"
          : "ui-shell-setting-option-idle hover:opacity-100"
      }`}
      data-shell-setting-option={active ? "active" : "idle"}
    >
      {label}
    </button>
  );
}

export function ShellWorkspaceMenu({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
  tone = "default",
}: ShellWorkspaceMenuProps) {
  const [open, setOpen] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousPathname = useRef(pathname);
  const { switchRole, logout } = useMockAuth();
  const {
    isDark,
    setIsDark,
    accessibility,
    setAccessibility,
  } = useTheme();

  const drawerGroups = resolveShellNavDrawerGroups(user, navigationContext);
  const adminGroups = user.roles.includes("ADMIN") ? resolveAdminNavigationGroups() : [];
  const adminWorkspaceContext = user.roles.includes("ADMIN")
    ? resolveAdminWorkspaceContext(pathname, searchParams)
    : null;
  const primaryRole = user.roles[0] ?? "ANONYMOUS";
  const isAuthenticated = user.roles.some((role) => role !== "ANONYMOUS");
  const canSimulate = user.roles.includes("ADMIN") || process.env.NODE_ENV === "development";
  const roleConfig = ROLE_CONFIG[primaryRole] ?? ROLE_CONFIG.ANONYMOUS;
  const itemTone = tone === "quiet" ? "quiet" : undefined;

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    setShowAccessibility(false);
    setShowSimulation(false);

    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
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
        closeMenu(true);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button, [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      const firstInteractive = panelRef.current?.querySelector<HTMLElement>("a[href], button");
      firstInteractive?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  const updateAccessibility = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K],
  ) => {
    setAccessibility({ ...accessibility, [key]: value });
  };

  const overlay = open ? (
    <div className="fixed inset-0 z-100" data-shell-workspace-menu-surface="true">
      <button
        type="button"
        aria-label="Close workspace menu"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => closeMenu()}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Workspace menu"
        className="ui-shell-dropdown safe-area-pt safe-area-pb absolute inset-y-0 left-0 flex w-[min(24rem,calc(100vw-var(--space-3)))] max-w-full flex-col overflow-hidden border-r border-foreground/10"
        data-shell-nav-tone={tone}
      >
        <div className="ui-shell-dropdown-header flex items-start justify-between gap-(--space-3) px-(--space-4) py-(--space-3)">
          <div className="flex min-w-0 flex-1 items-start gap-(--space-3)">
            <Image
              src="/ordo-mark.png"
              alt=""
              width={40}
              height={40}
              aria-hidden="true"
              className="shell-workspace-menu-header-mark shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="shell-section-heading text-foreground/42">Main Menu</p>
              <p className="shell-panel-heading mt-1 truncate">{SHELL_BRAND.shortName}</p>
              <div className="mt-(--space-2) flex items-start gap-(--space-2)">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${roleConfig.dot}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="shell-meta-text truncate opacity-50 normal-case tracking-[0.04em]">
                    {isAuthenticated ? user.email : roleConfig.label}
                  </p>
                  <p className="shell-supporting-text text-foreground/58">{roleConfig.description}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="ui-shell-control-cluster shell-action-row rounded-theme border-theme p-(--space-1) shadow-inner">
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className={`rounded-lg p-(--space-2) transition-all focus-ring ${isDark ? "accent-interactive-fill" : "opacity-40 hover:opacity-100"}`}
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => closeMenu(true)}
              className="rounded-lg p-(--space-2) opacity-60 transition-all hover:opacity-100 focus-ring"
              aria-label="Close workspace menu"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-(--space-4) py-(--space-4)">
          <div className="flex flex-col gap-(--space-5)">
            {drawerGroups.map((group) => (
              <section key={group.id} className="flex flex-col gap-(--space-2)">
                <div className="grid gap-1 px-(--space-1)">
                  <h2 className="shell-section-heading text-foreground/42">{group.label}</h2>
                  {group.description ? (
                    <p className="shell-supporting-text text-foreground/58">{group.description}</p>
                  ) : null}
                </div>

                <ul className="flex flex-col gap-(--space-1)">
                  {group.routes.map((route) => {
                    const isActive = isShellRouteActive(route, pathname);
                    const routeLabel = route.id === "jobs" ? "My Jobs" : route.label;
                    const labelId = `shell-workspace-route-${group.id}-${route.id}-label`;
                    const descriptionId = route.description
                      ? `shell-workspace-route-${group.id}-${route.id}-description`
                      : undefined;

                    return (
                      <li key={route.id}>
                        <Link
                          href={route.href}
                          aria-current={isActive ? "page" : undefined}
                          aria-labelledby={labelId}
                          aria-describedby={descriptionId}
                          className={`block rounded-2xl px-(--space-inset-default) py-(--space-3) transition-all haptic-press hover-surface focus-ring ${isActive ? "ui-shell-menu-link-active" : ""}`}
                          data-shell-nav-item-tone={itemTone}
                          onClick={() => closeMenu()}
                        >
                          <span id={labelId} className="shell-account-label block">{routeLabel}</span>
                          {route.description ? (
                            <span
                              id={descriptionId}
                              className="shell-supporting-text mt-(--space-1) block text-foreground/58"
                            >
                              {route.description}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {!isAuthenticated ? (
              <section className="flex flex-col gap-(--space-2)">
                <div className="grid gap-1 px-(--space-1)">
                  <h2 className="shell-section-heading text-foreground/42">Access</h2>
                  <p className="shell-supporting-text text-foreground/58">
                    Login or register to save conversations, unlock richer tools, and track referrals.
                  </p>
                </div>

                <div className="flex flex-col gap-(--space-1)">
                  {GUEST_ACCESS_LINKS.map((item) => {
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`block rounded-2xl px-(--space-inset-default) py-(--space-3) transition-all haptic-press hover-surface focus-ring ${isActive ? "ui-shell-menu-link-active" : ""}`}
                        onClick={() => closeMenu()}
                      >
                        <span className="shell-account-label block">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {adminGroups.length > 0 ? (
              <section className="flex flex-col gap-(--space-3)">
                <div className="grid gap-1 px-(--space-1)">
                  <h2 className="shell-section-heading text-foreground/42">Admin</h2>
                  <p className="shell-supporting-text text-foreground/58">
                    Move across admin workspaces from the same mobile surface.
                  </p>
                </div>

                <div className="flex flex-col gap-(--space-3)">
                  {adminGroups.map((group) => (
                    <div key={group.id} className="grid gap-(--space-1)">
                      <h3 className="shell-section-heading px-(--space-inset-default) text-foreground/35">{group.label}</h3>
                      {group.items.map((item) => {
                        const isActive = isAdminNavigationItemActive(item, pathname);
                        const itemLabel = item.id === "admin-jobs" ? "Global Jobs" : item.label;
                        const labelId = `shell-workspace-admin-${group.id}-${item.id}-label`;
                        const descriptionId = `shell-workspace-admin-${group.id}-${item.id}-description`;

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            aria-labelledby={labelId}
                            aria-describedby={descriptionId}
                            className={`block rounded-2xl px-(--space-inset-default) py-(--space-3) transition-all haptic-press hover-surface focus-ring ${isActive ? "ui-shell-menu-link-active" : ""}`}
                            onClick={() => closeMenu()}
                          >
                            <span id={labelId} className="shell-account-label block">{itemLabel}</span>
                            <span
                              id={descriptionId}
                              className="shell-supporting-text mt-(--space-1) block text-foreground/58"
                            >
                              {item.description}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {adminWorkspaceContext ? (
              <section className="flex flex-col gap-(--space-2)">
                <div className="grid gap-1 px-(--space-1)">
                  <h2 className="shell-section-heading text-foreground/42">{adminWorkspaceContext.label}</h2>
                  <p className="shell-supporting-text text-foreground/58">
                    {adminWorkspaceContext.description}
                  </p>
                </div>

                <ul className="flex flex-col gap-(--space-1)">
                  {adminWorkspaceContext.items.map((item) => {
                    const isActive = item.id === adminWorkspaceContext.currentItemId;
                    const labelId = `shell-workspace-context-${adminWorkspaceContext.id}-${item.id}-label`;
                    const descriptionId = `shell-workspace-context-${adminWorkspaceContext.id}-${item.id}-description`;

                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          aria-labelledby={labelId}
                          aria-describedby={descriptionId}
                          className={`block rounded-2xl px-(--space-inset-default) py-(--space-3) transition-all haptic-press hover-surface focus-ring ${isActive ? "ui-shell-menu-link-active" : ""}`}
                          onClick={() => closeMenu()}
                        >
                          <span id={labelId} className="shell-account-label block">{item.label}</span>
                          <span
                            id={descriptionId}
                            className="shell-supporting-text mt-(--space-1) block text-foreground/58"
                          >
                            {item.description}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <section className="flex flex-col gap-(--space-2)">
              <div className="grid gap-1 px-(--space-1)">
                <h2 className="shell-section-heading text-foreground/42">System</h2>
                <p className="shell-supporting-text text-foreground/58">
                  Tune legibility without leaving the current route.
                </p>
              </div>

              <div className="flex flex-col gap-(--space-1)">
                <button
                  type="button"
                  onClick={() => setShowAccessibility((current) => !current)}
                  className={`shell-account-label flex items-center justify-between rounded-theme px-(--space-inset-default) py-(--space-2) transition-all hover-surface focus-ring ${showAccessibility ? "ui-shell-accordion-active" : ""}`}
                >
                  System Legibility
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-300 ${showAccessibility ? "rotate-180" : ""}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>

                {showAccessibility ? (
                  <div className="flex flex-col gap-(--space-4) px-(--space-inset-default) py-(--space-4) animate-in fade-in slide-in-from-top-2">
                    <SettingBlock label="Type Scale">
                      {FONT_SIZES.map((fontSize) => (
                        <ControlButton
                          key={fontSize.value}
                          label={fontSize.label}
                          active={accessibility.fontSize === fontSize.value}
                          onClick={() => updateAccessibility("fontSize", fontSize.value)}
                        />
                      ))}
                    </SettingBlock>

                    <SettingBlock label="Line Height">
                      {SPACING.map((spacing) => (
                        <ControlButton
                          key={spacing.value}
                          label={spacing.label}
                          active={accessibility.lineHeight === spacing.value}
                          onClick={() => updateAccessibility("lineHeight", spacing.value)}
                        />
                      ))}
                    </SettingBlock>

                    <SettingBlock label="Tracking">
                      {SPACING.map((spacing) => (
                        <ControlButton
                          key={spacing.value}
                          label={spacing.label}
                          active={accessibility.letterSpacing === spacing.value}
                          onClick={() => updateAccessibility("letterSpacing", spacing.value)}
                        />
                      ))}
                    </SettingBlock>
                  </div>
                ) : null}
              </div>
            </section>

            {canSimulate ? (
              <section className="flex flex-col gap-(--space-1)">
                <button
                  type="button"
                  onClick={() => setShowSimulation((current) => !current)}
                  className={`shell-account-label flex items-center justify-between rounded-theme px-(--space-inset-default) py-(--space-2) transition-all hover-surface focus-ring ${showSimulation ? "ui-shell-accordion-active" : ""}`}
                >
                  Simulation Mode
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform duration-300 ${showSimulation ? "rotate-180" : ""}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>

                {showSimulation ? (
                  <div className="flex flex-col gap-(--space-2) px-(--space-inset-default) py-(--space-3) animate-in fade-in slide-in-from-top-2">
                    {(Object.entries(ROLE_CONFIG) as [RoleName, (typeof ROLE_CONFIG)[RoleName]][]).map(([roleName, config]) => (
                      <button
                        key={roleName}
                        type="button"
                        onClick={() => switchRole(roleName)}
                        className={`focus-ring flex min-h-11 w-full items-start gap-(--space-2) rounded-theme px-(--space-inset-default) py-(--space-1) text-left transition-all haptic-press hover-surface ${user.roles.includes(roleName) ? "ui-shell-simulation-active" : ""}`}
                      >
                        <span className={`mt-(--space-2) h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                        <div className="min-w-0">
                          <p className="shell-account-label leading-tight">{config.label}</p>
                          <p className="shell-nav-label truncate opacity-60">{config.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <div className="border-t border-foreground/8 px-(--space-4) py-(--space-3)">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                closeMenu();
                logout();
              }}
              className="shell-section-heading w-full py-(--space-1) text-center opacity-60 transition-opacity hover:opacity-100 focus-ring"
            >
              Sign Out
            </button>
          ) : (
            <p className="shell-micro-text text-foreground/40">{SHELL_BRAND.name}</p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative" data-shell-workspace-menu="true">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open workspace menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="shell-nav-icon-button focus-ring"
        data-shell-workspace-menu-trigger="true"
        data-shell-nav-item-tone={itemTone}
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          className="shell-workspace-menu-trigger-glyph"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
          data-shell-workspace-menu-trigger-glyph="true"
        >
          <path d="M5 7h14" />
          <path d="M5 12h14" />
          <path d="M5 17h14" />
        </svg>
      </button>

      {overlay && typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : overlay}
    </div>
  );
}
