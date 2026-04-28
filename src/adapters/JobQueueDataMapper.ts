import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  JobClaimOptions,
  JobEvent,
  JobEventSeed,
  JobLeaseRecovery,
  JobOwnershipTransferRequest,
  JobRequest,
  JobRequestSeed,
  JobStatus,
  JobStatusUpdate,
} from "@/core/entities/job";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import { AUDIT_ONLY_JOB_EVENT_TYPES } from "@/lib/jobs/job-renderable-event";

type JobRequestRow = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  tool_name: string;
  status: JobRequest["status"];
  priority: number;
  dedupe_key: string | null;
  initiator_type: JobRequest["initiatorType"];
  request_payload_json: string;
  result_payload_json: string | null;
  error_message: string | null;
  progress_percent: number | null;
  progress_label: string | null;
  attempt_count: number;
  lease_expires_at: string | null;
  claimed_by: string | null;
  failure_class: JobRequest["failureClass"];
  next_retry_at: string | null;
  recovery_mode: JobRequest["recoveryMode"];
  last_checkpoint_id: string | null;
  replayed_from_job_id: string | null;
  superseded_by_job_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type JobEventRow = {
  id: string;
  job_id: string;
  conversation_id: string;
  sequence: number;
  event_type: JobEvent["eventType"];
  event_payload_json: string;
  created_at: string;
};

type UserScopedJobEventRow = JobEventRow & {
  user_sequence: number;
};

