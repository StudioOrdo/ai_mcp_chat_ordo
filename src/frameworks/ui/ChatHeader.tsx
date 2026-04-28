import Image from "next/image";

import React from "react";

interface ChatHeaderProps {
  title: string;
  subtitle: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  density: "compact" | "normal" | "relaxed";
  onDensityChange: (density: "compact" | "normal" | "relaxed") => void;
  logoPath?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  density,
  onDensityChange,
  logoPath = "/logo_with_words.png",
}) => {
  const densityLabels: Record<"compact" | "normal" | "relaxed", string> = {
    compact: "C",
    normal: "N",
    relaxed: "R",
  };

  return (
    <header className="ui-chat-header-surface sticky top-0 z-30 flex h-14 items-center justify-between border-b px-(--container-padding) transition-colors duration-500" data-chat-header-surface="true">
      <div className="shell-action-row">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full shadow-[0_8px_16px_-14px_color-mix(in_srgb,var(--shadow-base)_8%,transparent)]">
          <Image src={logoPath} alt="" width={32} height={32} className="object-cover" style={{ width: "100%", height: "100%" }} />
        </div>
        <div className="flex flex-col">
          <h1 className="shell-panel-heading leading-none">{title}</h1>
          <span className="shell-meta-text opacity-50">
            {subtitle}
          </span>
        </div>
      </div>

      <div className="shell-action-row">
        {/* Search */}
        <div className="relative group hidden sm:block">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="absolute inset-s-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 transition-opacity"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Filter session..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ui-chat-search-field rounded-full border-none ps-9 pe-4 py-(--space-2) text-xs outline-none focus:ring-2 focus:ring-accent-interactive/20 w-40 transition-all focus:w-64"
          />
        </div>

        {/* Density */}
        <div className="ui-chat-density-toggle shell-action-row rounded-full p-(--space-1)" data-chat-density-toggle="true">
          {(["compact", "normal", "relaxed"] as const).map((d) => (
            <button
              key={d}
              onClick={() => onDensityChange(d)}
              className={`shell-micro-text flex h-7 w-7 items-center justify-center rounded-full transition-all ${density === d ? "ui-chat-density-option-active" : "ui-chat-density-option-idle"}`}
              title={`Density: ${d}`}
              aria-label={`Set density to ${d}`}
              data-chat-density-option={density === d ? "active" : "idle"}
            >
              {densityLabels[d]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
