import type { MediaWorkflowDeliverable, MediaWorkflowStatus, MediaWorkflowStepStatus } from "./types";

const WORKFLOW_TERMINAL_STATUSES = new Set<MediaWorkflowStatus>(["failed", "succeeded", "canceled"]);

export function isTerminalWorkflowStatus(status: MediaWorkflowStatus): boolean {
  return WORKFLOW_TERMINAL_STATUSES.has(status);
}

export function assertNotJobIdAssetReference(value: string | null | undefined, label = "assetId"): void {
  if (!value) {
    return;
  }

  if (value.startsWith("job_")) {
    throw new Error(`${label} must be a governed media asset id, not a job id.`);
  }
}

export function assertWorkflowCanSucceed(input: {
  requestedDeliverable: MediaWorkflowDeliverable;
  finalAssetId?: string | null;
}): void {
  if ((input.requestedDeliverable === "video" || input.requestedDeliverable === "audio" || input.requestedDeliverable === "chart" || input.requestedDeliverable === "image")
    && !input.finalAssetId) {
    throw new Error(`A ${input.requestedDeliverable} workflow cannot succeed without a final asset id.`);
  }

  assertNotJobIdAssetReference(input.finalAssetId, "finalAssetId");
}

export function assertStepReadyState(input: {
  status: MediaWorkflowStepStatus;
  assetId?: string | null;
  output?: Record<string, unknown>;
}): void {
  if (input.status !== "ready") {
    return;
  }

  assertNotJobIdAssetReference(input.assetId, "step.assetId");

  if (!input.assetId && Object.keys(input.output ?? {}).length === 0) {
    throw new Error("A ready media workflow step must have an asset id or explicit output.");
  }
}
