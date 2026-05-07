import type { Composition } from "@/core/entities/composition";
import type { Draft } from "@/core/entities/draft";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductionDAG } from "@/core/entities/production-dag";
import type { Outcome } from "@/core/entities/outcome";
import type { QAReport } from "@/core/entities/qa-report";
import type { Release } from "@/core/entities/release";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { StageRunRecord, StageResultEntityKind } from "@/core/entities/stage-run-record";
import type { WorkOrder, WorkOrderPauseState } from "@/core/entities/work-order";
import type { WorkOrderStatus } from "@/core/entities/factory-constants";

export type FactoryOutputEntity =
  | ResearchPacket
  | Draft
  | FactoryAsset
  | Composition
  | QAReport
  | Release
  | Outcome;

export type FactoryOutputSeed =
  | {
      entityKind: "research_packet";
      entity: ResearchPacket;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    }
  | {
      entityKind: "draft";
      entity: Draft;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    }
  | {
      entityKind: "asset";
      entity: FactoryAsset;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    }
  | {
      entityKind: "composition";
      entity: Composition;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    }
  | {
      entityKind: "qa_report";
      entity: QAReport;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    }
  | {
      entityKind: "release";
      entity: Release;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    }
  | {
      entityKind: "outcome";
      entity: Outcome;
      workOrderId: string;
      stageRunId?: string;
      supersedesEntityId?: string;
    };

export interface FactoryOutputRecord {
  entityId: string;
  entityKind: StageResultEntityKind;
  workOrderId: string;
  stageRunId: string | null;
  supersedesEntityId: string | null;
  createdAt: string;
  payload: FactoryOutputEntity;
}

export interface FactoryCheckpointRecord {
  checkpointId: string;
  workOrderId: string;
  stageRunId: string | null;
  pauseState: WorkOrderPauseState;
  resumeFromStageKey: string;
  createdAt: string;
  consumedAt: string | null;
}

export interface FactoryEventRecord {
  id: string;
  workOrderId: string;
  stageRunId: string | null;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FactoryRepository {
  createWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;
  updateWorkOrder(workOrder: WorkOrder): Promise<WorkOrder>;
  findWorkOrderById(id: string): Promise<WorkOrder | null>;
  findWorkOrderByOperationId(operationId: string): Promise<WorkOrder | null>;
  listWorkOrdersByUser(
    userId: string,
    options?: { statuses?: WorkOrderStatus[]; limit?: number },
  ): Promise<WorkOrder[]>;

  saveProductionDAG(workOrderId: string, dag: ProductionDAG): Promise<void>;
  findProductionDAGById(id: string): Promise<ProductionDAG | null>;
  findCurrentProductionDAGForWorkOrder(workOrderId: string): Promise<ProductionDAG | null>;

  replaceWorkOrderParents(workOrderId: string, parentIds: readonly string[]): Promise<void>;
  listParentWorkOrderIds(workOrderId: string): Promise<string[]>;

  upsertStageRun(workOrderId: string, stageRun: StageRunRecord): Promise<StageRunRecord>;
  listStageRunsForWorkOrder(workOrderId: string): Promise<StageRunRecord[]>;

  appendOutput(seed: FactoryOutputSeed): Promise<FactoryOutputRecord>;
  findOutputById(entityId: string): Promise<FactoryOutputRecord | null>;
  listOutputsForWorkOrder(
    workOrderId: string,
    entityKind?: StageResultEntityKind,
  ): Promise<FactoryOutputRecord[]>;

  createCheckpoint(input: {
    checkpointId: string;
    workOrderId: string;
    stageRunId?: string;
    pauseState: WorkOrderPauseState;
    resumeFromStageKey: string;
    createdAt: string;
  }): Promise<FactoryCheckpointRecord>;
  findLatestActiveCheckpoint(workOrderId: string): Promise<FactoryCheckpointRecord | null>;
  markCheckpointConsumed(checkpointId: string, consumedAt: string): Promise<void>;

  appendEvent(input: {
    id?: string;
    workOrderId: string;
    stageRunId?: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }): Promise<FactoryEventRecord>;
  listEventsForWorkOrder(workOrderId: string): Promise<FactoryEventRecord[]>;
}
