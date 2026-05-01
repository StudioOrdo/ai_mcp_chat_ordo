import type { Message } from "@/core/entities/conversation";
import type { CanonicalEvidenceRef } from "@/core/entities/conversation-continuity";
import type { MessagePart } from "@/core/entities/message-parts";
import type {
  RelationshipMemoryRecord,
  RelationshipMemoryStatus,
  RelationshipMemoryType,
} from "@/core/entities/relationship-memory";

export interface RelationshipMemoryProjectionInput {
  userId: string;
  conversationId: string;
  messages: readonly Message[];
}

type MemoryCandidate = {
  id: string;
  memoryType: RelationshipMemoryType;
  summary: string;
  status: RelationshipMemoryStatus;
  confidence: number;
  evidenceRefs: readonly CanonicalEvidenceRef[];
  createdAt: string;
  updatedAt: string;
};

type SentenceMatch = {
  memoryType: RelationshipMemoryType;
  status: RelationshipMemoryStatus;
  summary: string;
  confidence: number;
};

const MAX_SUMMARY_LENGTH = 240;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function normalizeClause(value: string): string {
  return truncate(
    normalizeWhitespace(value)
      .replace(/^[,:;\-\s]+/, "")
      .replace(/[\s,;:.!?]+$/, ""),
    MAX_SUMMARY_LENGTH,
  );
}

function splitSentences(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 0);
}

function buildEvidenceRef(message: Message, userId: string): CanonicalEvidenceRef {
  return {
    source: {
      sourceKind: "message",
      sourceId: message.id,
      userId,
      conversationId: message.conversationId,
    },
    observedAt: message.createdAt,
    summary: truncate(message.content, 160),
  };
}

