import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { PageQACheck, PageQACheckContext } from "./types";

export class CompositionPerformanceCheck implements PageQACheck {
  readonly criterion = "performance" as const;

  async run(context: PageQACheckContext): Promise<readonly QAFinding[]> {
    const totalAssetBytes = context.assets.reduce((sum, asset) => sum + (asset.fileSizeBytes ?? 0), 0);
    const threshold = context.brief.targetChannels.includes("email")
      ? 4 * 1024 * 1024
      : 8 * 1024 * 1024;
    const findings: QAFinding[] = [];

    if (totalAssetBytes > threshold) {
      findings.push({
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "warning",
        code: "composition_payload_too_large",
        message: "Combined asset payload exceeds the recommended threshold for the target channel.",
        suggestedFix: "Review the largest assets and reduce payload before release.",
      });
    }

    if (context.composition.htmlContent && context.composition.htmlContent.length > 100_000) {
      findings.push({
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "warning",
        code: "composition_html_too_large",
        message: "Composition htmlContent is unusually large and may impact rendering performance.",
      });
    }

    return findings;
  }
}