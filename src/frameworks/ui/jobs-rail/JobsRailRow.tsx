"use client";

import React from "react";

import type { JobsRailAction, JobsRailItem } from "./resolve-jobs-rail";

interface JobsRailRowProps {
  item: JobsRailItem;
  onAction: (action: JobsRailAction) => void | Promise<void>;
}

function formatProgress(item: JobsRailItem): string | null {
  if (item.progressLabel) return item.progressLabel;
  if (typeof item.progressPercent === "number") return `${Math.round(item.progressPercent)}%`;
  return item.subtitle;
}

export function JobsRailRow({ item, onAction }: JobsRailRowProps) {
  const primaryAction = item.actions.find((action) => action.primary) ?? item.actions[0];
  const secondaryActions = item.actions.filter((action) => action !== primaryAction);
  const progress = formatProgress(item);

  return (
    <div
      className="ui-jobs-rail-row"
      data-jobs-rail-row-state={item.state}
    >
      <div className="min-w-0">
        <div className="ui-jobs-rail-row-title">{item.title}</div>
        <div className="ui-jobs-rail-row-meta">
          <span>{item.statusLabel}</span>
          {progress ? <span>{progress}</span> : null}
        </div>
      </div>
      <div className="ui-jobs-rail-row-actions">
        {primaryAction ? (
          <button
            type="button"
            className="ui-jobs-rail-action ui-jobs-rail-action-primary focus-ring"
            data-jobs-rail-action={primaryAction.kind}
            onClick={() => void onAction(primaryAction)}
          >
            {primaryAction.label}
          </button>
        ) : null}
        {secondaryActions.slice(0, 2).map((action) => (
          <button
            key={`${item.jobId}:${action.kind}`}
            type="button"
            className="ui-jobs-rail-action focus-ring"
            data-jobs-rail-action={action.kind}
            title={action.label}
            aria-label={`${action.label} ${item.title}`}
            onClick={() => void onAction(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
