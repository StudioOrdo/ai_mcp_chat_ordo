"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ShellBrand } from "@/components/shell/ShellBrand";
import { NotificationFeed } from "@/components/NotificationFeed";
import { ShellWorkspaceMenu } from "@/components/ShellWorkspaceMenu";
import { JobsRail } from "@/frameworks/ui/jobs-rail/JobsRail";
import { useJobsRailController } from "@/frameworks/ui/jobs-rail/useJobsRailController";
import {
  resolveShellHomeHref,
} from "@/lib/shell/shell-navigation";
import type { User as SessionUser } from "@/core/entities/user";

interface SiteNavProps {
  user: SessionUser;
}

const GUEST_ACCESS_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
] as const;

function AuthenticatedJobsRail() {
  const jobsRail = useJobsRailController();

  return (
    <JobsRail
      model={jobsRail.model}
      utilityActions={jobsRail.utilityActions}
      onAction={jobsRail.onAction}
    />
  );
}

export function SiteNav({ user }: SiteNavProps) {
  const pathname = usePathname();
  const isJournalRoute = pathname === "/journal"
    || pathname.startsWith("/journal/");
  const navTone = isJournalRoute ? "quiet" : "default";
  const homeHref = resolveShellHomeHref();
  const isAnonymous = user.roles.every((role) => role === "ANONYMOUS");

  return (
    <nav
      className="ui-shell-rail ui-shell-rail-safe-top sticky top-0 z-50 transition-colors duration-500"
      aria-label="Primary"
      data-shell-nav-rail="true"
      data-shell-nav-tone={navTone}
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
            <div className="shell-action-row">
              <ShellWorkspaceMenu user={user} tone={navTone} />
              <ShellBrand href={homeHref} showMark={false} compactOnMobile />
            </div>
          </div>

          <div
            className="shell-nav-actions"
            data-shell-nav-region="account-access"
          >
            {isAnonymous ? null : <AuthenticatedJobsRail />}
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
              <NotificationFeed user={user} />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
