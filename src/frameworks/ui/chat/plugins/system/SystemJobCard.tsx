/* eslint-disable react/jsx-handler-names */
"use client";

import { useState } from "react";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { ToolPluginProps } from "../../registry/types";
import type { InlineNode } from "@/core/entities/rich-content";
import { CapabilityArtifactRail } from "../../primitives/CapabilityArtifactRail";
import { CapabilityCardShell } from "../../primitives/CapabilityCardShell";
import { CapabilityTimeline } from "../../primitives/CapabilityTimeline";
import type { CapabilityTone } from "../../primitives/capability-card-tone";
import { resolveCapabilityDisplayLabel } from "../../registry/capability-presentation-registry";
import { CapabilityDetailDrawer } from "./CapabilityDetailDrawer";
import {
  hasInlineToolCallError,
  humanizeSystemToolName,
  summarizeSystemResult,
} from "./resolve-system-card";
import {
  resolveCompactMeta,
  resolveJobDisplayStatus,
  resolveReplayRouteLabel,
  resolveReplayRepairs,
  resolveReplayRepairSummary,
  resolveRunDurationLabel,
} from "./job-transparency";

function resolveSystemJobTone(state: string): CapabilityTone {
  if (state === "running") return "accent";
  if (state === "succeeded") return "success";
  if (state === "failed" || state === "dead_letter") return "danger";
  if (state === "canceled") return "warning";
  return "neutral";
}

