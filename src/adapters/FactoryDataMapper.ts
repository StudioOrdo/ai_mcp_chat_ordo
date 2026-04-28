import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import { getStageByKey, listProductionDAGValidationErrors, type ProductionDAG } from "@/core/entities/production-dag";
import { listStageRunRecordValidationErrors, type StageResultEntityKind, type StageRunRecord } from "@/core/entities/stage-run-record";
import { listWorkOrderValidationErrors, type WorkOrder, type WorkOrderPauseState } from "@/core/entities/work-order";
import { listResearchPacketValidationErrors, type ResearchPacket } from "@/core/entities/research-packet";
import { listDraftValidationErrors, type Draft } from "@/core/entities/draft";
import { listFactoryAssetValidationErrors, type FactoryAsset } from "@/core/entities/factory-asset";
import { listCompositionValidationErrors, type Composition } from "@/core/entities/composition";
import { listQAReportValidationErrors, type QAReport } from "@/core/entities/qa-report";
import { listReleaseValidationErrors, type Release } from "@/core/entities/release";
import { listOutcomeValidationErrors, type Outcome } from "@/core/entities/outcome";
import type {
  FactoryCheckpointRecord,
  FactoryEventRecord,
  FactoryOutputEntity,
  FactoryOutputRecord,
  FactoryOutputSeed,
  FactoryRepository,
} from "@/core/use-cases/FactoryRepository";
import { isNonEmptyTrimmedString, isValidTimestamp } from "@/core/entities/factory-validation";
import type { WorkOrderStatus } from "@/core/entities/factory-constants";

type FactoryWorkOrderRow = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  status: WorkOrderStatus;
  current_dag_id: string | null;
  current_stage_key: string | null;
  active_checkpoint_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  snapshot_json: string;
};

type FactoryProductionDAGRow = {
  id: string;
  work_order_id: string;
  dag_version: number;
  generated_at: string;
  snapshot_json: string;
};

type FactoryStageRunRow = {
  id: string;
  work_order_id: string;
  stage_key: string;
  stage_kind: string;
  status: StageRunRecord["status"];
  attempt_count: number;
  result_entity_kind: StageResultEntityKind | null;
  result_entity_id: string | null;
  error_json: string | null;
  started_at: string | null;
  completed_at: string | null;
  snapshot_json: string;
};

type FactoryOutputRow = {
  id: string;
  work_order_id: string;
  stage_run_id: string | null;
  entity_kind: StageResultEntityKind;
  supersedes_entity_id: string | null;
  created_at: string;
  payload_json: string;
};

type FactoryCheckpointRow = {
  id: string;
  work_order_id: string;
  stage_run_id: string | null;
  resume_from_stage_key: string;
  reason: string;
  created_at: string;
  consumed_at: string | null;
  snapshot_json: string;
};

type FactoryEventRow = {
  id: string;
  work_order_id: string;
  stage_run_id: string | null;
  sequence: number;
  event_type: string;
  payload_json: string;
  created_at: string;
};

