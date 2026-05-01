"use client";

import React from "react";

interface ChatSurfaceHeaderProps {
  mode: "embedded" | "floating";
  isFullScreen: boolean;
  onMinimize?: () => void;
  onFullScreenToggle?: () => void;
}

export function ChatSurfaceHeader({
  mode,
  isFullScreen,
  onMinimize,
  onFullScreenToggle,
}: ChatSurfaceHeaderProps) {
  const headerClasses = mode === "embedded"
    ? "ui-chat-header-surface relative z-20 flex shrink-0 items-center justify-end border-b border-color-theme px-(--space-3) py-(--space-2)"
    : isFullScreen
      ? "glass-surface safe-area-pt safe-area-px relative z-20 flex shrink-0 items-start justify-between border-b border-color-theme pb-(--space-4) pt-(--space-3) transition-colors duration-500"
      : "glass-surface relative z-20 flex shrink-0 items-start justify-between border-b border-color-theme px-(--container-padding) py-(--space-4) transition-colors duration-500";

  return (
    <div
      className={headerClasses}
      data-chat-embedded-header={mode === "embedded" ? "true" : undefined}
      data-chat-floating-header={mode === "floating" ? "true" : undefined}
      data-chat-surface-header="true"
      data-chat-surface-header-mode={mode}
    >
      {mode === "floating" ? <div /> : null}
      <div
        className="shell-action-row shrink-0 ml-auto"
        data-chat-floating-header-chrome="true"
      >
        {mode === "floating" ? (
          <>
        <button
          onClick={onFullScreenToggle}
          className="icon-btn"
          aria-label={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
          title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
        >
          {isFullScreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
            </svg>
          )}
        </button>

        <button
          onClick={onMinimize}
          className="icon-btn"
          aria-label="Minimize Chat"
          title="Minimize Chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
