import type { Message } from "@/core/entities/conversation";
import type { MessagePart } from "@/core/entities/message-parts";
import type { OperationPromptGroundingToolEvidence } from "@/core/use-cases/operations/OperationPromptGrounding";
import { redactSecrets } from "@/lib/observability/secret-redaction";

const DEFAULT_MAX_EVIDENCE = 8;
const DEFAULT_MAX_SUMMARY_CHARS = 800;
const OPERATION_ID_PATTERN = /\bop_[A-Za-z0-9_-]+\b/;

interface ToolEvidenceCandidate {
  messageId: string;
  toolInvocationId: string | null;
  toolName: string;
  evidenceKind: "call" | "result" | "paired";
  callArgs?: Record<string, unknown>;
  result?: unknown;
  createdAt: string | null;
}

export function extractOperationToolEvidence(
  messages: readonly Message[],
  options: {
    maxEntries?: number;
    maxSummaryCharacters?: number;
  } = {},
): OperationPromptGroundingToolEvidence[] {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_EVIDENCE;
  const maxSummaryCharacters = options.maxSummaryCharacters ?? DEFAULT_MAX_SUMMARY_CHARS;
  const callsByInvocationId = new Map<string, ToolEvidenceCandidate>();
  const candidates: ToolEvidenceCandidate[] = [];

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type !== "tool_call" && part.type !== "tool_result") {
        continue;
      }

      const invocationId = part.toolInvocationId ?? null;
      if (part.type === "tool_call") {
        const callCandidate: ToolEvidenceCandidate = {
          messageId: message.id,
          toolInvocationId: invocationId,
          toolName: part.name,
          evidenceKind: "call",
          callArgs: part.args,
          createdAt: message.createdAt,
        };
        if (invocationId) {
          callsByInvocationId.set(invocationId, callCandidate);
        }
        candidates.push(callCandidate);
        continue;
      }

      const pairedCall = invocationId ? callsByInvocationId.get(invocationId) : null;
      if (pairedCall) {
        pairedCall.evidenceKind = "paired";
        pairedCall.result = part.result;
        pairedCall.toolName = pairedCall.toolName || part.name;
        continue;
      }

      candidates.push({
        messageId: message.id,
        toolInvocationId: invocationId,
        toolName: part.name,
        evidenceKind: "result",
        result: part.result,
        createdAt: message.createdAt,
      });
    }
  }

  return candidates
    .map((candidate) => toGroundingToolEvidence(candidate, maxSummaryCharacters))
    .sort(prioritizeToolEvidence)
    .slice(0, maxEntries);
}

function toGroundingToolEvidence(
  candidate: ToolEvidenceCandidate,
  maxSummaryCharacters: number,
): OperationPromptGroundingToolEvidence {
  const summaryPayload = candidate.evidenceKind === "call"
    ? { args: candidate.callArgs ?? {} }
    : candidate.evidenceKind === "result"
      ? { result: candidate.result }
      : { args: candidate.callArgs ?? {}, result: candidate.result };
  const summary = summarizeToolPayload(summaryPayload, maxSummaryCharacters);
  const error = extractToolError(candidate.result);

  return {
    messageId: candidate.messageId,
    toolInvocationId: candidate.toolInvocationId,
    toolName: candidate.toolName,
    evidenceKind: candidate.evidenceKind,
    summary,
    error,
    relatedOperationId: findRelatedOperationId(summaryPayload),
    createdAt: candidate.createdAt,
  };
}

function prioritizeToolEvidence(
  left: OperationPromptGroundingToolEvidence,
  right: OperationPromptGroundingToolEvidence,
): number {
  const leftScore = evidenceScore(left);
  const rightScore = evidenceScore(right);
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  return Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? "");
}

function evidenceScore(evidence: OperationPromptGroundingToolEvidence): number {
  return (evidence.error ? 10 : 0)
    + (evidence.relatedOperationId ? 5 : 0)
    + (evidence.evidenceKind === "paired" ? 2 : 0);
}

function summarizeToolPayload(value: unknown, maxCharacters: number): string {
  const redacted = redactSecrets(value).value;
  const text = stringifyBounded(redacted);
  return text.length > maxCharacters ? `${text.slice(0, Math.max(0, maxCharacters - 1))}…` : text;
}

function stringifyBounded(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractToolError(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
  const success = typeof record.success === "boolean" ? record.success : null;
  if (success === false || status === "failed" || status === "error") {
    const error = record.error ?? record.message ?? record.reason;
    return typeof error === "string" ? error : "tool_result_failed";
  }

  const error = record.error;
  return typeof error === "string" && error.trim() ? error : null;
}

function findRelatedOperationId(value: unknown): string | null {
  const direct = findDirectOperationId(value);
  if (direct) {
    return direct;
  }

  const text = stringifyBounded(value);
  return text.match(OPERATION_ID_PATTERN)?.[0] ?? null;
}

function findDirectOperationId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findDirectOperationId(item);
      if (nested) return nested;
    }
    return null;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "operationId" || key === "operation_id") && typeof entry === "string") {
      return entry;
    }
    const nested = findDirectOperationId(entry);
    if (nested) return nested;
  }

  return null;
}

export function hasToolEvidencePart(part: MessagePart): boolean {
  return part.type === "tool_call" || part.type === "tool_result";
}