function assertValid<T>(label: string, errors: string[], entity?: T): T {
  if (errors.length > 0) {
    throw new Error(`${label} is invalid: ${errors.join(" ")}`);
  }
  return entity as T;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function deriveCurrentStageKey(workOrder: WorkOrder): string | null {
  const runningStage = workOrder.stageRuns.find((stageRun) => stageRun.status === "running");
  if (runningStage) {
    return runningStage.stageKey;
  }

  if (workOrder.status === "paused") {
    return workOrder.pausedState?.resumeFromStageKey ?? null;
  }

  return null;
}

function getOutputEntityId(seed: FactoryOutputSeed): string {
  return seed.entity.id;
}

function getOutputCreatedAt(seed: FactoryOutputSeed): string {
  switch (seed.entityKind) {
    case "research_packet":
      return seed.entity.searchTimestamp;
    case "draft":
      return seed.entity.createdAt;
    case "asset":
      return seed.entity.generatedAt;
    case "composition":
      return seed.entity.createdAt;
    case "qa_report":
      return seed.entity.createdAt;
    case "release":
      return seed.entity.releasedAt;
    case "outcome":
      return seed.entity.observedAt;
  }
}

function mapOutputPayload(kind: StageResultEntityKind, payloadJson: string): FactoryOutputEntity {
  switch (kind) {
    case "research_packet":
      return parseJson<ResearchPacket>(payloadJson);
    case "draft":
      return parseJson<Draft>(payloadJson);
    case "asset":
      return parseJson<FactoryAsset>(payloadJson);
    case "composition":
      return parseJson<Composition>(payloadJson);
    case "qa_report":
      return parseJson<QAReport>(payloadJson);
    case "release":
      return parseJson<Release>(payloadJson);
    case "outcome":
      return parseJson<Outcome>(payloadJson);
  }
}

function mapOutputRecord(row: FactoryOutputRow): FactoryOutputRecord {
  return {
    entityId: row.id,
    entityKind: row.entity_kind,
    workOrderId: row.work_order_id,
    stageRunId: row.stage_run_id,
    supersedesEntityId: row.supersedes_entity_id,
    createdAt: row.created_at,
    payload: mapOutputPayload(row.entity_kind, row.payload_json),
  };
}

function mapCheckpointRecord(row: FactoryCheckpointRow): FactoryCheckpointRecord {
  return {
    checkpointId: row.id,
    workOrderId: row.work_order_id,
    stageRunId: row.stage_run_id,
    pauseState: parseJson<WorkOrderPauseState>(row.snapshot_json),
    resumeFromStageKey: row.resume_from_stage_key,
    createdAt: row.created_at,
    consumedAt: row.consumed_at,
  };
}

function mapEventRecord(row: FactoryEventRow): FactoryEventRecord {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    stageRunId: row.stage_run_id,
    sequence: row.sequence,
    eventType: row.event_type,
    payload: parseJson<Record<string, unknown>>(row.payload_json),
    createdAt: row.created_at,
  };
}

export class FactoryDataMapper implements FactoryRepository {
  constructor(private readonly db: Database.Database) {}

  async createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    assertValid("WorkOrder", listWorkOrderValidationErrors(workOrder), workOrder);

