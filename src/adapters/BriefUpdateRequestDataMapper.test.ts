import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import {
  createBriefEvidenceManifest,
  type SectionBrief,
} from "@/core/entities/brief";
import type {
  BriefUpdateRequest,
  BriefUpdateResult,
} from "@/core/entities/brief-execution";
import { ensureSchema } from "@/lib/db/schema";

import { BriefUpdateRequestDataMapper } from "./BriefUpdateRequestDataMapper";

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

function result(updateRequest: BriefUpdateRequest): BriefUpdateResult {
  const stagedBrief = brief({
    id: `${updateRequest.requestId}_brief_v1`,
    sectionId: updateRequest.scope.sectionId ?? updateRequest.scope.objectKind ?? updateRequest.briefType,
  });
  return {
    schemaVersion: "1",
    requestId: updateRequest.requestId,
    status: "succeeded",
    briefId: stagedBrief.id,
    priorBriefId: null,
    summary: stagedBrief.summary,
    brief: stagedBrief,
    manifest: createBriefEvidenceManifest({
      brief: stagedBrief,
      generatedAt: "2026-05-06T12:00:01.000Z",
      generatedBy: "brief-executor:deterministic",
      ownerUserId: updateRequest.scope.ownerUserId,
      visibilityPolicy: updateRequest.visibilityPolicy,
    }),
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
      elapsedMs: 10,
    },
    warnings: [],
  };
}

describe("BriefUpdateRequestDataMapper", () => {
  let db: Database.Database;
  let mapper: BriefUpdateRequestDataMapper;

  beforeEach(() => {
    db = createDb();
    mapper = new BriefUpdateRequestDataMapper(db);
  });

  it("creates durable brief request/result schema and lease indexes", () => {
    const requestColumns = db.pragma("table_info(brief_update_requests)") as Array<{ name: string }>;
    const resultColumns = db.pragma("table_info(brief_update_results)") as Array<{ name: string }>;
    const indexes = db.pragma("index_list(brief_update_requests)") as Array<{ name: string }>;

    expect(requestColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "request_id",
      "schema_version",
      "brief_type",
      "owner_user_id",
      "status",
      "lease_owner",
      "lease_expires_at",
      "diagnostics_json",
    ]));
    expect(resultColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "request_id",
      "status",
      "brief_json",
      "manifest_json",
      "error_json",
    ]));
    expect(indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      "idx_brief_update_requests_status_updated",
      "idx_brief_update_requests_lease",
    ]));
  });

  it("creates, claims, stages, and reconciles a valid brief update request", async () => {
    const updateRequest = request();
    const created = await mapper.createRequest({
      request: updateRequest,
      requestedByUserId: "usr_1",
      requestedFrom: "test",
      now: "2026-05-06T12:00:00.000Z",
    });

    expect(created).toMatchObject({
      requestId: updateRequest.requestId,
      status: "pending",
      requestedByUserId: "usr_1",
      requestedFrom: "test",
    });

    const claimed = await mapper.claimNext({
      leaseOwner: "worker_1",
      leaseDurationMs: 30_000,
      now: "2026-05-06T12:00:01.000Z",
    });

    expect(claimed).toMatchObject({
      requestId: updateRequest.requestId,
      status: "running",
      leaseOwner: "worker_1",
      leaseExpiresAt: "2026-05-06T12:00:31.000Z",
    });

    const staged = await mapper.stageResult(updateRequest.requestId, result(updateRequest), {
      now: "2026-05-06T12:00:02.000Z",
    });
    expect(staged).toMatchObject({
      requestId: updateRequest.requestId,
      status: "succeeded",
      briefId: `${updateRequest.requestId}_brief_v1`,
    });
    expect((await mapper.requireRequest(updateRequest.requestId)).status).toBe("staged");

    const reconciled = await mapper.markReconciled(updateRequest.requestId, {
      now: "2026-05-06T12:00:03.000Z",
    });
    expect(reconciled.status).toBe("reconciled");
  });

  it("rejects invalid request payloads before they can be claimed", async () => {
    await expect(mapper.createRequest({
      request: request({
        scope: { ownerUserId: "usr_1" },
      }),
    })).rejects.toThrow("scope must include sectionId or objectKind/objectId");

    expect(await mapper.claimNext({ leaseOwner: "worker_1" })).toBeNull();
  });

  it("marks expired running leases stale without staging a result", async () => {
    await mapper.createRequest({
      request: request(),
      now: "2026-05-06T12:00:00.000Z",
    });
    await mapper.claimNext({
      leaseOwner: "worker_1",
      leaseDurationMs: 1_000,
      now: "2026-05-06T12:00:00.000Z",
    });

    const staleCount = await mapper.recoverExpiredLeases({
      now: "2026-05-06T12:00:02.000Z",
    });
    const stale = await mapper.requireRequest("brief_req_1");

    expect(staleCount).toBe(1);
    expect(stale).toMatchObject({
      status: "stale",
      leaseOwner: null,
      leaseExpiresAt: null,
      errorMessage: "Brief update lease expired before a result was reconciled.",
    });
    expect(await mapper.findResult("brief_req_1")).toBeNull();
  });

  it("stores failed result diagnostics without creating a staged brief", async () => {
    const updateRequest = request();
    await mapper.createRequest({ request: updateRequest });
    await mapper.claimNext({ leaseOwner: "worker_1" });

    const failed = await mapper.stageResult(updateRequest.requestId, {
      schemaVersion: "1",
      requestId: updateRequest.requestId,
      status: "failed",
      briefId: null,
      priorBriefId: "brief_prior",
      summary: "Brief update failed before reconciliation.",
      artifacts: [],
      metrics: {
        evidenceRefs: 1,
        includedSources: 0,
        excludedSources: 1,
        elapsedMs: 4,
      },
      warnings: [],
      error: {
        code: "BRIEF_DRAFT_INVALID",
        message: "Generated claim was not grounded.",
        details: { adminTrace: "admin-only diagnostics" },
      },
    });

    const failedRequest = await mapper.requireRequest(updateRequest.requestId);
    expect(failed.status).toBe("failed");
    expect(failed.error?.details).toEqual({ adminTrace: "admin-only diagnostics" });
    expect(failedRequest.status).toBe("failed");
    expect(failedRequest.errorMessage).toBe("Generated claim was not grounded.");
  });
});