function buildPartEvidenceRef(
  message: Message,
  userId: string,
  sourceKind: CanonicalEvidenceRef["source"]["sourceKind"],
  sourceId: string,
  summary: string | null,
): CanonicalEvidenceRef {
  return {
    source: {
      sourceKind,
      sourceId,
      userId,
      conversationId: message.conversationId,
    },
    observedAt: message.createdAt,
    summary,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readAssetId(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return readString(value.assetId) ?? readString(value.primaryAssetId) ?? readString(value.heroImageAssetId);
}

function readAssetLabel(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return readString(value.title)
    ?? readString(value.label)
    ?? readString(value.fileName)
    ?? readString(value.altText)
    ?? readString(value.alt_text);
}

function readAssetKind(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return readString(value.assetKind) ?? readString(value.kind);
}

function buildAssetContextSummary(assetId: string, label: string | null, kind: string | null): string {
  if (label && kind) {
    return truncate(`Asset context: ${label} (${kind} asset ${assetId})`, MAX_SUMMARY_LENGTH);
  }

  if (label) {
    return truncate(`Asset context: ${label} (${assetId})`, MAX_SUMMARY_LENGTH);
  }

  if (kind) {
    return truncate(`Asset context: ${kind} asset ${assetId}`, MAX_SUMMARY_LENGTH);
  }

  return truncate(`Asset context: asset ${assetId}`, MAX_SUMMARY_LENGTH);
}

function buildMilestoneSummary(toolName: string, status: string, label: string | null): string {
  const statusLabel = status.toLowerCase();
  if (label) {
    return truncate(`Milestone: ${toolName} ${statusLabel} - ${label}`, MAX_SUMMARY_LENGTH);
  }

  return truncate(`Milestone: ${toolName} ${statusLabel}`, MAX_SUMMARY_LENGTH);
}

function extractAssetMatchesFromPart(
  part: MessagePart,
  message: Message,
  userId: string,
): MemoryCandidate[] {
  if (part.type === "attachment") {
    return [{
      id: buildRelationshipMemoryRecordId(message.conversationId, "asset_context", `${message.id}_${part.assetId}`, "active"),
      memoryType: "asset_context",
      summary: buildAssetContextSummary(part.assetId, part.fileName, part.assetKind ?? part.mimeType),
      status: "active",
      confidence: 0.95,
      evidenceRefs: [
        buildPartEvidenceRef(
          message,
          userId,
          "user_file",
          part.assetId,
          truncate(part.fileName, 160),
        ),
      ],
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
    }];
  }

  const payload = part.type === "job_status"
    ? part.resultEnvelope?.payload ?? part.resultPayload
    : part.type === "tool_result"
      ? part.result
      : null;
  const assetId = readAssetId(payload);
  if (!assetId) {
    return [];
  }

  const label = readAssetLabel(payload);
  const toolResultName = part.type === "tool_result" ? part.name : null;
  const kind = readAssetKind(payload)
    ?? (toolResultName ? toolResultName.replace(/^generate_/, "") : null);
  const sourceKind = part.type === "job_status" ? "job" : "message";
  const sourceId = part.type === "job_status" ? part.jobId : message.id;
  const sourceSummary = part.type === "job_status"
    ? truncate(`${part.toolName} ${part.status}`, 160)
    : truncate(toolResultName ?? message.id, 160);

  return [{
    id: buildRelationshipMemoryRecordId(message.conversationId, "asset_context", `${message.id}_${assetId}`, "active"),
    memoryType: "asset_context",
    summary: buildAssetContextSummary(assetId, label, kind),
    status: "active",
    confidence: 0.92,
    evidenceRefs: [
      buildPartEvidenceRef(message, userId, sourceKind, sourceId, sourceSummary),
      buildPartEvidenceRef(message, userId, "user_file", assetId, label ?? kind ?? assetId),
    ],
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  }];
}

function extractMilestoneMatchFromPart(
  part: MessagePart,
  message: Message,
  userId: string,
): MemoryCandidate[] {
  if (part.type !== "job_status") {
    return [];
  }

  if (part.status !== "succeeded") {
    return [];
  }

  const label = readString(part.summary)
    ?? readString(part.title)
    ?? readString(part.label)
    ?? readAssetLabel(part.resultEnvelope?.payload ?? part.resultPayload);

  return [{
    id: buildRelationshipMemoryRecordId(message.conversationId, "milestone", `${message.id}_${part.jobId}`, "active"),
    memoryType: "milestone",
    summary: buildMilestoneSummary(part.toolName, part.status, label),
    status: "active",
    confidence: 0.89,
    evidenceRefs: [
      buildPartEvidenceRef(
        message,
        userId,
        "job",
        part.jobId,
        truncate(`${part.toolName} ${part.status}`, 160),
      ),
    ],
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  }];
}

function extractPartMatches(message: Message, userId: string): MemoryCandidate[] {
  return message.parts.flatMap((part) => [
    ...extractMilestoneMatchFromPart(part, message, userId),
    ...extractAssetMatchesFromPart(part, message, userId),
  ]);
}

function matchPattern(
  sentence: string,
  patterns: readonly RegExp[],
  memoryType: RelationshipMemoryType,
  status: RelationshipMemoryStatus,
  label: string,
  confidence: number,
): SentenceMatch | null {
  for (const pattern of patterns) {
    const match = sentence.match(pattern);
    if (!match) {
      continue;
    }

    const clause = normalizeClause(match[1] ?? sentence);
    if (clause.length === 0) {
      continue;
    }

    const prefix = status === "retracted" ? `Retracted ${label}` : label;
    return {
      memoryType,
      status,
      summary: truncate(`${prefix}: ${clause}`, MAX_SUMMARY_LENGTH),
      confidence,
    };
  }

  return null;
}

function matchOpenQuestion(sentence: string, message: Message): SentenceMatch | null {
  if (message.role !== "user" || !sentence.includes("?")) {
    return null;
  }

  return {
    memoryType: "open_question",
    status: "active",
    summary: truncate(`Open question: ${sentence}`, MAX_SUMMARY_LENGTH),
    confidence: 0.78,
  };
}

function matchSentence(sentence: string, message: Message): SentenceMatch[] {
  if (message.role === "system") {
    return [];
  }

  const matches: SentenceMatch[] = [];
  const normalizedSentence = normalizeWhitespace(sentence);
  const openQuestion = matchOpenQuestion(normalizedSentence, message);
  if (openQuestion) {
    matches.push(openQuestion);
  }

  const goalRetraction = matchPattern(
    normalizedSentence,
    [
      /\b(?:i no longer need to|i do not need to|i don't need to|i no longer want to|i don't want to)\s+([^.!?\n]+)/i,
    ],
    "goal",
    "retracted",
    "Goal",
    0.92,
  );
  if (goalRetraction) {
    matches.push(goalRetraction);
  }

  const preferenceRetraction = matchPattern(
    normalizedSentence,
    [
      /\b(?:i do not care about|i don't care about|no preference for)\s+([^.!?\n]+)/i,
    ],
    "preference",
    "retracted",
    "Preference",
    0.9,
  );
  if (preferenceRetraction) {
    matches.push(preferenceRetraction);
  }

  const commitmentRetraction = matchPattern(
    normalizedSentence,
    [
      /\b(?:i will not|i won't|we will not|we won't)\s+([^.!?\n]+)/i,
    ],
    "commitment",
    "retracted",
    "Commitment",
    0.91,
  );
  if (commitmentRetraction) {
    matches.push(commitmentRetraction);
  }

  const decisionRetraction = matchPattern(
    normalizedSentence,
    [
      /\b(?:i have not decided|i haven't decided|we have not decided|we haven't decided|we are still undecided)\b/i,
    ],
    "decision",
    "retracted",
    "Decision",
    0.88,
  );
  if (decisionRetraction) {
    matches.push(decisionRetraction);
  }

  const goal = matchPattern(
    normalizedSentence,
    [
      /\b(?:my goal is to|the goal is to|i want to|i need to|i'm trying to|i am trying to|we want to)\s+([^.!?\n]+)/i,
    ],
    "goal",
    "active",
    "Goal",
    0.86,
  );
  if (goal) {
    matches.push(goal);
  }

  const preference = matchPattern(
    normalizedSentence,
    [
      /\b(?:i prefer|i'd prefer|i would prefer|i'd rather|i would rather)\s+([^.!?\n]+)/i,
    ],
    "preference",
    "active",
    "Preference",
    0.82,
  );
  if (preference) {
    matches.push(preference);
  }

  const decision = matchPattern(
    normalizedSentence,
    [
      /\b(?:i(?:'ve| have)? decided to|we(?:'ve| have)? decided to|i choose to|we choose to|let's go with|let us go with|let's use|let us use)\s+([^.!?\n]+)/i,
    ],
    "decision",
    "active",
    "Decision",
    0.88,
  );
  if (decision) {
    matches.push(decision);
  }

  const commitment = matchPattern(
    normalizedSentence,
    [
      /\b(?:i will|i'll|we will|we'll)\s+([^.!?\n]+)/i,
    ],
    "commitment",
    "active",
    "Commitment",
    0.84,
  );
  if (commitment) {
    matches.push(commitment);
  }

  return matches;
}

export function buildRelationshipMemoryRecordId(
  conversationId: string,
  memoryType: RelationshipMemoryType,
  sourceMessageId: string,
  status: RelationshipMemoryStatus,
): string {
  const suffix = status === "active" ? "active" : status;
  return `mem_${conversationId}_${memoryType}_${sourceMessageId}_${suffix}`;
}

export function projectRelationshipMemoryRecords(
  input: RelationshipMemoryProjectionInput,
): RelationshipMemoryRecord[] {
  const latestByType = new Map<RelationshipMemoryType, MemoryCandidate>();

  for (const message of input.messages) {
    const evidenceRef = buildEvidenceRef(message, input.userId);
    for (const sentence of splitSentences(message.content)) {
      const matches = matchSentence(sentence, message);
      for (const match of matches) {
        latestByType.set(match.memoryType, {
          id: buildRelationshipMemoryRecordId(
            input.conversationId,
            match.memoryType,
            message.id,
            match.status,
          ),
          memoryType: match.memoryType,
          summary: match.summary,
          status: match.status,
          confidence: match.confidence,
          evidenceRefs: [evidenceRef],
          createdAt: message.createdAt,
          updatedAt: message.createdAt,
        });
      }
    }

    for (const match of extractPartMatches(message, input.userId)) {
      latestByType.set(match.memoryType, match);
    }
  }

  return [...latestByType.values()]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((record) => ({
      id: record.id,
      userId: input.userId,
      conversationId: input.conversationId,
      memoryType: record.memoryType,
      summary: record.summary,
      evidenceRefs: record.evidenceRefs,
      status: record.status,
      confidence: record.confidence,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
}