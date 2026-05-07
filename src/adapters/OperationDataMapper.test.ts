import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import { _resetRepositorySingletons, getOperationRepository } from "@/adapters/RepositoryFactory";
import {
  type OperationAction,
  type OperationKind,
  OperationActionStaleError,
  OperationKindNotRegisteredError,
  OperationNotFoundError,
  OperationPayloadValidationError,
  OperationTransitionError,
} from "@/core/entities/operation";
import type { OperationRepository } from "@/core/use-cases/operations/OperationRepository";
import { closeDbConnection, getDb } from "@/lib/db";
import { ensureSchema } from "@/lib/db/schema";
import { createTables } from "@/lib/db/tables";
import { runMigrations } from "@/lib/db/migrations";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id = "usr_ops", roleId = "role_admin"): void {
  db.prepare("INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)")
    .run(id, `${id}@example.com`, "Operation User");
  db.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)")
    .run(id, roleId);
}

function seedConversation(db: Database.Database, id = "conv_ops", userId = "usr_ops"): void {
  db.prepare("INSERT OR IGNORE INTO conversations (id, user_id, title, status, session_source) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, "Operation Thread", "active", "authenticated");
  db.prepare("INSERT OR IGNORE INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)")
    .run("msg_ops", id, "user", "start operation");
}

async function createBackupOperation(mapper: OperationRepository, overrides: Partial<Parameters<OperationRepository["createOperation"]>[0]> = {}) {
  return mapper.createOperation({
    id: "op_backup",
    kind: "backup_create",
    title: "Create appliance backup",
    createdByUserId: "usr_ops",
    createdByRole: "ADMIN",
    input: { reason: "test" },
    now: "2026-05-03T12:00:00.000Z",
    ...overrides,
  });
}

function createStep(overrides: Partial<Parameters<OperationRepository["upsertStep"]>[0]["step"]> = {}) {
  return {
    id: "step_1",
    operationId: "op_backup",
    sequence: 1,
    kind: "backup.archive",
    status: "pending" as const,
    dependsOnStepIds: [],
    capabilityName: "backup.create",
    jobId: null,
    systemCommandId: null,
    resourceRef: null,
    input: {},
    output: null,
    error: null,
    retryCount: 0,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function createAction(overrides: Partial<OperationAction> = {}): OperationAction {
  return {
    id: "action_confirm",
    operationId: "op_backup",
    operationRevision: 1,
    actionType: "backup.confirm",
    label: "Confirm backup",
    riskLevel: "medium",
    confirmPolicy: "single_click",
    allowedRoles: ["ADMIN"],
    allowedStatuses: ["draft"],
    enabled: true,
    disabledReason: null,
    idempotencyKey: "idem_confirm",
    expiresAt: null,
    payload: {},
    payloadSchemaKey: "empty",
    confirmationText: null,
    ...overrides,
  };
}

describe("OperationDataMapper schema", () => {
  it("creates operation tables and indexes for fresh databases", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    createTables(db);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'operation%' ORDER BY name
    `).all().map((row) => (row as { name: string }).name);
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_operation%' ORDER BY name
    `).all().map((row) => (row as { name: string }).name);

    expect(tables).toEqual(["operation_actions", "operation_artifacts", "operation_events", "operation_steps", "operations"]);
    expect(indexes).toContain("idx_operation_events_operation_sequence");
    expect(indexes).toContain("idx_operation_actions_idempotency");
  });

  it("creates operation tables through migrations for existing databases", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    createTables(db);
    db.exec(`
      DROP TABLE operation_artifacts;
      DROP TABLE operation_actions;
      DROP TABLE operation_events;
      DROP TABLE operation_steps;
      DROP TABLE operations;
    `);

    runMigrations(db);

    const count = db.prepare(`
      SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name LIKE 'operation%'
    `).get() as { count: number };
    expect(count.count).toBe(5);
  });

  it("enables runtime SQLite foreign key enforcement", () => {
    const previousPath = process.env.STUDIO_ORDO_DB_PATH;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ordo-op-db-"));
    process.env.STUDIO_ORDO_DB_PATH = path.join(tempDir, "local.db");
    closeDbConnection();

    try {
      const db = getDb();
      expect((db.pragma("foreign_keys") as Array<{ foreign_keys: number }>)[0]?.foreign_keys).toBe(1);
    } finally {
      closeDbConnection();
      if (previousPath === undefined) {
        delete process.env.STUDIO_ORDO_DB_PATH;
      } else {
        process.env.STUDIO_ORDO_DB_PATH = previousPath;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("exposes repository factory storage with DB-handle invalidation", () => {
    const previousPath = process.env.STUDIO_ORDO_DB_PATH;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ordo-op-repo-"));

    try {
      process.env.STUDIO_ORDO_DB_PATH = path.join(tempDir, "first.db");
      closeDbConnection();
      _resetRepositorySingletons();

      const first = getOperationRepository();
      expect(getOperationRepository()).toBe(first);

      closeDbConnection();
      process.env.STUDIO_ORDO_DB_PATH = path.join(tempDir, "second.db");

      const second = getOperationRepository();
      expect(second).not.toBe(first);
      expect(getOperationRepository()).toBe(second);
    } finally {
      closeDbConnection();
      _resetRepositorySingletons();
      if (previousPath === undefined) {
        delete process.env.STUDIO_ORDO_DB_PATH;
      } else {
        process.env.STUDIO_ORDO_DB_PATH = previousPath;
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("OperationDataMapper", () => {
  let db: Database.Database;
  let mapper: OperationDataMapper;

  beforeEach(() => {
    db = createDb();
    seedUser(db);
    seedConversation(db);
    mapper = new OperationDataMapper(db);
  });

  afterEach(() => {
    db.close();
  });

  it("creates and reads an operation snapshot", async () => {
    const snapshot = await createBackupOperation(mapper, {
      conversationId: "conv_ops",
      originMessageId: "msg_ops",
    });

    expect(snapshot.operation).toMatchObject({
      id: "op_backup",
      kind: "backup_create",
      revision: 1,
      status: "draft",
      riskLevel: "medium",
      visibility: "admin",
      conversationId: "conv_ops",
      originMessageId: "msg_ops",
    });
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({ sequence: 1, type: "operation_created" });
    expect(await mapper.findOperationById("op_backup")).toMatchObject({
      operation: { id: "op_backup", input: { reason: "test" } },
    });
  });

  it("rejects unknown operation kinds before insertion", async () => {
    await expect(createBackupOperation(mapper, { kind: "unknown_kind" as OperationKind })).rejects.toBeInstanceOf(OperationKindNotRegisteredError);

    const row = db.prepare("SELECT COUNT(*) AS count FROM operations").get() as { count: number };
    expect(row.count).toBe(0);
  });

  it("updates operation status through the state machine and increments revision", async () => {
    await createBackupOperation(mapper);

    const updated = await mapper.updateOperationStatus({
      operationId: "op_backup",
      status: "queued",
      now: "2026-05-03T12:01:00.000Z",
    });

    expect(updated.operation).toMatchObject({
      status: "queued",
      revision: 2,
      updatedAt: "2026-05-03T12:01:00.000Z",
    });
    expect(updated.events.map((event) => [event.sequence, event.type])).toEqual([
      [1, "operation_created"],
      [2, "operation_status_changed"],
    ]);
  });

  it("persists dependent steps and rejects unsatisfied dependency transitions", async () => {
    await createBackupOperation(mapper);
    await mapper.upsertStep({ step: createStep({ id: "step_1", sequence: 1 }) });
    await mapper.upsertStep({
      step: createStep({
        id: "step_2",
        sequence: 2,
        dependsOnStepIds: ["step_1"],
      }),
    });

    await expect(mapper.transitionStep({
      operationId: "op_backup",
      stepId: "step_2",
      status: "ready",
    })).rejects.toBeInstanceOf(OperationTransitionError);

    await mapper.transitionStep({ operationId: "op_backup", stepId: "step_1", status: "ready" });
    await mapper.transitionStep({ operationId: "op_backup", stepId: "step_1", status: "running" });
    await mapper.transitionStep({ operationId: "op_backup", stepId: "step_1", status: "succeeded" });
    const snapshot = await mapper.transitionStep({ operationId: "op_backup", stepId: "step_2", status: "ready" });

    expect(snapshot.steps.map((step) => [step.id, step.status, step.dependsOnStepIds])).toEqual([
      ["step_1", "succeeded", []],
      ["step_2", "ready", ["step_1"]],
    ]);
  });

  it("appends events in operation-local sequence order", async () => {
    await createBackupOperation(mapper);
    await mapper.appendEvent({
      operationId: "op_backup",
      type: "executor_event_received",
      payload: { phase: "one" },
      now: "2026-05-03T12:02:00.000Z",
    });
    await mapper.appendEvent({
      operationId: "op_backup",
      type: "executor_event_received",
      payload: { phase: "two" },
      now: "2026-05-03T12:03:00.000Z",
    });

    const events = await mapper.listEvents("op_backup");
    expect(events.map((event) => [event.sequence, event.payload])).toEqual([
      [1, { kind: "backup_create", title: "Create appliance backup", status: "draft" }],
      [2, { phase: "one" }],
      [3, { phase: "two" }],
    ]);
  });

  it("replaces actions without deleting accepted action history", async () => {
    await createBackupOperation(mapper);
    await mapper.replaceActions({
      operationId: "op_backup",
      actions: [
        createAction(),
        createAction({ id: "action_old", actionType: "backup.old", idempotencyKey: "idem_old" }),
      ],
    });
    await mapper.acceptAction({
      operationId: "op_backup",
      actionId: "action_confirm",
      idempotencyKey: "idem_confirm",
      actorRole: "ADMIN",
      actorUserId: "usr_ops",
      confirmation: { confirmed: true },
      now: "2026-05-03T12:04:00.000Z",
    });

    const replaced = await mapper.replaceActions({
      operationId: "op_backup",
      actions: [
        createAction({ id: "action_new", actionType: "backup.new", idempotencyKey: "idem_new" }),
      ],
      now: "2026-05-03T12:05:00.000Z",
    });

    const actions = replaced.actions.sort((a, b) => a.id.localeCompare(b.id));
    expect(actions.map((action) => [action.id, action.enabled])).toEqual([
      ["action_confirm", true],
      ["action_new", true],
      ["action_old", false],
    ]);
    const accepted = db.prepare("SELECT accepted_at FROM operation_actions WHERE id = 'action_confirm'").get() as { accepted_at: string };
    expect(accepted.accepted_at).toBe("2026-05-03T12:04:00.000Z");
  });

  it("accepts actions idempotently without a second mutation or event", async () => {
    await createBackupOperation(mapper);
    await mapper.replaceActions({ operationId: "op_backup", actions: [createAction()] });
    const first = await mapper.acceptAction({
      operationId: "op_backup",
      actionId: "action_confirm",
      idempotencyKey: "idem_confirm",
      actorRole: "ADMIN",
      actorUserId: "usr_ops",
      confirmation: { confirmed: true },
      now: "2026-05-03T12:04:00.000Z",
    });
    const eventCountAfterFirst = (db.prepare("SELECT COUNT(*) AS count FROM operation_events").get() as { count: number }).count;
    const second = await mapper.acceptAction({
      operationId: "op_backup",
      actionId: "action_confirm",
      idempotencyKey: "idem_confirm",
      actorRole: "ADMIN",
      actorUserId: "usr_ops",
      confirmation: { confirmed: true },
      now: "2026-05-03T12:05:00.000Z",
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.acceptedAt).toBe("2026-05-03T12:04:00.000Z");
    expect((db.prepare("SELECT COUNT(*) AS count FROM operation_events").get() as { count: number }).count).toBe(eventCountAfterFirst);
  });

  it("rejects accepted action ids replayed with different idempotency keys", async () => {
    await createBackupOperation(mapper);
    await mapper.replaceActions({ operationId: "op_backup", actions: [createAction()] });
    await mapper.acceptAction({
      operationId: "op_backup",
      actionId: "action_confirm",
      idempotencyKey: "idem_confirm",
      actorRole: "ADMIN",
      actorUserId: "usr_ops",
      confirmation: { confirmed: true },
    });
    const eventCountBeforeMismatch = (db.prepare("SELECT COUNT(*) AS count FROM operation_events").get() as { count: number }).count;

    await expect(mapper.acceptAction({
      operationId: "op_backup",
      actionId: "action_confirm",
      idempotencyKey: "different_key",
      actorRole: "ADMIN",
      actorUserId: "usr_ops",
      confirmation: { confirmed: true },
    })).rejects.toBeInstanceOf(OperationActionStaleError);

    expect((db.prepare("SELECT COUNT(*) AS count FROM operation_events").get() as { count: number }).count).toBe(eventCountBeforeMismatch);
  });

  it("rejects stale action revisions without accepting the action", async () => {
    await createBackupOperation(mapper);
    await mapper.replaceActions({ operationId: "op_backup", actions: [createAction()] });
    await mapper.updateOperationStatus({ operationId: "op_backup", status: "queued" });

    await expect(mapper.acceptAction({
      operationId: "op_backup",
      actionId: "action_confirm",
      idempotencyKey: "idem_confirm",
      actorRole: "ADMIN",
      actorUserId: "usr_ops",
      confirmation: { confirmed: true },
    })).rejects.toBeInstanceOf(OperationActionStaleError);

    const row = db.prepare("SELECT accepted_at FROM operation_actions WHERE id = 'action_confirm'").get() as { accepted_at: string | null };
    expect(row.accepted_at).toBeNull();
    const events = await mapper.listEvents("op_backup");
    expect(events.at(-1)).toMatchObject({
      sequence: 4,
      type: "action_rejected",
      payload: {
        actionId: "action_confirm",
        actionType: "backup.confirm",
        errorCode: "OPERATION_ACTION_STALE",
      },
    });
  });

  it("attaches artifacts and returns read models", async () => {
    await createBackupOperation(mapper);
    const withStep = await mapper.upsertStep({ step: createStep() });
    await mapper.attachArtifact({
      artifact: {
        id: "artifact_1",
        operationId: "op_backup",
        stepId: "step_1",
        kind: "backup",
        uri: "backup://backup_1",
        label: "Backup archive",
        metadata: { size: 100 },
      },
      now: "2026-05-03T12:06:00.000Z",
    });
    await mapper.replaceActions({
      operationId: "op_backup",
      actions: [createAction({ operationRevision: withStep.operation.revision })],
    });

    const artifacts = await mapper.listArtifacts("op_backup");
    const conversationSummary = await mapper.getConversationSummary("op_backup");
    const adminSummary = await mapper.getAdminSummary("op_backup");
    const promptSummary = await mapper.getPromptGroundingSummary("op_backup");

    expect(artifacts).toMatchObject([{ id: "artifact_1", metadata: { size: 100 } }]);
    expect(conversationSummary).toMatchObject({ operationId: "op_backup", availableActions: [{ id: "action_confirm" }] });
    expect(adminSummary).toMatchObject({ stepCount: 1, actionCount: 1, artifactCount: 1 });
    expect(promptSummary).toMatchObject({
      operationId: "op_backup",
      artifacts: [{ label: "Backup archive", uri: "backup://backup_1" }],
      availableActions: [{ id: "action_confirm", actionType: "backup.confirm", label: "Confirm backup" }],
    });
  });

  it("lists operations by conversation, user, and admin filters", async () => {
    await createBackupOperation(mapper, {
      id: "op_a",
      conversationId: "conv_ops",
      now: "2026-05-03T12:00:00.000Z",
    });
    await createBackupOperation(mapper, {
      id: "op_b",
      title: "Second backup",
      conversationId: null,
      now: "2026-05-03T12:01:00.000Z",
    });
    await mapper.updateOperationStatus({ operationId: "op_b", status: "queued", now: "2026-05-03T12:02:00.000Z" });

    expect((await mapper.listOperationsByConversation("conv_ops")).map((summary) => summary.id)).toEqual(["op_a"]);
    expect((await mapper.listOperationsForUser("usr_ops")).map((summary) => summary.id)).toEqual(["op_b", "op_a"]);
    expect((await mapper.listOperationsForAdmin({ status: "queued", kind: "backup_create" })).map((summary) => summary.id)).toEqual(["op_b"]);
  });

  it("returns health aggregates", async () => {
    await createBackupOperation(mapper, { id: "op_active", now: "2026-05-03T12:00:00.000Z" });
    await createBackupOperation(mapper, { id: "op_blocked", now: "2026-05-03T12:01:00.000Z" });
    await mapper.updateOperationStatus({ operationId: "op_blocked", status: "blocked" });
    await createBackupOperation(mapper, { id: "op_failed", now: "2026-05-03T12:02:00.000Z" });
    await mapper.updateOperationStatus({ operationId: "op_failed", status: "queued" });
    await mapper.updateOperationStatus({ operationId: "op_failed", status: "failed" });
    await mapper.replaceActions({
      operationId: "op_active",
      actions: [
        createAction({
          id: "action_destructive",
          operationId: "op_active",
          actionType: "restore.execute",
          riskLevel: "destructive",
          confirmPolicy: "phrase",
          idempotencyKey: "idem_destructive",
          payloadSchemaKey: "restore.execute",
          payload: { restorePlanId: "restore_1" },
          confirmationText: "RESTORE",
        }),
      ],
    });

    const health = await mapper.getHealthAggregate("2026-05-03T12:10:00.000Z");
    expect(health).toMatchObject({
      totalActiveOperations: 2,
      activeByStatus: { draft: 1, blocked: 1 },
      activeByKind: { backup_create: 2 },
      failedCount: 1,
      blockedCount: 1,
      pendingDestructiveActions: 1,
    });
    expect(health.oldestActiveOperationAgeMs).toBeGreaterThan(0);
  });

  it("rejects missing parents through repository validation and database constraints", async () => {
    await expect(mapper.appendEvent({
      operationId: "missing",
      type: "operation_created",
    })).rejects.toBeInstanceOf(OperationNotFoundError);

    expect(() => db.prepare(`
      INSERT INTO operation_steps (
        id, operation_id, sequence, kind, status, depends_on_step_ids_json, input_json
      )
      VALUES ('step_missing', 'missing', 1, 'test', 'pending', '[]', '{}')
    `).run()).toThrow();
  });

  it("fails hydration for invalid enum values and malformed JSON", async () => {
    await createBackupOperation(mapper, { id: "op_bad_enum" });
    db.prepare("UPDATE operations SET status = 'bad_status' WHERE id = 'op_bad_enum'").run();
    await expect(mapper.findOperationById("op_bad_enum")).rejects.toBeInstanceOf(OperationTransitionError);

    await createBackupOperation(mapper, { id: "op_bad_json" });
    db.prepare("UPDATE operations SET input_json = '{bad' WHERE id = 'op_bad_json'").run();
    await expect(mapper.findOperationById("op_bad_json")).rejects.toBeInstanceOf(OperationPayloadValidationError);
  });
});
