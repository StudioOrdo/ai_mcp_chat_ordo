import type { RelationshipMemoryRecord } from "@/core/entities/relationship-memory";

function summarizeByType(
  records: readonly RelationshipMemoryRecord[],
  memoryType: RelationshipMemoryRecord["memoryType"],
  limit: number,
): string[] {
  return records
    .filter((record) => record.memoryType === memoryType)
    .slice(0, limit)
    .map((record) => record.summary);
}

function pushSection(lines: string[], label: string, values: readonly string[]): void {
  if (values.length === 0) {
    return;
  }

  lines.push(`${label}:`);
  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

export function buildRelationshipMemoryContextBlock(
  records: readonly RelationshipMemoryRecord[],
): string {
  if (records.length === 0) {
    return "";
  }

  const lines = [
    "",
    "[Relationship memory]",
    "Treat this as the canonical continuity layer for the active customer relationship.",
    "Prefer it over inferred continuity from transcript summaries when the two appear to conflict.",
  ];

  pushSection(lines, "Goals", summarizeByType(records, "goal", 3));
  pushSection(lines, "Preferences", summarizeByType(records, "preference", 3));
  pushSection(lines, "Decisions", summarizeByType(records, "decision", 3));
  pushSection(lines, "Commitments", summarizeByType(records, "commitment", 3));
  pushSection(lines, "Open questions", summarizeByType(records, "open_question", 3));
  pushSection(lines, "Recent milestones", summarizeByType(records, "milestone", 2));
  pushSection(lines, "Important assets", summarizeByType(records, "asset_context", 3));

  return lines.join("\n");
}