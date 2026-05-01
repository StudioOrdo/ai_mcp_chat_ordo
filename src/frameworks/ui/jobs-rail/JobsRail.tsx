"use client";

import React from "react";

import { JobsRailDrawer, type ConversationUtilityActions } from "./JobsRailDrawer";
import type { JobsRailAction, JobsRailModel } from "./resolve-jobs-rail";

export type { ConversationUtilityActions } from "./JobsRailDrawer";

interface JobsRailProps {
  model: JobsRailModel;
  utilityActions: ConversationUtilityActions;
  onAction: (action: JobsRailAction) => void | Promise<void>;
}

function buildSummary(model: JobsRailModel): string {
  if (model.primaryState === "reconnecting") return "Reconnecting";

  const parts: string[] = [];
  if (model.activeCount > 0) parts.push(`${model.activeCount} running`);
  if (model.attentionCount > 0) parts.push(`${model.attentionCount} needs input`);
  if (parts.length === 0) return "No active work";
  return parts.join(" · ");
}

function buildBadgeCount(model: JobsRailModel): number {
  return model.activeCount + model.attentionCount + model.completedCount;
}

function FactoryWorkIcon() {
  return (
    <svg
      className="ui-jobs-rail-factory-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.8 20.2h16.4" />
      <path d="M5 20.2V9.8l4.4 2.5V9.8l4.4 2.5V7h3.7v13.2" />
      <path d="M7.6 16.5h1.6" />
      <path d="M12 16.5h1.6" />
      <path d="M16.4 16.5h1.6" />
      <path className="ui-jobs-rail-factory-motion" d="M17.5 4.8h2.2" />
    </svg>
  );
}

export function JobsRail({ model, utilityActions, onAction }: JobsRailProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  const closeDrawer = React.useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;

    const firstButton = drawerRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    firstButton?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDrawer(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDrawer();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, open]);

  const summary = buildSummary(model);
  const badgeCount = buildBadgeCount(model);
  const countLabel = badgeCount === 1 ? "1 job" : `${badgeCount} jobs`;
  const ariaLabel = `Jobs, ${countLabel}, ${summary}, ${model.syncLabel}`;

  return (
    <div
      ref={rootRef}
      className="ui-jobs-rail-root"
      data-jobs-rail="true"
      data-jobs-rail-state={model.primaryState}
      data-jobs-rail-sync={model.syncState}
    >
      <button
        ref={triggerRef}
        type="button"
        className="ui-jobs-rail-trigger focus-ring"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ui-jobs-rail-trigger-icon" data-jobs-rail-icon-state={model.primaryState}>
          <FactoryWorkIcon />
          <span className="ui-jobs-rail-trigger-light" aria-hidden="true" />
          {badgeCount > 0 ? (
            <span className="ui-jobs-rail-trigger-badge" aria-hidden="true">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div ref={drawerRef}>
          <JobsRailDrawer
            model={model}
            utilityActions={utilityActions}
            onAction={onAction}
            onClose={closeDrawer}
          />
        </div>
      ) : null}
    </div>
  );
}
