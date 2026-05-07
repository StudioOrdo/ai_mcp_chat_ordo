import { describe, expect, it } from "vitest";

import type { Composition } from "@/core/entities/composition";
import type { Draft } from "@/core/entities/draft";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { QAReport } from "@/core/entities/qa-report";
import type { ResearchPacket } from "@/core/entities/research-packet";
import type { ProductionStage } from "@/core/entities/production-stage";
import type { WorkOrder } from "@/core/entities/work-order";
import { AssetGenerationExecutor } from "@/lib/factory/stage-executors/asset-generation-executor";
import { CompositionExecutor } from "@/lib/factory/stage-executors/composition-executor";
import { QAResolutionExecutor } from "@/lib/factory/stage-executors/qa-resolution-executor";
import { ReleaseExecutor } from "@/lib/factory/stage-executors/release-executor";
import type { StageExecutionContext } from "@/lib/factory/stage-executors/types";

function createBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    assetKinds: ["chart", "audio"],
    qaCriteria: ["accuracy", "accessibility"],
    targetChannels: ["blog"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: true,
      maxAssetCount: 3,
    },
    createdAt: "2026-04-27T12:00:00.000Z",
    createdBy: "user_1",
    ...overrides,
  };
}

function createWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo_1",
    schemaVersion: 1,
    briefId: "brief_1",
    status: "running",
    currentDag: {
      id: "dag_1",
      schemaVersion: 1,
      briefId: "brief_1",
      version: 1,
      stages: [],
      autoParallelize: true,
      generatedAt: "2026-04-27T12:00:00.000Z",
      generatedBy: "planner",
      generationReason: "batch_automation",
    },
    stageRuns: [],
    executionLog: [],
    revision: 1,
    previousWorkOrderIds: [],
    createdAt: "2026-04-27T12:00:00.000Z",
    userId: "user_1",
    initiatedBy: "batch_automation",
    ...overrides,
    operationId: overrides.operationId ?? "op_wo_1",
  };
}

