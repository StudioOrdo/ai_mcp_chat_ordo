import type { ExecutionKind } from "@/core/platform/execution/ExecutionTimeline";

export type RevisionSupportLevel = "advanced" | "reduced" | "unsupported";

export type RevisionState = "active" | "paused" | "recoverable" | "terminal" | "unsupported";

export type RevisionOperationKind = "pause" | "refine" | "resume" | "retry" | "cancel";

export type RevisionActionTransportKind = "job" | "factory" | "route" | "unsupported";

export interface RevisionAction {
  key: string;
  label: string;
  operation: RevisionOperationKind;
  transportKind: RevisionActionTransportKind;
  value: string;
  available: boolean;
  params?: Record<string, string>;
}

export interface RevisionCheckpoint {
  checkpointId: string;
  label: string;
  createdAt?: string | null;
  consumedAt?: string | null;
  stageKey?: string | null;
  reason?: string;
}

export interface RevisionInspection {
  executionId: string;
  executionKind: ExecutionKind;
  supportLevel: RevisionSupportLevel;
  state: RevisionState;
  title: string;
  summary?: string;
  conversationId?: string;
  userId?: string | null;
  toolName?: string;
  actions: RevisionAction[];
  checkpoints: RevisionCheckpoint[];
  metadata?: Record<string, unknown>;
}

export type ReadRevisionRequest =
  | {
      executionKind: "job";
      executionId: string;
      userId?: string;
    }
  | {
      executionKind: "work_order";
      executionId: string;
    }
  | {
      executionKind: "tool";
      executionId: string;
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