    const insert = this.db.transaction((entity: WorkOrder) => {
      this.db.prepare(
        `INSERT INTO factory_work_orders (
          id, user_id, conversation_id, status, current_dag_id, current_stage_key,
          active_checkpoint_id, created_at, started_at, completed_at, paused_at, snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      ).run(
        entity.id,
        entity.userId,
        entity.conversationId ?? null,
        entity.status,
        entity.currentDag.id,
        deriveCurrentStageKey(entity),
        entity.createdAt,
        entity.startedAt ?? null,
        entity.completedAt ?? null,
        entity.pausedState?.pausedAt ?? null,
        JSON.stringify(entity),
      );

      this.replaceWorkOrderParentsSync(entity.id, entity.previousWorkOrderIds);
    });

    insert(workOrder);
    return (await this.findWorkOrderById(workOrder.id)) as WorkOrder;
  }

  async updateWorkOrder(workOrder: WorkOrder): Promise<WorkOrder> {
    assertValid("WorkOrder", listWorkOrderValidationErrors(workOrder), workOrder);

    const update = this.db.transaction((entity: WorkOrder) => {
      const existing = this.getRequiredWorkOrderRow(entity.id);

      this.db.prepare(
        `UPDATE factory_work_orders
         SET user_id = ?,
             conversation_id = ?,
             status = ?,
             current_dag_id = ?,
             current_stage_key = ?,
             active_checkpoint_id = ?,
             created_at = ?,
             started_at = ?,
             completed_at = ?,
             paused_at = ?,
             snapshot_json = ?
         WHERE id = ?`,
      ).run(
        entity.userId,
        entity.conversationId ?? null,
        entity.status,
        entity.currentDag.id,
        deriveCurrentStageKey(entity),
        existing.active_checkpoint_id,
        entity.createdAt,
        entity.startedAt ?? null,
        entity.completedAt ?? null,
        entity.pausedState?.pausedAt ?? null,
        JSON.stringify(entity),
        entity.id,
      );

      this.replaceWorkOrderParentsSync(entity.id, entity.previousWorkOrderIds);
    });

    update(workOrder);
    return (await this.findWorkOrderById(workOrder.id)) as WorkOrder;
  }

  async findWorkOrderById(id: string): Promise<WorkOrder | null> {
    const row = this.db.prepare(
      `SELECT * FROM factory_work_orders WHERE id = ?`,
    ).get(id) as FactoryWorkOrderRow | undefined;

    if (!row) {
      return null;
    }

    return this.hydrateWorkOrderRow(row);
  }

  async listWorkOrdersByUser(
    userId: string,
    options?: { statuses?: WorkOrderStatus[]; limit?: number },
  ): Promise<WorkOrder[]> {
    const statuses = options?.statuses ?? [];
    const limit = options?.limit ?? 25;
    let rows: FactoryWorkOrderRow[];

    if (statuses.length > 0) {
      const placeholders = statuses.map(() => "?").join(", ");
      rows = this.db.prepare(
        `SELECT * FROM factory_work_orders
         WHERE user_id = ? AND status IN (${placeholders})
         ORDER BY created_at DESC
         LIMIT ?`,
      ).all(userId, ...statuses, limit) as FactoryWorkOrderRow[];
    } else {
      rows = this.db.prepare(
        `SELECT * FROM factory_work_orders
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      ).all(userId, limit) as FactoryWorkOrderRow[];
    }

    return Promise.all(rows.map((row) => this.hydrateWorkOrderRow(row)));
  }

  async saveProductionDAG(workOrderId: string, dag: ProductionDAG): Promise<void> {
    assertValid("ProductionDAG", listProductionDAGValidationErrors(dag), dag);
    const workOrder = this.getRequiredWorkOrderRow(workOrderId);
    const workOrderSnapshot = parseJson<WorkOrder>(workOrder.snapshot_json);

    if (workOrderSnapshot.briefId !== dag.briefId) {
      throw new Error("ProductionDAG.briefId must match the owning WorkOrder.briefId.");
    }

    this.db.prepare(
      `INSERT INTO factory_production_dags (
        id, work_order_id, dag_version, generated_at, snapshot_json
      ) VALUES (?, ?, ?, ?, ?)`,
    ).run(dag.id, workOrderId, dag.version, dag.generatedAt, JSON.stringify(dag));

    this.db.prepare(
      `UPDATE factory_work_orders SET current_dag_id = ? WHERE id = ?`,
    ).run(dag.id, workOrderId);
  }

  async findProductionDAGById(id: string): Promise<ProductionDAG | null> {
    const row = this.db.prepare(
      `SELECT * FROM factory_production_dags WHERE id = ?`,
    ).get(id) as FactoryProductionDAGRow | undefined;

    return row ? parseJson<ProductionDAG>(row.snapshot_json) : null;
  }

  async findCurrentProductionDAGForWorkOrder(workOrderId: string): Promise<ProductionDAG | null> {
    const workOrder = this.getRequiredWorkOrderRow(workOrderId);

    if (workOrder.current_dag_id) {
      return this.findProductionDAGById(workOrder.current_dag_id);
    }

    const row = this.db.prepare(
      `SELECT * FROM factory_production_dags
       WHERE work_order_id = ?
       ORDER BY dag_version DESC
       LIMIT 1`,
    ).get(workOrderId) as FactoryProductionDAGRow | undefined;

    return row ? parseJson<ProductionDAG>(row.snapshot_json) : null;
  }

  async replaceWorkOrderParents(workOrderId: string, parentIds: readonly string[]): Promise<void> {
    this.getRequiredWorkOrderRow(workOrderId);
    this.replaceWorkOrderParentsSync(workOrderId, parentIds);
  }