function mapJobRequest(row: JobRequestRow): JobRequest {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    toolName: row.tool_name,
    status: row.status,
    priority: row.priority,
    dedupeKey: row.dedupe_key,
    initiatorType: row.initiator_type,
    requestPayload: JSON.parse(row.request_payload_json) as Record<string, unknown>,
    resultPayload: row.result_payload_json ? JSON.parse(row.result_payload_json) : null,
    errorMessage: row.error_message,
    progressPercent: row.progress_percent,
    progressLabel: row.progress_label,
    attemptCount: row.attempt_count,
    leaseExpiresAt: row.lease_expires_at,
    claimedBy: row.claimed_by,
    failureClass: row.failure_class,
    nextRetryAt: row.next_retry_at,
    recoveryMode: row.recovery_mode,
    lastCheckpointId: row.last_checkpoint_id,
    replayedFromJobId: row.replayed_from_job_id,
    supersededByJobId: row.superseded_by_job_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function mapJobLeaseRecovery(
  row: JobRequestRow,
  previousClaimedBy: string | null,
  previousLeaseExpiresAt: string | null,
): JobLeaseRecovery {
  return {
    job: mapJobRequest(row),
    previousClaimedBy,
    previousLeaseExpiresAt,
  };
}

function mapJobEvent(row: JobEventRow): JobEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    conversationId: row.conversation_id,
    sequence: row.sequence,
    eventType: row.event_type,
    payload: JSON.parse(row.event_payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function mapUserScopedJobEvent(row: UserScopedJobEventRow): JobEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    conversationId: row.conversation_id,
    sequence: row.user_sequence,
    eventType: row.event_type,
    payload: JSON.parse(row.event_payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

type AdminJobQueryFilters = {
  status?: JobStatus;
  toolName?: string;
  toolNames?: string[];
  afterDate?: string;
  beforeDate?: string;
};

function buildAdminJobWhereClause(
  filters: AdminJobQueryFilters,
  tableAlias?: string,
): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const columnPrefix = tableAlias ? `${tableAlias}.` : "";

  if (filters.status) {
    conditions.push(`${columnPrefix}status = ?`);
    params.push(filters.status);
  }
  if (filters.toolName) {
    conditions.push(`${columnPrefix}tool_name = ?`);
    params.push(filters.toolName);
  }
  if (filters.toolNames) {
    if (filters.toolNames.length === 0) {
      conditions.push("1 = 0");
    } else {
      const placeholders = filters.toolNames.map(() => "?").join(", ");
      conditions.push(`${columnPrefix}tool_name IN (${placeholders})`);
      params.push(...filters.toolNames);
    }
  }
  if (filters.afterDate) {
    conditions.push(`${columnPrefix}created_at >= ?`);
    params.push(filters.afterDate);
  }
  if (filters.beforeDate) {
    conditions.push(`${columnPrefix}created_at <= ?`);
    params.push(filters.beforeDate);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export class JobQueueDataMapper implements JobQueueRepository {
  constructor(private readonly db: Database.Database) {}

  async createJob(seed: JobRequestSeed): Promise<JobRequest> {
    const id = `job_${randomUUID()}`;
    const now = new Date().toISOString();
    const initiatorType = seed.initiatorType ?? (seed.userId ? "user" : "anonymous_session");

    this.db.prepare(
      `INSERT INTO job_requests (
        id, conversation_id, user_id, tool_name, status, priority, dedupe_key, initiator_type,
        request_payload_json, failure_class, next_retry_at, recovery_mode, last_checkpoint_id,
        replayed_from_job_id, superseded_by_job_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      seed.conversationId,
      seed.userId ?? null,
      seed.toolName,
      seed.priority ?? 100,
      seed.dedupeKey ?? null,
      initiatorType,
      JSON.stringify(seed.requestPayload),
      seed.failureClass ?? null,
      seed.nextRetryAt ?? null,
      seed.recoveryMode ?? null,
      seed.lastCheckpointId ?? null,
      seed.replayedFromJobId ?? null,
      seed.supersededByJobId ?? null,
      now,
      now,
    );

    const row = this.db
      .prepare(`SELECT * FROM job_requests WHERE id = ?`)
      .get(id) as JobRequestRow;
    return mapJobRequest(row);
  }

  async findJobById(id: string): Promise<JobRequest | null> {
    const row = this.db
      .prepare(`SELECT * FROM job_requests WHERE id = ?`)
      .get(id) as JobRequestRow | undefined;
    return row ? mapJobRequest(row) : null;
  }

  async findLatestEventForJob(jobId: string): Promise<JobEvent | null> {
    const row = this.db.prepare(
      `SELECT * FROM job_events
       WHERE job_id = ?
       ORDER BY sequence DESC
       LIMIT 1`,
    ).get(jobId) as JobEventRow | undefined;

    return row ? mapJobEvent(row) : null;
  }

  async findLatestRenderableEventForJob(jobId: string): Promise<JobEvent | null> {
    const placeholders = [...AUDIT_ONLY_JOB_EVENT_TYPES].map(() => "?").join(", ");
    const row = this.db.prepare(
      `SELECT * FROM job_events
       WHERE job_id = ?
         AND event_type NOT IN (${placeholders})
       ORDER BY sequence DESC
       LIMIT 1`,
    ).get(jobId, ...AUDIT_ONLY_JOB_EVENT_TYPES) as JobEventRow | undefined;

    return row ? mapJobEvent(row) : null;
  }

  async findActiveJobByDedupeKey(conversationId: string, dedupeKey: string): Promise<JobRequest | null> {
    const row = this.db.prepare(
      `SELECT * FROM job_requests
       WHERE conversation_id = ?
         AND dedupe_key = ?
         AND status IN ('queued', 'running')
       ORDER BY created_at DESC
       LIMIT 1`,
    ).get(conversationId, dedupeKey) as JobRequestRow | undefined;

    return row ? mapJobRequest(row) : null;
  }

  async listJobsByConversation(
    conversationId: string,
    options?: { statuses?: JobStatus[]; limit?: number },
  ): Promise<JobRequest[]> {
    const statuses = options?.statuses ?? [];
    const limit = options?.limit ?? 25;

    if (statuses.length > 0) {
      const placeholders = statuses.map(() => "?").join(", ");
      const rows = this.db.prepare(
        `SELECT * FROM job_requests
         WHERE conversation_id = ?
           AND status IN (${placeholders})
         ORDER BY updated_at DESC, created_at DESC
         LIMIT ?`,
      ).all(conversationId, ...statuses, limit) as JobRequestRow[];

      return rows.map(mapJobRequest);
    }

    const rows = this.db.prepare(
      `SELECT * FROM job_requests
       WHERE conversation_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ?`,
    ).all(conversationId, limit) as JobRequestRow[];

    return rows.map(mapJobRequest);
  }

  async listJobsByUser(
    userId: string,
    options?: { statuses?: JobStatus[]; limit?: number },
  ): Promise<JobRequest[]> {
    const statuses = options?.statuses ?? [];
    const limit = options?.limit ?? 25;

    if (statuses.length > 0) {
      const placeholders = statuses.map(() => "?").join(", ");
      const rows = this.db.prepare(
        `SELECT jr.* FROM job_requests jr
         INNER JOIN conversations c ON c.id = jr.conversation_id
         WHERE (jr.user_id = ? OR c.user_id = ?)
           AND jr.status IN (${placeholders})
         ORDER BY jr.updated_at DESC, jr.created_at DESC
         LIMIT ?`,
      ).all(userId, userId, ...statuses, limit) as JobRequestRow[];

      return rows.map(mapJobRequest);
    }

    const rows = this.db.prepare(
      `SELECT jr.* FROM job_requests jr
       INNER JOIN conversations c ON c.id = jr.conversation_id
       WHERE (jr.user_id = ? OR c.user_id = ?)
       ORDER BY jr.updated_at DESC, jr.created_at DESC
       LIMIT ?`,
    ).all(userId, userId, limit) as JobRequestRow[];

    return rows.map(mapJobRequest);
  }

  async appendEvent(seed: JobEventSeed): Promise<JobEvent> {
    const id = `jobevt_${randomUUID()}`;
    const now = new Date().toISOString();

    const row = this.db.prepare(
      `INSERT INTO job_events (id, job_id, conversation_id, sequence, event_type, event_payload_json, created_at)
       VALUES (
         ?, ?, ?, 
         (SELECT COALESCE(MAX(sequence), 0) + 1 FROM job_events WHERE conversation_id = ?), 
         ?, ?, ?
       ) RETURNING *`
    ).get(
      id,
      seed.jobId,
      seed.conversationId,
      seed.conversationId, // for the subquery
      seed.eventType,
      JSON.stringify(seed.payload ?? {}),
      now,
    ) as JobEventRow;

    return mapJobEvent(row);
  }

  async requeueExpiredRunningJobs(now: string): Promise<JobLeaseRecovery[]> {
    const recover = this.db.transaction((requeueAt: string) => {
      const expiredRows = this.db.prepare(
        `SELECT * FROM job_requests
         WHERE status = 'running'
           AND lease_expires_at IS NOT NULL
           AND lease_expires_at <= ?
         ORDER BY lease_expires_at ASC, created_at ASC`,
      ).all(requeueAt) as JobRequestRow[];

      for (const row of expiredRows) {
        this.db.prepare(
          `UPDATE job_requests
           SET status = 'queued',
               lease_expires_at = NULL,
               claimed_by = NULL,
               updated_at = ?
           WHERE id = ?
             AND status = 'running'`,
        ).run(requeueAt, row.id);
      }

      return expiredRows.map((row) => {
        const updatedRow = this.db
          .prepare(`SELECT * FROM job_requests WHERE id = ?`)
          .get(row.id) as JobRequestRow;

        return mapJobLeaseRecovery(updatedRow, row.claimed_by, row.lease_expires_at);
      });
    });

    return recover(now);
  }

  async listConversationEvents(
    conversationId: string,
    options?: { afterSequence?: number; limit?: number },
  ): Promise<JobEvent[]> {
    const afterSequence = options?.afterSequence ?? 0;
    const limit = options?.limit ?? 100;
    const rows = this.db.prepare(
      `SELECT * FROM job_events
       WHERE conversation_id = ?
         AND sequence > ?
       ORDER BY sequence ASC
       LIMIT ?`,
    ).all(conversationId, afterSequence, limit) as JobEventRow[];

    return rows.map(mapJobEvent);
  }

  async listUserEvents(
    userId: string,
    options?: { afterSequence?: number; limit?: number },
  ): Promise<JobEvent[]> {
    const afterSequence = options?.afterSequence ?? 0;
    const limit = options?.limit ?? 100;
    const rows = this.db.prepare(
      `SELECT je.id,
              je.job_id,
              je.conversation_id,
              je.sequence,
              je.event_type,
              je.event_payload_json,
              je.created_at,
              je.rowid AS user_sequence
       FROM job_events je
       INNER JOIN job_requests jr ON jr.id = je.job_id
       INNER JOIN conversations c ON c.id = je.conversation_id
       WHERE (jr.user_id = ? OR c.user_id = ?)
         AND je.rowid > ?
       ORDER BY je.rowid ASC
       LIMIT ?`,
    ).all(userId, userId, afterSequence, limit) as UserScopedJobEventRow[];

    return rows.map(mapUserScopedJobEvent);
  }

  async listEventsForUserJob(
    userId: string,
    jobId: string,
    options?: { limit?: number },
  ): Promise<JobEvent[]> {
    const limit = options?.limit ?? 100;
    const rows = this.db.prepare(
      `SELECT *
       FROM (
         SELECT je.*
         FROM job_events je
         INNER JOIN job_requests jr ON jr.id = je.job_id
         INNER JOIN conversations c ON c.id = je.conversation_id
         WHERE (jr.user_id = ? OR c.user_id = ?)
           AND je.job_id = ?
         ORDER BY je.sequence DESC
         LIMIT ?
       ) recent_events
       ORDER BY sequence ASC`,
    ).all(userId, userId, jobId, limit) as JobEventRow[];

    return rows.map(mapJobEvent);
  }

  async claimNextQueuedJob(options: JobClaimOptions): Promise<JobRequest | null> {
    const claim = this.db.transaction((claimOptions: JobClaimOptions) => {
      const now = claimOptions.now ?? new Date().toISOString();
      const candidate = this.db.prepare(
        `SELECT * FROM job_requests
         WHERE status = 'queued'
           AND (next_retry_at IS NULL OR next_retry_at <= ?)
         ORDER BY priority ASC, COALESCE(next_retry_at, created_at) ASC, created_at ASC
         LIMIT 1`,
      ).get(now) as JobRequestRow | undefined;

      if (!candidate) {
        return null;
      }

      const result = this.db.prepare(
        `UPDATE job_requests
         SET status = 'running',
             claimed_by = ?,
             lease_expires_at = ?,
             started_at = COALESCE(started_at, ?),
           completed_at = NULL,
           error_message = NULL,
           progress_percent = NULL,
           progress_label = NULL,
           failure_class = NULL,
           next_retry_at = NULL,
             attempt_count = attempt_count + 1,
             updated_at = ?
         WHERE id = ? AND status = 'queued'`,
      ).run(
        claimOptions.workerId,
        claimOptions.leaseExpiresAt,
        now,
        now,
        candidate.id,
      );

      if (result.changes === 0) {
        return null;
      }

      return this.db
        .prepare(`SELECT * FROM job_requests WHERE id = ?`)
        .get(candidate.id) as JobRequestRow;
    });

    const row = claim(options);
    return row ? mapJobRequest(row) : null;
  }

  async transferJobsToUser(request: JobOwnershipTransferRequest): Promise<JobRequest[]> {
    const conversationIds = Array.from(new Set(
      request.conversationIds.map((conversationId) => conversationId.trim()).filter(Boolean),
    ));

    if (conversationIds.length === 0) {
      return [];
    }

    const placeholders = conversationIds.map(() => "?").join(", ");
    const params: unknown[] = [...conversationIds];
    let ownershipWhere = "user_id IS NULL";

    if (request.previousUserId) {
      ownershipWhere += " OR user_id = ?";
      params.push(request.previousUserId);
    }

    const rows = this.db.prepare(
      `SELECT * FROM job_requests
       WHERE conversation_id IN (${placeholders})
         AND (${ownershipWhere})
       ORDER BY created_at ASC`,
    ).all(...params) as JobRequestRow[];

    if (rows.length === 0) {
      return [];
    }

    const transferredAt = request.transferredAt ?? new Date().toISOString();

    const transferredRows = this.db.transaction((jobRows: JobRequestRow[]) => {
      for (const row of jobRows) {
        const previousUserId = row.user_id ?? request.previousUserId ?? null;
        const summary = previousUserId?.startsWith("anon_")
          ? "Job ownership transferred from the anonymous session to the signed-in account."
          : "Job ownership transferred to the signed-in account.";

        this.db.prepare(
          `UPDATE job_requests
           SET user_id = ?,
               updated_at = ?
           WHERE id = ?`,
        ).run(request.userId, transferredAt, row.id);

        const nextSequenceRow = this.db.prepare(
          `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
           FROM job_events
           WHERE conversation_id = ?`,
        ).get(row.conversation_id) as { next_sequence: number };

        this.db.prepare(
          `INSERT INTO job_events (id, job_id, conversation_id, sequence, event_type, event_payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          `jobevt_${randomUUID()}`,
          row.id,
          row.conversation_id,
          nextSequenceRow.next_sequence,
          "ownership_transferred",
          JSON.stringify({
            previousUserId,
            nextUserId: request.userId,
            source: request.source ?? "anonymous_migration",
            summary,
          }),
          transferredAt,
        );
      }

      return jobRows.map((row) => this.db.prepare(`SELECT * FROM job_requests WHERE id = ?`).get(row.id) as JobRequestRow);
    });

    return transferredRows(rows).map(mapJobRequest);
  }

  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<JobRequest> {
    const now = new Date().toISOString();
    const current = this.db
      .prepare(`SELECT * FROM job_requests WHERE id = ?`)
      .get(id) as JobRequestRow | undefined;

    if (!current) {
      throw new Error(`Deferred job not found: ${id}`);
    }

    this.db.prepare(
      `UPDATE job_requests
       SET status = ?,
           result_payload_json = ?,
           error_message = ?,
           progress_percent = ?,
           progress_label = ?,
           started_at = COALESCE(?, started_at),
           completed_at = ?,
           lease_expires_at = ?,
           claimed_by = ?,
           failure_class = ?,
           next_retry_at = ?,
           recovery_mode = ?,
           last_checkpoint_id = ?,
           replayed_from_job_id = ?,
           superseded_by_job_id = ?,
           attempt_count = attempt_count + ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(
      update.status,
      update.resultPayload === undefined ? current.result_payload_json : JSON.stringify(update.resultPayload),
      update.errorMessage === undefined ? current.error_message : update.errorMessage,
      update.progressPercent === undefined ? current.progress_percent : update.progressPercent,
      update.progressLabel === undefined ? current.progress_label : update.progressLabel,
      update.startedAt === undefined ? current.started_at : update.startedAt,
      update.completedAt === undefined ? current.completed_at : update.completedAt,
      update.leaseExpiresAt === undefined ? current.lease_expires_at : update.leaseExpiresAt,
      update.claimedBy === undefined ? current.claimed_by : update.claimedBy,
      update.failureClass === undefined ? current.failure_class : update.failureClass,
      update.nextRetryAt === undefined ? current.next_retry_at : update.nextRetryAt,
      update.recoveryMode === undefined ? current.recovery_mode : update.recoveryMode,
      update.lastCheckpointId === undefined ? current.last_checkpoint_id : update.lastCheckpointId,
      update.replayedFromJobId === undefined ? current.replayed_from_job_id : update.replayedFromJobId,
      update.supersededByJobId === undefined ? current.superseded_by_job_id : update.supersededByJobId,
      update.incrementAttemptCount ? 1 : 0,
      now,
      id,
    );

    const row = this.db
      .prepare(`SELECT * FROM job_requests WHERE id = ?`)
      .get(id) as JobRequestRow | undefined;

    if (!row) {
      throw new Error(`Deferred job not found after update: ${id}`);
    }

    return mapJobRequest(row);
  }

  async cancelJob(id: string, now: string): Promise<JobRequest> {
    return this.updateJobStatus(id, {
      status: "canceled",
      completedAt: now,
      leaseExpiresAt: null,
      claimedBy: null,
    });
  }

  // ── Admin methods ──────────────────────────────────────────────────

  async listForAdmin(filters: {
    status?: JobStatus;
    toolName?: string;
    toolNames?: string[];
    afterDate?: string;
    beforeDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobRequest[]> {
    const { where, params } = buildAdminJobWhereClause(filters, "jr");
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const rows = this.db.prepare(
      `SELECT jr.* FROM job_requests jr ${where} ORDER BY jr.created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as JobRequestRow[];

    return rows.map(mapJobRequest);
  }

  async countForAdmin(filters: {
    status?: JobStatus;
    toolName?: string;
    toolNames?: string[];
    afterDate?: string;
    beforeDate?: string;
  }): Promise<number> {
    const { where, params } = buildAdminJobWhereClause(filters);
    const row = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM job_requests ${where}`,
    ).get(...params) as { cnt: number };

    return row.cnt;
  }

  async countByStatus(filters: {
    toolName?: string;
    toolNames?: string[];
    afterDate?: string;
    beforeDate?: string;
  } = {}): Promise<Record<string, number>> {
    const { where, params } = buildAdminJobWhereClause(filters);
    const rows = this.db.prepare(
      `SELECT status, COUNT(*) AS cnt FROM job_requests ${where} GROUP BY status`,
    ).all(...params) as Array<{ status: string; cnt: number }>;

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.status] = row.cnt;
    }
    return counts;
  }

  async countByToolName(filters: {
    status?: JobStatus;
    toolNames?: string[];
    afterDate?: string;
    beforeDate?: string;
  } = {}): Promise<Record<string, number>> {
    const { where, params } = buildAdminJobWhereClause(filters);
    const rows = this.db.prepare(
      `SELECT tool_name, COUNT(*) AS cnt FROM job_requests ${where} GROUP BY tool_name`,
    ).all(...params) as Array<{ tool_name: string; cnt: number }>;

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.tool_name] = row.cnt;
    }
    return counts;
  }

  async listEventsForJob(jobId: string): Promise<JobEvent[]> {
    const rows = this.db.prepare(
      `SELECT * FROM job_events WHERE job_id = ? ORDER BY sequence ASC`,
    ).all(jobId) as JobEventRow[];
    return rows.map(mapJobEvent);
  }
}
