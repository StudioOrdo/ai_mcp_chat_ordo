import type { BriefReadModelDataMapper } from "@/adapters/BriefReadModelDataMapper";
import type { BriefUpdateRequestDataMapper } from "@/adapters/BriefUpdateRequestDataMapper";
import {
  briefObjectRefFromScope,
  sectionIdFromBriefUpdateScope,
  type BriefUpdateArtifact,
  type BriefUpdateResult,
  type DurableBriefUpdateRequest,
  type StoredBriefUpdateResult,
} from "@/core/entities/brief-execution";
import {
  briefSourceRefId,
  createBriefEvidenceManifest,
  type BriefEvidenceManifest,
  type BriefEvidenceRef,
  type BriefManifestClaim,
  type SectionBrief,
  type StoredSectionBrief,
} from "@/core/entities/brief";

import { BriefUpdateReconciler } from "./brief-update-reconciler";

export interface BriefUpdateExecutionInput {
  leaseOwner: string;
  leaseDurationMs?: number;
}

export interface BriefUpdateExecutionResult {
  request: DurableBriefUpdateRequest;
  result: StoredBriefUpdateResult;
  reconciled: boolean;
}

export interface BriefDraftGeneratorInput {
  request: DurableBriefUpdateRequest;
  evidenceRefs: BriefEvidenceRef[];
  priorBrief: StoredSectionBrief | null;
  now: string;
  elapsedMs: number;
}

export interface BriefDraftGeneratorOutput {
  brief: SectionBrief;
  manifest: BriefEvidenceManifest;
  warnings?: string[];
}

export class BriefUpdateExecutionError extends Error {
  constructor(
    message: string,
    readonly code = "BRIEF_UPDATE_EXECUTION_FAILED",
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "BriefUpdateExecutionError";
  }
}

export interface BriefUpdateExecutorDeps {
  requests: BriefUpdateRequestDataMapper;
  briefs: BriefReadModelDataMapper;
  reconciler?: BriefUpdateReconciler;
  gatherEvidence: (request: DurableBriefUpdateRequest) => Promise<BriefEvidenceRef[]>;
  generateDraft?: (input: BriefDraftGeneratorInput) => Promise<BriefDraftGeneratorOutput>;
  now?: () => string;
}

export class BriefUpdateExecutor {
  private readonly reconciler: BriefUpdateReconciler;

  constructor(private readonly deps: BriefUpdateExecutorDeps) {
    this.reconciler = deps.reconciler ?? new BriefUpdateReconciler({
      requests: deps.requests,
      briefs: deps.briefs,
      now: deps.now,
    });
  }

  async runNext(input: BriefUpdateExecutionInput): Promise<BriefUpdateExecutionResult | null> {
    const claimNow = this.now();
    await this.deps.requests.recoverExpiredLeases({ now: claimNow });
    const request = await this.deps.requests.claimNext({
      leaseOwner: input.leaseOwner,
      leaseDurationMs: input.leaseDurationMs,
      now: claimNow,
    });

    if (!request) {
      return null;
    }

    const startedAt = Date.parse(claimNow);
    let evidenceRefs: BriefEvidenceRef[] = [];
    let priorBrief: StoredSectionBrief | null = null;

    try {
      priorBrief = await this.findPriorBrief(request);
      evidenceRefs = await this.deps.gatherEvidence(request);
      const draftNow = this.now();
      const elapsedMs = elapsedSince(startedAt, draftNow);
      const draft = await this.generateDraft({
        request,
        evidenceRefs,
        priorBrief,
        now: draftNow,
        elapsedMs,
      });
      const result = buildSucceededResult({
        request,
        draft,
        evidenceRefs,
        priorBrief,
        elapsedMs,
      });
      const staged = await this.deps.requests.stageResult(request.requestId, result, { now: this.now() });
      await this.reconciler.reconcile(request, staged);
      const stored = await this.deps.requests.requireResult(request.requestId);

      return {
        request: await this.deps.requests.requireRequest(request.requestId),
        result: stored,
        reconciled: true,
      };
    } catch (error) {
      const result = buildFailedResult({
        request,
        error,
        evidenceRefCount: evidenceRefs.length,
        priorBrief,
        elapsedMs: elapsedSince(startedAt, this.now()),
      });
      const failed = await this.deps.requests.stageResult(request.requestId, result, { now: this.now() });
      return {
        request: await this.deps.requests.requireRequest(request.requestId),
        result: failed,
        reconciled: false,
      };
    }
  }

