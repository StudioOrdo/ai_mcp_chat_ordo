import type {
  OperationAction,
  OperationKind,
  OperationRiskLevel,
} from "@/core/entities/operation";
import type { OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import type { RoleName } from "@/core/entities/user";
import type { ConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { OperationPromptGroundingSnapshot } from "@/core/use-cases/operations/OperationPromptGrounding";

export type OperationIntentSource = "deterministic" | "llm" | "hybrid";
export type OperationGateState = "available" | "warning" | "blocked" | "unknown";

export interface OperationGateFact {
  id: string;
  state: OperationGateState;
  summary: string;
  remediation?: string | null;
  affectedOperationKinds?: readonly OperationKind[];
  affectedCapabilities?: readonly string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface OperationGateSnapshot {
  generatedAt: string;
  gates: readonly OperationGateFact[];
}

export interface OperationIntentCompilerInput {
  conversationId: string;
  originMessageId: string | null;
  userId: string;
  role: RoleName;
  latestUserText: string;
  latestUserContent: string;
  routingSnapshot: ConversationRoutingSnapshot;
  attachments: readonly unknown[];
  taskOriginHandoff: unknown | null;
  mediaContinuityHandoff: unknown | null;
  effectiveToolManifestVersion: string | null;
  availableToolNames: readonly string[];
  providerCapabilitySummary: Record<string, unknown>;
  gateSnapshot: OperationGateSnapshot;
  operationGrounding?: OperationPromptGroundingSnapshot | null;
  now: string;
}

export interface OperationIntentPassThroughOutput {
  kind: "pass_through";
  confidence: number;
  source: OperationIntentSource;
  reason?: string;
}

export interface OperationIntentClarificationOutput {
  kind: "clarification_required";
  confidence: number;
  source: OperationIntentSource;
  question: string;
  reason: string;
  operationKind?: OperationKind;
  riskLevel?: OperationRiskLevel;
  missingInputs?: readonly string[];
}

export interface OperationIntentRejectedOutput {
  kind: "rejected";
  confidence: number;
  source: OperationIntentSource;
  rejectedReason: string;
  operationKind?: OperationKind;
  requiredRole?: RoleName;
  riskLevel?: OperationRiskLevel;
}

export interface OperationIntentOperationOutput {
  kind: "operation_intent";
  intentKind: OperationKind;
  confidence: number;
  source: OperationIntentSource;
  operationKind: OperationKind;
  requiredRole: RoleName;
  riskLevel: OperationRiskLevel;
  title: string;
  summary: string;
  input: Record<string, unknown>;
  requiredCapabilities: readonly string[];
  requiredProviderSlots: readonly string[];
  missingInputs: readonly string[];
  explicitNewOperation?: boolean;
}

export type OperationIntentCompilerOutput =
  | OperationIntentPassThroughOutput
  | OperationIntentClarificationOutput
  | OperationIntentRejectedOutput
  | OperationIntentOperationOutput;

export type OperationIntentHandledRouteKind =
  | "created_operation"
  | "blocked_operation"
  | "existing_operation"
  | "clarification_response"
  | "rejected_response";

export type OperationIntentRouteResult =
  | {
      kind: "pass_through";
      confidence: number;
      reason?: string;
    }
  | {
      kind: "clarification_response";
      message: string;
      compilerOutput: OperationIntentClarificationOutput | OperationIntentOperationOutput;
    }
  | {
      kind: "rejected_response";
      message: string;
      compilerOutput?: OperationIntentRejectedOutput;
    }
  | {
      kind: "created_operation";
      snapshot: OperationSnapshot;
      actions: readonly OperationAction[];
      blockingGates: readonly OperationGateFact[];
      compilerOutput: OperationIntentOperationOutput;
    }
  | {
      kind: "blocked_operation";
      snapshot: OperationSnapshot;
      actions: readonly OperationAction[];
      blockingGates: readonly OperationGateFact[];
      compilerOutput: OperationIntentOperationOutput;
    }
  | {
      kind: "existing_operation";
      snapshot: OperationSnapshot;
      actions: readonly OperationAction[];
      compilerOutput: OperationIntentOperationOutput;
    };

export const ACTIVE_OPERATION_INTENT_STATUSES = [
  "draft",
  "awaiting_confirmation",
  "queued",
  "running",
  "blocked",
] as const;
