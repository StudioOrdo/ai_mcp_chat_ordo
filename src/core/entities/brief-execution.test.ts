import { describe, expect, it } from "vitest";

import {
  createBriefEvidenceManifest,
  type SectionBrief,
} from "@/core/entities/brief";

import {
  assertValidBriefUpdateRequest,
  assertValidBriefUpdateResult,
  listBriefUpdateRequestValidationErrors,
  listBriefUpdateResultValidationErrors,
  type BriefUpdateRequest,
  type BriefUpdateResult,
} from "./brief-execution";

function request(overrides: Partial<BriefUpdateRequest> = {}): BriefUpdateRequest {
  return {
    schemaVersion: "1",
    requestId: "brief_req_1",
    briefType: "today",
    scope: {
      sectionId: "today",
      ownerUserId: "usr_1",
    },
    evidenceWindow: {
      from: "2026-05-06T11:00:00.000Z",
      to: "2026-05-06T12:00:00.000Z",
    },
    visibilityPolicy: "owner",
    executorProfile: {
      kind: "deterministic",
    },
    ...overrides,
  };
}

function brief(overrides: Partial<SectionBrief> = {}): SectionBrief {
  return {
    id: "brief_today_v1",
    sectionId: "today",
    asOf: "2026-05-06T12:00:00.000Z",
    status: "fresh",
    title: "Today Brief",
    summary: "One durable signal needs review.",
    bullets: ["Review the strategy offer before sending it."],
    recommendedAction: { label: "Review offer", href: "/offers?offer=offer_1" },
    evidenceRefs: [{
      kind: "offer",
      id: "offer_1",
      label: "Strategy offer",
      href: "/offers?offer=offer_1",
      visibility: "owner",
    }],
    limitations: [],
    version: 1,
    ...overrides,
  };
}

function result(
  updateRequest: BriefUpdateRequest,
  overrides: Partial<BriefUpdateResult> = {},
): BriefUpdateResult {
  const stagedBrief = brief({
    sectionId: updateRequest.scope.sectionId ?? updateRequest.scope.objectKind ?? updateRequest.briefType,
  });
  const manifest = createBriefEvidenceManifest({
    brief: stagedBrief,
    generatedAt: "2026-05-06T12:00:01.000Z",
    generatedBy: "brief-executor:deterministic",
    ownerUserId: updateRequest.scope.ownerUserId,
    visibilityPolicy: updateRequest.visibilityPolicy,
    executorMetadata: {
      kind: updateRequest.executorProfile.kind,
      requestId: updateRequest.requestId,
    },
  });

  return {
    schemaVersion: "1",
    requestId: updateRequest.requestId,
    status: "succeeded",
    briefId: stagedBrief.id,
    priorBriefId: null,
    summary: stagedBrief.summary,
    brief: stagedBrief,
    manifest,
    artifacts: [{
      kind: "brief",
      uri: `briefs://${stagedBrief.id}`,
      label: "Staged brief",
      metadata: { briefId: stagedBrief.id },
    }],
    metrics: {
      evidenceRefs: 1,
      includedSources: 1,
      excludedSources: 0,
      elapsedMs: 12,
    },
    warnings: [],
    ...overrides,
  };
}

describe("brief update execution contract", () => {
  it("accepts a valid durable brief update request", () => {
    expect(() => assertValidBriefUpdateRequest(request())).not.toThrow();
  });

  it("rejects invalid scope and evidence windows before execution", () => {
    const errors = listBriefUpdateRequestValidationErrors(request({
      scope: { ownerUserId: "usr_1" },
      evidenceWindow: {
        from: "2026-05-06T13:00:00.000Z",
        to: "2026-05-06T12:00:00.000Z",
      },
    }));

    expect(errors).toEqual(expect.arrayContaining([
      "BriefUpdateRequest.scope must include sectionId or objectKind/objectId.",
      "BriefUpdateRequest.evidenceWindow.from must not be after evidenceWindow.to.",
    ]));
  });

  it("accepts a valid staged result with brief and evidence manifest", () => {
    const updateRequest = request();
    expect(() => assertValidBriefUpdateResult(result(updateRequest), updateRequest)).not.toThrow();
  });

  it("rejects an ungrounded generated claim before reconciliation", () => {
    const updateRequest = request();
    const staged = result(updateRequest);

    const errors = listBriefUpdateResultValidationErrors({
      ...staged,
      manifest: staged.manifest
        ? {
            ...staged.manifest,
            claims: [{
              id: "claim_fake",
              text: "Revenue improved.",
              evidenceRefIds: [],
            }],
          }
        : undefined,
    }, updateRequest);

    expect(errors).toContain("BriefEvidenceManifest.claims[0] must have evidence refs or a limitation.");
  });

  it("rejects private evidence in public-safe brief results", () => {
    const updateRequest = request({ visibilityPolicy: "public-safe" });
    const publicBrief = brief({
      evidenceRefs: [{
        kind: "conversation",
        id: "conv_private",
        label: "Private conversation",
        visibility: "private",
      }],
    });
    const publicManifest = createBriefEvidenceManifest({
      brief: publicBrief,
      generatedAt: "2026-05-06T12:00:01.000Z",
      generatedBy: "brief-executor:deterministic",
      ownerUserId: updateRequest.scope.ownerUserId,
      visibilityPolicy: "public-safe",
    });

    const errors = listBriefUpdateResultValidationErrors(result(updateRequest, {
      brief: publicBrief,
      briefId: publicBrief.id,
      manifest: publicManifest,
    }), updateRequest);

    expect(errors).toContain("Public-safe briefs cannot include private, owner-only, or admin evidence.");
  });
});
