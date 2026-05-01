"use client";

import Image from "next/image";

import Link from "next/link";

import { SHELL_BRAND } from "@/lib/shell/shell-navigation";
import { useInstanceIdentity } from "@/lib/config/InstanceConfigContext";

interface EyeOfOrdoMarkProps {
  className?: string;
  decorative?: boolean;
  strokeWidth?: number;
  pupilRadius?: number;
}

export function EyeOfOrdoMark({
  className,
  decorative = false,
  strokeWidth = 2.2,
  pupilRadius = 3.35,
}: EyeOfOrdoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={decorative}
      focusable="false"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 12C4.85 7.88 8.02 5.82 12 5.82C15.98 5.82 19.15 7.88 21.5 12C19.15 16.12 15.98 18.18 12 18.18C8.02 18.18 4.85 16.12 2.5 12Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r={pupilRadius} fill="currentColor" />
    </svg>
  );
}

interface ShellBrandProps {
  href?: string;
  showMark?: boolean;
  showWordmark?: boolean;
  compactOnMobile?: boolean;
  className?: string;
}

export function ShellBrand({
  href = SHELL_BRAND.homeHref,
  showMark = true,
  showWordmark = true,
  compactOnMobile = false,
  className,
}: ShellBrandProps) {
  const identity = useInstanceIdentity();
  const classes = [
    "shell-brand-row flex shrink-0 items-center whitespace-nowrap",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={href}
      aria-label={`${identity.name} home`}
      className={classes}
      data-shell-brand="true"
    >
      {showMark ? (
        <div
          className="shell-brand-mark overflow-hidden rounded-[0.58rem]"
          aria-hidden="true"
          data-shell-brand-mark="true"
        >
          <Image src={identity.logoPath} alt="" width={40} height={40} className="h-full w-full object-cover" />
        </div>
      ) : null}
      {showWordmark ? (
        <span className={`theme-display font-semibold tracking-[-0.06em] text-foreground ${compactOnMobile ? "hidden sm:inline" : ""}`.trim()} data-shell-brand-wordmark="true">{identity.name}</span>
      ) : (
        <span className="sr-only">{identity.name}</span>
      )}
    </Link>
  );
}
