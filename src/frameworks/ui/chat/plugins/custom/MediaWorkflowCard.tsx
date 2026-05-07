"use client";

import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { ActionLinkType } from "@/core/entities/rich-content";
import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";
import { operationActionsToActionLinks } from "@/lib/operations/operation-action-view-model";

import { CapabilityActionRail } from "../../primitives/CapabilityActionRail";
import { MediaRenderCard } from "./MediaRenderCard";

interface MediaWorkflowCardProps {
  workflow: CanonicalMediaWorkflowSnapshot;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}

const STATUS_LABELS: Record<CanonicalMediaWorkflowSnapshot["status"], string> = {
  blocked: "Needs attention",
  canceled: "Canceled",
  failed: "Failed",
  queued: "Queued",
  running: "Running",
  succeeded: "Ready",
};

function getArtifactMimeType(kind: string): string {
  switch (kind) {
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/mpeg";
    case "chart":
    case "graph":
    case "image":
    default:
      return "image/png";
  }
}

function buildWorkflowEnvelope(workflow: CanonicalMediaWorkflowSnapshot): CapabilityResultEnvelope {
  const artifact = workflow.finalArtifact;

  return {
    schemaVersion: 1,
    toolName: "compose_media",
    family: "media",
    cardKind: "media_render",
    executionMode: "deferred",
    inputSnapshot: {
      workflowId: workflow.workflowId,
      requestedDeliverable: workflow.requestedDeliverable,
    },
    summary: {
      title: workflow.title,
      subtitle: workflow.stage.label,
      statusLine: workflow.status,
      message: workflow.failure.message ?? undefined,
    },
    replaySnapshot: {
      workflowId: workflow.workflowId,
      linkedJobIds: workflow.linkedJobIds,
    },
    progress: {
      percent: workflow.stage.progressPercent,
      label: workflow.stage.label,
      phases: workflow.steps.map((step) => ({
        key: step.kind,
        label: step.label,
        status: step.status === "ready" || step.status === "skipped"
          ? "succeeded"
          : step.status === "failed" || step.status === "blocked"
            ? "failed"
            : step.status === "running"
              ? "active"
              : step.status === "queued"
                ? "pending"
                : "pending",
      })),
      activePhaseKey: workflow.stage.key,
    },
    artifacts: artifact
      ? [{
          kind: artifact.kind,
          label: `${workflow.requestedDeliverable} asset`,
          mimeType: getArtifactMimeType(artifact.kind),
          assetId: artifact.assetId,
        }]
      : [],
    payload: {
      workflowId: workflow.workflowId,
      status: workflow.status,
      finalArtifact: workflow.finalArtifact,
    },
  };
}

function StepRow({ step }: { step: CanonicalMediaWorkflowSnapshot["steps"][number] }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface-muted/40 px-3 py-2 text-xs">
      <span className="font-medium text-foreground/72">{step.label}</span>
      <span className="font-semibold uppercase tracking-[0.12em] text-foreground/45">{step.status}</span>
    </div>
  );
}

export function MediaWorkflowCard({ workflow, onActionClick }: MediaWorkflowCardProps) {
  if (workflow.status === "succeeded" && workflow.finalArtifact?.kind === "video") {
    return <MediaRenderCard envelope={buildWorkflowEnvelope(workflow)} />;
  }

  const isFailure = workflow.status === "failed" || workflow.status === "blocked" || workflow.status === "canceled";
  const operationActions = workflow.operation?.availableActions.length
    ? operationActionsToActionLinks(workflow.operation.availableActions)
    : [];

  return (
    <div
      className={`w-full max-w-sm rounded-xl border p-4 ${isFailure ? "border-red-500/30 bg-red-500/10" : "border-border/50 bg-surface-elevated"}`}
      data-media-workflow-card={workflow.status}
      aria-label={`${workflow.title} workflow ${STATUS_LABELS[workflow.status]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
            {workflow.requestedDeliverable} workflow
          </p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">{workflow.title}</h4>
        </div>
        <span className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/55">
          {STATUS_LABELS[workflow.status]}
        </span>
      </div>

      <p className="mt-3 text-sm text-foreground/68">
        {isFailure
          ? workflow.failure.message ?? workflow.stage.label
          : workflow.stage.label}
      </p>

      {workflow.stage.progressPercent != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/40">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.max(0, Math.min(100, workflow.stage.progressPercent))}%` }}
          />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {workflow.steps.map((step) => (
          <StepRow key={step.stepId} step={step} />
        ))}
      </div>

      {workflow.finalArtifact && workflow.finalArtifact.kind !== "video" ? (
        <a
          href={`/api/user-files/${workflow.finalArtifact.assetId}`}
          className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline"
        >
          Open {workflow.finalArtifact.kind}
        </a>
      ) : null}

      {operationActions.length > 0 ? (
        <div className="mt-3 border-t border-border/40 pt-3">
          <CapabilityActionRail actions={operationActions} onActionClick={onActionClick} />
        </div>
      ) : null}
    </div>
  );
}
