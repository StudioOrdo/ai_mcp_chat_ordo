import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

import {
  assertValidBriefUpdateRequest,
  assertValidBriefUpdateResult,
  isBriefUpdateResultStatus,
  isBriefUpdateStatus,
  type BriefUpdateRequest,
  type BriefUpdateResult,
  type BriefUpdateResultError,
  type BriefUpdateStatus,
  type DurableBriefUpdateRequest,
  type StoredBriefUpdateResult,
} from "@/core/entities/brief-execution";
import type { BriefEvidenceManifest, SectionBrief } from "@/core/entities/brief";

interface BriefUpdateRequestRow {
  request_id: string;
  schema_version: string;
  brief_type: string;
  section_id: string | null;
  object_kind: string | null;
  object_id: string | null;
  object_label: string | null;
  owner_user_id: string;
  evidence_window_json: string;
  visibility_policy: BriefUpdateRequest["visibilityPolicy"];
  prior_brief_id: string | null;
  executor_profile_json: string;
  status: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  requested_by_user_id: string | null;
  requested_from: string;
  error_message: string | null;
  diagnostics_json: string;
  created_at: string;
  updated_at: string;
}

interface BriefUpdateResultRow {
  request_id: string;
  schema_version: string;
  status: string;
  brief_id: string | null;
  prior_brief_id: string | null;
  summary: string;
  brief_json: string | null;
  manifest_json: string | null;
  artifacts_json: string;
  metrics_json: string;
  warnings_json: string;
  error_json: string | null;
  created_at: string;
}

export interface CreateBriefUpdateRequestInput {
  request: BriefUpdateRequest;
  requestedByUserId?: string | null;
  requestedFrom?: string;
  now?: string;
}

