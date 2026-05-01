import { randomUUID } from "crypto";
import type Database from "better-sqlite3";

import { assertStepReadyState, assertWorkflowCanSucceed } from "./state";
import type {
  MediaWorkflow,
  MediaWorkflowDraft,
  MediaWorkflowEvent,
  MediaWorkflowSnapshot,
  MediaWorkflowStep,
  MediaWorkflowStepStatus,
  MediaWorkflowStepSeed,
  MediaWorkflowStatus,
} from "./types";

interface WorkflowRow {
  id: string;
  user_id: string;
  conversation_id: string;
  origin_message_id: string | null;
  origin_turn_id: string | null;
  requested_deliverable: MediaWorkflow["requestedDeliverable"];
  title: string;
  status: MediaWorkflowStatus;
  final_asset_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  request_json: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface StepRow {
  id: string;
  workflow_id: string;
  sequence: number;
  kind: MediaWorkflowStep["kind"];
  status: MediaWorkflowStep["status"];
  depends_on_step_ids_json: string;
  job_id: string | null;
  asset_id: string | null;
  input_json: string;
  output_json: string;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  workflow_id: string;
  step_id: string | null;
  event_type: string;
  payload_json: string;
  created_at: string;
}

function parseObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || "{}");
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function parseStringArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value || "[]");
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

