import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { AssetQACheck, AssetQACheckContext } from "./types";

export class ChartAccuracyCheck implements AssetQACheck {
  readonly criterion = "accuracy" as const;
  readonly supportedAssetKinds = ["chart", "graph"] as const;

  async run(context: AssetQACheckContext): Promise<readonly QAFinding[]> {
    const validationStatus = context.asset.generationParams.validationStatus;
    const sourceDataMatches = context.asset.generationParams.sourceDataMatches;
    const dataPointsValid = context.asset.generationParams.dataPointsValid;

    if (validationStatus === "invalid" || sourceDataMatches === false || dataPointsValid === false) {
      return [
        {
          id: `finding_${randomUUID()}`,
          criterion: this.criterion,
          severity: "error",
          code: "chart_data_validation_failed",
          message: "Chart or graph asset failed source data validation.",
        },
      ];
    }

    return [];
  }
}