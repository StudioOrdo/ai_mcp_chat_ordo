export type MediaWorkflowStatus =
  | "queued"
  | "running"
  | "blocked"
  | "failed"
  | "succeeded"
  | "canceled";

export type MediaWorkflowStepStatus =
  | "pending"
  | "queued"
  | "running"
  | "ready"
  | "blocked"
  | "failed"
  | "skipped";

export type MediaWorkflowStepKind =
  | "generate_chart"
  | "generate_audio"
  | "generate_image"
  | "compose_media"
  | "reuse_asset";

export type MediaWorkflowDeliverable = "video" | "audio" | "chart" | "image";

export interface MediaWorkflow {
  id: string;
  userId: string;
  conversationId: string;
  originMessageId: string | null;
  originTurnId: string | null;
  requestedDeliverable: MediaWorkflowDeliverable;
  title: string;
  status: MediaWorkflowStatus;
  finalAssetId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  request: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface MediaWorkflowStep {
  id: string;
  workflowId: string;
  sequence: number;
  kind: MediaWorkflowStepKind;
  status: MediaWorkflowStepStatus;
  dependsOnStepIds: string[];
  jobId: string | null;
  assetId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaWorkflowEvent {
  id: string;
  workflowId: string;
  stepId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MediaWorkflowSnapshot {
  workflow: MediaWorkflow;
  steps: MediaWorkflowStep[];
  events: MediaWorkflowEvent[];
}

export interface MediaWorkflowSeed {
  id: string;
  userId: string;
  conversationId: string;
  originMessageId?: string | null;
  originTurnId?: string | null;
  requestedDeliverable: MediaWorkflowDeliverable;
  title?: string;
  status?: MediaWorkflowStatus;
  finalAssetId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  request?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface MediaWorkflowStepSeed {
  id: string;
  workflowId: string;
  sequence: number;
  kind: MediaWorkflowStepKind;
  status?: MediaWorkflowStepStatus;
  dependsOnStepIds?: string[];
  jobId?: string | null;
  assetId?: string | null;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  failureCode?: string | null;
  failureMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaWorkflowDraft {
  workflow: MediaWorkflowSeed;
  steps: MediaWorkflowStepSeed[];
  initialEvent?: {
    eventType: string;
    payload?: Record<string, unknown>;
    createdAt?: string;
  };
}
