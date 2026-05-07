import { randomUUID } from "crypto";
import type Database from "better-sqlite3";

import {
  isOperationActorType,
  isOperationConfirmPolicy,
  isOperationEventType,
  isOperationKind,
  isOperationRiskLevel,
  isOperationStatus,
  isOperationStepStatus,
  isOperationVisibility,
  OperationActionRejectedError,
  OperationActionStaleError,
  OperationDomainError,
  OperationKindNotRegisteredError,
  OperationNotFoundError,
  OperationPayloadValidationError,
  OperationTransitionError,
  type Operation,
  type OperationAction,
  type OperationActorType,
  type OperationArtifact,
  type OperationErrorPayload,
  type OperationEvent,
  type OperationEventType,
  type OperationKind,
  type OperationResourceRef,
  type OperationStatus,
  type OperationStep,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";
import {
  DEFAULT_OPERATION_PAYLOAD_VALIDATORS,
  operationActionPolicy,
  type OperationActionAccepted,
  type OperationActionPolicy,
  type OperationPayloadValidatorRegistry,
} from "@/core/use-cases/operations/OperationActionPolicy";
import {
  createDefaultOperationKindRegistry,
  type OperationKindRegistry,
} from "@/core/use-cases/operations/OperationKindRegistry";
import {
  operationStateMachine,
  type OperationStateMachine,
} from "@/core/use-cases/operations/OperationStateMachine";
import type {
  AcceptActionInput,
  AppendOperationEventInput,
  AttachOperationArtifactInput,
  CreateOperationInput,
  OperationEventListOptions,
  OperationListOptions,
  OperationRepository,
  OperationSnapshot,
  OperationSummary,
  ReplaceActionsInput,
  TransitionStepInput,
  UpdateOperationStatusInput,
  UpsertStepInput,
} from "@/core/use-cases/operations/OperationRepository";
import type {
  AdminOperationSummary,
  ConversationOperationSummary,
  OperationHealthAggregate,
  OperationProgressSummary,
  PromptGroundingOperationSummary,
} from "@/core/use-cases/operations/OperationReadModel";

const ROLE_NAMES: readonly RoleName[] = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ACTIVE_OPERATION_STATUSES = new Set<OperationStatus>([
  "draft",
  "awaiting_confirmation",
  "queued",
  "running",
  "blocked",
]);

interface OperationDataMapperOptions {
  kindRegistry?: OperationKindRegistry;
  stateMachine?: OperationStateMachine;
  actionPolicy?: OperationActionPolicy;
  payloadValidators?: OperationPayloadValidatorRegistry;
}

interface OperationRow {
  id: string;
  kind: string;
  revision: number;
  title: string;
  status: string;
  risk_level: string;
  conversation_id: string | null;
  origin_message_id: string | null;
  created_by_user_id: string | null;
  created_by_role: string;
  visibility: string;
  current_step_id: string | null;
  summary: string | null;
  input_json: string;
  result_json: string | null;
  error_json: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface OperationStepRow {
  id: string;
  operation_id: string;
  sequence: number;
  kind: string;
  status: string;
  depends_on_step_ids_json: string;
  capability_name: string | null;
  job_id: string | null;
  system_command_id: string | null;
  resource_ref_json: string | null;
  input_json: string;
  output_json: string | null;
  error_json: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
}

interface OperationEventRow {
  id: string;
  operation_id: string;
  step_id: string | null;
  sequence: number;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  payload_json: string;
  created_at: string;
}

interface OperationActionRow {
  id: string;
  operation_id: string;
  operation_revision: number;
  action_type: string;
  label: string;
  risk_level: string;
  confirm_policy: string;
  allowed_roles_json: string;
  allowed_statuses_json: string;
  enabled: number;
  disabled_reason: string | null;
  idempotency_key: string;
  expires_at: string | null;
  payload_json: string;
  payload_schema_key: string;
  confirmation_text: string | null;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  accepted_by_role: string | null;
}

interface OperationArtifactRow {
  id: string;
  operation_id: string;
  step_id: string | null;
  kind: string;
  uri: string;
  label: string;
  metadata_json: string;
  created_at: string;
}

interface EventSeed {
  id?: string;
  operationId: string;
  stepId?: string | null;
  type: OperationEventType;
  actorType?: OperationActorType;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: string;
}

function nowIso(override?: string): string {
  return override ?? new Date().toISOString();
}

function clampLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function normalizeOffset(offset: number | undefined): number {
  if (offset == null || !Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new OperationPayloadValidationError(`${label} must be a JSON object.`, { label });
  }

  return value;
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new OperationPayloadValidationError(`${label} contains malformed JSON.`, {
      label,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseRecord(value: string, label: string): Record<string, unknown> {
  return requireRecord(parseJson(value, label), label);
}

function parseNullableRecord(value: string | null, label: string): Record<string, unknown> | null {
  if (value == null) return null;
  return parseRecord(value, label);
}

function parseStringArray(value: string, label: string): string[] {
  const parsed = parseJson(value, label);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new OperationPayloadValidationError(`${label} must be a JSON string array.`, { label });
  }

  return parsed;
}

function stringifyRecord(value: Record<string, unknown>, label: string): string {
  return JSON.stringify(requireRecord(value, label));
}

function stringifyNullableRecord(value: Record<string, unknown> | null | undefined, label: string): string | null {
  if (value == null) return null;
  return stringifyRecord(value, label);
}

function stringifyStringArray(value: readonly string[], label: string): string {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new OperationPayloadValidationError(`${label} must be a string array.`, { label });
  }

  return JSON.stringify([...value]);
}

function parseErrorPayload(value: string | null, label: string): OperationErrorPayload | null {
  const parsed = parseNullableRecord(value, label);
  if (parsed == null) return null;
  if (typeof parsed.code !== "string" || typeof parsed.message !== "string") {
    throw new OperationPayloadValidationError(`${label} must contain code and message strings.`, { label });
  }
  const details = parsed.details === undefined ? undefined : requireRecord(parsed.details, `${label}.details`);
  return { code: parsed.code, message: parsed.message, details };
}

function stringifyErrorPayload(value: OperationErrorPayload | null | undefined, label: string): string | null {
  if (value == null) return null;
  const payload: Record<string, unknown> = {
    code: value.code,
    message: value.message,
  };
  if (value.details !== undefined) payload.details = value.details;
  return stringifyRecord(payload, label);
}

function parseResourceRef(value: string | null, label: string): OperationResourceRef | null {
  const parsed = parseNullableRecord(value, label);
  if (parsed == null) return null;
  if (typeof parsed.type !== "string" || typeof parsed.id !== "string") {
    throw new OperationPayloadValidationError(`${label} must contain type and id strings.`, { label });
  }
  if (parsed.uri !== undefined && typeof parsed.uri !== "string") {
    throw new OperationPayloadValidationError(`${label}.uri must be a string when present.`, { label });
  }
  return { type: parsed.type, id: parsed.id, uri: parsed.uri };
}

function stringifyResourceRef(value: OperationResourceRef | null | undefined): string | null {
  if (value == null) return null;
  return stringifyRecord({
    type: value.type,
    id: value.id,
    ...(value.uri === undefined ? {} : { uri: value.uri }),
  }, "resourceRef");
}

function assertRoleName(value: string, label: string): RoleName {
  if (!ROLE_NAMES.includes(value as RoleName)) {
    throw new OperationPayloadValidationError(`${label} is not a valid role.`, { label, value });
  }
  return value as RoleName;
}

function assertRoleArray(values: readonly string[], label: string): RoleName[] {
  return values.map((value) => assertRoleName(value, label));
}

function toOperationKind(value: string): OperationKind {
  if (!isOperationKind(value)) throw new OperationKindNotRegisteredError(value);
  return value;
}

function summarizeProgress(steps: readonly OperationStep[]): OperationProgressSummary {
  const progress: OperationProgressSummary = {
    totalSteps: steps.length,
    pendingSteps: 0,
    readySteps: 0,
    runningSteps: 0,
    blockedSteps: 0,
    succeededSteps: 0,
    failedSteps: 0,
    skippedSteps: 0,
    cancelledSteps: 0,
    percentComplete: 0,
  };

  for (const step of steps) {
    if (step.status === "pending") progress.pendingSteps += 1;
    if (step.status === "ready") progress.readySteps += 1;
    if (step.status === "running") progress.runningSteps += 1;
    if (step.status === "blocked") progress.blockedSteps += 1;
    if (step.status === "succeeded") progress.succeededSteps += 1;
    if (step.status === "failed") progress.failedSteps += 1;
    if (step.status === "skipped") progress.skippedSteps += 1;
    if (step.status === "cancelled") progress.cancelledSteps += 1;
  }

  if (progress.totalSteps > 0) {
    progress.percentComplete = Math.round(((progress.succeededSteps + progress.skippedSteps) / progress.totalSteps) * 100);
  }

  return progress;
}

export class OperationDataMapper implements OperationRepository {
  private readonly kindRegistry: OperationKindRegistry;
  private readonly stateMachine: OperationStateMachine;
  private readonly actionPolicy: OperationActionPolicy;
  private readonly payloadValidators: OperationPayloadValidatorRegistry;

  constructor(
    private readonly db: Database.Database,
    options: OperationDataMapperOptions = {},
  ) {
    this.kindRegistry = options.kindRegistry ?? createDefaultOperationKindRegistry();
    this.stateMachine = options.stateMachine ?? operationStateMachine;
    this.actionPolicy = options.actionPolicy ?? operationActionPolicy;
    this.payloadValidators = options.payloadValidators ?? DEFAULT_OPERATION_PAYLOAD_VALIDATORS;
  }

  async createOperation(input: CreateOperationInput): Promise<OperationSnapshot> {
    const definition = this.kindRegistry.require(input.kind);
    const actorRole = input.createdByRole;
    if (!definition.allowedRoles.includes(actorRole)) {
      throw new OperationActionRejectedError("Actor role is not allowed to create this operation kind.", {
        kind: input.kind,
        actorRole,
        allowedRoles: definition.allowedRoles,
      });
    }
    if (definition.requiresConversation && !input.conversationId) {
      throw new OperationActionRejectedError("Operation kind requires a conversation.", { kind: input.kind });
    }

    const createdAt = nowIso(input.now);
    const operation: Operation = {
      id: input.id,
      kind: input.kind,
      revision: 1,
      title: input.title,
      status: input.status ?? "draft",
      riskLevel: input.riskLevel ?? definition.defaultRiskLevel,
      conversationId: input.conversationId ?? null,
      originMessageId: input.originMessageId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdByRole: input.createdByRole,
      visibility: input.visibility ?? definition.defaultVisibility,
      currentStepId: input.currentStepId ?? null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      summary: input.summary ?? null,
      input: input.input ?? {},
      result: input.result ?? null,
      error: input.error ?? null,
    };

    const write = this.db.transaction(() => {
      this.insertOperation(operation);
      this.appendEventInternal({
        operationId: operation.id,
        type: "operation_created",
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? input.createdByUserId ?? null,
        payload: { kind: operation.kind, title: operation.title, status: operation.status },
        createdAt,
      });
    });

    write();
    return this.requireSnapshot(operation.id);
  }

  async updateOperationStatus(input: UpdateOperationStatusInput): Promise<OperationSnapshot> {
    const operation = this.requireOperation(input.operationId);
    const definition = this.kindRegistry.require(operation.kind);
    const previousStatus = operation.status;
    const nextOperation = this.stateMachine.transitionOperation(operation, input.status, {
      supportsRetry: input.supportsRetry ?? definition.supportsRetry,
      now: input.now,
    });

    const write = this.db.transaction(() => {
      this.updateOperation(nextOperation);
      this.appendEventInternal({
        operationId: nextOperation.id,
        type: "operation_status_changed",
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        payload: { from: previousStatus, to: nextOperation.status, revision: nextOperation.revision },
        createdAt: nextOperation.updatedAt,
      });
      if (nextOperation.completedAt) {
        this.appendEventInternal({
          operationId: nextOperation.id,
          type: "operation_completed",
          actorType: input.actorType ?? "system",
          actorId: input.actorId ?? null,
          payload: { status: nextOperation.status, revision: nextOperation.revision },
          createdAt: nextOperation.completedAt,
        });
      }
    });

    write();
    return this.requireSnapshot(input.operationId);
  }

  async upsertStep(input: UpsertStepInput): Promise<OperationSnapshot> {
    const operation = this.requireOperation(input.step.operationId);
    this.assertStepPayload(input.step);
    const changedAt = nowIso(input.now);
    const nextOperation: Operation = {
      ...operation,
      revision: operation.revision + 1,
      updatedAt: changedAt,
      currentStepId: operation.currentStepId ?? input.step.id,
    };

    const write = this.db.transaction(() => {
      this.upsertStepRow(input.step, changedAt);
      this.updateOperation(nextOperation);
      this.appendEventInternal({
        operationId: input.step.operationId,
        stepId: input.step.id,
        type: "step_status_changed",
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        payload: { stepId: input.step.id, status: input.step.status, action: "upsert" },
        createdAt: changedAt,
      });
    });

    write();
    return this.requireSnapshot(input.step.operationId);
  }

  async transitionStep(input: TransitionStepInput): Promise<OperationSnapshot> {
    const snapshot = this.requireSnapshot(input.operationId);
    const previousStep = snapshot.steps.find((step) => step.id === input.stepId);
    if (!previousStep) throw new OperationTransitionError(`Operation step not found: ${input.stepId}`, { stepId: input.stepId });
    const definition = this.kindRegistry.require(snapshot.operation.kind);
    const result = this.stateMachine.transitionOperationStep(snapshot.operation, snapshot.steps, input.stepId, input.status, {
      supportsRetry: input.supportsRetry ?? definition.supportsRetry,
      now: input.now,
    });
    const changedAt = result.operation.updatedAt;

    const write = this.db.transaction(() => {
      this.updateOperation(result.operation);
      this.upsertStepRow(result.step, changedAt);
      this.appendEventInternal({
        operationId: input.operationId,
        stepId: input.stepId,
        type: "step_status_changed",
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        payload: { stepId: input.stepId, from: previousStep.status, to: input.status, revision: result.operation.revision },
        createdAt: changedAt,
      });
    });

    write();
    return this.requireSnapshot(input.operationId);
  }

  async replaceActions(input: ReplaceActionsInput): Promise<OperationSnapshot> {
    const operation = this.requireOperation(input.operationId);
    const changedAt = nowIso(input.now);
    const acceptedRows = this.listActionRows(input.operationId).filter((row) => row.accepted_at != null);
    const acceptedActionIds = new Set(acceptedRows.map((row) => row.id));

    for (const action of input.actions) {
      if (action.operationId !== input.operationId) {
        throw new OperationActionRejectedError("Action does not belong to operation.", {
          operationId: input.operationId,
          actionOperationId: action.operationId,
          actionId: action.id,
        });
      }
      if (action.operationRevision !== operation.revision) {
        throw new OperationActionStaleError("Cannot expose action for stale operation revision.", {
          operationId: operation.id,
          operationRevision: operation.revision,
          actionRevision: action.operationRevision,
          actionId: action.id,
        });
      }
      if (acceptedActionIds.has(action.id)) {
        throw new OperationActionStaleError("Cannot replace an already accepted action row.", {
          operationId: operation.id,
          actionId: action.id,
        });
      }
      this.assertActionPayload(action);
    }

    const write = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE operation_actions
        SET enabled = 0,
            disabled_reason = COALESCE(disabled_reason, 'superseded'),
            updated_at = ?
        WHERE operation_id = ?
          AND accepted_at IS NULL
          AND enabled = 1
      `).run(changedAt, input.operationId);

      for (const action of input.actions) {
        this.upsertActionRow(action, changedAt);
        this.appendEventInternal({
          operationId: input.operationId,
          type: "action_exposed",
          actorType: input.actorType ?? "system",
          actorId: input.actorId ?? null,
          payload: {
            actionId: action.id,
            actionType: action.actionType,
            operationRevision: action.operationRevision,
            riskLevel: action.riskLevel,
          },
          createdAt: changedAt,
        });
      }
    });

    write();
    return this.requireSnapshot(input.operationId);
  }

  async acceptAction(input: AcceptActionInput): Promise<OperationActionAccepted> {
    const snapshot = this.requireSnapshot(input.operationId);
    const action = snapshot.actions.find((candidate) => candidate.id === input.actionId);
    if (!action) throw new OperationNotFoundError(input.actionId);

    if (action.idempotencyKey !== input.idempotencyKey) {
      throw new OperationActionStaleError("Operation action idempotency key does not match stored action.", {
        operationId: input.operationId,
        actionId: input.actionId,
        idempotencyKey: input.idempotencyKey,
      });
    }

    const actionRow = this.requireActionRow(input.operationId, input.actionId);
    const acceptedRows = this.listActionRows(input.operationId).filter((row) => row.accepted_at != null);
    const acceptedIdempotencyKeys = acceptedRows.map((row) => row.idempotency_key);
    const acceptedActionIds = acceptedRows.map((row) => row.id);
    const acceptedAt = actionRow.accepted_at ?? nowIso(input.now);
    let result: OperationActionAccepted;
    try {
      result = this.actionPolicy.evaluate({
        operation: snapshot.operation,
        action,
        actorRole: input.actorRole,
        payload: input.payload,
        confirmation: input.confirmation,
        now: acceptedAt,
        acceptedIdempotencyKeys,
        acceptedActionIds,
        availableActions: snapshot.actions,
        payloadValidators: this.payloadValidators,
      });
    } catch (error) {
      if (error instanceof OperationDomainError) {
        const rejectedAt = nowIso(input.now);
        const writeRejected = this.db.transaction(() => {
          this.appendEventInternal({
            operationId: input.operationId,
            type: "action_rejected",
            actorType: "user",
            actorId: input.actorUserId ?? null,
            payload: {
              actionId: input.actionId,
              actionType: action.actionType,
              idempotencyKey: input.idempotencyKey,
              errorCode: error.code,
              errorMessage: error.message,
              errorDetails: error.details,
            },
            createdAt: rejectedAt,
          });
        });
        writeRejected();
      }
      throw error;
    }

    if (result.duplicate) return result;

    const write = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE operation_actions
        SET accepted_at = ?,
            accepted_by_user_id = ?,
            accepted_by_role = ?,
            updated_at = ?
        WHERE operation_id = ?
          AND id = ?
          AND accepted_at IS NULL
      `).run(result.acceptedAt, input.actorUserId ?? null, input.actorRole, result.acceptedAt, input.operationId, input.actionId);

      this.appendEventInternal({
        operationId: input.operationId,
        type: "action_requested",
        actorType: "user",
        actorId: input.actorUserId ?? null,
        payload: {
          actionId: input.actionId,
          actionType: action.actionType,
          idempotencyKey: input.idempotencyKey,
        },
        createdAt: result.acceptedAt,
      });
    });

    write();
    return result;
  }

  async appendEvent(input: AppendOperationEventInput): Promise<OperationEvent> {
    this.requireOperation(input.operationId);
    if (input.stepId) this.requireStep(input.operationId, input.stepId);
    let event: OperationEvent | null = null;
    const write = this.db.transaction(() => {
      event = this.appendEventInternal({
        id: input.id,
        operationId: input.operationId,
        stepId: input.stepId ?? null,
        type: input.type,
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        payload: input.payload ?? {},
        createdAt: nowIso(input.now),
      });
    });
    write();
    if (!event) throw new Error("Operation event append failed.");
    return event;
  }

  async attachArtifact(input: AttachOperationArtifactInput): Promise<OperationArtifact> {
    this.requireOperation(input.artifact.operationId);
    if (input.artifact.stepId) this.requireStep(input.artifact.operationId, input.artifact.stepId);
    this.assertArtifactPayload(input.artifact);
    const createdAt = input.artifact.createdAt ?? nowIso(input.now);
    const artifact: OperationArtifact = {
      ...input.artifact,
      createdAt,
    };

    const write = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO operation_artifacts (
          id, operation_id, step_id, kind, uri, label, metadata_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artifact.id,
        artifact.operationId,
        artifact.stepId,
        artifact.kind,
        artifact.uri,
        artifact.label,
        stringifyRecord(artifact.metadata, "artifact.metadata"),
        artifact.createdAt,
      );
      this.appendEventInternal({
        operationId: artifact.operationId,
        stepId: artifact.stepId,
        type: "artifact_attached",
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        payload: { artifactId: artifact.id, kind: artifact.kind, uri: artifact.uri, label: artifact.label },
        createdAt,
      });
    });

    write();
    return artifact;
  }

  async findOperationById(id: string): Promise<OperationSnapshot | null> {
    const row = this.findOperationRow(id);
    if (!row) return null;
    return this.toSnapshot(row);
  }

  async listOperationsByConversation(conversationId: string, options: OperationListOptions = {}): Promise<OperationSummary[]> {
    return this.listOperationSummaries("conversation_id = ?", [conversationId], options);
  }

  async listOperationsForUser(userId: string, options: OperationListOptions = {}): Promise<OperationSummary[]> {
    return this.listOperationSummaries("created_by_user_id = ?", [userId], options);
  }

  async listOperationsForAdmin(options: OperationListOptions = {}): Promise<OperationSummary[]> {
    return this.listOperationSummaries("1 = 1", [], options);
  }

  async listEvents(operationId: string, options: OperationEventListOptions = {}): Promise<OperationEvent[]> {
    this.requireOperation(operationId);
    const clauses = ["operation_id = ?"];
    const params: Array<string | number> = [operationId];
    if (options.afterSequence != null) {
      clauses.push("sequence > ?");
      params.push(options.afterSequence);
    }
    params.push(clampLimit(options.limit));
    return this.db.prepare(`
      SELECT *
      FROM operation_events
      WHERE ${clauses.join(" AND ")}
      ORDER BY sequence ASC
      LIMIT ?
    `).all(...params).map((row) => this.toEvent(row as OperationEventRow));
  }

  async listArtifacts(operationId: string, options: OperationEventListOptions = {}): Promise<OperationArtifact[]> {
    this.requireOperation(operationId);
    return this.db.prepare(`
      SELECT *
      FROM operation_artifacts
      WHERE operation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(operationId, clampLimit(options.limit)).map((row) => this.toArtifact(row as OperationArtifactRow));
  }

  async listAvailableActions(operationId: string, options: { now?: string } = {}): Promise<OperationAction[]> {
    this.requireOperation(operationId);
    const now = nowIso(options.now);
    return this.db.prepare(`
      SELECT *
      FROM operation_actions
      WHERE operation_id = ?
        AND enabled = 1
        AND accepted_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at ASC, id ASC
    `).all(operationId, now).map((row) => this.toAction(row as OperationActionRow));
  }

  async getConversationSummary(operationId: string): Promise<ConversationOperationSummary | null> {
    const snapshot = await this.findOperationById(operationId);
    if (!snapshot) return null;
    const availableActions = await this.listAvailableActions(operationId);
    const latestEvent = snapshot.events.at(-1) ?? null;
    return {
      operationId,
      kind: snapshot.operation.kind,
      title: snapshot.operation.title,
      status: snapshot.operation.status,
      riskLevel: snapshot.operation.riskLevel,
      revision: snapshot.operation.revision,
      currentStepId: snapshot.operation.currentStepId,
      summary: snapshot.operation.summary,
      progress: summarizeProgress(snapshot.steps),
      availableActions,
      latestEvent,
      updatedAt: snapshot.operation.updatedAt,
    };
  }

  async getAdminSummary(operationId: string): Promise<AdminOperationSummary | null> {
    const summary = await this.getConversationSummary(operationId);
    const snapshot = await this.findOperationById(operationId);
    if (!summary || !snapshot) return null;
    return {
      ...summary,
      createdByUserId: snapshot.operation.createdByUserId,
      createdByRole: snapshot.operation.createdByRole,
      visibility: snapshot.operation.visibility,
      createdAt: snapshot.operation.createdAt,
      completedAt: snapshot.operation.completedAt,
      stepCount: snapshot.steps.length,
      actionCount: snapshot.actions.length,
      artifactCount: snapshot.artifacts.length,
      eventCount: snapshot.events.length,
    };
  }

  async getHealthAggregate(now: string = new Date().toISOString()): Promise<OperationHealthAggregate> {
    const rows = this.db.prepare("SELECT * FROM operations").all().map((row) => this.toOperation(row as OperationRow));
    const active = rows.filter((operation) => ACTIVE_OPERATION_STATUSES.has(operation.status));
    const activeByStatus: Record<string, number> = {};
    const activeByKind: Record<string, number> = {};
    for (const operation of active) {
      activeByStatus[operation.status] = (activeByStatus[operation.status] ?? 0) + 1;
      activeByKind[operation.kind] = (activeByKind[operation.kind] ?? 0) + 1;
    }
    const nowMs = Date.parse(now);
    const oldestCreatedAtMs = active
      .map((operation) => Date.parse(operation.createdAt))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    const pendingDestructiveActions = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM operation_actions
      WHERE risk_level = 'destructive'
        AND enabled = 1
        AND accepted_at IS NULL
    `).get() as { count: number };

    return {
      totalActiveOperations: active.length,
      activeByStatus,
      activeByKind,
      failedCount: rows.filter((operation) => operation.status === "failed").length,
      blockedCount: rows.filter((operation) => operation.status === "blocked").length,
      oldestActiveOperationAgeMs: oldestCreatedAtMs === undefined || !Number.isFinite(nowMs) ? null : Math.max(0, nowMs - oldestCreatedAtMs),
      pendingDestructiveActions: pendingDestructiveActions.count,
    };
  }

  async getPromptGroundingSummary(operationId: string): Promise<PromptGroundingOperationSummary | null> {
    const snapshot = await this.findOperationById(operationId);
    if (!snapshot) return null;
    const availableActions = await this.listAvailableActions(operationId);
    return {
      operationId,
      kind: snapshot.operation.kind,
      title: snapshot.operation.title,
      status: snapshot.operation.status,
      riskLevel: snapshot.operation.riskLevel,
      revision: snapshot.operation.revision,
      currentStepId: snapshot.operation.currentStepId,
      summary: snapshot.operation.summary,
      progress: summarizeProgress(snapshot.steps),
      latestEvents: snapshot.events.slice(-5),
      availableActions: availableActions.map((action) => ({
        id: action.id,
        actionType: action.actionType,
        label: action.label,
        enabled: action.enabled,
        disabledReason: action.disabledReason,
        riskLevel: action.riskLevel,
        confirmPolicy: action.confirmPolicy,
      })),
      artifacts: snapshot.artifacts.map((artifact) => ({
        label: artifact.label,
        uri: artifact.uri,
        kind: artifact.kind,
        createdAt: artifact.createdAt,
      })),
      error: snapshot.operation.error ? {
        code: snapshot.operation.error.code,
        message: snapshot.operation.error.message,
      } : null,
      updatedAt: snapshot.operation.updatedAt,
    };
  }

  private insertOperation(operation: Operation): void {
    this.assertOperationPayload(operation);
    this.db.prepare(`
      INSERT INTO operations (
        id, kind, revision, title, status, risk_level, conversation_id,
        origin_message_id, created_by_user_id, created_by_role, visibility,
        current_step_id, summary, input_json, result_json, error_json,
        created_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      operation.id,
      operation.kind,
      operation.revision,
      operation.title,
      operation.status,
      operation.riskLevel,
      operation.conversationId,
      operation.originMessageId,
      operation.createdByUserId,
      operation.createdByRole,
      operation.visibility,
      operation.currentStepId,
      operation.summary,
      stringifyRecord(operation.input, "operation.input"),
      stringifyNullableRecord(operation.result, "operation.result"),
      stringifyErrorPayload(operation.error, "operation.error"),
      operation.createdAt,
      operation.updatedAt,
      operation.completedAt,
    );
  }

  private updateOperation(operation: Operation): void {
    this.assertOperationPayload(operation);
    this.db.prepare(`
      UPDATE operations
      SET revision = ?,
          title = ?,
          status = ?,
          risk_level = ?,
          conversation_id = ?,
          origin_message_id = ?,
          created_by_user_id = ?,
          created_by_role = ?,
          visibility = ?,
          current_step_id = ?,
          summary = ?,
          input_json = ?,
          result_json = ?,
          error_json = ?,
          updated_at = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      operation.revision,
      operation.title,
      operation.status,
      operation.riskLevel,
      operation.conversationId,
      operation.originMessageId,
      operation.createdByUserId,
      operation.createdByRole,
      operation.visibility,
      operation.currentStepId,
      operation.summary,
      stringifyRecord(operation.input, "operation.input"),
      stringifyNullableRecord(operation.result, "operation.result"),
      stringifyErrorPayload(operation.error, "operation.error"),
      operation.updatedAt,
      operation.completedAt,
      operation.id,
    );
  }

  private upsertStepRow(step: OperationStep, changedAt: string): void {
    this.assertStepPayload(step);
    this.db.prepare(`
      INSERT INTO operation_steps (
        id, operation_id, sequence, kind, status, depends_on_step_ids_json,
        capability_name, job_id, system_command_id, resource_ref_json,
        input_json, output_json, error_json, retry_count, started_at,
        completed_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sequence = excluded.sequence,
        kind = excluded.kind,
        status = excluded.status,
        depends_on_step_ids_json = excluded.depends_on_step_ids_json,
        capability_name = excluded.capability_name,
        job_id = excluded.job_id,
        system_command_id = excluded.system_command_id,
        resource_ref_json = excluded.resource_ref_json,
        input_json = excluded.input_json,
        output_json = excluded.output_json,
        error_json = excluded.error_json,
        retry_count = excluded.retry_count,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `).run(
      step.id,
      step.operationId,
      step.sequence,
      step.kind,
      step.status,
      stringifyStringArray(step.dependsOnStepIds, "step.dependsOnStepIds"),
      step.capabilityName,
      step.jobId,
      step.systemCommandId,
      stringifyResourceRef(step.resourceRef),
      stringifyRecord(step.input, "step.input"),
      stringifyNullableRecord(step.output, "step.output"),
      stringifyErrorPayload(step.error, "step.error"),
      step.retryCount,
      step.startedAt,
      step.completedAt,
      changedAt,
      changedAt,
    );
  }

  private upsertActionRow(action: OperationAction, changedAt: string): void {
    this.assertActionPayload(action);
    this.db.prepare(`
      INSERT INTO operation_actions (
        id, operation_id, operation_revision, action_type, label, risk_level,
        confirm_policy, allowed_roles_json, allowed_statuses_json, enabled,
        disabled_reason, idempotency_key, expires_at, payload_json,
        payload_schema_key, confirmation_text, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        operation_revision = excluded.operation_revision,
        action_type = excluded.action_type,
        label = excluded.label,
        risk_level = excluded.risk_level,
        confirm_policy = excluded.confirm_policy,
        allowed_roles_json = excluded.allowed_roles_json,
        allowed_statuses_json = excluded.allowed_statuses_json,
        enabled = excluded.enabled,
        disabled_reason = excluded.disabled_reason,
        idempotency_key = excluded.idempotency_key,
        expires_at = excluded.expires_at,
        payload_json = excluded.payload_json,
        payload_schema_key = excluded.payload_schema_key,
        confirmation_text = excluded.confirmation_text,
        updated_at = excluded.updated_at
      WHERE operation_actions.accepted_at IS NULL
    `).run(
      action.id,
      action.operationId,
      action.operationRevision,
      action.actionType,
      action.label,
      action.riskLevel,
      action.confirmPolicy,
      stringifyStringArray(action.allowedRoles, "action.allowedRoles"),
      stringifyStringArray(action.allowedStatuses, "action.allowedStatuses"),
      action.enabled ? 1 : 0,
      action.disabledReason,
      action.idempotencyKey,
      action.expiresAt,
      stringifyRecord(action.payload, "action.payload"),
      action.payloadSchemaKey,
      action.confirmationText ?? null,
      changedAt,
      changedAt,
    );
  }

  private appendEventInternal(input: EventSeed): OperationEvent {
    const createdAt = input.createdAt ?? nowIso();
    const payload = input.payload ?? {};
    requireRecord(payload, "event.payload");
    const nextSequence = (this.db.prepare(`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
      FROM operation_events
      WHERE operation_id = ?
    `).get(input.operationId) as { sequence: number }).sequence;
    const id = input.id ?? `opevt_${randomUUID()}`;
    this.db.prepare(`
      INSERT INTO operation_events (
        id, operation_id, step_id, sequence, event_type, actor_type,
        actor_id, payload_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.operationId,
      input.stepId ?? null,
      nextSequence,
      input.type,
      input.actorType ?? "system",
      input.actorId ?? null,
      stringifyRecord(payload, "event.payload"),
      createdAt,
    );
    return this.toEvent(this.db.prepare("SELECT * FROM operation_events WHERE id = ?").get(id) as OperationEventRow);
  }

  private toSnapshot(operationRow: OperationRow): OperationSnapshot {
    const operation = this.toOperation(operationRow);
    return {
      operation,
      steps: this.listStepRows(operation.id).map((row) => this.toStep(row)),
      actions: this.listActionRows(operation.id).map((row) => this.toAction(row)),
      events: this.listEventRows(operation.id).map((row) => this.toEvent(row)),
      artifacts: this.listArtifactRows(operation.id).map((row) => this.toArtifact(row)),
    };
  }

  private toOperation(row: OperationRow): Operation {
    this.kindRegistry.require(row.kind);
    const kind = toOperationKind(row.kind);
    if (!isOperationStatus(row.status)) throw new OperationTransitionError("Stored operation status is invalid.", { status: row.status });
    if (!isOperationRiskLevel(row.risk_level)) throw new OperationPayloadValidationError("Stored operation risk level is invalid.", { riskLevel: row.risk_level });
    if (!isOperationVisibility(row.visibility)) throw new OperationPayloadValidationError("Stored operation visibility is invalid.", { visibility: row.visibility });

    return {
      id: row.id,
      kind,
      revision: row.revision,
      title: row.title,
      status: row.status,
      riskLevel: row.risk_level,
      conversationId: row.conversation_id,
      originMessageId: row.origin_message_id,
      createdByUserId: row.created_by_user_id,
      createdByRole: assertRoleName(row.created_by_role, "operation.createdByRole"),
      visibility: row.visibility,
      currentStepId: row.current_step_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      summary: row.summary,
      input: parseRecord(row.input_json, "operation.input"),
      result: parseNullableRecord(row.result_json, "operation.result"),
      error: parseErrorPayload(row.error_json, "operation.error"),
    };
  }

  private toStep(row: OperationStepRow): OperationStep {
    if (!isOperationStepStatus(row.status)) throw new OperationTransitionError("Stored operation step status is invalid.", { status: row.status });
    return {
      id: row.id,
      operationId: row.operation_id,
      sequence: row.sequence,
      kind: row.kind,
      status: row.status,
      dependsOnStepIds: parseStringArray(row.depends_on_step_ids_json, "step.dependsOnStepIds"),
      capabilityName: row.capability_name,
      jobId: row.job_id,
      systemCommandId: row.system_command_id,
      resourceRef: parseResourceRef(row.resource_ref_json, "step.resourceRef"),
      input: parseRecord(row.input_json, "step.input"),
      output: parseNullableRecord(row.output_json, "step.output"),
      error: parseErrorPayload(row.error_json, "step.error"),
      retryCount: row.retry_count,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  private toAction(row: OperationActionRow): OperationAction {
    if (!isOperationRiskLevel(row.risk_level)) throw new OperationPayloadValidationError("Stored action risk level is invalid.", { riskLevel: row.risk_level });
    if (!isOperationConfirmPolicy(row.confirm_policy)) throw new OperationPayloadValidationError("Stored action confirmation policy is invalid.", { confirmPolicy: row.confirm_policy });
    const allowedStatuses = parseStringArray(row.allowed_statuses_json, "action.allowedStatuses");
    for (const status of allowedStatuses) {
      if (!isOperationStatus(status)) throw new OperationTransitionError("Stored action allowed status is invalid.", { status });
    }
    const typedAllowedStatuses = allowedStatuses.filter(isOperationStatus);

    return {
      id: row.id,
      operationId: row.operation_id,
      operationRevision: row.operation_revision,
      actionType: row.action_type,
      label: row.label,
      riskLevel: row.risk_level,
      confirmPolicy: row.confirm_policy,
      allowedRoles: assertRoleArray(parseStringArray(row.allowed_roles_json, "action.allowedRoles"), "action.allowedRoles"),
      allowedStatuses: typedAllowedStatuses,
      enabled: row.enabled === 1,
      disabledReason: row.disabled_reason,
      idempotencyKey: row.idempotency_key,
      expiresAt: row.expires_at,
      payload: parseRecord(row.payload_json, "action.payload"),
      payloadSchemaKey: row.payload_schema_key,
      confirmationText: row.confirmation_text,
    };
  }

  private toEvent(row: OperationEventRow): OperationEvent {
    if (!isOperationEventType(row.event_type)) throw new OperationPayloadValidationError("Stored operation event type is invalid.", { eventType: row.event_type });
    if (!isOperationActorType(row.actor_type)) throw new OperationPayloadValidationError("Stored operation event actor type is invalid.", { actorType: row.actor_type });
    return {
      id: row.id,
      operationId: row.operation_id,
      stepId: row.step_id,
      sequence: row.sequence,
      type: row.event_type,
      actorType: row.actor_type,
      actorId: row.actor_id,
      payload: parseRecord(row.payload_json, "event.payload"),
      createdAt: row.created_at,
    };
  }

  private toArtifact(row: OperationArtifactRow): OperationArtifact {
    return {
      id: row.id,
      operationId: row.operation_id,
      stepId: row.step_id,
      kind: row.kind,
      uri: row.uri,
      label: row.label,
      metadata: parseRecord(row.metadata_json, "artifact.metadata"),
      createdAt: row.created_at,
    };
  }

  private requireSnapshot(operationId: string): OperationSnapshot {
    const row = this.findOperationRow(operationId);
    if (!row) throw new OperationNotFoundError(operationId);
    return this.toSnapshot(row);
  }

  private requireOperation(operationId: string): Operation {
    const row = this.findOperationRow(operationId);
    if (!row) throw new OperationNotFoundError(operationId);
    return this.toOperation(row);
  }

  private requireStep(operationId: string, stepId: string): OperationStep {
    const row = this.db.prepare(`
      SELECT *
      FROM operation_steps
      WHERE operation_id = ?
        AND id = ?
    `).get(operationId, stepId) as OperationStepRow | undefined;
    if (!row) throw new OperationNotFoundError(stepId);
    return this.toStep(row);
  }

  private requireActionRow(operationId: string, actionId: string): OperationActionRow {
    const row = this.db.prepare(`
      SELECT *
      FROM operation_actions
      WHERE operation_id = ?
        AND id = ?
    `).get(operationId, actionId) as OperationActionRow | undefined;
    if (!row) throw new OperationNotFoundError(actionId);
    return row;
  }

  private findOperationRow(operationId: string): OperationRow | null {
    return (this.db.prepare("SELECT * FROM operations WHERE id = ?").get(operationId) as OperationRow | undefined) ?? null;
  }

  private listStepRows(operationId: string): OperationStepRow[] {
    return this.db.prepare("SELECT * FROM operation_steps WHERE operation_id = ? ORDER BY sequence ASC")
      .all(operationId) as OperationStepRow[];
  }

  private listActionRows(operationId: string): OperationActionRow[] {
    return this.db.prepare("SELECT * FROM operation_actions WHERE operation_id = ? ORDER BY created_at ASC, id ASC")
      .all(operationId) as OperationActionRow[];
  }

  private listEventRows(operationId: string): OperationEventRow[] {
    return this.db.prepare("SELECT * FROM operation_events WHERE operation_id = ? ORDER BY sequence ASC")
      .all(operationId) as OperationEventRow[];
  }

  private listArtifactRows(operationId: string): OperationArtifactRow[] {
    return this.db.prepare("SELECT * FROM operation_artifacts WHERE operation_id = ? ORDER BY created_at DESC, id DESC")
      .all(operationId) as OperationArtifactRow[];
  }

  private listOperationSummaries(baseWhere: string, baseParams: Array<string | number>, options: OperationListOptions): OperationSummary[] {
    const clauses = [baseWhere];
    const params: Array<string | number> = [...baseParams];
    if (options.status) {
      clauses.push("status = ?");
      params.push(options.status);
    }
    if (options.kind) {
      clauses.push("kind = ?");
      params.push(options.kind);
    }
    if (options.createdFrom) {
      clauses.push("created_at >= ?");
      params.push(options.createdFrom);
    }
    if (options.createdTo) {
      clauses.push("created_at <= ?");
      params.push(options.createdTo);
    }
    params.push(clampLimit(options.limit), normalizeOffset(options.offset));
    const rows = this.db.prepare(`
      SELECT *
      FROM operations
      WHERE ${clauses.join(" AND ")}
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
      OFFSET ?
    `).all(...params) as OperationRow[];
    return rows.map((row) => this.toSummary(this.toSnapshot(row)));
  }

  private toSummary(snapshot: OperationSnapshot): OperationSummary {
    const latestEvent = snapshot.events.at(-1) ?? null;
    return {
      id: snapshot.operation.id,
      kind: snapshot.operation.kind,
      title: snapshot.operation.title,
      status: snapshot.operation.status,
      riskLevel: snapshot.operation.riskLevel,
      revision: snapshot.operation.revision,
      conversationId: snapshot.operation.conversationId,
      currentStepId: snapshot.operation.currentStepId,
      summary: snapshot.operation.summary,
      createdByUserId: snapshot.operation.createdByUserId,
      createdByRole: snapshot.operation.createdByRole,
      visibility: snapshot.operation.visibility,
      createdAt: snapshot.operation.createdAt,
      updatedAt: snapshot.operation.updatedAt,
      completedAt: snapshot.operation.completedAt,
      stepCount: snapshot.steps.length,
      actionCount: snapshot.actions.length,
      artifactCount: snapshot.artifacts.length,
      eventCount: snapshot.events.length,
      latestEventType: latestEvent?.type ?? null,
      latestEventAt: latestEvent?.createdAt ?? null,
      progress: summarizeProgress(snapshot.steps),
    };
  }

  private assertOperationPayload(operation: Operation): void {
    this.kindRegistry.require(operation.kind);
    assertRoleName(operation.createdByRole, "operation.createdByRole");
    requireRecord(operation.input, "operation.input");
    if (operation.result != null) requireRecord(operation.result, "operation.result");
    if (operation.error?.details != null) requireRecord(operation.error.details, "operation.error.details");
  }

  private assertStepPayload(step: OperationStep): void {
    if (!isOperationStepStatus(step.status)) throw new OperationTransitionError("Step status is invalid.", { status: step.status });
    requireRecord(step.input, "step.input");
    if (step.output != null) requireRecord(step.output, "step.output");
    if (step.error?.details != null) requireRecord(step.error.details, "step.error.details");
    if (step.resourceRef != null && (!step.resourceRef.type || !step.resourceRef.id)) {
      throw new OperationPayloadValidationError("Step resourceRef must include type and id.", { stepId: step.id });
    }
  }

  private assertActionPayload(action: OperationAction): void {
    if (!isOperationRiskLevel(action.riskLevel)) throw new OperationPayloadValidationError("Action risk level is invalid.", { actionId: action.id });
    if (!isOperationConfirmPolicy(action.confirmPolicy)) throw new OperationPayloadValidationError("Action confirm policy is invalid.", { actionId: action.id });
    assertRoleArray(action.allowedRoles, "action.allowedRoles");
    for (const status of action.allowedStatuses) {
      if (!isOperationStatus(status)) throw new OperationTransitionError("Action allowed status is invalid.", { actionId: action.id, status });
    }
    requireRecord(action.payload, "action.payload");
  }

  private assertArtifactPayload(artifact: Omit<OperationArtifact, "createdAt">): void {
    requireRecord(artifact.metadata, "artifact.metadata");
  }
}