  async listParentWorkOrderIds(workOrderId: string): Promise<string[]> {
    const rows = this.db.prepare(
      `SELECT parent_work_order_id FROM factory_work_order_parents
       WHERE work_order_id = ?
       ORDER BY ordinal ASC`,
    ).all(workOrderId) as Array<{ parent_work_order_id: string }>;

    return rows.map((row) => row.parent_work_order_id);
  }

  async upsertStageRun(workOrderId: string, stageRun: StageRunRecord): Promise<StageRunRecord> {
    assertValid("StageRunRecord", listStageRunRecordValidationErrors(stageRun), stageRun);
    this.getRequiredWorkOrderRow(workOrderId);

    const currentDag = await this.findCurrentProductionDAGForWorkOrder(workOrderId);
    const stage = currentDag ? getStageByKey(currentDag, stageRun.stageKey) : undefined;

    if (!stage) {
      throw new Error(`StageRunRecord.stageKey ${stageRun.stageKey} is not part of the current ProductionDAG.`);
    }

    if (stageRun.resultRef) {
      const output = await this.findOutputById(stageRun.resultRef.entityId);
      if (!output) {
        throw new Error(`StageRunRecord.resultRef.entityId ${stageRun.resultRef.entityId} was not found.`);
      }
      if (output.workOrderId !== workOrderId) {
        throw new Error("StageRunRecord.resultRef must reference an output in the same work order.");
      }
      if (output.entityKind !== stageRun.resultRef.entityKind) {
        throw new Error("StageRunRecord.resultRef.entityKind must match the referenced output entity kind.");
      }
    }

    const existing = this.db.prepare(
      `SELECT * FROM factory_stage_runs WHERE work_order_id = ? AND stage_key = ?`,
    ).get(workOrderId, stageRun.stageKey) as FactoryStageRunRow | undefined;

    if (existing && existing.id !== stageRun.id) {
      throw new Error(`Stage run ${stageRun.stageKey} already exists with durable id ${existing.id}.`);
    }

    this.db.prepare(
      `INSERT INTO factory_stage_runs (
        id, work_order_id, stage_key, stage_kind, status, attempt_count,
        result_entity_kind, result_entity_id, error_json, started_at, completed_at, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(work_order_id, stage_key) DO UPDATE SET
        id = excluded.id,
        stage_kind = excluded.stage_kind,
        status = excluded.status,
        attempt_count = excluded.attempt_count,
        result_entity_kind = excluded.result_entity_kind,
        result_entity_id = excluded.result_entity_id,
        error_json = excluded.error_json,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        snapshot_json = excluded.snapshot_json`,
    ).run(
      stageRun.id,
      workOrderId,
      stageRun.stageKey,
      stage.kind,
      stageRun.status,
      stageRun.attemptCount,
      stageRun.resultRef?.entityKind ?? null,
      stageRun.resultRef?.entityId ?? null,
      stageRun.errorCode || stageRun.errorMessage
        ? JSON.stringify({ errorCode: stageRun.errorCode, errorMessage: stageRun.errorMessage })
        : null,
      stageRun.startedAt ?? null,
      stageRun.completedAt ?? null,
      JSON.stringify(stageRun),
    );

    const row = this.db.prepare(
      `SELECT * FROM factory_stage_runs WHERE id = ?`,
    ).get(stageRun.id) as FactoryStageRunRow;

    return parseJson<StageRunRecord>(row.snapshot_json);
  }

