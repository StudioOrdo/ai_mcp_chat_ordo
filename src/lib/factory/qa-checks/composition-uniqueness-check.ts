import { randomUUID } from "node:crypto";

import type { QAFinding } from "@/core/entities/factory-asset";

import type { PageQACheck, PageQACheckContext } from "./types";

export class CompositionUniquenessCheck implements PageQACheck {
  readonly criterion = "uniqueness" as const;

  async run(context: PageQACheckContext): Promise<readonly QAFinding[]> {
    const textSections = context.composition.sections
      .filter((section) => section.kind === "heading" || section.kind === "text")
      .map((section) => section.text.trim().toLowerCase())
      .filter((text) => text.length > 0);
    const seen = new Set<string>();

    for (const text of textSections) {
      if (seen.has(text)) {
        return [
          {
            id: `finding_${randomUUID()}`,
            criterion: this.criterion,
            severity: "warning",
            code: "duplicate_copy_segments",
            message: "Composition includes duplicate text sections that reduce uniqueness.",
            suggestedFix: "Review duplicate sections and collapse repeated copy before release.",
          },
        ];
      }
      seen.add(text);
    }

    return [];
  }
}