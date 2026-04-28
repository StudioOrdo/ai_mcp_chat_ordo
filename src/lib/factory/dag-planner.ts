import { randomUUID } from "node:crypto";

import type { GenerationReason } from "@/core/entities/factory-constants";
import { listProductBriefValidationErrors, type ProductBrief } from "@/core/entities/product-brief";
import { listProductionDAGValidationErrors, type ProductionDAG } from "@/core/entities/production-dag";
import type { ProductionStage } from "@/core/entities/production-stage";

const DEFAULT_TIMEOUTS_MS = {
  research: 60_000,
  draft: 120_000,
  composition: 60_000,
  qa: 90_000,
  qaResolution: 45_000,
  release: 60_000,
  outcome: 60_000,
  assetGeneration: {
    chart: 30_000,
    graph: 30_000,
    image: 45_000,
    audio: 60_000,
    video: 180_000,
  },
} as const;

export interface DAGPlannerOptions {
  brief: ProductBrief;
  generatedBy?: string;
  generationReason?: GenerationReason;
  version?: number;
  now?: () => string;
  idGenerator?: () => string;
}

export class DAGPlanner {
  generateDAG(options: DAGPlannerOptions): ProductionDAG {
    const { brief } = options;
    const briefErrors = listProductBriefValidationErrors(brief);

    if (brief.executionPreferences.maxAssetCount !== undefined
      && brief.assetKinds.length > brief.executionPreferences.maxAssetCount) {
      briefErrors.push(
        "ProductBrief.assetKinds cannot exceed executionPreferences.maxAssetCount.",
      );
    }

    if (briefErrors.length > 0) {
      throw new Error(`ProductBrief is invalid: ${briefErrors.join(" ")}`);
    }

    const assetStages = brief.assetKinds.map((assetKind) => this.createAssetStage(assetKind));
    const assetStageKeys = assetStages.map((stage) => stage.key);

    const stages: ProductionStage[] = [
      {
        key: "research",
        kind: "research",
        label: "Research",
        description: `Research sources and claims for ${brief.topic}`,
        dependencyKeys: [],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.research,
        config: { kind: "research", queryHint: brief.topic },
      },
      {
        key: "draft",
        kind: "draft",
        label: "Draft",
        description: `Draft content for ${brief.title}`,
        dependencyKeys: ["research"],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.draft,
        config: { kind: "draft", outlineHint: brief.description ?? brief.title },
      },
      ...assetStages,
      {
        key: "composition",
        kind: "composition",
        label: "Composition",
        description: "Assemble the draft and generated assets into the final surface.",
        dependencyKeys: ["draft", ...assetStageKeys],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.composition,
        config: { kind: "composition", template: "default" },
      },
      {
        key: "qa_asset",
        kind: "qa",
        label: "Asset QA",
        description: "Run asset-level quality checks for generated media.",
        dependencyKeys: ["composition"],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.qa,
        config: { kind: "qa", scope: "asset" },
      },
      {
        key: "qa_page",
        kind: "qa",
        label: "Page QA",
        description: "Run page-level quality checks for the assembled composition.",
        dependencyKeys: ["composition"],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.qa,
        config: { kind: "qa", scope: "page" },
      },
      {
        key: "qa_resolution",
        kind: "qa_resolution",
        label: "QA Resolution",
        description: "Resolve or escalate QA findings before release.",
        dependencyKeys: ["qa_asset", "qa_page"],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.qaResolution,
        config: { kind: "qa_resolution", strategy: "auto" },
      },
      {
        key: "release",
        kind: "release",
        label: "Release",
        description: "Publish the approved composition to the requested channels.",
        dependencyKeys: ["qa_resolution"],
        parallelizable: false,
        timeoutMs: DEFAULT_TIMEOUTS_MS.release,
        config: { kind: "release", channels: brief.targetChannels },
      },
    ];

    const dag: ProductionDAG = {
      id: options.idGenerator?.() ?? `dag_${randomUUID()}`,
      schemaVersion: 1,
      briefId: brief.id,
      version: options.version ?? 1,
      stages,
      autoParallelize: brief.executionPreferences.parallelizeAssets,
      generatedAt: options.now?.() ?? new Date().toISOString(),
      generatedBy: options.generatedBy ?? "factory_dag_planner",
      generationReason: options.generationReason ?? "batch_automation",
    };

    const dagErrors = listProductionDAGValidationErrors(dag);
    if (dagErrors.length > 0) {
      throw new Error(`ProductionDAG is invalid: ${dagErrors.join(" ")}`);
    }

    return dag;
  }

  getTimeoutForAssetKind(assetKind: ProductBrief["assetKinds"][number]): number {
    return DEFAULT_TIMEOUTS_MS.assetGeneration[assetKind];
  }

  private createAssetStage(assetKind: ProductBrief["assetKinds"][number]): ProductionStage {
    const assetSlot = `${assetKind}-primary`;

    return {
      key: `asset_${assetKind}_primary`,
      kind: "asset_generation",
      label: `Generate ${assetKind}`,
      description: `Generate the ${assetKind} asset for the final composition.`,
      dependencyKeys: ["draft"],
      parallelizable: true,
      timeoutMs: this.getTimeoutForAssetKind(assetKind),
      config: {
        kind: "asset_generation",
        assetKind,
        assetSlot,
      },
    };
  }
}
