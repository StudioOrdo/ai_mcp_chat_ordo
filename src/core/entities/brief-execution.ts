import {
  assertValidBriefEvidenceManifest,
  assertValidSectionBrief,
  isBriefVisibilityPolicy,
  type BriefEvidenceManifest,
  type BriefObjectRef,
  type BriefVisibilityPolicy,
  type SectionBrief,
} from "@/core/entities/brief";

export const BRIEF_UPDATE_SCHEMA_VERSION = "1" as const;

export const BRIEF_UPDATE_STATUSES = [
  "pending",
  "running",
  "staged",
  "reconciled",
  "failed",
  "stale",
] as const;
export type BriefUpdateStatus = typeof BRIEF_UPDATE_STATUSES[number];

export const BRIEF_UPDATE_RESULT_STATUSES = ["succeeded", "failed", "limited"] as const;
export type BriefUpdateResultStatus = typeof BRIEF_UPDATE_RESULT_STATUSES[number];

export const BRIEF_EXECUTOR_KINDS = ["deterministic", "llm", "local_model", "rust_native"] as const;
export type BriefExecutorKind = typeof BRIEF_EXECUTOR_KINDS[number];

export interface BriefUpdateScope {
  sectionId?: string;
  objectKind?: string;
  objectId?: string;
  objectLabel?: string;
  ownerUserId: string;
}

export interface BriefUpdateRequest {
  schemaVersion: typeof BRIEF_UPDATE_SCHEMA_VERSION;
  requestId: string;
  briefType: string;
  scope: BriefUpdateScope;
  evidenceWindow: {
    from?: string;
    to: string;
  };
  visibilityPolicy: BriefVisibilityPolicy;
  priorBriefId?: string;
  executorProfile: {
    kind: BriefExecutorKind;
    model?: string;
  };
}

