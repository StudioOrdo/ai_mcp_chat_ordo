import { randomUUID } from "node:crypto";

import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { FactoryAssetKind } from "@/core/entities/factory-constants";

import { requireDraft, type StageExecutionContext, type StageExecutionResult, type StageExecutor } from "./types";

export interface AssetGenerationServiceResult {
  label?: string;
  uri?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  generationParams?: Record<string, unknown>;
  generationDurationMs?: number;
  qaStatus?: FactoryAsset["qaStatus"];
  qaFindings?: FactoryAsset["qaFindings"];
}

export type AssetGenerationHandler = (
  input: {
    briefTitle: string;
    topic: string;
    draft: ReturnType<typeof requireDraft>;
    assetKind: FactoryAssetKind;
    assetSlot: string;
    parameterOverrides?: Record<string, unknown>;
    abortSignal?: AbortSignal;
  },
) => Promise<AssetGenerationServiceResult>;

export class AssetGenerationExecutor implements StageExecutor {
  readonly kind = "asset_generation" as const;

  constructor(private readonly handlers: Partial<Record<FactoryAssetKind, AssetGenerationHandler>>) {}

  async execute(context: StageExecutionContext): Promise<StageExecutionResult> {
    if (context.stage.config?.kind !== "asset_generation") {
      throw new Error(`Stage ${context.stage.key} is missing asset_generation config.`);
    }

    const handler = this.handlers[context.stage.config.assetKind];
    if (!handler) {
      throw new Error(`No asset generation handler registered for ${context.stage.config.assetKind}.`);
    }

    const draft = requireDraft(context);
    const result = await handler({
      briefTitle: context.brief.title,
      topic: context.brief.topic,
      draft,
      assetKind: context.stage.config.assetKind,
      assetSlot: context.stage.config.assetSlot,
      abortSignal: context.abortSignal,
    });

    const qaStatus = result.qaStatus ?? "pending";
    const qaFindings = result.qaFindings ?? [];

    const asset: FactoryAsset = {
      id: `asset_${randomUUID()}`,
      schemaVersion: 1,
      workOrderId: context.workOrder.id,
      kind: context.stage.config.assetKind,
      label: result.label,
      uri: result.uri,
      mimeType: result.mimeType,
      fileSizeBytes: result.fileSizeBytes,
      generationParams: result.generationParams ?? {
        assetKind: context.stage.config.assetKind,
        assetSlot: context.stage.config.assetSlot,
      },
      generatedAt: new Date().toISOString(),
      generationDurationMs: result.generationDurationMs,
      provenance: {
        stageKey: context.stage.key,
      },
      qaStatus,
      qaFindings,
      revision: 1,
    };

    return {
      entityKind: "asset",
      entity: asset,
    };
  }
}
