import { getStageByKey } from "@/core/entities/production-dag";
import type { Draft } from "@/core/entities/draft";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { FactoryOutputRecord } from "@/core/use-cases/FactoryRepository";
import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";

import { createFactoryProductionRoot } from "./factory-production-root";
import { AssetRefinementService } from "./asset-refinement-service";
import { PauseWorkOrderService } from "./pause-work-order-service";
import { FactoryResumeFrontierPlanner } from "./resume-frontier-planner";
import { ResumeWorkOrderService } from "./resume-work-order-service";
import { FactoryRevisionControlService } from "./revision-control-service";

function findLatestActiveOutput(
  outputs: readonly FactoryOutputRecord[],
  entityKind: FactoryOutputRecord["entityKind"],
): FactoryOutputRecord | null {
  const records = outputs.filter((output) => output.entityKind === entityKind);
  const supersededIds = new Set(records.flatMap((record) => record.supersedesEntityId ? [record.supersedesEntityId] : []));

  return records.filter((record) => !supersededIds.has(record.entityId)).at(-1) ?? null;
}

export function createFactoryRevisionRoot() {
  const productionRoot = createFactoryProductionRoot();
  const frontierPlanner = new FactoryResumeFrontierPlanner();
  const pauseWorkOrderService = new PauseWorkOrderService({
    repository: productionRoot.repository,
  });
  const assetRefinementService = new AssetRefinementService({
    repository: productionRoot.repository,
    frontierPlanner,
    userFileRepository: getUserFileDataMapper(),
    regenerateAsset: async ({ workOrderId, asset, brief, parameterOverrides }) => {
      const workOrder = await productionRoot.repository.findWorkOrderById(workOrderId);
      if (!workOrder) {
        throw new Error(`Factory work order not found: ${workOrderId}`);
      }

      const stage = getStageByKey(workOrder.currentDag, asset.provenance.stageKey);
      if (!stage || stage.config?.kind !== "asset_generation") {
        throw new Error(`Asset ${asset.id} does not reference a valid asset-generation stage.`);
      }

      const handler = productionRoot.assetHandlers[asset.kind];
      if (!handler) {
        throw new Error(`No asset generation handler registered for ${asset.kind}.`);
      }

      const outputs = await productionRoot.repository.listOutputsForWorkOrder(workOrderId);
      const draftRecord = findLatestActiveOutput(outputs, "draft");
      if (!draftRecord) {
        throw new Error(`Work order ${workOrderId} does not have an active draft output.`);
      }

      const draft = draftRecord.payload as Draft;
      return handler({
        briefTitle: brief.title,
        topic: brief.topic,
        draft,
        assetKind: asset.kind,
        assetSlot: stage.config.assetSlot,
        parameterOverrides,
      });
    },
  });
  const resumeWorkOrderService = new ResumeWorkOrderService({
    repository: productionRoot.repository,
    orchestrator: productionRoot.orchestrator,
    frontierPlanner,
  });
  const revisionControl = new FactoryRevisionControlService({
    assetRefinementService,
    pauseWorkOrderService,
    resumeWorkOrderService,
  });

  return {
    ...productionRoot,
    frontierPlanner,
    pauseWorkOrderService,
    assetRefinementService,
    resumeWorkOrderService,
    revisionControl,
  };
}