export interface ClaimBriefUpdateInput {
  leaseOwner: string;
  leaseDurationMs?: number;
  now?: string;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLimit(limit: number): number {
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
}

function addMs(timestamp: string, ms: number): string {
  return new Date(Date.parse(timestamp) + ms).toISOString();
}

function mapRequestRow(row: BriefUpdateRequestRow): DurableBriefUpdateRequest {
  return {
    schemaVersion: row.schema_version as DurableBriefUpdateRequest["schemaVersion"],
    requestId: row.request_id,
    briefType: row.brief_type,
    scope: {
      ...(row.section_id ? { sectionId: row.section_id } : {}),
      ...(row.object_kind ? { objectKind: row.object_kind } : {}),
      ...(row.object_id ? { objectId: row.object_id } : {}),
      ...(row.object_label ? { objectLabel: row.object_label } : {}),
      ownerUserId: row.owner_user_id,
    },
    evidenceWindow: parseJson<BriefUpdateRequest["evidenceWindow"]>(row.evidence_window_json, {
      to: row.created_at,
    }),
    visibilityPolicy: row.visibility_policy,
    ...(row.prior_brief_id ? { priorBriefId: row.prior_brief_id } : {}),
    executorProfile: parseJson<BriefUpdateRequest["executorProfile"]>(row.executor_profile_json, {
      kind: "deterministic",
    }),
    status: isBriefUpdateStatus(row.status) ? row.status : "failed",
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    requestedByUserId: row.requested_by_user_id,
    requestedFrom: row.requested_from,
    errorMessage: row.error_message,
    diagnostics: parseJson<Record<string, unknown>>(row.diagnostics_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResultRow(row: BriefUpdateResultRow): StoredBriefUpdateResult {
  return {
    schemaVersion: row.schema_version as StoredBriefUpdateResult["schemaVersion"],
    requestId: row.request_id,
    status: isBriefUpdateResultStatus(row.status) ? row.status : "failed",
    briefId: row.brief_id,
    priorBriefId: row.prior_brief_id,
    summary: row.summary,
    ...(row.brief_json ? { brief: parseJson<SectionBrief>(row.brief_json, {} as SectionBrief) } : {}),
    ...(row.manifest_json ? { manifest: parseJson<BriefEvidenceManifest>(row.manifest_json, {} as BriefEvidenceManifest) } : {}),
    artifacts: parseJson<StoredBriefUpdateResult["artifacts"]>(row.artifacts_json, []),
    metrics: parseJson<StoredBriefUpdateResult["metrics"]>(row.metrics_json, {
      evidenceRefs: 0,
      includedSources: 0,
      excludedSources: 0,
      elapsedMs: 0,
    }),
    warnings: parseJson<string[]>(row.warnings_json, []),
    ...(row.error_json ? { error: parseJson<BriefUpdateResultError>(row.error_json, {
      code: "BRIEF_UPDATE_RESULT_ERROR",
      message: "Brief update failed.",
    }) } : {}),
    createdAt: row.created_at,
  };
}

export class BriefUpdateRequestDataMapper {
  constructor(private readonly db: Database.Database) {}

  async createRequest(input: CreateBriefUpdateRequestInput): Promise<DurableBriefUpdateRequest> {
    assertValidBriefUpdateRequest(input.request);
    const now = input.now ?? new Date().toISOString();
    const requestedFrom = input.requestedFrom ?? "system";

    this.db.prepare(
      `INSERT INTO brief_update_requests (
         request_id, schema_version, brief_type, section_id, object_kind,
         object_id, object_label, owner_user_id, evidence_window_json,
         visibility_policy, prior_brief_id, executor_profile_json, status,
         requested_by_user_id, requested_from, diagnostics_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.request.requestId,
      input.request.schemaVersion,
      input.request.briefType,
      input.request.scope.sectionId ?? null,
      input.request.scope.objectKind ?? null,
      input.request.scope.objectId ?? null,
      input.request.scope.objectLabel ?? null,
      input.request.scope.ownerUserId,
      JSON.stringify(input.request.evidenceWindow),
      input.request.visibilityPolicy,
      input.request.priorBriefId ?? null,
      JSON.stringify(input.request.executorProfile),
      "pending",
      input.requestedByUserId ?? null,
      requestedFrom,
      JSON.stringify({}),
      now,
      now,
    );

    return this.requireRequest(input.request.requestId);
  }

  async findRequest(requestId: string): Promise<DurableBriefUpdateRequest | null> {
    const row = this.db.prepare(
      `SELECT * FROM brief_update_requests WHERE request_id = ?`,
    ).get(requestId) as BriefUpdateRequestRow | undefined;
    return row ? mapRequestRow(row) : null;
  }

  async requireRequest(requestId: string): Promise<DurableBriefUpdateRequest> {
    const request = await this.findRequest(requestId);
    if (!request) {
      throw new Error(`Brief update request ${requestId} was not found.`);
    }
    return request;
  }

  async claimNext(input: ClaimBriefUpdateInput): Promise<DurableBriefUpdateRequest | null> {
    const now = input.now ?? new Date().toISOString();
    const leaseMs = input.leaseDurationMs ?? 60_000;
    const leaseExpiresAt = addMs(now, leaseMs);

    const transaction = this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM brief_update_requests
         WHERE status = 'pending'
         ORDER BY created_at ASC, request_id ASC
         LIMIT 1`,
      ).get() as BriefUpdateRequestRow | undefined;

      if (!row) return null;

      this.db.prepare(
        `UPDATE brief_update_requests
         SET status = 'running', lease_owner = ?, lease_expires_at = ?, updated_at = ?
         WHERE request_id = ? AND status = 'pending'`,
      ).run(input.leaseOwner, leaseExpiresAt, now, row.request_id);

      return row.request_id;
    });

    const requestId = transaction();
    return requestId ? this.requireRequest(requestId) : null;
  }

  async recoverExpiredLeases(input: { now?: string; errorMessage?: string } = {}): Promise<number> {
    const now = input.now ?? new Date().toISOString();
    const errorMessage = input.errorMessage ?? "Brief update lease expired before a result was reconciled.";
    const result = this.db.prepare(
      `UPDATE brief_update_requests
       SET status = 'stale',
           error_message = ?,
           diagnostics_json = ?,
           lease_owner = NULL,
           lease_expires_at = NULL,
           updated_at = ?
       WHERE status = 'running'
         AND lease_expires_at IS NOT NULL
         AND lease_expires_at <= ?`,
    ).run(errorMessage, JSON.stringify({ staleAt: now, reason: "lease_expired" }), now, now);
    return result.changes;
  }

  async stageResult(requestId: string, result: BriefUpdateResult, input: { now?: string } = {}): Promise<StoredBriefUpdateResult> {
    const request = await this.requireRequest(requestId);
    assertValidBriefUpdateResult(result, request);
    const now = input.now ?? new Date().toISOString();
    const nextStatus: BriefUpdateStatus = result.status === "failed" ? "failed" : "staged";

    const transaction = this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO brief_update_results (
           request_id, schema_version, status, brief_id, prior_brief_id, summary,
           brief_json, manifest_json, artifacts_json, metrics_json, warnings_json,
           error_json, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(request_id) DO UPDATE SET
           schema_version = excluded.schema_version,
           status = excluded.status,
           brief_id = excluded.brief_id,
           prior_brief_id = excluded.prior_brief_id,
           summary = excluded.summary,
           brief_json = excluded.brief_json,
           manifest_json = excluded.manifest_json,
           artifacts_json = excluded.artifacts_json,
           metrics_json = excluded.metrics_json,
           warnings_json = excluded.warnings_json,
           error_json = excluded.error_json,
           created_at = excluded.created_at`,
      ).run(
        result.requestId,
        result.schemaVersion,
        result.status,
        result.briefId,
        result.priorBriefId,
        result.summary,
        result.brief ? JSON.stringify(result.brief) : null,
        result.manifest ? JSON.stringify(result.manifest) : null,
        JSON.stringify(result.artifacts),
        JSON.stringify(result.metrics),
        JSON.stringify(result.warnings),
        result.error ? JSON.stringify(result.error) : null,
        now,
      );

      this.db.prepare(
        `UPDATE brief_update_requests
         SET status = ?,
             error_message = ?,
             diagnostics_json = ?,
             lease_owner = NULL,
             lease_expires_at = NULL,
             updated_at = ?
         WHERE request_id = ?`,
      ).run(
        nextStatus,
        result.error?.message ?? null,
        JSON.stringify({
          resultStatus: result.status,
          warnings: result.warnings,
          error: result.error ?? null,
        }),
        now,
        requestId,
      );
    });

    transaction();
    return this.requireResult(requestId);
  }

  async markReconciled(requestId: string, input: { now?: string } = {}): Promise<DurableBriefUpdateRequest> {
    const now = input.now ?? new Date().toISOString();
    this.db.prepare(
      `UPDATE brief_update_requests
       SET status = 'reconciled', updated_at = ?
       WHERE request_id = ? AND status = 'staged'`,
    ).run(now, requestId);
    return this.requireRequest(requestId);
  }

  async findResult(requestId: string): Promise<StoredBriefUpdateResult | null> {
    const row = this.db.prepare(
      `SELECT * FROM brief_update_results WHERE request_id = ?`,
    ).get(requestId) as BriefUpdateResultRow | undefined;
    return row ? mapResultRow(row) : null;
  }

  async requireResult(requestId: string): Promise<StoredBriefUpdateResult> {
    const result = await this.findResult(requestId);
    if (!result) {
      throw new Error(`Brief update result ${requestId} was not found.`);
    }
    return result;
  }

  async listRecent(limit = 25): Promise<DurableBriefUpdateRequest[]> {
    const rows = this.db.prepare(
      `SELECT * FROM brief_update_requests
       ORDER BY updated_at DESC, created_at DESC, request_id DESC
       LIMIT ?`,
    ).all(normalizeLimit(limit)) as BriefUpdateRequestRow[];
    return rows.map(mapRequestRow);
  }

  createRequestId(): string {
    return `brief_req_${randomUUID()}`;
  }
}
