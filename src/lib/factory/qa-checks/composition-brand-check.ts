import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { PageQACheck, PageQACheckContext } from "./types";

export class CompositionBrandCheck implements PageQACheck {
  readonly criterion = "brand_compliance" as const;

  async run(context: PageQACheckContext): Promise<readonly QAFinding[]> {
    const findings: QAFinding[] = [];

    if (context.composition.metadata.theme === "off-brand" || context.composition.metadata.theme === "unapproved") {
      findings.push({
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "error",
        code: "composition_theme_off_brand",
        message: "Composition theme metadata indicates the output is off-brand.",
      });
    }

    if (context.assets.some((asset) => asset.generationParams.brandApproved === false)) {
      findings.push({
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "error",
        code: "asset_brand_rejected",
        message: "At least one asset was explicitly marked as not brand-approved.",
      });
    }

    return findings;
  }
}