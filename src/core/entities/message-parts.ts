import type { CapabilityResultEnvelope } from "./capability-result";
import type {
  MediaRuntimeFailureStage,
  MediaRuntimeLifecyclePhase,
} from "./media-runtime-state";
import type { ActionLinkType } from "./rich-content";
import type { JobFailureClass, JobRecoveryMode, JobStatus } from "./job";
import type {
  MediaAssetKind,
  MediaAssetRetentionClass,
  MediaAssetSource,
} from "./media-asset";

/**
 * Domain types for message parts (tool calls, text segments, tool results).
 * Defined in the core layer so entities and use-cases can reference them
 * without depending on React hooks or framework code.
 */
export interface JobStatusMessagePart {
  type: "job_status";
  jobId: string;
  toolInvocationId?: string;
  toolName: string;
  label: string;
  title?: string;
  subtitle?: string;
  status: JobStatus;
  sequence?: number;
  progressPercent?: number | null;
  progressLabel?: string | null;
  summary?: string;
  error?: string;
  updatedAt?: string;
  lifecyclePhase?: MediaRuntimeLifecyclePhase;
  failureCode?: string | null;
  failureStage?: MediaRuntimeFailureStage | null;
  resultPayload?: unknown;
  resultEnvelope?: CapabilityResultEnvelope | null;
  failureClass?: JobFailureClass | null;
  recoveryMode?: JobRecoveryMode | null;
  nextRetryAt?: string | null;
  lastCheckpointId?: string | null;
  replayedFromJobId?: string | null;
  supersededByJobId?: string | null;
  attemptCount?: number | null;
  maxAttempts?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  claimedBy?: string | null;
  actions?: Array<{
    label: string;
    actionType: ActionLinkType;
    value: string;
    params?: Record<string, string>;
  }>;
}

export type GenerationStatus = "stopped" | "interrupted";
export type GenerationStatusActor = "user" | "system";

export interface GenerationStatusMessagePart {
  type: "generation_status";
  status: GenerationStatus;
  actor: GenerationStatusActor;
  reason: string;
  partialContentRetained: boolean;
  recordedAt?: string;
}

export type ImportedAttachmentAvailability = "embedded" | "unavailable";

export interface ImportedAttachmentMessagePart {
  type: "imported_attachment";
  fileName: string;
  mimeType: string;
  fileSize: number;
  availability: ImportedAttachmentAvailability;
  note: string;
  originalAssetId?: string | null;
}

export interface AttachmentMessagePart {
  type: "attachment";
  assetId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  assetKind?: MediaAssetKind;
  width?: number;
  height?: number;
  durationSeconds?: number;
  source?: MediaAssetSource;
  retentionClass?: MediaAssetRetentionClass;
  toolName?: string;
}

export type CompactionMarkerKind = "summary" | "meta_summary";

export interface CompactionMarkerMessagePart {
  type: "compaction_marker";
  kind: CompactionMarkerKind;
  compactedCount: number;
  coversUpToMessageId?: string;
  coversUpToSummaryId?: string;
}

export type MessagePart =
  | { type: "text"; text: string }
  | { type: "error"; text: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; toolInvocationId?: string }
  | { type: "tool_result"; name: string; result: unknown; toolInvocationId?: string }
  | JobStatusMessagePart
  | GenerationStatusMessagePart
  | AttachmentMessagePart
  | ImportedAttachmentMessagePart
  | CompactionMarkerMessagePart
  | { type: "summary"; text: string; coversUpToMessageId: string }
  | { type: "meta_summary"; text: string; coversUpToSummaryId: string; summariesCompacted: number };
