import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { BriefReadModelDataMapper } from "@/adapters/BriefReadModelDataMapper";
import { BriefUpdateRequestDataMapper } from "@/adapters/BriefUpdateRequestDataMapper";
import {
  createBriefEvidenceManifest,
  type SectionBrief,
} from "@/core/entities/brief";
import type {
  BriefUpdateRequest,
  BriefUpdateResult,
  StoredBriefUpdateResult,
} from "@/core/entities/brief-execution";
import { ensureSchema } from "@/lib/db/schema";

import { BriefUpdateReconciler } from "./brief-update-reconciler";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run("usr_1", "owner@example.com", "Owner");
  return db;
}

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
    bullets: ["Review the relationship signal before follow-up."],
    recommendedAction: { label: "Review people", href: "/business" },
    evidenceRefs: [{
      kind: "person",
      id: "person_1",
      label: "Avery relationship",
      href: "/business?person=person_1",
      visibility: "owner",
    }],
    limitations: [],
    version: 1,
    ...overrides,
  };
}

function resultFor(updateRequest: BriefUpdateRequest, sourceBrief = brief()): BriefUpdateResult {
  return {
    schemaVersion: "1",
    requestId: updateRequest.requestId,
    status: "succeeded",
    briefId: sourceBrief.id,
    priorBriefId: null,
    summary: sourceBrief.summary,
    brief: sourceBrief,
    manifest: createBriefEvidenceManifest({
      brief: sourceBrief,
      generatedAt: "2026-05-06T12:00:01.000Z",
      generatedBy: "brief-executor:deterministic",
      ownerUserId: updateRequest.scope.ownerUserId,
      visibilityPolicy: updateRequest.visibilityPolicy,
    }),
    artifacts: [{
      kind: "brief",
      uri: `briefs://${sourceBrief.id}`,
      label: "Staged brief",
      metadata: { briefId: sourceBrief.id },
    }],
    metrics: {
      evidenceRefs: sourceBrief.evidenceRefs.length,
      includedSources: sourceBrief.evidenceRefs.length,
      excludedSources: 0,
      elapsedMs: 8,
    },
    warnings: [],
  };
}

describe("BriefUpdateReconciler", () => {
  let db: Database.Database;
  let requests: BriefUpdateRequestDataMapper;
  let briefs: BriefReadModelDataMapper;
  let reconciler: BriefUpdateReconciler;

  beforeEach(() => {
    db = createDb();
    requests = new BriefUpdateRequestDataMapper(db);
    briefs = new BriefReadModelDataMapper(db);
    reconciler = new BriefUpdateReconciler({
      requests,
      briefs,
      now: () => "2026-05-06T12:00:02.000Z",
    });
  });

  it("reconciles a staged result into the current stored section brief", async () => {
    const updateRequest = request();
    await requests.createRequest({ request: updateRequest });
    await requests.claimNext({ leaseOwner: "brief_worker" });
    const staged = await requests.stageResult(updateRequest.requestId, resultFor(updateRequest));

    await reconciler.reconcile(await requests.requireRequest(updateRequest.requestId), staged);

    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    const reconciledRequest = await requests.requireRequest(updateRequest.requestId);

    expect(current?.id).toBe("brief_today_v1");
    expect(current?.manifest.claims[0]).toMatchObject({
      evidenceRefIds: ["person:person_1"],
    });
    expect(reconciledRequest.status).toBe("reconciled");
  });

  it("does not overwrite the prior current brief for failed results", async () => {
    const prior = brief({
      id: "brief_prior",
      summary: "Prior brief remains current.",
    });
    await briefs.saveSectionBrief({
      brief: prior,
      manifest: createBriefEvidenceManifest({
        brief: prior,
        generatedAt: "2026-05-06T11:00:00.000Z",
        generatedBy: "deterministic:test",
        ownerUserId: "usr_1",
        visibilityPolicy: "owner",
      }),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    const updateRequest = request({ requestId: "brief_req_failed", priorBriefId: prior.id });
    await requests.createRequest({ request: updateRequest });
    await requests.claimNext({ leaseOwner: "brief_worker" });
    const failed = await requests.stageResult(updateRequest.requestId, {
      schemaVersion: "1",
      requestId: updateRequest.requestId,
      status: "failed",
      briefId: null,
      priorBriefId: prior.id,
      summary: "Brief update failed before reconciliation.",
      artifacts: [],
      metrics: {
        evidenceRefs: 0,
        includedSources: 0,
        excludedSources: 0,
        elapsedMs: 4,
      },
      warnings: [],
      error: {
        code: "BRIEF_UPDATE_FAILED",
        message: "Draft could not be grounded.",
      },
    });

    await reconciler.reconcile(await requests.requireRequest(updateRequest.requestId), failed);

    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    expect(current?.id).toBe(prior.id);
    expect((await requests.requireRequest(updateRequest.requestId)).status).toBe("failed");
  });

  it("rejects non-failed results that do not include both a brief and manifest", async () => {
    const updateRequest = request({ requestId: "brief_req_invalid" });
    await requests.createRequest({ request: updateRequest });
    const stored = {
      schemaVersion: "1",
      requestId: updateRequest.requestId,
      status: "succeeded",
      briefId: "brief_missing_manifest",
      priorBriefId: null,
      summary: "Invalid staged result.",
      artifacts: [],
      metrics: {
        evidenceRefs: 1,
        includedSources: 1,
        excludedSources: 0,
        elapsedMs: 2,
      },
      warnings: [],
      createdAt: "2026-05-06T12:00:01.000Z",
    } satisfies StoredBriefUpdateResult;

    await expect(reconciler.reconcile(await requests.requireRequest(updateRequest.requestId), stored))
      .rejects.toThrow("requires a staged brief and manifest");
  });
});
