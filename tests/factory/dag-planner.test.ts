import { describe, expect, it } from "vitest";

import type { ProductBrief } from "@/core/entities/product-brief";
import { listProductionDAGValidationErrors } from "@/core/entities/production-dag";
import { DAGPlanner } from "@/lib/factory/dag-planner";

function createProductBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_1",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    description: "A launch campaign for a digital product.",
    audience: "Indie founders",
    tone: "Confident",
    assetKinds: ["chart", "audio"],
    qaCriteria: ["accuracy", "accessibility"],
    targetChannels: ["blog", "newsletter"],
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

describe("DAGPlanner", () => {
  it("generates a valid DAG with deterministic stage keys", () => {
    const planner = new DAGPlanner();

    const dag = planner.generateDAG({
      brief: createProductBrief(),
      now: () => "2026-04-27T12:01:00.000Z",
      idGenerator: () => "dag_1",
    });

    expect(dag.stages.map((stage) => stage.key)).toEqual([
      "research",
      "draft",
      "asset_chart_primary",
      "asset_audio_primary",
      "composition",
      "qa_asset",
      "qa_page",
      "qa_resolution",
      "release",
    ]);
    expect(dag.autoParallelize).toBe(true);
    expect(dag.generatedAt).toBe("2026-04-27T12:01:00.000Z");
    expect(listProductionDAGValidationErrors(dag)).toEqual([]);
  });

  it("wires composition, QA, and release dependencies correctly", () => {
    const planner = new DAGPlanner();
    const dag = planner.generateDAG({
      brief: createProductBrief({ assetKinds: ["chart", "video", "image"] }),
      idGenerator: () => "dag_2",
      now: () => "2026-04-27T12:01:00.000Z",
    });

    const composition = dag.stages.find((stage) => stage.key === "composition");
    const qaResolution = dag.stages.find((stage) => stage.key === "qa_resolution");
    const release = dag.stages.find((stage) => stage.key === "release");

    expect(composition?.dependencyKeys).toEqual([
      "draft",
      "asset_chart_primary",
      "asset_video_primary",
      "asset_image_primary",
    ]);
    expect(qaResolution?.dependencyKeys).toEqual(["qa_asset", "qa_page"]);
    expect(release?.config).toEqual({
      kind: "release",
      channels: ["blog", "newsletter"],
    });
  });

  it("keeps asset generation stages parallelizable even when the DAG disables auto parallelism", () => {
    const planner = new DAGPlanner();
    const dag = planner.generateDAG({
      brief: createProductBrief({
        executionPreferences: {
          autoRetryOnFailure: true,
          parallelizeAssets: false,
          maxAssetCount: 3,
        },
      }),
      idGenerator: () => "dag_3",
      now: () => "2026-04-27T12:01:00.000Z",
    });

    expect(dag.autoParallelize).toBe(false);
    expect(
      dag.stages.filter((stage) => stage.kind === "asset_generation").every((stage) => stage.parallelizable),
    ).toBe(true);
  });

  it("uses longer timeouts for video than chart generation", () => {
    const planner = new DAGPlanner();

    expect(planner.getTimeoutForAssetKind("video")).toBeGreaterThan(planner.getTimeoutForAssetKind("chart"));
  });

  it("rejects briefs whose asset count exceeds maxAssetCount", () => {
    const planner = new DAGPlanner();

    expect(() =>
      planner.generateDAG({
        brief: createProductBrief({
          assetKinds: ["chart", "audio", "image"],
          executionPreferences: {
            autoRetryOnFailure: true,
            parallelizeAssets: true,
            maxAssetCount: 2,
          },
        }),
      }),
    ).toThrow(/maxAssetCount/);
  });

  it("rejects invalid briefs before planning", () => {
    const planner = new DAGPlanner();

    expect(() =>
      planner.generateDAG({
        brief: createProductBrief({ createdAt: "not-a-timestamp" }),
      }),
    ).toThrow(/ProductBrief is invalid/);
  });
});