export const BRIEF_SCHEMA_VERSION = "1" as const;

export const BRIEF_STATUSES = ["fresh", "stale", "limited", "failed"] as const;
export type BriefStatus = typeof BRIEF_STATUSES[number];

export const BRIEF_VISIBILITY_POLICIES = ["owner", "admin", "public-safe"] as const;
export type BriefVisibilityPolicy = typeof BRIEF_VISIBILITY_POLICIES[number];

export const BRIEF_SOURCE_VISIBILITIES = ["public", "owner", "admin", "private"] as const;
export type BriefSourceVisibility = typeof BRIEF_SOURCE_VISIBILITIES[number];

export interface BriefAction {
  label: string;
  href: string;
  prompt?: string;
}

export interface BriefObjectRef {
  kind: string;
  id: string;
  label: string;
}

export interface BriefEvidenceRef {
  kind: string;
  id: string;
  label: string;
  href?: string;
  visibility?: BriefSourceVisibility;
}

export interface SectionBrief {
  id: string;
  sectionId: string;
  objectRef?: BriefObjectRef;
  asOf?: string;
  status: BriefStatus;
  title: string;
  summary: string;
  bullets: string[];
  recommendedAction: BriefAction | null;
  evidenceRefs: BriefEvidenceRef[];
  limitations: string[];
  version?: number;
  priorBriefId?: string;
}

export interface BriefExcludedEvidenceRef extends BriefEvidenceRef {
  reason: string;
}

export interface BriefManifestClaim {
  id: string;
  text: string;
  evidenceRefIds: string[];
  limitation?: string;
}

export interface BriefExecutorMetadata {
  kind: "deterministic" | "llm" | "local_model" | "rust_native";
  model?: string;
  provider?: string;
  requestId?: string;
  elapsedMs?: number;
}

export interface BriefEvidenceManifest {
  schemaVersion: typeof BRIEF_SCHEMA_VERSION;
  briefId: string;
  briefVersion: number;
  generatedAt: string;
  generatedBy: string;
  ownerUserId: string | null;
  sectionId: string;
  objectRef?: BriefObjectRef;
  visibilityPolicy: BriefVisibilityPolicy;
  includedSourceRefs: BriefEvidenceRef[];
  excludedSourceRefs: BriefExcludedEvidenceRef[];
  claims: BriefManifestClaim[];
  limitations: string[];
  executorMetadata: BriefExecutorMetadata | null;
  warnings: string[];
}

export interface StoredSectionBrief extends SectionBrief {
  ownerUserId: string | null;
  visibilityPolicy: BriefVisibilityPolicy;
  generatedAt: string;
  generatedBy: string;
  manifest: BriefEvidenceManifest;
  isCurrent: boolean;
}

export type BriefEventType =
  | "brief_created"
  | "brief_updated"
  | "brief_superseded"
  | "brief_update_failed"
  | "brief_update_stale";