  private async findPriorBrief(request: DurableBriefUpdateRequest): Promise<StoredSectionBrief | null> {
    return this.deps.briefs.findCurrentForScope({
      sectionId: sectionIdFromBriefUpdateScope(request.scope, request.briefType),
      ownerUserId: request.scope.ownerUserId,
      visibilityPolicy: request.visibilityPolicy,
      objectRef: briefObjectRefFromScope(request.scope) ?? null,
    });
  }

  private async generateDraft(input: BriefDraftGeneratorInput): Promise<BriefDraftGeneratorOutput> {
    if (this.deps.generateDraft) {
      return this.deps.generateDraft(input);
    }
    return createDeterministicBriefDraft(input);
  }

  private now(): string {
    return this.deps.now?.() ?? new Date().toISOString();
  }
}

export function createDeterministicBriefDraft(input: BriefDraftGeneratorInput): BriefDraftGeneratorOutput {
  const sectionId = sectionIdFromBriefUpdateScope(input.request.scope, input.request.briefType);
  const objectRef = briefObjectRefFromScope(input.request.scope);
  const nextVersion = (input.priorBrief?.version ?? 0) + 1;
  const briefId = `${input.request.requestId}_brief_v${nextVersion}`;
  const includedSourceRefs = input.evidenceRefs.filter((ref) => shouldIncludeEvidenceRef(ref, input.request.visibilityPolicy));
  const excludedSourceRefs = input.evidenceRefs
    .filter((ref) => !shouldIncludeEvidenceRef(ref, input.request.visibilityPolicy))
    .map((ref, index) => excludedEvidenceRefFor(ref, input.request.visibilityPolicy, index));
  const hasIncludedEvidence = includedSourceRefs.length > 0;
  const title = `${titleize(input.request.briefType)} Brief`;
  const sourceLabel = includedSourceRefs[0]?.label ?? "source evidence";
  const limitations = hasIncludedEvidence
    ? []
    : ["No source evidence was available in the selected window."];
  const bullets = hasIncludedEvidence
    ? [`Review ${sourceLabel} before deciding the next action.`]
    : ["No durable source evidence was available for this update."];

  const brief: SectionBrief = {
    id: briefId,
    sectionId,
    ...(objectRef ? { objectRef } : {}),
    asOf: input.request.evidenceWindow.to,
    status: hasIncludedEvidence ? "fresh" : "limited",
    title,
    summary: hasIncludedEvidence
      ? `Brief updated from ${includedSourceRefs.length} durable evidence source${includedSourceRefs.length === 1 ? "" : "s"}.`
      : "Brief update is limited because no source evidence was available.",
    bullets,
    recommendedAction: {
      label: hasIncludedEvidence ? "Review evidence" : "Ask Ordo",
      href: evidenceHrefFor(sectionId, includedSourceRefs[0]),
      prompt: hasIncludedEvidence
        ? `Review ${sourceLabel} and recommend the next step.`
        : `Find evidence for the ${input.request.briefType} brief.`,
    },
    evidenceRefs: includedSourceRefs,
    limitations,
    version: nextVersion,
    ...(input.priorBrief ? { priorBriefId: input.priorBrief.id } : {}),
  };

  const claims: BriefManifestClaim[] = brief.bullets.map((bullet, index) => ({
    id: `${brief.id}:claim:${index + 1}`,
    text: bullet,
    evidenceRefIds: includedSourceRefs.length > 0 ? includedSourceRefs.map(briefSourceRefId) : [],
    ...(includedSourceRefs.length === 0 ? { limitation: limitations[0] } : {}),
  }));
  const manifest = createBriefEvidenceManifest({
    brief,
    generatedAt: input.now,
    generatedBy: `brief-executor:${input.request.executorProfile.kind}`,
    ownerUserId: input.request.scope.ownerUserId,
    visibilityPolicy: input.request.visibilityPolicy,
    includedSourceRefs,
    excludedSourceRefs,
    claims,
    limitations,
    executorMetadata: {
      kind: input.request.executorProfile.kind,
      model: input.request.executorProfile.model,
      requestId: input.request.requestId,
      elapsedMs: input.elapsedMs,
    },
    warnings: excludedSourceRefs.length > 0 ? ["Some evidence was excluded by visibility policy."] : [],
  });

  return {
    brief,
    manifest,
    warnings: manifest.warnings,
  };
}

