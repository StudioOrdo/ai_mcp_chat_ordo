import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { PageQACheck, PageQACheckContext } from "./types";

const TONE_SIGNALS: Record<string, readonly string[]> = {
  precise: ["clear", "structured", "specific", "exact"],
  friendly: ["welcome", "easy", "support", "together"],
  bold: ["distinctive", "transform", "standout", "confident"],
  urgent: ["now", "today", "immediately", "fast"],
  calm: ["steady", "gentle", "clear", "confident"],
};

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export class CompositionToneCheck implements PageQACheck {
  readonly criterion = "tone_match" as const;

  async run(context: PageQACheckContext): Promise<readonly QAFinding[]> {
    const requestedTone = context.brief.tone?.trim().toLowerCase();
    if (!requestedTone) {
      return [];
    }

    const text = stripTags(context.composition.htmlContent ?? context.composition.title);
    const signals = TONE_SIGNALS[requestedTone] ?? [requestedTone];
    const matches = signals.some((signal) => text.includes(signal));

    if (matches) {
      return [];
    }

    return [
      {
        id: `finding_${randomUUID()}`,
        criterion: this.criterion,
        severity: "warning",
        code: "tone_signal_missing",
        message: `Composition lacks clear deterministic signals for the requested tone "${requestedTone}".`,
        suggestedFix: "Review the composition copy for tone alignment before release.",
      },
    ];
  }
}