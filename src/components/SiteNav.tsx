"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/AccountMenu";
import { ShellBrand } from "@/components/shell/ShellBrand";
import { ShellMobileMainMenu } from "@/components/shell/ShellMobileMainMenu";
import { PublicRouteLinks } from "@/components/public/PublicRouteLinks";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  resolveShellHomeHref,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";
import type { User as SessionUser } from "@/core/entities/user";

interface SiteNavProps {
  user: SessionUser;
  navigationContext?: ShellNavigationContext;
}

const GUEST_ACCESS_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
] as const;

export function SiteNav({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
}: SiteNavProps) {
  const pathname = usePathname();
  const isFeedRoute = pathname === "/feed"
    || pathname.startsWith("/feed/");
  const navTone = isFeedRoute ? "quiet" : "default";
  const homeHref = resolveShellHomeHref();
  const isAnonymous = user.roles.every((role) => role === "ANONYMOUS");
  const isAuthenticated = !isAnonymous;

  return (
    <nav
      className="ui-shell-rail ui-shell-rail-safe-top sticky top-0 z-50 transition-colors duration-500"
      aria-label="Primary"
      data-shell-nav-rail="true"
      data-shell-nav-tone={navTone}
      data-shell-nav-authenticated={isAuthenticated ? "true" : undefined}
    >
      <div
        className="site-container relative mx-auto w-full shell-nav-frame"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-(--space-16) bottom-0 h-px bg-linear-to-r from-transparent via-foreground/8 to-transparent" />
        <div
          className="shell-nav-band"
          data-shell-nav-band="true"
        >
          <div className="shell-nav-brand-region" data-shell-nav-region="brand">
            {isAuthenticated ? <ShellMobileMainMenu user={user} /> : null}
            <ShellBrand href={homeHref} compactOnMobile={false} />
          </div>

          <PublicRouteLinks user={user} navigationContext={navigationContext} />

          <div
            className="shell-nav-actions"
            data-shell-nav-region="account-access"
          >
            {isAnonymous ? (
              <div className="shell-action-row" data-shell-nav-guest-access="true">
                {GUEST_ACCESS_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shell-nav-icon-button shell-micro-text min-w-21 justify-center rounded-full px-(--space-3)"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="shell-action-row" data-shell-nav-authenticated-access="true">
                <AccountMenu user={user} />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
