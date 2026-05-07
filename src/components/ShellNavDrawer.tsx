"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

import {
  isAdminNavigationItemActive,
  resolveAdminNavigationGroups,
} from "@/lib/admin/admin-navigation";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  isShellRouteActive,
  resolveShellNavDrawerGroups,
  SHELL_BRAND,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";
import type { User as SessionUser } from "@/core/entities/user";

interface ShellNavDrawerProps {
  user: SessionUser;
  navigationContext?: ShellNavigationContext;
  tone?: "default" | "quiet";
}

export function ShellNavDrawer({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
  tone = "default",
}: ShellNavDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousPathname = useRef(pathname);

  const drawerGroups = resolveShellNavDrawerGroups(user, navigationContext);
  const adminGroups = user.roles.includes("ADMIN") ? resolveAdminNavigationGroups() : [];

  const closeDrawer = useCallback((restoreFocus = false) => {
    setOpen(false);

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
        setOpen(false);
      });
    }

    previousPathname.current = pathname;

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [open, pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer(true);
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
  }, [closeDrawer, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      closeDrawer();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeDrawer, open]);

  const itemTone = tone === "quiet" ? "quiet" : undefined;

  const overlay = open ? (
    <div className="fixed inset-0 z-100" data-shell-nav-drawer="true">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-black/24 backdrop-blur-sm"
        onClick={() => closeDrawer()}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        className="ui-shell-dropdown absolute inset-y-0 left-0 flex w-[min(24rem,calc(100vw-var(--space-3)))] max-w-full flex-col overflow-hidden border-r border-foreground/8"
        data-shell-nav-tone={tone}
      >
        <div className="ui-shell-dropdown-header flex items-center justify-between px-(--space-4) py-(--space-3)">
          <div className="grid gap-1">
            <span className="shell-section-heading text-foreground/42">Navigation</span>
            <span className="shell-panel-heading">{SHELL_BRAND.shortName}</span>
          </div>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="shell-nav-icon-button focus-ring"
            onClick={() => closeDrawer(true)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-(--space-4) py-(--space-4)">
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

                    return (
                      <li key={route.id}>
                        <Link
                          href={route.href}
                          aria-current={isActive ? "page" : undefined}
                          className={`block rounded-2xl px-(--space-inset-default) py-(--space-3) transition-all haptic-press hover-surface focus-ring ${isActive ? "ui-shell-menu-link-active" : ""}`}
                          data-shell-nav-item-tone={itemTone}
                          onClick={() => closeDrawer()}
                        >
                          <span className="shell-account-label block">{route.label}</span>
                          {route.description ? (
                            <span className="shell-supporting-text mt-(--space-1) block text-foreground/58">
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

            {adminGroups.length > 0 ? (
              <section className="flex flex-col gap-(--space-3)">
                <div className="grid gap-1 px-(--space-1)">
                  <h2 className="shell-section-heading text-foreground/42">Admin</h2>
                  <p className="shell-supporting-text text-foreground/58">
                    Move across operational workspaces without routing through account settings.
                  </p>
                </div>

                <div className="flex flex-col gap-(--space-3)">
                  {adminGroups.map((group) => (
                    <div key={group.id} className="grid gap-(--space-1)">
                      <p className="shell-section-heading px-(--space-inset-default) text-foreground/35">{group.label}</p>
                      {group.items.map((item) => {
                        const isActive = isAdminNavigationItemActive(item, pathname);

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            className={`block rounded-2xl px-(--space-inset-default) py-(--space-3) transition-all haptic-press hover-surface focus-ring ${isActive ? "ui-shell-menu-link-active" : ""}`}
                            onClick={() => closeDrawer()}
                          >
                            <span className="shell-account-label block">{item.label}</span>
                            <span className="shell-supporting-text mt-(--space-1) block text-foreground/58">
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
          </div>
        </nav>

        <div className="border-t border-foreground/8 px-(--space-4) py-(--space-3)">
          <p className="shell-micro-text text-foreground/40">{SHELL_BRAND.name}</p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative" data-shell-nav-region="primary-links" data-shell-nav-drawer-surface="true">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="shell-nav-icon-button focus-ring"
        data-shell-nav-item-tone={itemTone}
        onClick={() => setOpen((current) => !current)}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {overlay && typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : overlay}
    </div>
  );
}
