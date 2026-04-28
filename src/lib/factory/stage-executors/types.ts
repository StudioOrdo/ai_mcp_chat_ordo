import type { Composition } from "@/core/entities/composition";
import type { Draft } from "@/core/entities/draft";
import type { StageKind } from "@/core/entities/factory-constants";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { QAReport } from "@/core/entities/qa-report";
import type { Release } from "@/core/entities/release";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { ProductionStage } from "@/core/entities/production-stage";
import type { StageRunRecord, StageResultEntityKind } from "@/core/entities/stage-run-record";
import type { WorkOrder } from "@/core/entities/work-order";
import type { FactoryOutputEntity, FactoryOutputRecord } from "@/core/use-cases/FactoryRepository";

export interface StageExecutionContext {
  workOrder: WorkOrder;
  brief: ProductBrief;
  stage: ProductionStage;
  priorStageRuns: readonly StageRunRecord[];
  resolvedInputs: {
    outputsByStageKey: ReadonlyMap<string, FactoryOutputRecord[]>;
  };
  abortSignal?: AbortSignal;
  emitProgress?: (payload: Record<string, unknown>) => Promise<void>;
}

export interface StageExecutionResult {
  entityKind: StageResultEntityKind;
  entity: FactoryOutputEntity;
  supersedesEntityId?: string;
  supplementalOutputs?: readonly {
    entityKind: StageResultEntityKind;
    entity: FactoryOutputEntity;
    supersedesEntityId?: string;
  }[];
  executionDetails?: Record<string, unknown>;
}

export interface StageExecutor {
  readonly kind: StageKind;
  execute(context: StageExecutionContext): Promise<StageExecutionResult>;
}

export function requireOutputRecord(
  context: StageExecutionContext,
  stageKey: string,
): FactoryOutputRecord {
  const records = context.resolvedInputs.outputsByStageKey.get(stageKey) ?? [];
  const latest = records.at(-1);

  if (!latest) {
    throw new Error(`Required stage output was not found for ${stageKey}.`);
  }

  return latest;
}

export function requireEntity<TEntity extends FactoryOutputEntity>(
  context: StageExecutionContext,
  stageKey: string,
  entityKind: StageExecutionResult["entityKind"],
): TEntity {
  const record = (context.resolvedInputs.outputsByStageKey.get(stageKey) ?? [])
    .filter((candidate) => candidate.entityKind === entityKind)
    .at(-1);

  if (!record) {
    throw new Error(`Stage ${stageKey} must provide a ${entityKind} output.`);
  }

  return record.payload as TEntity;
}

export function requireResearchPacket(context: StageExecutionContext, stageKey = "research"): ResearchPacket {
  return requireEntity<ResearchPacket>(context, stageKey, "research_packet");
}

export function requireDraft(context: StageExecutionContext, stageKey = "draft"): Draft {
  return requireEntity<Draft>(context, stageKey, "draft");
}

export function listAssets(context: StageExecutionContext): FactoryAsset[] {
  const records = [...context.resolvedInputs.outputsByStageKey.values()]
    .flat()
    .filter((record) => record.entityKind === "asset");
  const supersededIds = new Set(records.flatMap((record) => record.supersedesEntityId ? [record.supersedesEntityId] : []));

  return records
    .filter((record) => !supersededIds.has(record.entityId))
    .map((record) => record.payload as FactoryAsset);
}

export function requireComposition(context: StageExecutionContext, stageKey = "composition"): Composition {
  return requireEntity<Composition>(context, stageKey, "composition");
}

export function requireCurrentComposition(context: StageExecutionContext): Composition {
  const compositions = [...context.resolvedInputs.outputsByStageKey.values()]
    .flat()
    .filter((record) => record.entityKind === "composition");
  const supersededIds = new Set(compositions.flatMap((record) => record.supersedesEntityId ? [record.supersedesEntityId] : []));
  const latest = compositions.filter((record) => !supersededIds.has(record.entityId)).at(-1);

  if (!latest) {
    throw new Error("Required composition output was not found.");
  }

  return latest.payload as Composition;
}

export function requireQAReport(context: StageExecutionContext, stageKey: string): QAReport {
  return requireEntity<QAReport>(context, stageKey, "qa_report");
}

export function requireRelease(context: StageExecutionContext, stageKey = "release"): Release {
  return requireEntity<Release>(context, stageKey, "release");
}
