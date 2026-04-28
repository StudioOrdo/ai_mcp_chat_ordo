import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { PageQACheck, PageQACheckContext } from "./types";

export class CompositionCompletenessCheck implements PageQACheck {
  readonly criterion = "completeness" as const;

  async run(context: PageQACheckContext): Promise<readonly QAFinding[]> {
    const findings: QAFinding[] = [];
    const assetIdsFromSections = context.composition.sections
      .filter((section) => "assetId" in section)
      .map((section) => section.assetId);
    const availableAssetIds = new Set(context.assets.map((asset) => asset.id));

    if (context.composition.sections.length === 0) {
      findings.push({
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "error",
        code: "composition_missing_sections",
        message: "Composition has no sections to render.",
      });
    }

    if (!context.composition.htmlContent) {
      findings.push({
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "warning",
        code: "missing_html_content",
        message: "Composition does not yet include htmlContent.",
        suggestedFix: "materialize_html",
      });
    }

    for (const assetId of assetIdsFromSections) {
      if (!context.composition.embeddedAssetIds.includes(assetId)) {
        findings.push({
          id: `finding_${randomUUID()}`,
          criterion: this.criterion,
          severity: "error",
          code: "composition_embedded_asset_mismatch",
          message: `Composition section references asset ${assetId} that is missing from embeddedAssetIds.`,
        });
      }
    }

    for (const embeddedAssetId of context.composition.embeddedAssetIds) {
      if (!availableAssetIds.has(embeddedAssetId)) {
        findings.push({
          id: `finding_${randomUUID()}`,
          criterion: this.criterion,
          severity: "error",
          code: "composition_missing_asset_output",
          message: `Composition references asset ${embeddedAssetId} that is not present in current outputs.`,
        });
      }
    }

    return findings;
  }
}