function hasObjectEntries(value: Record<string, unknown> | null | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function stringifySnapshot(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildArtifactItems(resultEnvelope: CapabilityResultEnvelope | null | undefined) {
  return (resultEnvelope?.artifacts ?? []).map((artifact, index) => ({
    id: artifact.assetId ?? artifact.uri ?? `${artifact.label}-${index}`,
    label: artifact.label,
    href: artifact.uri,
    meta: artifact.mimeType,
  }));
}

function resolveInlineToolCallState(toolCall: ToolPluginProps["toolCall"]): "running" | "failed" | "succeeded" {
  if (!toolCall || toolCall.result === undefined) {
    return "running";
  }
  if (hasInlineToolCallError(toolCall.result)) {
    return "failed";
  }
  return "succeeded";
}

export function SystemJobCard({
  part,
  toolCall,
  computedActions,
  descriptor,
  resultEnvelope,
  onActionClick,
  viewerRole,
}: ToolPluginProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const nowMs = Date.now();
  const effectiveEnvelope = resultEnvelope ?? part?.resultEnvelope ?? null;
  const toolName = part?.toolName ?? toolCall?.name ?? "unknown_tool";
  const label = resolveCapabilityDisplayLabel({
    toolName,
    explicitLabel: part?.label,
    descriptorLabel: descriptor?.label,
    fallbackLabel: humanizeSystemToolName(toolName),
  });

  const state = part?.status ?? resolveInlineToolCallState(toolCall);
  const statusLabel = resolveJobDisplayStatus(part, state as Parameters<typeof resolveJobDisplayStatus>[1], nowMs);
  const compactMeta = resolveCompactMeta(part, effectiveEnvelope);

  const progressPercent = part?.progressPercent ?? effectiveEnvelope?.progress?.percent ?? null;
  const progressPhases = effectiveEnvelope?.progress?.phases ?? [];
  const artifactItems = buildArtifactItems(effectiveEnvelope);

  const replayRouteLabel = resolveReplayRouteLabel(effectiveEnvelope);
  const replayRepairs = resolveReplayRepairs(effectiveEnvelope);
  const replayRepairSummary = resolveReplayRepairSummary(replayRepairs);
  const retryCountdownLabel = part?.nextRetryAt ? resolveJobDisplayStatus({ ...part, status: "queued" }, "queued", nowMs) : null;

  const hasAdminIdentity = viewerRole === "ADMIN" && Boolean(part?.claimedBy);
  const hasPhases = progressPhases.length > 0;

  const drawerSections = [
    hasObjectEntries(effectiveEnvelope?.inputSnapshot)
      ? {
          title: "Input snapshot",
          content: (
            <pre className="ui-capability-json-block">{stringifySnapshot(effectiveEnvelope?.inputSnapshot)}</pre>
          ),
        }
      : null,
    replayRepairs.length > 0
      ? {
          title: "Asset repairs",
          content: (
            <ul>
              {replayRepairs.map((repair) => (
                <li key={repair.reference}>
                  {repair.reference} → {repair.resolvedAssetId} ({repair.strategy})
                </li>
              ))}
            </ul>
          ),
        }
      : null,
    artifactItems.length > 0
      ? {
          title: "Artifacts",
          content: <CapabilityArtifactRail items={artifactItems} title="Artifacts" />,
        }
      : null,
  ].filter((section): section is NonNullable<typeof section> => section !== null);

  const hasBody =
    hasPhases ||
    hasAdminIdentity ||
    Boolean(part?.supersededByJobId) ||
    Boolean(retryCountdownLabel) ||
    replayRouteLabel !== null ||
    drawerSections.length > 0;

  const completedDuration = resolveRunDurationLabel(part?.startedAt, part?.completedAt, nowMs);

  const handleToggle = () => {
    if (!hasBody) return;
    setExpanded((prev) => !prev);
  };

  const cancelActionNode = computedActions?.find(
    (node): node is InlineNode & { type: "action-link"; actionType: string } =>
      node.type === "action-link" && (node as Record<string, unknown>).params
        ? ((node as Record<string, unknown>).params as Record<string, unknown>)?.operation === "cancel"
        : false,
  );

  const otherActions = computedActions?.filter((node) => node !== cancelActionNode) ?? [];

  return (
    <CapabilityCardShell
      descriptor={descriptor}
      tone={resolveSystemJobTone(state)}
      state={state}
      ariaLabel={`${label} status`}
    >
      {/* Compact summary row */}
      <button
        type="button"
        className="ui-system-job-compact-row"
        onClick={handleToggle}
        aria-expanded={hasBody ? (expanded ? "true" : "false") : undefined}
        aria-disabled={!hasBody ? "true" : undefined}
      >
        <span className="ui-system-job-label">{label}</span>
        {compactMeta ? <span className="ui-system-job-meta">{compactMeta}</span> : null}
        <span className="ui-system-job-status">{statusLabel}</span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="ui-system-job-body">
          {progressPercent != null ? (
            <div
              role="progressbar"
              aria-label={`${label} progress`}
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="ui-capability-progress-track"
            >
              <div
                className="ui-capability-progress-fill"
                style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
              />
            </div>
          ) : null}

          <CapabilityTimeline
            title="Progress"
            items={progressPhases.map((phase) => ({
              key: phase.key,
              label: phase.label,
              status: phase.status,
              meta: phase.percent != null ? `${Math.round(phase.percent)}%` : null,
            }))}
          />

          {/* Admin-gated worker identity */}
          {hasAdminIdentity ? (
            <dl className="ui-system-job-details">
              <div>
                <dt>Worker</dt>
                <dd>{part?.claimedBy}</dd>
              </div>
              {completedDuration ? (
                <div>
                  <dt>Duration</dt>
                  <dd>{completedDuration}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {part?.supersededByJobId || retryCountdownLabel ? (
            <dl className="ui-system-job-details">
              {part?.supersededByJobId ? (
                <div>
                  <dt>Superseded by</dt>
                  <dd>{part.supersededByJobId}</dd>
                </div>
              ) : null}
              {retryCountdownLabel ? (
                <div>
                  <dt>Recovery</dt>
                  <dd>{retryCountdownLabel}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {/* Replay route + repairs */}
          {replayRouteLabel ? (
            <dl className="ui-system-job-details">
              <div>
                <dt>Route</dt>
                <dd>{replayRouteLabel}</dd>
              </div>
              {replayRepairSummary ? (
                <div>
                  <dt>Repairs</dt>
                  <dd>{replayRepairSummary}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <CapabilityDetailDrawer
            title={label}
            sections={drawerSections}
          />
        </div>
      )}

      {/* Inline cancel confirmation */}
      {cancelActionNode && !confirmingCancel ? (
        <button
          type="button"
          className="ui-system-job-action"
          onClick={() => setConfirmingCancel(true)}
        >
          {(cancelActionNode as Record<string, unknown>).label as string} ({(cancelActionNode as Record<string, unknown>).actionType as string})
        </button>
      ) : null}

      {cancelActionNode && confirmingCancel ? (
        <div className="ui-system-job-cancel-confirm">
          <span>Cancel this job?</span>
          <button
            type="button"
            onClick={() => {
              setConfirmingCancel(false);
              const node = cancelActionNode as Record<string, unknown>;
              onActionClick?.(
                node.actionType as Parameters<NonNullable<ToolPluginProps["onActionClick"]>>[0],
                node.value as string,
                node.params as Record<string, string> | undefined,
              );
            }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmingCancel(false)}
          >
            No
          </button>
        </div>
      ) : null}

      {/* Non-cancel actions */}
      {otherActions.length > 0 ? (
        <div className="ui-system-job-actions">
          {otherActions.map((node) => {
            const n = node as Record<string, unknown>;
            return (
              <button
                key={String(n.value)}
                type="button"
                className="ui-system-job-action"
                onClick={() =>
                  onActionClick?.(
                    n.actionType as Parameters<NonNullable<ToolPluginProps["onActionClick"]>>[0],
                    n.value as string,
                    n.params as Record<string, string> | undefined,
                  )
                }
              >
                {String(n.label)} ({String(n.actionType)})
              </button>
            );
          })}
        </div>
      ) : null}
    </CapabilityCardShell>
  );
}
