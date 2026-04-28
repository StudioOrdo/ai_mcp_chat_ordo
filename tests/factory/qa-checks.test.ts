import { describe, expect, it } from "vitest";

import type { Composition } from "@/core/entities/composition";
import type { FactoryAsset } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import { QACheckRegistry } from "@/lib/factory/qa-check-registry";
import { AssetAccessibilityCheck } from "@/lib/factory/qa-checks/asset-accessibility-check";
import { ChartAccuracyCheck } from "@/lib/factory/qa-checks/chart-accuracy-check";
import { CompositionCompletenessCheck } from "@/lib/factory/qa-checks/composition-completeness-check";
import { createFactoryQACheckRegistry } from "@/lib/factory/factory-qa-root";
import { QARemediator } from "@/lib/factory/qa-remediation";

function createBrief(overrides: Partial<ProductBrief> = {}): ProductBrief {
  return {
    id: "brief_checks",
    schemaVersion: 1,
    title: "Factory launch page",
    topic: "Launching a solopreneur product",
    description: "A launch campaign for a digital product.",
    assetKinds: ["image", "chart"],
    qaCriteria: ["accuracy", "completeness", "accessibility"],
    targetChannels: ["web"],
    executionPreferences: {
      autoRetryOnFailure: true,
      parallelizeAssets: false,
      maxAssetCount: 2,
    },
    createdAt: "2026-04-27T12:00:00.000Z",
    createdBy: "user_1",
    tone: "precise",
    ...overrides,
  };
}

function createAsset(id: string, kind: FactoryAsset["kind"], generationParams: Record<string, unknown> = {}): FactoryAsset {
  return {
    id,
    schemaVersion: 1,
    workOrderId: "wo_checks",
    kind,
    uri: `/api/user-files/${id}`,
    generationParams,
    generatedAt: "2026-04-27T12:01:00.000Z",
    provenance: { stageKey: `asset_${kind}_primary` },
    qaStatus: "passed",
    qaFindings: [],
    revision: 1,
  };
}

function createComposition(assetIds: readonly string[], htmlContent?: string): Composition {
  return {
    id: "composition_checks",
    schemaVersion: 1,
    workOrderId: "wo_checks",
    title: "Factory launch page",
    sections: [
      { id: "c1", kind: "heading", order: 0, text: "Launch", level: 1 },
      { id: "c2", kind: "image", order: 1, assetId: assetIds[0], caption: "Hero" },
      { id: "c3", kind: "chart", order: 2, assetId: assetIds[1], caption: "Proof" },
    ],
    embeddedAssetIds: [...assetIds],
    htmlContent,
    metadata: { targetChannel: "web" },
    provenance: { draftId: "draft_checks", assetIds: [...assetIds] },
    createdAt: "2026-04-27T12:02:00.000Z",
    revision: 1,
  };
}

describe("Phase 4 QA checks", () => {
  it("registers the expected default asset and page checks", () => {
    const registry = createFactoryQACheckRegistry();

    expect(registry.listAssetChecks(["accuracy", "accessibility", "performance"], "chart").map((check) => check.criterion).sort()).toEqual([
      "accessibility",
      "accuracy",
      "performance",
    ]);
    expect(registry.listPageChecks(["completeness", "performance", "tone_match", "brand_compliance", "uniqueness"]).map((check) => check.criterion).sort()).toEqual([
      "brand_compliance",
      "completeness",
      "performance",
      "tone_match",
      "uniqueness",
    ]);
  });

  it("fails closed when the registry does not implement every requested criterion", async () => {
    const registry = new QACheckRegistry();
    registry.registerAssetCheck(new ChartAccuracyCheck());
    registry.registerPageCheck(new CompositionCompletenessCheck());

    const remediator = new QARemediator(registry);
    const brief = createBrief();
    const assets = [
      createAsset("asset_image_1", "image"),
      createAsset("asset_chart_1", "chart", { validationStatus: "valid" }),
    ];
    const composition = createComposition([assets[0].id, assets[1].id], "<main>launch</main>");

    await expect(remediator.remediate({
      brief,
      workOrderId: "wo_checks",
      assets,
      composition,
    })).rejects.toThrow(/No QA checks registered for criteria: accessibility/);
  });

  it("flags missing accessibility metadata by asset kind", async () => {
    const check = new AssetAccessibilityCheck();
    const brief = createBrief();

    const imageFindings = await check.run({
      brief,
      asset: createAsset("asset_image_1", "image"),
      siblingAssets: [],
    });
    const chartFindings = await check.run({
      brief,
      asset: createAsset("asset_chart_1", "chart"),
      siblingAssets: [],
    });
    const audioFindings = await check.run({
      brief,
      asset: createAsset("asset_audio_1", "audio"),
      siblingAssets: [],
    });

    expect(imageFindings[0]?.code).toBe("missing_alt_text");
    expect(chartFindings[0]?.code).toBe("missing_accessibility_summary");
    expect(audioFindings[0]?.code).toBe("missing_transcript");
  });

  it("fails chart accuracy and composition completeness deterministically", async () => {
    const chartCheck = new ChartAccuracyCheck();
    const completenessCheck = new CompositionCompletenessCheck();
    const brief = createBrief();
    const imageAsset = createAsset("asset_image_1", "image", { altText: "Hero image" });
    const chartAsset = createAsset("asset_chart_1", "chart", { validationStatus: "invalid" });
    const composition = createComposition([imageAsset.id, "asset_missing_1"]);

    const chartFindings = await chartCheck.run({
      brief,
      asset: chartAsset,
      siblingAssets: [imageAsset, chartAsset],
    });
    const compositionFindings = await completenessCheck.run({
      brief,
      composition,
      assets: [imageAsset, chartAsset],
    });

    expect(chartFindings[0]?.code).toBe("chart_data_validation_failed");
    expect(compositionFindings.map((finding) => finding.code).sort()).toEqual([
      "composition_missing_asset_output",
      "missing_html_content",
    ]);
  });
});