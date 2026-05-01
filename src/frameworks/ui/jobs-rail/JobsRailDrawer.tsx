"use client";

import React from "react";

import { JobsRailRow } from "./JobsRailRow";
import type { JobsRailAction, JobsRailItem, JobsRailModel } from "./resolve-jobs-rail";

export interface ConversationUtilityActions {
  canCopyTranscript: boolean;
  canExportConversation: boolean;
  canImportConversation: boolean;
  isBusy?: boolean;
  onCopyTranscript?: () => void | Promise<unknown>;
  onExportConversation?: () => void | Promise<unknown>;
  onImportConversationFile?: (file: File) => void | Promise<unknown>;
}

interface JobsRailDrawerProps {
  model: JobsRailModel;
  utilityActions: ConversationUtilityActions;
  onAction: (action: JobsRailAction) => void | Promise<void>;
  onClose: (restoreFocus?: boolean) => void;
}

const SECTION_ORDER: Array<{
  key: JobsRailItem["state"];
  label: string;
}> = [
  { key: "needs_input", label: "Needs input" },
  { key: "running", label: "Running" },
  { key: "completed", label: "Completed" },
];

export function JobsRailDrawer({
  model,
  utilityActions,
  onAction,
  onClose,
}: JobsRailDrawerProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const runUtility = React.useCallback((callback?: () => void | Promise<unknown>) => {
    void callback?.();
    onClose(false);
  }, [onClose]);

  return (
    <div
      className="ui-jobs-rail-drawer"
      data-jobs-rail-drawer="true"
      role="dialog"
      aria-label="Jobs"
    >
      <div className="ui-jobs-rail-drawer-header">
        <div>
          <div className="ui-jobs-rail-drawer-title">Jobs</div>
          <div className="ui-jobs-rail-drawer-subtitle">{model.syncLabel}</div>
        </div>
        <button
          type="button"
          className="ui-jobs-rail-icon-button focus-ring"
          aria-label="Close jobs"
          onClick={() => onClose()}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ui-jobs-rail-section-list">
        {SECTION_ORDER.map((section) => {
          const items = model.items.filter((item) => item.state === section.key);
          if (items.length === 0) return null;

          return (
            <section key={section.key} className="ui-jobs-rail-section" aria-label={section.label}>
              <div className="ui-jobs-rail-section-label">{section.label}</div>
              <div className="ui-jobs-rail-row-list">
                {items.map((item) => (
                  <JobsRailRow key={item.jobId} item={item} onAction={onAction} />
                ))}
              </div>
            </section>
          );
        })}
        {model.items.length === 0 ? (
          <div className="ui-jobs-rail-empty">No active work</div>
        ) : null}
      </div>

      <div className="ui-jobs-rail-utilities" role="menu" aria-label="Conversation utilities">
        {model.overflowActions.map((action) => (
          <button
            key={action.kind}
            type="button"
            role="menuitem"
            className="ui-jobs-rail-utility focus-ring"
            data-jobs-rail-action={action.kind}
            onClick={() => {
              void onAction(action);
              onClose(false);
            }}
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
          role="menuitem"
          disabled={!utilityActions.canCopyTranscript || utilityActions.isBusy}
          className="ui-jobs-rail-utility focus-ring"
          onClick={() => runUtility(utilityActions.onCopyTranscript)}
        >
          Copy transcript
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!utilityActions.canExportConversation || utilityActions.isBusy}
          className="ui-jobs-rail-utility focus-ring"
          onClick={() => runUtility(utilityActions.onExportConversation)}
        >
          Export JSON
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!utilityActions.canImportConversation || utilityActions.isBusy}
          className="ui-jobs-rail-utility focus-ring"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void utilityActions.onImportConversationFile?.(file);
            onClose(false);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
