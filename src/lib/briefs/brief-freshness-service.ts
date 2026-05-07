import { randomUUID } from "node:crypto";
import type { BriefReadModelDataMapper, BriefReadModelScopeInput } from "@/adapters/BriefReadModelDataMapper";
import type { BriefUpdateRequestDataMapper } from "@/adapters/BriefUpdateRequestDataMapper";
import type { SystemEventDataMapper } from "@/adapters/SystemEventDataMapper";
import type {
  BriefObjectRef,
  BriefVisibilityPolicy,
  StoredSectionBrief,
} from "@/core/entities/brief";
import type { BriefUpdateRequest, DurableBriefUpdateRequest } from "@/core/entities/brief-execution";
import type { SystemEvent, SystemEventViewer } from "@/core/entities/system-event";

export interface BriefFreshnessScope {
  sectionId: string;
  ownerUserId?: string | null;
  visibilityPolicy: BriefVisibilityPolicy;
  objectRef?: BriefObjectRef | null;
}

export interface BriefFreshnessResult {
  sectionId: string;
  objectRef: BriefObjectRef | null;
  briefId: string | null;
  briefAsOfSequence: number;
  latestEventSequence: number;
  isStale: boolean;
  missingBrief: boolean;
  reason: string;
}

export interface EnsureBriefUpdateRequestResult {
  freshness: BriefFreshnessResult;
  request: DurableBriefUpdateRequest | null;
}

export interface BriefFreshnessServiceDependencies {
  briefs: BriefReadModelDataMapper;
  events: SystemEventDataMapper;
  updateRequests: BriefUpdateRequestDataMapper;
}

export class BriefFreshnessService {
  constructor(private readonly deps: BriefFreshnessServiceDependencies) {}

  async getBriefFreshness(input: {
    scope: BriefFreshnessScope;
    viewer?: SystemEventViewer | null;
  }): Promise<BriefFreshnessResult> {
    assertCanInspectFreshness(input.scope, input.viewer ?? null);
    const current = await this.deps.briefs.findCurrentForScope(toBriefScope(input.scope));
    const latest = await this.deps.events.findLatestVisible({
      viewer: input.viewer ?? null,
      sectionId: input.scope.sectionId,
      objectRef: input.scope.objectRef ?? null,
    });

    return buildFreshness(input.scope, current, latest);
  }

  async ensureUpdateRequestForStaleBrief(input: {
    scope: BriefFreshnessScope;
    viewer?: SystemEventViewer | null;
    requestedByUserId?: string | null;
    requestedFrom?: string;
    now?: string;
  }): Promise<EnsureBriefUpdateRequestResult> {
    const viewer = input.viewer ?? null;
    assertCanInspectFreshness(input.scope, viewer);
    const current = await this.deps.briefs.findCurrentForScope(toBriefScope(input.scope));
    const latest = await this.deps.events.findLatestVisible({
      viewer,
      sectionId: input.scope.sectionId,
      objectRef: input.scope.objectRef ?? null,
    });
    const freshness = buildFreshness(input.scope, current, latest);

    if (!freshness.isStale) {
      return { freshness, request: null };
    }
    if (!input.scope.ownerUserId) {
      return { freshness, request: null };
    }

    const now = input.now ?? new Date().toISOString();
    const request: BriefUpdateRequest = {
      schemaVersion: "1",
      requestId: `brief_req_${randomUUID()}`,
      briefType: input.scope.sectionId,
      scope: {
        sectionId: input.scope.sectionId,
        ownerUserId: input.scope.ownerUserId,
        ...(input.scope.objectRef ? {
          objectKind: input.scope.objectRef.kind,
          objectId: input.scope.objectRef.id,
          objectLabel: input.scope.objectRef.label,
        } : {}),
      },
      evidenceWindow: {
        ...(current?.asOf ? { from: current.asOf } : {}),
        to: latest?.occurredAt ?? now,
      },
      visibilityPolicy: input.scope.visibilityPolicy,
      ...(current?.id ? { priorBriefId: current.id } : {}),
      executorProfile: { kind: "deterministic" },
    };

    const created = await this.deps.updateRequests.createRequest({
      request,
      requestedByUserId: input.requestedByUserId ?? viewer?.userId ?? null,
      requestedFrom: input.requestedFrom ?? "brief-freshness",
      now,
    });

    return { freshness, request: created };
  }
}

function buildFreshness(
  scope: BriefFreshnessScope,
  current: StoredSectionBrief | null,
  latest: SystemEvent | null,
): BriefFreshnessResult {
  const briefAsOfSequence = current?.asOfSequence ?? 0;
  const latestEventSequence = latest?.sequence ?? 0;
  const missingBrief = current === null;
  const isStale = missingBrief || latestEventSequence > briefAsOfSequence;

  return {
    sectionId: scope.sectionId,
    objectRef: scope.objectRef ?? null,
    briefId: current?.id ?? null,
    briefAsOfSequence,
    latestEventSequence,
    isStale,
    missingBrief,
    reason: freshnessReason({ missingBrief, isStale, latestEventSequence }),
  };
}

function freshnessReason(input: {
  missingBrief: boolean;
  isStale: boolean;
  latestEventSequence: number;
}): string {
  if (input.missingBrief && input.latestEventSequence > 0) {
    return "No current brief covers the latest durable evidence.";
  }
  if (input.missingBrief) {
    return "No current brief exists for this scope.";
  }
  if (input.isStale) {
    return "Durable evidence is newer than the current brief.";
  }
  return "Current brief covers visible durable evidence.";
}

function toBriefScope(scope: BriefFreshnessScope): BriefReadModelScopeInput {
  return {
    sectionId: scope.sectionId,
    ownerUserId: scope.ownerUserId ?? null,
    visibilityPolicy: scope.visibilityPolicy,
    objectRef: scope.objectRef ?? null,
  };
}

function assertCanInspectFreshness(scope: BriefFreshnessScope, viewer: SystemEventViewer | null): void {
  const role = viewer?.role?.toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SYSTEM";

  if (scope.visibilityPolicy === "public-safe") {
    return;
  }
  if (scope.visibilityPolicy === "admin") {
    if (!isAdmin) {
      throw new Error("Brief freshness scope is not visible to this viewer.");
    }
    return;
  }
  if (!scope.ownerUserId) {
    throw new Error("Owner brief freshness requires an owner scope.");
  }
  if (!isAdmin && viewer?.userId !== scope.ownerUserId) {
    throw new Error("Brief freshness scope is not visible to this viewer.");
  }
}
