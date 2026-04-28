import type { CapabilityProgressPhase, CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobStatus } from "@/core/entities/job";

export type ExecutionKind = "job" | "work_order" | "tool" | "chat_turn" | "observability";

export type ExecutionSupportLevel = "full" | "limited" | "unsupported";

export type ExecutionLifecycleState =
  | "planned"
  | "queued"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "canceled"
  | "unknown";

export type ExecutionTimelineActionKind = "job" | "route" | "send" | "factory" | "unsupported";

export interface ExecutionTimelineProgress {
  percent?: number | null;
  label?: string | null;
  phases?: CapabilityProgressPhase[];
  activePhaseKey?: string | null;
}

export interface ExecutionTimelineArtifact {
  id: string;
  kind: string;
  label: string;
  mimeType?: string;
  uri?: string;
  source: "job_result" | "factory_output" | "tool_result" | "derived";
  stageKey?: string | null;
  stageRunId?: string | null;
  entityKind?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionTimelineCheckpoint {
  checkpointId: string;
  label: string;
  createdAt: string;
  consumedAt?: string | null;
  stageKey?: string | null;
  pauseReason?: string;
}

export interface ExecutionTimelineNextAction {
  key: string;
  label: string;
  kind: ExecutionTimelineActionKind;
  value: string;
  available: boolean;
  params?: Record<string, string>;
}

export interface ExecutionTimelineEvent {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  summary?: string;
  state?: ExecutionLifecycleState;
  stageKey?: string;
  sequence?: number;
  source: "durable" | "synthetic" | "derived";
  renderable?: boolean;
  auditOnly?: boolean;
  details?: Record<string, unknown>;
}

export interface ExecutionTimeline {
  executionId: string;
  executionKind: ExecutionKind;
  supportLevel: ExecutionSupportLevel;
  state: ExecutionLifecycleState;
  title: string;
  summary?: string;
  conversationId?: string;
  userId?: string | null;
  toolName?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  progress?: ExecutionTimelineProgress;
  events: ExecutionTimelineEvent[];
  artifacts: ExecutionTimelineArtifact[];
  checkpoints: ExecutionTimelineCheckpoint[];
  nextActions: ExecutionTimelineNextAction[];
  metadata?: Record<string, unknown>;
}

export type ReadExecutionTimelineRequest =
  | {
      executionKind: "job";
      executionId: string;
      userId?: string;
      historyLimit?: number;
    }
  | {
      executionKind: "work_order";
      executionId: string;
    }
  | {
      executionKind: "tool";
      executionId: string;
      envelope?: CapabilityResultEnvelope | null;
      toolName?: string;
    }
  | {
      executionKind: "chat_turn";
      executionId: string;
      conversationId?: string;
    }
  | {
      executionKind: "observability";
      executionId: string;
    };

export function mapJobStatusToExecutionLifecycleState(status: JobStatus): ExecutionLifecycleState {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "succeeded":
      return "succeeded";
    case "failed":
    case "dead_letter":
      return "failed";
    case "canceled":
      return "canceled";
  }
}
