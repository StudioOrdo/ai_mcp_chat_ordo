import type { RoleName } from "@/core/entities/user";
import type { JobExecutionPrincipal } from "@/core/entities/job";
import type { ConversationLane } from "@/core/entities/conversation-routing";
import type {
  CapabilityArtifactRef,
  CapabilityProgressPhase,
  CapabilityResultEnvelope,
} from "@/core/entities/capability-result";
import type { CurrentPageSnapshot } from "@/lib/chat/current-page-context";
import type { PromptRuntimeResult } from "@/lib/chat/prompt-runtime";
import type { Logger } from "@/core/services/ErrorHandler";
import type { ExecutionPlanningContext } from "@/core/platform/execution/ExecutionPlanner";

export type ToolDeniedReason = "role_denied" | "manifest_prefiltered";

export interface ToolDeniedEvent {
  toolName: string;
  role: RoleName;
  reason: ToolDeniedReason;
  conversationId?: string;
  lane?: ConversationLane | null;
  allowedToolCount?: number;
}

export interface ToolProgressUpdate {
  progressPercent?: number | null;
  progressLabel?: string | null;
  phases?: CapabilityProgressPhase[];
  activePhaseKey?: string | null;
  summary?: string;
  replaySnapshot?: Record<string, unknown> | null;
  artifacts?: CapabilityArtifactRef[];
  resultEnvelope?: CapabilityResultEnvelope | null;
  payload?: Record<string, unknown>;
}

export interface ToolExecutionContext {
  role: RoleName;
  userId: string;
  toolInvocationId?: string;
  jobId?: string;
  materializationKey?: string;
  promptBindingId?: string;
  executionPrincipal?: JobExecutionPrincipal;
  executionAllowedRoles?: readonly RoleName[];
  conversationId?: string;
  currentPathname?: string;
  currentPageSnapshot?: CurrentPageSnapshot;
  promptRuntime?: PromptRuntimeResult;
  allowedToolNames?: readonly string[];
  conversationLane?: ConversationLane | null;
  executionPlanning?: ExecutionPlanningContext;
  onToolDenied?: (event: ToolDeniedEvent) => void | Promise<void>;
  reportProgress?: (update: ToolProgressUpdate) => void | Promise<void>;
  abortSignal?: AbortSignal;
  logger?: Logger;
}