function buildSucceededResult(input: {
  request: DurableBriefUpdateRequest;
  draft: BriefDraftGeneratorOutput;
  evidenceRefs: BriefEvidenceRef[];
  priorBrief: StoredSectionBrief | null;
  elapsedMs: number;
}): BriefUpdateResult {
  return {
    schemaVersion: "1",
    requestId: input.request.requestId,
    status: input.draft.brief.status === "limited" ? "limited" : "succeeded",
    briefId: input.draft.brief.id,
    priorBriefId: input.priorBrief?.id ?? input.request.priorBriefId ?? null,
    summary: input.draft.brief.summary,
    brief: input.draft.brief,
    manifest: input.draft.manifest,
    artifacts: artifactsFor(input.draft.brief.id),
    metrics: {
      evidenceRefs: input.evidenceRefs.length,
      includedSources: input.draft.manifest.includedSourceRefs.length,
      excludedSources: input.draft.manifest.excludedSourceRefs.length,
      elapsedMs: input.elapsedMs,
    },
    warnings: input.draft.warnings ?? input.draft.manifest.warnings,
  };
}

function buildFailedResult(input: {
  request: DurableBriefUpdateRequest;
  error: unknown;
  evidenceRefCount: number;
  priorBrief: StoredSectionBrief | null;
  elapsedMs: number;
}): BriefUpdateResult {
  const normalized = normalizeExecutionError(input.error);
  return {
    schemaVersion: "1",
    requestId: input.request.requestId,
    status: "failed",
    briefId: null,
    priorBriefId: input.priorBrief?.id ?? input.request.priorBriefId ?? null,
    summary: "Brief update failed before reconciliation.",
    artifacts: [],
    metrics: {
      evidenceRefs: input.evidenceRefCount,
      includedSources: 0,
      excludedSources: input.evidenceRefCount,
      elapsedMs: input.elapsedMs,
    },
    warnings: [],
    error: normalized,
  };
}

function normalizeExecutionError(error: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof BriefUpdateExecutionError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  if (error instanceof Error) {
    return {
      code: "BRIEF_UPDATE_EXECUTION_FAILED",
      message: error.message,
    };
  }
  return {
    code: "BRIEF_UPDATE_EXECUTION_FAILED",
    message: String(error),
  };
}

function shouldIncludeEvidenceRef(
  ref: BriefEvidenceRef,
  visibilityPolicy: DurableBriefUpdateRequest["visibilityPolicy"],
): boolean {
  if (visibilityPolicy === "admin") {
    return true;
  }
  if (visibilityPolicy === "public-safe") {
    return (ref.visibility ?? "owner") === "public";
  }
  return ref.visibility !== "admin";
}

function excludedEvidenceRefFor(
  ref: BriefEvidenceRef,
  visibilityPolicy: DurableBriefUpdateRequest["visibilityPolicy"],
  index: number,
): BriefEvidenceRef & { reason: string } {
  if (visibilityPolicy === "admin") {
    return {
      ...ref,
      reason: "Evidence visibility is outside this brief visibility policy.",
    };
  }

  return {
    kind: "redacted",
    id: `non_public_${index + 1}`,
    label: "Non-public evidence",
    visibility: ref.visibility,
    reason: "Evidence visibility is outside this brief visibility policy.",
  };
}

function artifactsFor(briefId: string): BriefUpdateArtifact[] {
  return [
    {
      kind: "brief",
      uri: `briefs://${briefId}`,
      label: "Staged brief",
      metadata: { briefId },
    },
    {
      kind: "brief_manifest",
      uri: `briefs://${briefId}/manifest`,
      label: "Evidence manifest",
      metadata: { briefId },
    },
  ];
}

function evidenceHrefFor(sectionId: string, ref?: BriefEvidenceRef): string {
  if (ref?.href) {
    return ref.href;
  }
  return `/${sectionId}`;
}

function elapsedSince(startedAt: number, now: string): number {
  const end = Date.parse(now);
  if (!Number.isFinite(startedAt) || !Number.isFinite(end) || end < startedAt) {
    return 0;
  }
  return end - startedAt;
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
