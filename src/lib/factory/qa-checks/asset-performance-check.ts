import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { AssetQACheck, AssetQACheckContext } from "./types";

const MAX_FILE_SIZE_BYTES = {
  image: 3 * 1024 * 1024,
  chart: 1024 * 1024,
  graph: 1024 * 1024,
  audio: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
} as const;

export class AssetPerformanceCheck implements AssetQACheck {
  readonly criterion = "performance" as const;
  readonly supportedAssetKinds = ["image", "chart", "graph", "audio", "video"] as const;

  async run(context: AssetQACheckContext): Promise<readonly QAFinding[]> {
    const threshold = MAX_FILE_SIZE_BYTES[context.asset.kind];
    const fileSizeBytes = context.asset.fileSizeBytes;

    if (fileSizeBytes === undefined || fileSizeBytes <= threshold) {
      return [];
    }

    return [
      {
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "warning",
        code: "asset_file_too_large",
        message: `${context.asset.kind} asset exceeds the recommended payload budget for release.`,
        suggestedFix: "Compress or regenerate the asset with a smaller payload.",
      },
    ];
  }
}