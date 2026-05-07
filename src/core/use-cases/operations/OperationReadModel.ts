import type {
  OperationAction,
  OperationArtifact,
  OperationEvent,
  OperationKind,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export interface OperationProgressSummary {
  totalSteps: number;
  pendingSteps: number;
  readySteps: number;
  runningSteps: number;
  blockedSteps: number;
  succeededSteps: number;
  failedSteps: number;
  skippedSteps: number;
  cancelledSteps: number;
  percentComplete: number;
}

export interface ConversationOperationSummary {
  operationId: string;
  kind: OperationKind;
  title: string;
  status: OperationStatus;
  riskLevel: OperationRiskLevel;
  revision: number;
  currentStepId: string | null;
  summary: string | null;
  progress: OperationProgressSummary;
  availableActions: OperationAction[];
  latestEvent: OperationEvent | null;
  updatedAt: string;
}

export interface AdminOperationSummary extends ConversationOperationSummary {
  createdByUserId: string | null;
  createdByRole: RoleName;
  visibility: string;
  createdAt: string;
  completedAt: string | null;
  stepCount: number;
  actionCount: number;
  artifactCount: number;
  eventCount: number;
}

export interface OperationHealthAggregate {
  totalActiveOperations: number;
  activeByStatus: Record<string, number>;
  activeByKind: Record<string, number>;
  failedCount: number;
  blockedCount: number;
  oldestActiveOperationAgeMs: number | null;
  pendingDestructiveActions: number;
}

export interface PromptGroundingOperationSummary {
  operationId: string;
  kind: OperationKind;
  title: string;
  status: OperationStatus;
  riskLevel: OperationRiskLevel;
  revision: number;
  currentStepId: string | null;
  summary: string | null;
  progress: OperationProgressSummary;
  latestEvents: OperationEvent[];
  availableActions: Array<
    Pick<
      OperationAction,
      "id" | "actionType" | "label" | "enabled" | "disabledReason" | "riskLevel" | "confirmPolicy"
    >
  >;
  artifacts: Array<Pick<OperationArtifact, "label" | "uri" | "kind" | "createdAt">>;
  error: { code: string; message: string } | null;
  updatedAt: string;
}
