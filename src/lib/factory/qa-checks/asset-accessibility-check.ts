import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { AssetQACheck, AssetQACheckContext } from "./types";

function readStringParam(context: AssetQACheckContext, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = context.asset.generationParams[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readAltText(context: AssetQACheckContext): string | undefined {
  return readStringParam(context, "altText", "alt_text");
}

function readAccessibilitySummary(context: AssetQACheckContext): string | undefined {
  return readStringParam(context, "summary", "description", "ariaLabel", "aria_label", "caption");
}

function readTranscript(context: AssetQACheckContext): string | undefined {
  return readStringParam(context, "transcript", "captions", "captionTrack");
}

export class AssetAccessibilityCheck implements AssetQACheck {
  readonly criterion = "accessibility" as const;
  readonly supportedAssetKinds = ["image", "chart", "graph", "audio", "video"] as const;

  async run(context: AssetQACheckContext): Promise<readonly QAFinding[]> {
    if (context.asset.kind === "image") {
      if (readAltText(context)) {
        return [];
      }

      const suggestedAltText = context.asset.label?.trim() || `${context.brief.title} image`;

      return [
        {
          id: `finding_${randomUUID()}`,
          criterion: this.criterion,
          severity: "warning",
          code: "missing_alt_text",
          message: "Image asset is missing alt text metadata.",
          suggestedFix: `Add alt text: ${suggestedAltText}`,
        },
      ];
    }

    if (context.asset.kind === "chart" || context.asset.kind === "graph") {
      if (readAccessibilitySummary(context)) {
        return [];
      }

      return [
        {
          id: `finding_${randomUUID()}`,
          criterion: this.criterion,
          severity: "warning",
          code: "missing_accessibility_summary",
          message: `${context.asset.kind} asset is missing accessibility summary metadata.`,
          suggestedFix: "Add a concise textual summary or caption describing the visualization.",
        },
      ];
    }

    if (readTranscript(context)) {
      return [];
    }

    return [
      {
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "warning",
        code: "missing_transcript",
        message: `${context.asset.kind} asset is missing transcript or caption metadata for accessibility.`,
        suggestedFix: "Attach transcript or caption metadata before release.",
      },
    ];
  }
}