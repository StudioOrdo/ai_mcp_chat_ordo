export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled" | "dead_letter";

export type JobExecutionPrincipal = "system_worker" | "admin_delegate" | "owner_delegate";
export type JobRetryMode = "manual_only" | "automatic";
export type JobRetryBackoffStrategy = "none" | "fixed" | "exponential";
export type JobRecoveryMode = "rerun" | "checkpoint_resume";
export type JobResultRetentionMode = "retain" | "prune_payload_keep_events";
export type JobArtifactPolicyMode = "retain" | "open_artifact" | "open_or_download";
export type JobFailureClass = "canceled" | "policy" | "terminal" | "transient" | "unknown";

export type JobEventType =
  | "queued"
  | "started"
  | "progress"
  | "result"
  | "failed"
  | "canceled"
  | "requeued"
  | "retry_scheduled"
  | "retry_exhausted"
  | "lease_recovered"
  | "notification_sent"
  | "notification_failed"
  | "ownership_transferred";

export type JobInitiatorType = "user" | "anonymous_session" | "system";

export interface JobOwnershipTransferRequest {
  conversationIds: readonly string[];
  userId: string;
  previousUserId?: string | null;
  source?: string;
  transferredAt?: string;
}

export interface JobRequest {
  id: string;
  conversationId: string;
  userId: string | null;
  toolName: string;
  status: JobStatus;
  priority: number;
  dedupeKey: string | null;
  initiatorType: JobInitiatorType;
  requestPayload: Record<string, unknown>;
  resultPayload: unknown | null;
  errorMessage: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  attemptCount: number;
  leaseExpiresAt: string | null;
  claimedBy: string | null;
  failureClass: JobFailureClass | null;
  nextRetryAt: string | null;
  recoveryMode: JobRecoveryMode | null;
  lastCheckpointId: string | null;
  replayedFromJobId: string | null;
  supersededByJobId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface JobLeaseRecovery {
  job: JobRequest;
  previousClaimedBy: string | null;
  previousLeaseExpiresAt: string | null;
}

export interface JobRequestSeed {
  conversationId: string;
  userId?: string | null;
  toolName: string;
  priority?: number;
  dedupeKey?: string | null;
  initiatorType?: JobInitiatorType;
  failureClass?: JobFailureClass | null;
  nextRetryAt?: string | null;
  recoveryMode?: JobRecoveryMode | null;
  lastCheckpointId?: string | null;
  replayedFromJobId?: string | null;
  supersededByJobId?: string | null;
  requestPayload: Record<string, unknown>;
}

export interface JobEvent {
  id: string;
  jobId: string;
  conversationId: string;
  sequence: number;
  eventType: JobEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface JobEventSeed {
  jobId: string;
  conversationId: string;
  eventType: JobEventType;
  payload?: Record<string, unknown>;
}

export interface JobStatusUpdate {
  status: JobStatus;
  resultPayload?: unknown | null;
  errorMessage?: string | null;
  progressPercent?: number | null;
  progressLabel?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  leaseExpiresAt?: string | null;
  claimedBy?: string | null;
  failureClass?: JobFailureClass | null;
  nextRetryAt?: string | null;
  recoveryMode?: JobRecoveryMode | null;
  lastCheckpointId?: string | null;
  replayedFromJobId?: string | null;
  supersededByJobId?: string | null;
  incrementAttemptCount?: boolean;
}

export interface JobClaimOptions {
  workerId: string;
  leaseExpiresAt: string;
  now?: string;
}