function createDraft(): Draft {
  return {
    id: "draft_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    title: "Factory launch page",
    sections: [
      { id: "d1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "d2", kind: "paragraph", order: 1, text: "Start with owned channels." },
    ],
    createdAt: "2026-04-27T12:00:00.000Z",
    revision: 1,
    sourceResearchPacketId: "research_1",
  };
}

function createAsset(id: string, kind: FactoryAsset["kind"]): FactoryAsset {
  return {
    id,
    schemaVersion: 1,
    workOrderId: "wo_1",
    kind,
    uri: `/api/user-files/${id}`,
    generationParams: { kind },
    generatedAt: "2026-04-27T12:01:00.000Z",
    provenance: { stageKey: `asset_${kind}_primary` },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
  };
}

function createComposition(): Composition {
  return {
    id: "composition_1",
    schemaVersion: 1,
    workOrderId: "wo_1",
    title: "Factory launch page",
    sections: [
      { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "c2", kind: "chart", order: 1, assetId: "asset_chart_1" },
    ],
    embeddedAssetIds: ["asset_chart_1"],
    htmlContent: "<main>Launch</main>",
    metadata: { targetChannel: "blog" },
    provenance: { draftId: "draft_1", assetIds: ["asset_chart_1"] },
    createdAt: "2026-04-27T12:02:00.000Z",
    revision: 1,
  };
}

function createQAReport(status: QAReport["status"]): QAReport {
  return {
    id: `qa_${status}`,
    schemaVersion: 1,
    workOrderId: "wo_1",
    status,
    totalFindings: 0,
    passedCriteria: ["accuracy", "accessibility"],
    failedCriteria: [],
    assetReports: [],
    pageFindings: [],
    recommendedFixes: [],
    autoResolvableCount: 0,
    requiresUserDecision: false,
    createdAt: "2026-04-27T12:03:00.000Z",
  };
}

function createContext(stage: ProductionStage, outputsByStageKey: ReadonlyMap<string, unknown[]>): StageExecutionContext {
  return {
    workOrder: createWorkOrder(),
    brief: createBrief(),
    stage,
    priorStageRuns: [],
    resolvedInputs: {
      outputsByStageKey: outputsByStageKey as StageExecutionContext["resolvedInputs"]["outputsByStageKey"],
    },
  };
}

describe("factory stage executors", () => {
  it("rejects missing asset handlers", async () => {
    const executor = new AssetGenerationExecutor({});
    const context = createContext(
      {
        key: "asset_chart_primary",
        kind: "asset_generation",
        label: "Generate chart",
        dependencyKeys: ["draft"],
        parallelizable: true,
        config: { kind: "asset_generation", assetKind: "chart", assetSlot: "chart-primary" },
      },
      new Map([
        ["draft", [{ entityKind: "draft", payload: createDraft() }]],
      ]),
    );

    await expect(executor.execute(context)).rejects.toThrow(/No asset generation handler/);
  });

  it("preserves asset ordering in composition output", async () => {
    const executor = new CompositionExecutor({
      compose: async () => ({ htmlContent: "<main>ok</main>" }),
    });
    const context = createContext(
      {
        key: "composition",
        kind: "composition",
        label: "Compose",
        dependencyKeys: ["draft", "asset_chart_primary", "asset_audio_primary"],
        parallelizable: false,
        config: { kind: "composition", template: "default" },
      },
      new Map([
        ["draft", [{ entityKind: "draft", payload: createDraft() }]],
        ["asset_chart_primary", [{ entityKind: "asset", payload: createAsset("asset_chart_1", "chart") }]],
        ["asset_audio_primary", [{ entityKind: "asset", payload: createAsset("asset_audio_1", "audio") }]],
      ]),
    );

    const result = await executor.execute(context);
    const composition = result.entity as Composition;

    expect(composition.embeddedAssetIds).toEqual(["asset_chart_1", "asset_audio_1"]);
    expect(composition.provenance.assetIds).toEqual(["asset_chart_1", "asset_audio_1"]);
  });

  it("blocks release when qa_resolution has not passed", async () => {
    const executor = new ReleaseExecutor({
      publish: async () => ({ publishedDestinations: [{ channel: "blog", url: "https://example.com/blog/post" }] }),
    });
    const context = createContext(
      {
        key: "release",
        kind: "release",
        label: "Release",
        dependencyKeys: ["qa_resolution"],
        parallelizable: false,
        config: { kind: "release", channels: ["blog"] },
      },
      new Map([
        ["composition", [{ entityKind: "composition", payload: createComposition() }]],
        ["qa_resolution", [{ entityKind: "qa_report", payload: createQAReport("needs_review") }]],
      ]),
    );

    await expect(executor.execute(context)).rejects.toThrow(/qa_resolution has passed/);
  });

  it("reads the qa_report from qa_resolution even when supplemental outputs exist", async () => {
    const executor = new ReleaseExecutor({
      publish: async ({ compositionId }) => ({
        publishedDestinations: [{ channel: "blog", url: `https://example.com/blog/${compositionId}` }],
      }),
    });
    const correctedComposition = {
      ...createComposition(),
      id: "composition_2",
      revision: 2,
      provenance: { draftId: "draft_1", assetIds: ["asset_chart_1"] },
    };
    const context = createContext(
      {
        key: "release",
        kind: "release",
        label: "Release",
        dependencyKeys: ["qa_resolution"],
        parallelizable: false,
        config: { kind: "release", channels: ["blog"] },
      },
      new Map([
        ["composition", [{ entityKind: "composition", payload: createComposition() }]],
        [
          "qa_resolution",
          [
            { entityKind: "asset", payload: createAsset("asset_chart_2", "chart") },
            { entityKind: "composition", payload: correctedComposition },
            { entityKind: "qa_report", payload: createQAReport("passed") },
          ],
        ],
      ]),
    );

    const result = await executor.execute(context);

    expect((result.entity as { compositionId: string }).compositionId).toBe(correctedComposition.id);
  });

  it("merges QA asset and page reports during qa_resolution", async () => {
    const executor = new QAResolutionExecutor();
    const context = createContext(
      {
        key: "qa_resolution",
        kind: "qa_resolution",
        label: "Resolve QA",
        dependencyKeys: ["qa_asset", "qa_page"],
        parallelizable: false,
        config: { kind: "qa_resolution", strategy: "auto" },
      },
      new Map([
        ["qa_asset", [{ entityKind: "qa_report", payload: createQAReport("passed") }]],
        ["qa_page", [{ entityKind: "qa_report", payload: createQAReport("passed") }]],
      ]),
    );

    const result = await executor.execute(context);
    const report = result.entity as QAReport;

    expect(report.status).toBe("passed");
    expect(report.totalFindings).toBe(0);
  });
});
