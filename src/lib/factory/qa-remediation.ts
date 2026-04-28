import { randomUUID } from "node:crypto";

import type { Composition, CompositionSection } from "@/core/entities/composition";
import type { FactoryAsset, QAFinding } from "@/core/entities/factory-asset";
import type { ProductBrief } from "@/core/entities/product-brief";
import type { QAReport } from "@/core/entities/qa-report";
import type { StageResultEntityKind } from "@/core/entities/stage-run-record";
import type { FactoryOutputEntity } from "@/core/use-cases/FactoryRepository";

import { QAEvaluator } from "./qa-evaluator";
import { QACheckRegistry } from "./qa-check-registry";

export interface SupplementalFactoryOutput {
  entityKind: StageResultEntityKind;
  entity: FactoryOutputEntity;
  supersedesEntityId?: string;
}

export interface QARemediationResult {
  assetReport: QAReport;
  pageReport: QAReport;
  finalReport: QAReport;
  supplementalOutputs: readonly SupplementalFactoryOutput[];
}

export function isAutoResolvableFinding(finding: QAFinding): boolean {
  return finding.code === "missing_alt_text" || finding.code === "missing_html_content";
}

function cloneCompositionSection(section: CompositionSection, replacements: ReadonlyMap<string, string>): CompositionSection {
  if ("assetId" in section) {
    return {
      ...section,
      assetId: replacements.get(section.assetId) ?? section.assetId,
    };
  }

  return { ...section };
}

function materializeHtml(composition: Composition): string {
  return composition.sections
    .map((section) => {
      if (section.kind === "heading") {
        return `<h${section.level}>${section.text}</h${section.level}>`;
      }
      if (section.kind === "text") {
        return `<p>${section.text}</p>`;
      }
      return `<figure data-asset-id="${section.assetId}" data-kind="${section.kind}">${section.caption ? `<figcaption>${section.caption}</figcaption>` : ""}</figure>`;
    })
    .join("\n");
}

export interface QARemediatorOptions {
  now?: () => string;
  idGenerator?: () => string;
}

export class QARemediator {
  private readonly evaluator: QAEvaluator;

  constructor(
    private readonly registry: QACheckRegistry,
    private readonly options: QARemediatorOptions = {},
  ) {
    this.evaluator = new QAEvaluator(registry, options);
  }

  async remediate(input: {
    brief: ProductBrief;
    workOrderId: string;
    assets: readonly FactoryAsset[];
    composition: Composition;
  }): Promise<QARemediationResult> {
    const missingCriteria = this.registry.listMissingCriteria(
      input.brief.qaCriteria,
      input.assets.map((asset) => asset.kind),
    );

    if (missingCriteria.length > 0) {
      throw new Error(`No QA checks registered for criteria: ${missingCriteria.join(", ")}.`);
    }

    const initialAssetReport = await this.evaluator.evaluateAssetReport({
      brief: input.brief,
      workOrderId: input.workOrderId,
      assets: input.assets,
    });
    const initialPageReport = await this.evaluator.evaluatePageReport({
      brief: input.brief,
      workOrderId: input.workOrderId,
      composition: input.composition,
      assets: input.assets,
    });

    let correctedAssets = [...input.assets];
    let correctedComposition = input.composition;
    const supplementalOutputs: SupplementalFactoryOutput[] = [];
    const assetReplacementIds = new Map<string, string>();

    for (const assetReport of initialAssetReport.assetReports) {
      const asset = correctedAssets.find((candidate) => candidate.id === assetReport.assetId);
      if (!asset) {
        continue;
      }

      const shouldAddAltText = assetReport.findings.some((finding) => finding.code === "missing_alt_text");
      if (!shouldAddAltText) {
        continue;
      }

      const nextAsset: FactoryAsset = {
        ...asset,
        id: `asset_${this.id()}`,
        generatedAt: this.now(),
        revision: asset.revision + 1,
        generationParams: {
          ...asset.generationParams,
          altText: asset.label?.trim() || `${input.brief.title} image`,
        },
        provenance: {
          ...asset.provenance,
          previousAssetId: asset.id,
        },
        qaStatus: "passed",
        qaFindings: [],
      };

      supplementalOutputs.push({
        entityKind: "asset",
        entity: nextAsset,
        supersedesEntityId: asset.id,
      });
      assetReplacementIds.set(asset.id, nextAsset.id);
      correctedAssets = correctedAssets.map((candidate) => candidate.id === asset.id ? nextAsset : candidate);
    }

    const shouldMaterializeHtml = initialPageReport.pageFindings.some((finding) => finding.code === "missing_html_content");
    const shouldUpdateAssetRefs = assetReplacementIds.size > 0;
    if (shouldMaterializeHtml || shouldUpdateAssetRefs) {
      correctedComposition = {
        ...correctedComposition,
        id: `composition_${this.id()}`,
        createdAt: this.now(),
        revision: correctedComposition.revision + 1,
        htmlContent: correctedComposition.htmlContent ?? materializeHtml(correctedComposition),
        sections: correctedComposition.sections.map((section) => cloneCompositionSection(section, assetReplacementIds)),
        embeddedAssetIds: correctedComposition.embeddedAssetIds.map((assetId) => assetReplacementIds.get(assetId) ?? assetId),
        provenance: {
          ...correctedComposition.provenance,
          assetIds: correctedComposition.provenance.assetIds.map((assetId) => assetReplacementIds.get(assetId) ?? assetId),
        },
      };

      supplementalOutputs.push({
        entityKind: "composition",
        entity: correctedComposition,
        supersedesEntityId: input.composition.id,
      });
    }

    const assetReport = await this.evaluator.evaluateAssetReport({
      brief: input.brief,
      workOrderId: input.workOrderId,
      assets: correctedAssets,
    });
    const pageReport = await this.evaluator.evaluatePageReport({
      brief: input.brief,
      workOrderId: input.workOrderId,
      composition: correctedComposition,
      assets: correctedAssets,
    });
    const finalReport = this.evaluator.buildResolutionReport({
      brief: input.brief,
      workOrderId: input.workOrderId,
      assetReport,
      pageReport,
    });

    return {
      assetReport,
      pageReport,
      finalReport,
      supplementalOutputs,
    };
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString();
  }

  private id(): string {
    return this.options.idGenerator?.() ?? randomUUID();
  }
}