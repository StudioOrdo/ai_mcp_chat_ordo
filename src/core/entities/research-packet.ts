import { hasDuplicateStrings, isNonEmptyTrimmedString, isUnitIntervalNumber, isValidTimestamp, pushError } from "./factory-validation";

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  retrievedAt: string;
  relevanceScore: number;
}

export interface Claim {
  id: string;
  text: string;
  supportingSourceIds: readonly string[];
  confidence: number;
  contradictionClaimIds?: readonly string[];
}

export interface ResearchPacket {
  id: string;
  schemaVersion: 1;
  workOrderId: string;
  queryUsed: string;
  searchTimestamp: string;
  summary: string;
  confidenceScore: number;
  sources: readonly SourceReference[];
  claims: readonly Claim[];
  searchEngine?: "web" | "vector" | "hybrid";
}

export function listResearchPacketValidationErrors(packet: ResearchPacket): string[] {
  const errors: string[] = [];
  const sourceIds = packet.sources.map((source) => source.id);

  pushError(errors, packet.schemaVersion !== 1, "ResearchPacket.schemaVersion must be 1.");
  pushError(errors, !isNonEmptyTrimmedString(packet.id), "ResearchPacket.id must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(packet.workOrderId), "ResearchPacket.workOrderId must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(packet.queryUsed), "ResearchPacket.queryUsed must be a non-empty string.");
  pushError(errors, !isNonEmptyTrimmedString(packet.summary), "ResearchPacket.summary must be a non-empty string.");
  pushError(errors, !isValidTimestamp(packet.searchTimestamp), "ResearchPacket.searchTimestamp must be a valid timestamp.");
  pushError(errors, !isUnitIntervalNumber(packet.confidenceScore), "ResearchPacket.confidenceScore must be between 0 and 1.");
  pushError(errors, hasDuplicateStrings(sourceIds), "ResearchPacket source ids must be unique.");

  for (const source of packet.sources) {
    pushError(errors, !isNonEmptyTrimmedString(source.id), "SourceReference.id must be a non-empty string.");
    pushError(errors, !isNonEmptyTrimmedString(source.title), `SourceReference ${source.id} title must be non-empty.`);
    pushError(errors, !isNonEmptyTrimmedString(source.url), `SourceReference ${source.id} url must be non-empty.`);
    pushError(errors, !isValidTimestamp(source.retrievedAt), `SourceReference ${source.id} retrievedAt must be a valid timestamp.`);
    pushError(
      errors,
      !isUnitIntervalNumber(source.relevanceScore),
      `SourceReference ${source.id} relevanceScore must be between 0 and 1.`,
    );
  }

  for (const claim of packet.claims) {
    pushError(errors, !isNonEmptyTrimmedString(claim.id), "Claim.id must be a non-empty string.");
    pushError(errors, !isNonEmptyTrimmedString(claim.text), `Claim ${claim.id} text must be non-empty.`);
    pushError(errors, !isUnitIntervalNumber(claim.confidence), `Claim ${claim.id} confidence must be between 0 and 1.`);
    pushError(
      errors,
      claim.supportingSourceIds.some((sourceId) => !sourceIds.includes(sourceId)),
      `Claim ${claim.id} references unknown supporting sources.`,
    );
  }

  if (packet.claims.length === 0) {
    pushError(
      errors,
      !/insufficient|no reliable evidence|limited evidence/i.test(packet.summary),
      "ResearchPacket.summary must explain missing evidence when claims are empty.",
    );
  }

  return errors;
}