  async listStageRunsForWorkOrder(workOrderId: string): Promise<StageRunRecord[]> {
    const rows = this.db.prepare(
      `SELECT * FROM factory_stage_runs WHERE work_order_id = ?`,
    ).all(workOrderId) as FactoryStageRunRow[];

    const stageRuns = rows.map((row) => parseJson<StageRunRecord>(row.snapshot_json));
    const currentDag = await this.findCurrentProductionDAGForWorkOrder(workOrderId);

    if (!currentDag) {
      return stageRuns.sort((left, right) => left.stageKey.localeCompare(right.stageKey));
    }

    const stageOrder = new Map(currentDag.stages.map((stage, index) => [stage.key, index]));
    return stageRuns.sort(
      (left, right) => (stageOrder.get(left.stageKey) ?? Number.MAX_SAFE_INTEGER) - (stageOrder.get(right.stageKey) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  async appendOutput(seed: FactoryOutputSeed): Promise<FactoryOutputRecord> {
    await this.assertValidOutputSeed(seed);

    const entityId = getOutputEntityId(seed);
    const createdAt = getOutputCreatedAt(seed);

    this.db.prepare(
      `INSERT INTO factory_outputs (
        id, work_order_id, stage_run_id, entity_kind, supersedes_entity_id, created_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      entityId,
      seed.workOrderId,
      seed.stageRunId ?? null,
      seed.entityKind,
      seed.supersedesEntityId ?? null,
      createdAt,
      JSON.stringify(seed.entity),
    );

    if (seed.entityKind === "composition") {
      seed.entity.embeddedAssetIds.forEach((assetId, ordinal) => {
        this.db.prepare(
          `INSERT INTO factory_composition_assets (composition_id, asset_id, ordinal) VALUES (?, ?, ?)`,
        ).run(seed.entity.id, assetId, ordinal);
      });
    }

    return (await this.findOutputById(entityId)) as FactoryOutputRecord;
  }

  async findOutputById(entityId: string): Promise<FactoryOutputRecord | null> {
    const row = this.db.prepare(
      `SELECT * FROM factory_outputs WHERE id = ?`,
    ).get(entityId) as FactoryOutputRow | undefined;

    return row ? mapOutputRecord(row) : null;
  }

  async listOutputsForWorkOrder(
    workOrderId: string,
    entityKind?: StageResultEntityKind,
  ): Promise<FactoryOutputRecord[]> {
    const rows = entityKind
      ? (this.db.prepare(
          `SELECT * FROM factory_outputs
           WHERE work_order_id = ? AND entity_kind = ?
           ORDER BY created_at ASC`,
        ).all(workOrderId, entityKind) as FactoryOutputRow[])
      : (this.db.prepare(
          `SELECT * FROM factory_outputs
           WHERE work_order_id = ?
           ORDER BY created_at ASC`,
        ).all(workOrderId) as FactoryOutputRow[]);

    return rows.map(mapOutputRecord);
  }

  async createCheckpoint(input: {
    checkpointId: string;
    workOrderId: string;
    stageRunId?: string;
    pauseState: WorkOrderPauseState;
    resumeFromStageKey: string;
    createdAt: string;
  }): Promise<FactoryCheckpointRecord> {
    this.getRequiredWorkOrderRow(input.workOrderId);
    this.assertValidPauseState(input.pauseState, input.resumeFromStageKey, input.createdAt);

    if (input.stageRunId) {
      this.getRequiredStageRunRow(input.stageRunId, input.workOrderId);
    }

    this.db.prepare(
      `INSERT INTO factory_checkpoints (
        id, work_order_id, stage_run_id, resume_from_stage_key, reason, created_at, consumed_at, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(
      input.checkpointId,
      input.workOrderId,
      input.stageRunId ?? null,
      input.resumeFromStageKey,
      input.pauseState.reason,
      input.createdAt,
      JSON.stringify(input.pauseState),
    );

    this.db.prepare(
      `UPDATE factory_work_orders
       SET active_checkpoint_id = ?, current_stage_key = ?, paused_at = ?
       WHERE id = ?`,
    ).run(input.checkpointId, input.resumeFromStageKey, input.pauseState.pausedAt, input.workOrderId);

    const row = this.db.prepare(
      `SELECT * FROM factory_checkpoints WHERE id = ?`,
    ).get(input.checkpointId) as FactoryCheckpointRow;

    return mapCheckpointRecord(row);
  }

  async findLatestActiveCheckpoint(workOrderId: string): Promise<FactoryCheckpointRecord | null> {
    const row = this.db.prepare(
      `SELECT * FROM factory_checkpoints
       WHERE work_order_id = ? AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    ).get(workOrderId) as FactoryCheckpointRow | undefined;

    return row ? mapCheckpointRecord(row) : null;
  }

  async markCheckpointConsumed(checkpointId: string, consumedAt: string): Promise<void> {
    if (!isValidTimestamp(consumedAt)) {
      throw new Error("Checkpoint consumedAt must be a valid timestamp.");
    }

    const checkpoint = this.db.prepare(
      `SELECT * FROM factory_checkpoints WHERE id = ?`,
    ).get(checkpointId) as FactoryCheckpointRow | undefined;

    if (!checkpoint || checkpoint.consumed_at !== null) {
      throw new Error(`Active checkpoint not found: ${checkpointId}`);
    }

    this.db.prepare(
      `UPDATE factory_checkpoints SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
    ).run(consumedAt, checkpointId);

    this.db.prepare(
      `UPDATE factory_work_orders
       SET active_checkpoint_id = CASE WHEN active_checkpoint_id = ? THEN NULL ELSE active_checkpoint_id END
       WHERE id = ?`,
    ).run(checkpointId, checkpoint.work_order_id);
  }

  async appendEvent(input: {
    id?: string;
    workOrderId: string;
    stageRunId?: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }): Promise<FactoryEventRecord> {
    this.getRequiredWorkOrderRow(input.workOrderId);

    if (input.stageRunId) {
      this.getRequiredStageRunRow(input.stageRunId, input.workOrderId);
    }

    if (!isNonEmptyTrimmedString(input.eventType)) {
      throw new Error("Factory eventType must be a non-empty string.");
    }
    if (!isValidTimestamp(input.createdAt)) {
      throw new Error("Factory event createdAt must be a valid timestamp.");
    }

    const nextSequence = ((this.db.prepare(
      `SELECT COALESCE(MAX(sequence), 0) AS sequence FROM factory_events WHERE work_order_id = ?`,
    ).get(input.workOrderId) as { sequence: number }).sequence) + 1;

    const eventId = input.id ?? `factoryevent_${randomUUID()}`;

    this.db.prepare(
      `INSERT INTO factory_events (
        id, work_order_id, stage_run_id, sequence, event_type, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      eventId,
      input.workOrderId,
      input.stageRunId ?? null,
      nextSequence,
      input.eventType,
      JSON.stringify(input.payload),
      input.createdAt,
    );

    const row = this.db.prepare(
      `SELECT * FROM factory_events WHERE id = ?`,
    ).get(eventId) as FactoryEventRow;

    return mapEventRecord(row);
  }

  async listEventsForWorkOrder(workOrderId: string): Promise<FactoryEventRecord[]> {
    const rows = this.db.prepare(
      `SELECT * FROM factory_events WHERE work_order_id = ? ORDER BY sequence ASC`,
    ).all(workOrderId) as FactoryEventRow[];

    return rows.map(mapEventRecord);
  }

  private async hydrateWorkOrderRow(row: FactoryWorkOrderRow): Promise<WorkOrder> {
    const workOrder = parseJson<WorkOrder>(row.snapshot_json);
    const parentIds = this.db.prepare(
      `SELECT parent_work_order_id FROM factory_work_order_parents
       WHERE work_order_id = ?
       ORDER BY ordinal ASC`,
    ).all(row.id) as Array<{ parent_work_order_id: string }>;

    const currentDag = row.current_dag_id
      ? await this.findProductionDAGById(row.current_dag_id)
      : workOrder.currentDag;

    const stageRuns = await this.listStageRunsForWorkOrder(row.id);

    let pausedState = workOrder.pausedState;
    if (row.active_checkpoint_id) {
      const checkpointRow = this.db.prepare(
        `SELECT * FROM factory_checkpoints WHERE id = ?`,
      ).get(row.active_checkpoint_id) as FactoryCheckpointRow | undefined;

      if (checkpointRow && checkpointRow.consumed_at === null) {
        pausedState = parseJson<WorkOrderPauseState>(checkpointRow.snapshot_json);
      }
    } else if (row.status !== "paused") {
      pausedState = undefined;
    }

    return {
      ...workOrder,
      status: row.status,
      currentDag: currentDag ?? workOrder.currentDag,
      stageRuns,
      previousWorkOrderIds: parentIds.map((parent) => parent.parent_work_order_id),
      pausedState,
      createdAt: row.created_at,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
    };
  }

  private getRequiredWorkOrderRow(id: string): FactoryWorkOrderRow {
    const row = this.db.prepare(
      `SELECT * FROM factory_work_orders WHERE id = ?`,
    ).get(id) as FactoryWorkOrderRow | undefined;

    if (!row) {
      throw new Error(`Factory work order not found: ${id}`);
    }

    return row;
  }

  private getRequiredStageRunRow(stageRunId: string, workOrderId: string): FactoryStageRunRow {
    const row = this.db.prepare(
      `SELECT * FROM factory_stage_runs WHERE id = ?`,
    ).get(stageRunId) as FactoryStageRunRow | undefined;

    if (!row) {
      throw new Error(`Factory stage run not found: ${stageRunId}`);
    }
    if (row.work_order_id !== workOrderId) {
      throw new Error(`Factory stage run ${stageRunId} does not belong to work order ${workOrderId}.`);
    }

    return row;
  }

  private replaceWorkOrderParentsSync(workOrderId: string, parentIds: readonly string[]): void {
    const uniqueParentIds = new Set(parentIds);
    if (uniqueParentIds.size !== parentIds.length) {
      throw new Error("WorkOrder.previousWorkOrderIds cannot contain duplicates.");
    }
    if (parentIds.includes(workOrderId)) {
      throw new Error("WorkOrder cannot reference itself as a parent.");
    }

    for (const parentId of parentIds) {
      this.getRequiredWorkOrderRow(parentId);
    }

    this.db.prepare(`DELETE FROM factory_work_order_parents WHERE work_order_id = ?`).run(workOrderId);

    parentIds.forEach((parentId, ordinal) => {
      this.db.prepare(
        `INSERT INTO factory_work_order_parents (
          work_order_id, parent_work_order_id, ordinal, relationship_kind
        ) VALUES (?, ?, ?, 'revision_parent')`,
      ).run(workOrderId, parentId, ordinal);
    });
  }

  private async assertValidOutputSeed(seed: FactoryOutputSeed): Promise<void> {
    this.getRequiredWorkOrderRow(seed.workOrderId);

    const outputErrors = this.listOutputValidationErrors(seed);
    assertValid("Factory output", outputErrors);

    if (seed.stageRunId) {
      this.getRequiredStageRunRow(seed.stageRunId, seed.workOrderId);
    }

    if (seed.supersedesEntityId) {
      const priorOutput = await this.findOutputById(seed.supersedesEntityId);
      if (!priorOutput) {
        throw new Error(`Superseded output not found: ${seed.supersedesEntityId}`);
      }
      if (priorOutput.workOrderId !== seed.workOrderId) {
        throw new Error("Superseded output must belong to the same work order.");
      }
      if (priorOutput.entityKind !== seed.entityKind) {
        throw new Error("Superseded output must have the same entity kind.");
      }
    }

    switch (seed.entityKind) {
      case "research_packet":
        if (seed.entity.workOrderId !== seed.workOrderId) {
          throw new Error("ResearchPacket.workOrderId must match the owning work order.");
        }
        return;
      case "draft":
        if (seed.entity.workOrderId !== seed.workOrderId) {
          throw new Error("Draft.workOrderId must match the owning work order.");
        }
        if (seed.entity.sourceResearchPacketId) {
          await this.assertOutputExists(seed.entity.sourceResearchPacketId, "research_packet", seed.workOrderId);
        }
        return;
      case "asset":
        if (seed.entity.workOrderId !== seed.workOrderId) {
          throw new Error("FactoryAsset.workOrderId must match the owning work order.");
        }
        if (seed.entity.provenance.previousAssetId) {
          await this.assertOutputExists(seed.entity.provenance.previousAssetId, "asset", seed.workOrderId);
        }
        for (const sourceAssetId of seed.entity.provenance.sourceAssetIds ?? []) {
          await this.assertOutputExists(sourceAssetId, "asset", seed.workOrderId);
        }
        return;
      case "composition":
        if (seed.entity.workOrderId !== seed.workOrderId) {
          throw new Error("Composition.workOrderId must match the owning work order.");
        }
        await this.assertOutputExists(seed.entity.provenance.draftId, "draft", seed.workOrderId);
        for (const assetId of seed.entity.embeddedAssetIds) {
          await this.assertOutputExists(assetId, "asset", seed.workOrderId);
        }
        return;
      case "qa_report":
        for (const assetReport of seed.entity.assetReports) {
          await this.assertOutputExists(assetReport.assetId, "asset", seed.workOrderId);
        }
        return;
      case "release":
        if (seed.entity.workOrderId !== seed.workOrderId) {
          throw new Error("Release.workOrderId must match the owning work order.");
        }
        await this.assertOutputExists(seed.entity.compositionId, "composition", seed.workOrderId);
        return;
      case "outcome":
        if (seed.entity.workOrderId !== seed.workOrderId) {
          throw new Error("Outcome.workOrderId must match the owning work order.");
        }
        await this.assertOutputExists(seed.entity.releaseId, "release", seed.workOrderId);
        return;
    }
  }

  private listOutputValidationErrors(seed: FactoryOutputSeed): string[] {
    switch (seed.entityKind) {
      case "research_packet":
        return listResearchPacketValidationErrors(seed.entity);
      case "draft":
        return listDraftValidationErrors(seed.entity);
      case "asset":
        return listFactoryAssetValidationErrors(seed.entity);
      case "composition":
        return listCompositionValidationErrors(seed.entity);
      case "qa_report":
        return listQAReportValidationErrors(seed.entity);
      case "release":
        return listReleaseValidationErrors(seed.entity);
      case "outcome":
        return listOutcomeValidationErrors(seed.entity);
    }
  }

  private async assertOutputExists(entityId: string, entityKind: StageResultEntityKind, workOrderId: string): Promise<void> {
    const output = await this.findOutputById(entityId);
    if (!output) {
      throw new Error(`Referenced output not found: ${entityId}`);
    }
    if (output.entityKind !== entityKind) {
      throw new Error(`Referenced output ${entityId} must be of kind ${entityKind}.`);
    }
    if (output.workOrderId !== workOrderId) {
      throw new Error(`Referenced output ${entityId} must belong to work order ${workOrderId}.`);
    }
  }

  private assertValidPauseState(pauseState: WorkOrderPauseState, resumeFromStageKey: string, createdAt: string): void {
    if (!isValidTimestamp(pauseState.pausedAt)) {
      throw new Error("WorkOrderPauseState.pausedAt must be a valid timestamp.");
    }
    if (!isNonEmptyTrimmedString(pauseState.reason)) {
      throw new Error("WorkOrderPauseState.reason must be a non-empty string.");
    }
    if (!isNonEmptyTrimmedString(pauseState.resumeFromStageKey)) {
      throw new Error("WorkOrderPauseState.resumeFromStageKey must be a non-empty string.");
    }
    if (pauseState.resumeFromStageKey !== resumeFromStageKey) {
      throw new Error("Checkpoint resumeFromStageKey must match the pause state.");
    }
    if (!isValidTimestamp(createdAt)) {
      throw new Error("Checkpoint.createdAt must be a valid timestamp.");
    }
  }
}