import { hasContiguousOrder, hasDuplicateStrings, isNonEmptyTrimmedString, isPositiveInteger, isValidTimestamp, pushError } from "./factory-validation";

export type DraftSection =
  | { id: string; kind: "heading"; order: number; text: string; level: 1 | 2 | 3 | 4 }
  | { id: string; kind: "paragraph"; order: number; text: string }
  | { id: string; kind: "callout"; order: number; text: string; tone?: "info" | "warning" | "success" };

export interface Draft {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  title: string;
  summary?: string;
  sections: readonly DraftSection[];
  createdAt: string;
  revision: number;
  sourceResearchPacketId?: string;
}

export function listDraftValidationErrors(draft: Draft): string[] {
  const errors: string[] = [];
  const sectionIds = draft.sections.map((section) => section.id);
  const orderValues = draft.sections.map((section) => section.order);

  pushError(errors, draft.schemaVersion !== 1, "Draft.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(draft.id), "Draft.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(draft.workOrderId), "Draft.workOrderId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(draft.title), "Draft.title must be a non-empty string.");
  pushError(errors, !isValidTimestamp(draft.createdAt), "Draft.createdAt must be a valid timestamp.");
  pushError(errors, !isPositiveInteger(draft.revision), "Draft.revision must be a positive integer.");
  pushError(errors, hasDuplicateStrings(sectionIds), "Draft section ids must be unique.");
  pushError(errors, hasDuplicateStrings(orderValues.map(String)), "Draft section order values must be unique.");
  pushError(errors, !hasContiguousOrder(orderValues), "Draft section order values must be contiguous.");

  for (const section of draft.sections) {
    pushError(errors, !isNonEmptyTrimmedString(section.id), "Draft section id must be a non-empty string.");
    pushError(errors, !isNonEmptyTrimmedString(section.text), `Draft section ${section.id} text must be non-empty.`);
    pushError(errors, !Number.isInteger(section.order), `Draft section ${section.id} order must be an integer.`);
  }

  return errors;
}