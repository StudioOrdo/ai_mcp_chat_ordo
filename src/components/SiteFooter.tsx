"use client";

import React from "react";
import Link from "next/link";

import { ShellBrand } from "@/components/shell/ShellBrand";
import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  resolveFooterGroups,
  resolveFooterGroupRoutes,
  resolveShellHomeHref,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";
import type { User as SessionUser } from "@/core/entities/user";
import { useInstanceIdentity } from "@/lib/config/InstanceConfigContext";

interface SiteFooterProps {
  user: SessionUser;
  navigationContext?: ShellNavigationContext;
}

export function SiteFooter({
  user,
  navigationContext = DEFAULT_SHELL_NAVIGATION_CONTEXT,
}: SiteFooterProps) {
  const identity = useInstanceIdentity();
  const footerGroups = resolveFooterGroups(user, navigationContext);
  const homeHref = resolveShellHomeHref();

  return (
    <footer className="shell-footer-frame border-t border-color-theme bg-background px-(--container-padding)">
      <div className="site-container flex flex-col items-start justify-between shell-section-gap md:flex-row">
        <div className="flex max-w-xs flex-col shell-section-gap">
          <ShellBrand href={homeHref} />
          <p className="shell-supporting-text max-w-xs opacity-60">
            {identity.tagline}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-(--phi-2p) sm:grid-cols-2" data-shell-footer-groups="true">
          {footerGroups.map((group) => (
            <div key={group.id} className="flex flex-col shell-section-gap">
              <p className="shell-section-heading opacity-70">{group.label}</p>
              <ul className="space-y-(--phi-3) shell-nav-label opacity-70 transition-opacity hover:opacity-100">
                {resolveFooterGroupRoutes(group, user, navigationContext).map((route) => (
                  <li key={route.id}>
                    <Link href={route.href} className="shell-nav-label">
                      {route.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      
      <div className="site-container mt-(--phi-2p) pt-(--phi-1p) border-t border-color-theme">
        <span className="shell-micro-text opacity-70">
          {identity.copyright ?? `© ${new Date().getFullYear()} ${identity.name}. All rights reserved.`}
        </span>
      </div>
    </footer>
  );
}