function mapWorkflow(row: WorkflowRow): MediaWorkflow {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    originMessageId: row.origin_message_id,
    originTurnId: row.origin_turn_id,
    requestedDeliverable: row.requested_deliverable,
    title: row.title,
    status: row.status,
    finalAssetId: row.final_asset_id,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    request: parseObject(row.request_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function mapStep(row: StepRow): MediaWorkflowStep {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    sequence: row.sequence,
    kind: row.kind,
    status: row.status,
    dependsOnStepIds: parseStringArray(row.depends_on_step_ids_json),
    jobId: row.job_id,
    assetId: row.asset_id,
    input: parseObject(row.input_json),
    output: parseObject(row.output_json),
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): MediaWorkflowEvent {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    stepId: row.step_id,
    eventType: row.event_type,
    payload: parseObject(row.payload_json),
    createdAt: row.created_at,
  };
}

export class SqliteMediaWorkflowRepository {
  constructor(private readonly db: Database.Database) {}

  createValidatedWorkflow(draft: MediaWorkflowDraft): MediaWorkflowSnapshot {
    this.validateDraftAssetOwnership(draft);
    return this.createWorkflow(draft);
  }

  createWorkflow(draft: MediaWorkflowDraft): MediaWorkflowSnapshot {
    const now = new Date().toISOString();
    const workflow = {
      status: "queued",
      title: "",
      finalAssetId: null,
      failureCode: null,
      failureMessage: null,
      request: {},
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      ...draft.workflow,
    };

    if (workflow.status === "succeeded") {
      assertWorkflowCanSucceed(workflow);
    }

    const steps: Array<Required<Pick<MediaWorkflowStepSeed,
      "status" | "dependsOnStepIds" | "jobId" | "assetId" | "input" | "output" | "failureCode" | "failureMessage" | "createdAt" | "updatedAt"
    >> & Omit<MediaWorkflowStepSeed,
      "status" | "dependsOnStepIds" | "jobId" | "assetId" | "input" | "output" | "failureCode" | "failureMessage" | "createdAt" | "updatedAt"
    >> = draft.steps.map((step) => ({
      status: "pending",
      dependsOnStepIds: [],
      jobId: null,
      assetId: null,
      input: {},
      output: {},
      failureCode: null,
      failureMessage: null,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      ...step,
    }));

    for (const step of steps) {
      assertStepReadyState(step);
    }

    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO media_workflows (
          id, user_id, conversation_id, origin_message_id, origin_turn_id,
          requested_deliverable, title, status, final_asset_id, failure_code,
          failure_message, request_json, created_at, updated_at, completed_at
        ) VALUES (
          @id, @userId, @conversationId, @originMessageId, @originTurnId,
          @requestedDeliverable, @title, @status, @finalAssetId, @failureCode,
          @failureMessage, @requestJson, @createdAt, @updatedAt, @completedAt
        )
      `).run({
        ...workflow,
        requestJson: JSON.stringify(workflow.request),
      });

      const insertStep = this.db.prepare(`
        INSERT INTO media_workflow_steps (
          id, workflow_id, sequence, kind, status, depends_on_step_ids_json,
          job_id, asset_id, input_json, output_json, failure_code,
          failure_message, created_at, updated_at
        ) VALUES (
          @id, @workflowId, @sequence, @kind, @status, @dependsOnStepIdsJson,
          @jobId, @assetId, @inputJson, @outputJson, @failureCode,
          @failureMessage, @createdAt, @updatedAt
        )
      `);

      for (const step of steps) {
        insertStep.run({
          ...step,
          dependsOnStepIdsJson: JSON.stringify(step.dependsOnStepIds),
          inputJson: JSON.stringify(step.input),
          outputJson: JSON.stringify(step.output),
        });
      }

      if (draft.initialEvent) {
        this.appendEventInternal({
          workflowId: workflow.id,
          stepId: null,
          eventType: draft.initialEvent.eventType,
          payload: draft.initialEvent.payload ?? {},
          createdAt: draft.initialEvent.createdAt ?? workflow.createdAt,
        });
      }
    });

    transaction();
    const snapshot = this.findWorkflowById(workflow.id);
    if (!snapshot) {
      throw new Error(`Media workflow ${workflow.id} was not persisted.`);
    }

    return snapshot;
  }

  private validateDraftAssetOwnership(draft: MediaWorkflowDraft): void {
    for (const step of draft.steps) {
      if (!step.assetId) {
        continue;
      }

      if (step.assetId.startsWith("blogasset_")) {
        const row = this.db.prepare("SELECT created_by_user_id FROM blog_assets WHERE id = ?")
          .get(step.assetId) as { created_by_user_id: string } | undefined;
        if (!row) {
          throw new Error(`Media workflow asset ${step.assetId} was not found.`);
        }
        if (row.created_by_user_id !== draft.workflow.userId) {
          throw new Error(`Media workflow asset ${step.assetId} is not owned by workflow user.`);
        }
        continue;
      }

      const row = this.db.prepare("SELECT user_id FROM user_files WHERE id = ?")
        .get(step.assetId) as { user_id: string | null } | undefined;
      if (!row) {
        throw new Error(`Media workflow asset ${step.assetId} was not found.`);
      }
      if (row.user_id !== draft.workflow.userId) {
        throw new Error(`Media workflow asset ${step.assetId} is not owned by workflow user.`);
      }
    }
  }

  findWorkflowById(id: string): MediaWorkflowSnapshot | null {
    const workflowRow = this.db.prepare("SELECT * FROM media_workflows WHERE id = ?").get(id) as WorkflowRow | undefined;
    if (!workflowRow) {
      return null;
    }

    const stepRows = this.db.prepare("SELECT * FROM media_workflow_steps WHERE workflow_id = ? ORDER BY sequence ASC")
      .all(id) as StepRow[];
    const eventRows = this.db.prepare("SELECT * FROM media_workflow_events WHERE workflow_id = ? ORDER BY created_at ASC, id ASC")
      .all(id) as EventRow[];

    return {
      workflow: mapWorkflow(workflowRow),
      steps: stepRows.map(mapStep),
      events: eventRows.map(mapEvent),
    };
  }

  listWorkflowsByConversation(conversationId: string): MediaWorkflowSnapshot[] {
    const rows = this.db.prepare("SELECT id FROM media_workflows WHERE conversation_id = ? ORDER BY created_at DESC, id DESC")
      .all(conversationId) as Array<{ id: string }>;

    return rows.flatMap((row) => {
      const snapshot = this.findWorkflowById(row.id);
      return snapshot ? [snapshot] : [];
    });
  }

  listWorkflowsByUser(userId: string, options: { limit?: number } = {}): MediaWorkflowSnapshot[] {
    const limit = Math.max(1, Math.min(options.limit ?? 25, 500));
    const rows = this.db.prepare(`
      SELECT id
      FROM media_workflows
      WHERE user_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ?
    `).all(userId, limit) as Array<{ id: string }>;

    return rows.flatMap((row) => {
      const snapshot = this.findWorkflowById(row.id);
      return snapshot ? [snapshot] : [];
    });
  }

  listRunnableWorkflows(options: {
    conversationId?: string;
    userId?: string;
    limit?: number;
  } = {}): MediaWorkflowSnapshot[] {
    const conditions = ["status NOT IN ('failed', 'succeeded', 'canceled')"];
    const params: unknown[] = [];

    if (options.conversationId) {
      conditions.push("conversation_id = ?");
      params.push(options.conversationId);
    }

    if (options.userId) {
      conditions.push("user_id = ?");
      params.push(options.userId);
    }

    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
    const rows = this.db.prepare(`
      SELECT id
      FROM media_workflows
      WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at ASC, created_at ASC
      LIMIT ?
    `).all(...params, limit) as Array<{ id: string }>;

    return rows.flatMap((row) => {
      const snapshot = this.findWorkflowById(row.id);
      return snapshot ? [snapshot] : [];
    });
  }

  findWorkflowByStepJobId(jobId: string): MediaWorkflowSnapshot | null {
    const row = this.db.prepare("SELECT workflow_id FROM media_workflow_steps WHERE job_id = ? LIMIT 1")
      .get(jobId) as { workflow_id: string } | undefined;
    return row ? this.findWorkflowById(row.workflow_id) : null;
  }

  updateStep(input: {
    stepId: string;
    status?: MediaWorkflowStepStatus;
    jobId?: string | null;
    assetId?: string | null;
    output?: Record<string, unknown>;
    failureCode?: string | null;
    failureMessage?: string | null;
    updatedAt?: string;
    eventType?: string;
    eventPayload?: Record<string, unknown>;
  }): MediaWorkflowSnapshot {
    const stepRow = this.db.prepare("SELECT * FROM media_workflow_steps WHERE id = ?").get(input.stepId) as StepRow | undefined;
    if (!stepRow) {
      throw new Error(`Media workflow step ${input.stepId} was not found.`);
    }

    const updatedStatus = input.status ?? stepRow.status;
    const updatedAssetId = input.assetId !== undefined ? input.assetId : stepRow.asset_id;
    const updatedOutput = input.output ?? parseObject(stepRow.output_json);
    assertStepReadyState({
      status: updatedStatus,
      assetId: updatedAssetId,
      output: updatedOutput,
    });

    const updatedAt = input.updatedAt ?? new Date().toISOString();
    this.db.prepare(`
      UPDATE media_workflow_steps
      SET status = @status,
          job_id = @jobId,
          asset_id = @assetId,
          output_json = @outputJson,
          failure_code = @failureCode,
          failure_message = @failureMessage,
          updated_at = @updatedAt
      WHERE id = @stepId
    `).run({
      stepId: input.stepId,
      status: updatedStatus,
      jobId: input.jobId !== undefined ? input.jobId : stepRow.job_id,
      assetId: updatedAssetId,
      outputJson: JSON.stringify(updatedOutput),
      failureCode: input.failureCode !== undefined ? input.failureCode : stepRow.failure_code,
      failureMessage: input.failureMessage !== undefined ? input.failureMessage : stepRow.failure_message,
      updatedAt,
    });

    this.db.prepare("UPDATE media_workflows SET updated_at = ? WHERE id = ?").run(updatedAt, stepRow.workflow_id);

    if (input.eventType) {
      this.appendEventInternal({
        workflowId: stepRow.workflow_id,
        stepId: input.stepId,
        eventType: input.eventType,
        payload: input.eventPayload ?? {},
        createdAt: updatedAt,
      });
    }

    const snapshot = this.findWorkflowById(stepRow.workflow_id);
    if (!snapshot) {
      throw new Error(`Media workflow ${stepRow.workflow_id} was not found after step update.`);
    }
    return snapshot;
  }

  markWorkflowRunning(input: { workflowId: string; updatedAt?: string }): MediaWorkflowSnapshot {
    const existing = this.findWorkflowById(input.workflowId);
    if (!existing) {
      throw new Error(`Media workflow ${input.workflowId} was not found.`);
    }

    if (existing.workflow.status !== "queued") {
      return existing;
    }

    const updatedAt = input.updatedAt ?? new Date().toISOString();
    this.db.prepare(`
      UPDATE media_workflows
      SET status = 'running',
          updated_at = ?
      WHERE id = ?
    `).run(updatedAt, input.workflowId);

    this.appendEventInternal({
      workflowId: input.workflowId,
      stepId: null,
      eventType: "workflow_running",
      payload: {},
      createdAt: updatedAt,
    });

    const updated = this.findWorkflowById(input.workflowId);
    if (!updated) {
      throw new Error(`Media workflow ${input.workflowId} disappeared after running transition.`);
    }

    return updated;
  }

  markWorkflowFailed(input: {
    workflowId: string;
    failureCode: string;
    failureMessage: string;
    completedAt?: string;
  }): MediaWorkflowSnapshot {
    const existing = this.findWorkflowById(input.workflowId);
    if (!existing) {
      throw new Error(`Media workflow ${input.workflowId} was not found.`);
    }

    if (existing.workflow.status === "succeeded" || existing.workflow.status === "canceled") {
      return existing;
    }

    const completedAt = input.completedAt ?? new Date().toISOString();
    this.db.prepare(`
      UPDATE media_workflows
      SET status = 'failed',
          final_asset_id = NULL,
          failure_code = ?,
          failure_message = ?,
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(input.failureCode, input.failureMessage, completedAt, completedAt, input.workflowId);

    this.appendEventInternal({
      workflowId: input.workflowId,
      stepId: null,
      eventType: "workflow_failed",
      payload: {
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
      },
      createdAt: completedAt,
    });

    const updated = this.findWorkflowById(input.workflowId);
    if (!updated) {
      throw new Error(`Media workflow ${input.workflowId} disappeared after failure transition.`);
    }

    return updated;
  }

  markWorkflowSucceeded(input: { workflowId: string; finalAssetId: string; completedAt?: string }): MediaWorkflowSnapshot {
    const existing = this.findWorkflowById(input.workflowId);
    if (!existing) {
      throw new Error(`Media workflow ${input.workflowId} was not found.`);
    }

    assertWorkflowCanSucceed({
      requestedDeliverable: existing.workflow.requestedDeliverable,
      finalAssetId: input.finalAssetId,
    });

    const completedAt = input.completedAt ?? new Date().toISOString();
    this.db.prepare(`
      UPDATE media_workflows
      SET status = 'succeeded',
          final_asset_id = ?,
          failure_code = NULL,
          failure_message = NULL,
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(input.finalAssetId, completedAt, completedAt, input.workflowId);

    this.appendEventInternal({
      workflowId: input.workflowId,
      stepId: null,
      eventType: "workflow_succeeded",
      payload: { finalAssetId: input.finalAssetId },
      createdAt: completedAt,
    });

    const updated = this.findWorkflowById(input.workflowId);
    if (!updated) {
      throw new Error(`Media workflow ${input.workflowId} disappeared after update.`);
    }

    return updated;
  }

  private appendEventInternal(input: {
    workflowId: string;
    stepId: string | null;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }): void {
    this.db.prepare(`
      INSERT INTO media_workflow_events (
        id, workflow_id, step_id, event_type, payload_json, created_at
      ) VALUES (
        @id, @workflowId, @stepId, @eventType, @payloadJson, @createdAt
      )
    `).run({
      id: `mwfe_${randomUUID()}`,
      workflowId: input.workflowId,
      stepId: input.stepId,
      eventType: input.eventType,
      payloadJson: JSON.stringify(input.payload),
      createdAt: input.createdAt,
    });
  }
}

export type { MediaWorkflowStepSeed };