export interface DurableBriefUpdateRequest extends BriefUpdateRequest {
  status: BriefUpdateStatus;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  requestedByUserId: string | null;
  requestedFrom: string;
  errorMessage: string | null;
  diagnostics: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BriefUpdateArtifact {
  kind: "brief" | "brief_manifest" | "brief_evidence";
  uri: string;
  label: string;
  metadata: Record<string, unknown>;
}

export interface BriefUpdateResultError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface BriefUpdateResult {
  schemaVersion: typeof BRIEF_UPDATE_SCHEMA_VERSION;
  requestId: string;
  status: BriefUpdateResultStatus;
  briefId: string | null;
  priorBriefId: string | null;
  summary: string;
  brief?: SectionBrief;
  manifest?: BriefEvidenceManifest;
  artifacts: BriefUpdateArtifact[];
  metrics: {
    evidenceRefs: number;
    includedSources: number;
    excludedSources: number;
    elapsedMs: number;
  };
  warnings: string[];
  error?: BriefUpdateResultError;
}

export interface StoredBriefUpdateResult extends BriefUpdateResult {
  createdAt: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoLikeTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function isBriefUpdateStatus(value: string): value is BriefUpdateStatus {
  return (BRIEF_UPDATE_STATUSES as readonly string[]).includes(value);
}

export function isBriefUpdateResultStatus(value: string): value is BriefUpdateResultStatus {
  return (BRIEF_UPDATE_RESULT_STATUSES as readonly string[]).includes(value);
}

export function isBriefExecutorKind(value: string): value is BriefExecutorKind {
  return (BRIEF_EXECUTOR_KINDS as readonly string[]).includes(value);
}

export function briefObjectRefFromScope(scope: BriefUpdateScope): BriefObjectRef | undefined {
  if (!scope.objectKind || !scope.objectId) {
    return undefined;
  }

  return {
    kind: scope.objectKind,
    id: scope.objectId,
    label: scope.objectLabel ?? scope.objectId,
  };
}

export function sectionIdFromBriefUpdateScope(scope: BriefUpdateScope, briefType: string): string {
  return scope.sectionId ?? scope.objectKind ?? briefType;
}

export function listBriefUpdateRequestValidationErrors(request: BriefUpdateRequest): string[] {
  const errors: string[] = [];

  if (request.schemaVersion !== BRIEF_UPDATE_SCHEMA_VERSION) {
    errors.push("BriefUpdateRequest.schemaVersion must be 1.");
  }
  if (!isNonEmptyString(request.requestId)) {
    errors.push("BriefUpdateRequest.requestId must be a non-empty string.");
  }
  if (!isNonEmptyString(request.briefType)) {
    errors.push("BriefUpdateRequest.briefType must be a non-empty string.");
  }
  if (!request.scope || !isNonEmptyString(request.scope.ownerUserId)) {
    errors.push("BriefUpdateRequest.scope.ownerUserId must be a non-empty string.");
  }
  if (!isNonEmptyString(request.scope?.sectionId) && (!isNonEmptyString(request.scope?.objectKind) || !isNonEmptyString(request.scope?.objectId))) {
    errors.push("BriefUpdateRequest.scope must include sectionId or objectKind/objectId.");
  }
  if ((request.scope?.objectKind && !request.scope.objectId) || (!request.scope?.objectKind && request.scope?.objectId)) {
    errors.push("BriefUpdateRequest.scope objectKind and objectId must be provided together.");
  }
  if (!isNonEmptyString(request.evidenceWindow?.to) || !isIsoLikeTimestamp(request.evidenceWindow.to)) {
    errors.push("BriefUpdateRequest.evidenceWindow.to must be a valid timestamp.");
  }
  if (request.evidenceWindow?.from !== undefined && (!isNonEmptyString(request.evidenceWindow.from) || !isIsoLikeTimestamp(request.evidenceWindow.from))) {
    errors.push("BriefUpdateRequest.evidenceWindow.from must be a valid timestamp when provided.");
  }
  if (request.evidenceWindow?.from && request.evidenceWindow?.to && Date.parse(request.evidenceWindow.from) > Date.parse(request.evidenceWindow.to)) {
    errors.push("BriefUpdateRequest.evidenceWindow.from must not be after evidenceWindow.to.");
  }
  if (!isBriefVisibilityPolicy(request.visibilityPolicy)) {
    errors.push("BriefUpdateRequest.visibilityPolicy is invalid.");
  }
  if (!request.executorProfile || !isBriefExecutorKind(request.executorProfile.kind)) {
    errors.push("BriefUpdateRequest.executorProfile.kind is invalid.");
  }
  if (request.priorBriefId !== undefined && !isNonEmptyString(request.priorBriefId)) {
    errors.push("BriefUpdateRequest.priorBriefId must be a non-empty string when provided.");
  }

  return errors;
}

export function assertValidBriefUpdateRequest(request: BriefUpdateRequest): void {
  const errors = listBriefUpdateRequestValidationErrors(request);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export function listBriefUpdateResultValidationErrors(
  result: BriefUpdateResult,
  request?: BriefUpdateRequest,
): string[] {
  const errors: string[] = [];

  if (result.schemaVersion !== BRIEF_UPDATE_SCHEMA_VERSION) {
    errors.push("BriefUpdateResult.schemaVersion must be 1.");
  }
  if (!isNonEmptyString(result.requestId)) {
    errors.push("BriefUpdateResult.requestId must be a non-empty string.");
  }
  if (request && result.requestId !== request.requestId) {
    errors.push("BriefUpdateResult.requestId must match the request.");
  }
  if (!isBriefUpdateResultStatus(result.status)) {
    errors.push("BriefUpdateResult.status is invalid.");
  }
  if (!isNonEmptyString(result.summary)) {
    errors.push("BriefUpdateResult.summary must be a non-empty string.");
  }
  if (!Number.isFinite(result.metrics?.elapsedMs) || result.metrics.elapsedMs < 0) {
    errors.push("BriefUpdateResult.metrics.elapsedMs must be a non-negative number.");
  }
  if (!Number.isSafeInteger(result.metrics?.evidenceRefs) || result.metrics.evidenceRefs < 0) {
    errors.push("BriefUpdateResult.metrics.evidenceRefs must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(result.metrics?.includedSources) || result.metrics.includedSources < 0) {
    errors.push("BriefUpdateResult.metrics.includedSources must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(result.metrics?.excludedSources) || result.metrics.excludedSources < 0) {
    errors.push("BriefUpdateResult.metrics.excludedSources must be a non-negative integer.");
  }

  if (result.status === "failed") {
    if (!result.error || !isNonEmptyString(result.error.code) || !isNonEmptyString(result.error.message)) {
      errors.push("Failed BriefUpdateResult requires an error code and message.");
    }
  } else {
    if (!result.brief || !result.manifest) {
      errors.push("Succeeded or limited BriefUpdateResult requires a staged brief and manifest.");
    }
  }

  if (result.brief && result.manifest) {
    try {
      assertValidSectionBrief(result.brief, {
        visibilityPolicy: request?.visibilityPolicy ?? result.manifest.visibilityPolicy,
        requireDurableFields: true,
      });
      assertValidBriefEvidenceManifest(result.manifest);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
    if (result.manifest.briefId !== result.brief.id) {
      errors.push("BriefUpdateResult manifest must reference the staged brief id.");
    }
    if (result.briefId !== result.brief.id) {
      errors.push("BriefUpdateResult.briefId must match the staged brief id.");
    }
    if (result.manifest.briefVersion !== result.brief.version) {
      errors.push("BriefUpdateResult manifest version must match the staged brief version.");
    }
    if (request) {
      if (result.brief.sectionId !== sectionIdFromBriefUpdateScope(request.scope, request.briefType)) {
        errors.push("BriefUpdateResult brief section must match the request scope.");
      }
      if (result.manifest.ownerUserId !== request.scope.ownerUserId) {
        errors.push("BriefUpdateResult manifest owner must match the request scope.");
      }
      if (result.manifest.visibilityPolicy !== request.visibilityPolicy) {
        errors.push("BriefUpdateResult manifest visibility policy must match the request.");
      }
    }
  }

  for (const [index, artifact] of result.artifacts.entries()) {
    if (!isNonEmptyString(artifact.kind) || !["brief", "brief_manifest", "brief_evidence"].includes(artifact.kind)) {
      errors.push(`BriefUpdateResult.artifacts[${index}].kind is invalid.`);
    }
    if (!isNonEmptyString(artifact.uri)) {
      errors.push(`BriefUpdateResult.artifacts[${index}].uri must be a non-empty string.`);
    }
    if (!isNonEmptyString(artifact.label)) {
      errors.push(`BriefUpdateResult.artifacts[${index}].label must be a non-empty string.`);
    }
  }

  return errors;
}

export function assertValidBriefUpdateResult(result: BriefUpdateResult, request?: BriefUpdateRequest): void {
  const errors = listBriefUpdateResultValidationErrors(result, request);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}
