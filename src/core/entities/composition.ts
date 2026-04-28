import { hasContiguousOrder, hasDuplicateStrings, isNonEmptyTrimmedString, isPositiveInteger, isValidTimestamp, pushError } from "./factory-validation";

export type CompositionSection =
  | { id: string; kind: "heading"; order: number; text: string; level: 1 | 2 | 3 | 4 }
  | { id: string; kind: "text"; order: number; text: string }
  | { id: string; kind: "image" | "chart" | "graph" | "video" | "audio"; order: number; assetId: string; caption?: string };

export interface Composition {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  title: string;
  sections: readonly CompositionSection[];
  embeddedAssetIds: readonly string[];
  htmlContent?: string;
  metadata: {
    theme?: string;
    layout?: string;
    targetChannel?: string;
  };
  provenance: {
    draftId: string;
    assetIds: readonly string[];
  };
  createdAt: string;
  revision: number;
}

export function listCompositionValidationErrors(composition: Composition): string[] {
  const errors: string[] = [];
  const sectionIds = composition.sections.map((section) => section.id);
  const orders = composition.sections.map((section) => section.order);

  pushError(errors, composition.schemaVersion !== 1, "Composition.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(composition.id), "Composition.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(composition.workOrderId), "Composition.workOrderId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(composition.title), "Composition.title must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(composition.provenance.draftId), "Composition.provenance.draftId must be a non-empty string.");
  pushError(errors, !isValidTimestamp(composition.createdAt), "Composition.createdAt must be a valid timestamp.");
  pushError(errors, !isPositiveInteger(composition.revision), "Composition.revision must be a positive integer.");
  pushError(errors, hasDuplicateStrings(sectionIds), "Composition section ids must be unique.");
  pushError(errors, hasDuplicateStrings(orders.map(String)), "Composition section order values must be unique.");
  pushError(errors, !hasContiguousOrder(orders), "Composition section order values must be contiguous.");
  pushError(errors, hasDuplicateStrings(composition.embeddedAssetIds), "Composition.embeddedAssetIds cannot contain duplicates.");

  for (const section of composition.sections) {
    pushError(errors, !isNonEmptyTrimmedString(section.id), "Composition section id must be a non-empty string.");
    if (section.kind === "heading" || section.kind === "text") {
      pushError(errors, !isNonEmptyTrimmedString(section.text), `Composition section ${section.id} text must be non-empty.`);
    }

    if ("assetId" in section) {
      pushError(
        errors,
        !composition.embeddedAssetIds.includes(section.assetId),
        `Composition section ${section.id} references missing embedded asset ${section.assetId}.`,
      );
    }
  }

  return errors;
}