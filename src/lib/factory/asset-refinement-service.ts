import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { UserFile } from "@/core/entities/user-file";
import type { FactoryOutputRecord, FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { UserFileRepository } from "@/core/use-cases/UserFileRepository";
import { projectUserFileToMediaAssetDescriptor } from "@/lib/media/media-asset-projection";

import {
  FactoryResumeFrontierPlanner,
  type ResumeFrontierPlan,
  type RevisionFrontierMode,
} from "./resume-frontier-planner";

export interface AssetRefinementRequest {
  workOrderId: string;
  assetId: string;
  mode: Exclude<RevisionFrontierMode, "none">;
  requestedBy: string;
  brief?: ProductBrief;
  parameterOverrides?: Record<string, unknown>;
  requestedStageKey?: string;
  userFileId?: string;
}

export interface AssetRefinementResult {
  previousAssetId: string;
  newAssetId: string;
  resumeFromStageKey: string;
}

export interface AssetRegenerationResult {
  label?: FactoryAsset["label"];
  uri?: FactoryAsset["uri"];
  mimeType?: FactoryAsset["mimeType"];
  fileSizeBytes?: FactoryAsset["fileSizeBytes"];
  generationParams?: FactoryAsset["generationParams"];
  generationDurationMs?: FactoryAsset["generationDurationMs"];
}

export interface AssetRefinementServiceOptions {
  repository: FactoryRepository;
  frontierPlanner: FactoryResumeFrontierPlanner;
  userFileRepository?: Pick<UserFileRepository, "findById">;
  now?: () => string;
  idGenerator?: () => string;
  regenerateAsset?: (input: {
    workOrderId: string;
    asset: FactoryAsset;
    brief: ProductBrief;
    parameterOverrides?: Record<string, unknown>;
  }) => Promise<AssetRegenerationResult>;
}

export class AssetRefinementService {
  constructor(private readonly options: AssetRefinementServiceOptions) {}

  async refine(request: AssetRefinementRequest): Promise<AssetRefinementResult> {
    const workOrder = await this.requirePausedWorkOrder(request.workOrderId);
    const checkpoint = await this.options.repository.findLatestActiveCheckpoint(workOrder.id);
    if (!checkpoint) {
      throw new Error(`Paused work order ${workOrder.id} does not have an active checkpoint.`);
    }

    const outputs = await this.options.repository.listOutputsForWorkOrder(workOrder.id);
    const currentAssetRecord = this.requireActiveAssetRecord(outputs, request.assetId, workOrder.id);
    const currentAsset = currentAssetRecord.payload as FactoryAsset;
    const nextAsset = await this.buildRefinedAsset(currentAsset, request);

    await this.options.repository.appendOutput({
      entityKind: "asset",
      entity: nextAsset,
      workOrderId: workOrder.id,
      stageRunId: checkpoint.stageRunId ?? undefined,
      supersedesEntityId: currentAsset.id,
    });

    const plan = this.options.frontierPlanner.plan({
      workOrder,
      outputs: await this.options.repository.listOutputsForWorkOrder(workOrder.id),
      mode: request.mode,
      requestedStageKey: request.requestedStageKey,
    });

    await this.options.repository.appendEvent({
      workOrderId: workOrder.id,
      stageRunId: checkpoint.stageRunId ?? undefined,
      eventType: "revision_asset_refined",
      payload: {
        previousAssetId: currentAsset.id,
        newAssetId: nextAsset.id,
        mode: request.mode,
        requestedBy: request.requestedBy,
        resumeFromStageKey: plan.stageKey,
      },
      createdAt: this.now(),
    });

    await this.persistPausedFrontier(workOrder, checkpoint.stageRunId ?? undefined, plan, request.requestedBy);

    return {
      previousAssetId: currentAsset.id,
      newAssetId: nextAsset.id,
      resumeFromStageKey: plan.stageKey,
    };
  }

  private async buildRefinedAsset(
    currentAsset: FactoryAsset,
    request: AssetRefinementRequest,
  ): Promise<FactoryAsset> {
    const baseAsset: FactoryAsset = {
      ...currentAsset,
      id: `asset_${this.id()}`,
      generatedAt: this.now(),
      revision: currentAsset.revision + 1,
      generationDurationMs: undefined,
      provenance: {
        ...currentAsset.provenance,
        previousAssetId: currentAsset.id,
      },
      qaStatus: "pending",
      qaFindings: [],
    };

    switch (request.mode) {
      case "metadata_fix":
        return {
          ...baseAsset,
          generationParams: {
            ...currentAsset.generationParams,
            ...request.parameterOverrides,
          },
        };
      case "replace_with_upload": {
        const uploadedFile = await this.requireUserFile(request.userFileId);
        const projected = projectUserFileToMediaAssetDescriptor(uploadedFile);
        if (!projected || projected.kind !== currentAsset.kind) {
          throw new Error(`Uploaded file ${uploadedFile.id} does not match asset kind ${currentAsset.kind}.`);
        }

        return {
          ...baseAsset,
          label: currentAsset.label ?? uploadedFile.fileName,
          uri: `/api/user-files/${uploadedFile.id}`,
          mimeType: uploadedFile.mimeType,
          fileSizeBytes: uploadedFile.fileSize,
          generationParams: {
            ...currentAsset.generationParams,
            ...request.parameterOverrides,
            replacementUserFileId: uploadedFile.id,
          },
        };
      }
      case "regenerate": {
        if (!this.options.regenerateAsset) {
          throw new Error("AssetRefinementService.regenerateAsset is required for regenerate mode.");
        }

        const regenerated = await this.options.regenerateAsset({
          workOrderId: currentAsset.workOrderId,
          asset: currentAsset,
          brief: this.requireBrief(request),
          parameterOverrides: request.parameterOverrides,
        });

        return {
          ...baseAsset,
          label: regenerated.label ?? baseAsset.label,
          uri: regenerated.uri ?? baseAsset.uri,
          mimeType: regenerated.mimeType ?? baseAsset.mimeType,
          fileSizeBytes: regenerated.fileSizeBytes ?? baseAsset.fileSizeBytes,
          generationDurationMs: regenerated.generationDurationMs,
          generationParams: {
            ...currentAsset.generationParams,
            ...request.parameterOverrides,
            ...(regenerated.generationParams ?? {}),
          },
        };
      }
    }
  }

  private requireBrief(request: AssetRefinementRequest): ProductBrief {
    if (!request.brief) {
      throw new Error("regenerate requires the current ProductBrief.");
    }

    return request.brief;
  }

  private requireActiveAssetRecord(
    outputs: readonly FactoryOutputRecord[],
    assetId: string,
    workOrderId: string,
  ): FactoryOutputRecord {
    const assetRecords = outputs.filter((output) => output.entityKind === "asset");
    const supersededIds = new Set(assetRecords.flatMap((record) => record.supersedesEntityId ? [record.supersedesEntityId] : []));
    const targetRecord = assetRecords.find((record) => record.entityId === assetId);

    if (!targetRecord) {
      throw new Error(`Asset ${assetId} was not found in work order ${workOrderId}.`);
    }
    if (supersededIds.has(assetId)) {
      throw new Error(`Asset ${assetId} is no longer the current active output for work order ${workOrderId}.`);
    }

    return targetRecord;
  }

  private async requireUserFile(userFileId: string | undefined): Promise<UserFile> {
    if (!userFileId) {
      throw new Error("replace_with_upload requires a userFileId.");
    }
    if (!this.options.userFileRepository) {
      throw new Error("AssetRefinementService.userFileRepository is required for replace_with_upload mode.");
    }

    const userFile = await this.options.userFileRepository.findById(userFileId);
    if (!userFile) {
      throw new Error(`User file ${userFileId} was not found.`);
    }
    return userFile;
  }

  private async requirePausedWorkOrder(workOrderId: string) {
    const workOrder = await this.options.repository.findWorkOrderById(workOrderId);
    if (!workOrder) {
      throw new Error(`Factory work order not found: ${workOrderId}`);
    }
    if (workOrder.status !== "paused") {
      throw new Error(`Work order ${workOrder.id} must be paused before refinement.`);
    }
    return workOrder;
  }

  private async persistPausedFrontier(
    workOrder: Awaited<ReturnType<AssetRefinementService["requirePausedWorkOrder"]>>,
    stageRunId: string | undefined,
    plan: ResumeFrontierPlan,
    requestedBy: string,
  ): Promise<void> {
    const pausedState = {
      pausedAt: this.now(),
      reason: `Revision requested by ${requestedBy}.`,
      resumeFromStageKey: plan.stageKey,
    };

    await this.options.repository.updateWorkOrder({
      ...workOrder,
      revision: workOrder.revision + 1,
      pausedState,
      executionLog: [
        ...workOrder.executionLog,
        {
          timestamp: this.now(),
          stageKey: plan.stageKey,
          eventType: "paused",
          details: { reason: pausedState.reason, rationale: plan.rationale },
        },
      ],
    });

    await this.options.repository.createCheckpoint({
      checkpointId: `checkpoint_${this.id()}`,
      workOrderId: workOrder.id,
      stageRunId,
      pauseState: pausedState,
      resumeFromStageKey: plan.stageKey,
      createdAt: this.now(),
    });
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private id(): string {
    return this.options.idGenerator?.() ?? crypto.randomUUID();
  }
}