export interface BriefReadModelEvent {
  id: string;
  briefId: string;
  sectionId: string;
  objectRef?: BriefObjectRef;
  ownerUserId: string | null;
  eventType: BriefEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function briefSourceRefId(ref: Pick<BriefEvidenceRef, "kind" | "id">): string {
  return `${ref.kind}:${ref.id}`;
}

export function isBriefStatus(value: string): value is BriefStatus {
  return (BRIEF_STATUSES as readonly string[]).includes(value);
}

export function isBriefVisibilityPolicy(value: string): value is BriefVisibilityPolicy {
  return (BRIEF_VISIBILITY_POLICIES as readonly string[]).includes(value);
}

export function isBriefSourceVisibility(value: string): value is BriefSourceVisibility {
  return (BRIEF_SOURCE_VISIBILITIES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoLikeTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

const OWNER_UNSAFE_COPY_PATTERNS: readonly RegExp[] = [
  /\bjob_[a-z0-9-]+\b/i,
  /\bprovider\b/i,
  /\blogs?\b/i,
  /\bsystem_commands\b/i,
  /\bpayload_json\b/i,
];

function containsOwnerUnsafeCopy(value: string): boolean {
  return OWNER_UNSAFE_COPY_PATTERNS.some((pattern) => pattern.test(value));
}

function validateAction(action: BriefAction | null, errors: string[], path: string): void {
  if (!action) {
    return;
  }
  if (!isNonEmptyString(action.label)) {
    errors.push(`${path}.label must be a non-empty string.`);
  }
  if (!isNonEmptyString(action.href)) {
    errors.push(`${path}.href must be a non-empty string.`);
  }
}

function validateEvidenceRef(ref: BriefEvidenceRef, errors: string[], path: string): void {
  if (!isNonEmptyString(ref.kind)) {
    errors.push(`${path}.kind must be a non-empty string.`);
  }
  if (!isNonEmptyString(ref.id)) {
    errors.push(`${path}.id must be a non-empty string.`);
  }
  if (!isNonEmptyString(ref.label)) {
    errors.push(`${path}.label must be a non-empty string.`);
  }
  if (ref.visibility !== undefined && !isBriefSourceVisibility(ref.visibility)) {
    errors.push(`${path}.visibility is invalid.`);
  }
}

function validateObjectRef(ref: BriefObjectRef | undefined, errors: string[], path: string): void {
  if (!ref) {
    return;
  }
  if (!isNonEmptyString(ref.kind)) {
    errors.push(`${path}.kind must be a non-empty string.`);
  }
  if (!isNonEmptyString(ref.id)) {
    errors.push(`${path}.id must be a non-empty string.`);
  }
  if (!isNonEmptyString(ref.label)) {
    errors.push(`${path}.label must be a non-empty string.`);
  }
}

export function listSectionBriefValidationErrors(
  brief: SectionBrief,
  options: { visibilityPolicy?: BriefVisibilityPolicy; requireDurableFields?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const visibilityPolicy = options.visibilityPolicy ?? "owner";

  if (!isNonEmptyString(brief.id)) errors.push("SectionBrief.id must be a non-empty string.");
  if (!isNonEmptyString(brief.sectionId)) errors.push("SectionBrief.sectionId must be a non-empty string.");
  if (!isBriefStatus(brief.status)) errors.push("SectionBrief.status is invalid.");
  if (!isNonEmptyString(brief.title)) errors.push("SectionBrief.title must be a non-empty string.");
  if (!isNonEmptyString(brief.summary)) errors.push("SectionBrief.summary must be a non-empty string.");
  if (brief.asOf !== undefined && !isIsoLikeTimestamp(brief.asOf)) {
    errors.push("SectionBrief.asOf must be a valid timestamp when provided.");
  }
  if (options.requireDurableFields && typeof brief.version !== "number") {
    errors.push("SectionBrief.version is required for durable storage.");
  }
  if (brief.version !== undefined && (!Number.isSafeInteger(brief.version) || brief.version < 1)) {
    errors.push("SectionBrief.version must be a positive integer when provided.");
  }
  validateObjectRef(brief.objectRef, errors, "SectionBrief.objectRef");
  validateAction(brief.recommendedAction, errors, "SectionBrief.recommendedAction");

  brief.evidenceRefs.forEach((ref, index) => validateEvidenceRef(ref, errors, `SectionBrief.evidenceRefs[${index}]`));

  if (visibilityPolicy !== "admin") {
    const ownerCopy = [
      brief.title,
      brief.summary,
      ...brief.bullets,
      ...brief.limitations,
      ...brief.evidenceRefs.map((ref) => ref.label),
    ].join("\n");
    if (containsOwnerUnsafeCopy(ownerCopy)) {
      errors.push("Owner/public-safe briefs cannot expose raw job, provider, log, or payload details.");
    }
  }

  return errors;
}

export function listBriefEvidenceManifestValidationErrors(
  manifest: BriefEvidenceManifest,
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== BRIEF_SCHEMA_VERSION) {
    errors.push("BriefEvidenceManifest.schemaVersion must be 1.");
  }
  if (!isNonEmptyString(manifest.briefId)) {
    errors.push("BriefEvidenceManifest.briefId must be a non-empty string.");
  }
  if (!Number.isSafeInteger(manifest.briefVersion) || manifest.briefVersion < 1) {
    errors.push("BriefEvidenceManifest.briefVersion must be a positive integer.");
  }
  if (!isNonEmptyString(manifest.generatedAt) || !isIsoLikeTimestamp(manifest.generatedAt)) {
    errors.push("BriefEvidenceManifest.generatedAt must be a valid timestamp.");
  }
  if (!isNonEmptyString(manifest.generatedBy)) {
    errors.push("BriefEvidenceManifest.generatedBy must be a non-empty string.");
  }
  if (!isNonEmptyString(manifest.sectionId)) {
    errors.push("BriefEvidenceManifest.sectionId must be a non-empty string.");
  }
  if (!isBriefVisibilityPolicy(manifest.visibilityPolicy)) {
    errors.push("BriefEvidenceManifest.visibilityPolicy is invalid.");
  }
  validateObjectRef(manifest.objectRef, errors, "BriefEvidenceManifest.objectRef");

  manifest.includedSourceRefs.forEach((ref, index) => validateEvidenceRef(ref, errors, `BriefEvidenceManifest.includedSourceRefs[${index}]`));
  manifest.excludedSourceRefs.forEach((ref, index) => {
    validateEvidenceRef(ref, errors, `BriefEvidenceManifest.excludedSourceRefs[${index}]`);
    if (!isNonEmptyString(ref.reason)) {
      errors.push(`BriefEvidenceManifest.excludedSourceRefs[${index}].reason must be a non-empty string.`);
    }
  });

  const includedIds = new Set(manifest.includedSourceRefs.map(briefSourceRefId));
  manifest.claims.forEach((claim, index) => {
    if (!isNonEmptyString(claim.id)) {
      errors.push(`BriefEvidenceManifest.claims[${index}].id must be a non-empty string.`);
    }
    if (!isNonEmptyString(claim.text)) {
      errors.push(`BriefEvidenceManifest.claims[${index}].text must be a non-empty string.`);
    }
    if (claim.evidenceRefIds.length === 0 && !isNonEmptyString(claim.limitation)) {
      errors.push(`BriefEvidenceManifest.claims[${index}] must have evidence refs or a limitation.`);
    }
    for (const evidenceRefId of claim.evidenceRefIds) {
      if (!includedIds.has(evidenceRefId)) {
        errors.push(`BriefEvidenceManifest.claims[${index}] references missing evidence ${evidenceRefId}.`);
      }
    }
  });

  if (manifest.visibilityPolicy === "public-safe") {
    for (const ref of manifest.includedSourceRefs) {
      if ((ref.visibility ?? "owner") !== "public") {
        errors.push("Public-safe briefs cannot include private, owner-only, or admin evidence.");
        break;
      }
    }
  }

  if (manifest.visibilityPolicy === "owner") {
    for (const ref of manifest.includedSourceRefs) {
      if (ref.visibility === "admin") {
        errors.push("Owner briefs cannot include admin-only evidence.");
        break;
      }
    }
  }

  return errors;
}

export function assertValidSectionBrief(
  brief: SectionBrief,
  options?: { visibilityPolicy?: BriefVisibilityPolicy; requireDurableFields?: boolean },
): void {
  const errors = listSectionBriefValidationErrors(brief, options);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export function assertValidBriefEvidenceManifest(manifest: BriefEvidenceManifest): void {
  const errors = listBriefEvidenceManifestValidationErrors(manifest);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
}

export function createBriefEvidenceManifest(input: {
  brief: SectionBrief;
  generatedAt: string;
  generatedBy: string;
  ownerUserId: string | null;
  visibilityPolicy: BriefVisibilityPolicy;
  includedSourceRefs?: BriefEvidenceRef[];
  excludedSourceRefs?: BriefExcludedEvidenceRef[];
  claims?: BriefManifestClaim[];
  limitations?: string[];
  executorMetadata?: BriefExecutorMetadata | null;
  warnings?: string[];
}): BriefEvidenceManifest {
  const includedSourceRefs = input.includedSourceRefs ?? input.brief.evidenceRefs;
  const includedIds = includedSourceRefs.map(briefSourceRefId);
  const claims = input.claims ?? input.brief.bullets.map((bullet, index) => ({
    id: `${input.brief.id}:claim:${index + 1}`,
    text: bullet,
    evidenceRefIds: includedIds,
    limitation: includedIds.length === 0 ? input.brief.limitations[0] : undefined,
  }));

  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    briefId: input.brief.id,
    briefVersion: input.brief.version ?? 1,
    generatedAt: input.generatedAt,
    generatedBy: input.generatedBy,
    ownerUserId: input.ownerUserId,
    sectionId: input.brief.sectionId,
    ...(input.brief.objectRef ? { objectRef: input.brief.objectRef } : {}),
    visibilityPolicy: input.visibilityPolicy,
    includedSourceRefs,
    excludedSourceRefs: input.excludedSourceRefs ?? [],
    claims,
    limitations: input.limitations ?? input.brief.limitations,
    executorMetadata: input.executorMetadata ?? { kind: "deterministic" },
    warnings: input.warnings ?? [],
  };
}
