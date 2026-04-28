import type { Message } from "@/core/entities/conversation";
import type {
  CompactionMarkerMessagePart,
  MessagePart,
} from "@/core/entities/message-parts";

const CONTENT_SUMMARY_MAX_LENGTH = 500;

export type TranscriptEntryRole = "user" | "assistant" | "tool_result" | "system" | "compaction_marker";

export interface TranscriptEntry {
  turnIndex: number;
  timestamp: string;
  role: TranscriptEntryRole;
  contentSummary: string;
  contentHash: string;
  tokenEstimate: number;
  inContextWindow: boolean;
  sourceMessageId?: string;
  toolInvocationId?: string;
  compactedCount?: number;
  compactionKind?: CompactionMarkerMessagePart["kind"];
  coversUpToMessageId?: string;
  coversUpToSummaryId?: string;
}

function hashText(text: string): string {
  let first = 0xdeadbeef ^ text.length;
  let second = 0x41c6ce57 ^ text.length;

  for (let index = 0; index < text.length; index++) {
    const codePoint = text.charCodeAt(index);
    first = Math.imul(first ^ codePoint, 2654435761);
    second = Math.imul(second ^ codePoint, 1597334677);
  }

  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);

  return `${(second >>> 0).toString(16).padStart(8, "0")}${(first >>> 0).toString(16).padStart(8, "0")}`;
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "(no text content)";
  }

  if (normalized.length <= CONTENT_SUMMARY_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, CONTENT_SUMMARY_MAX_LENGTH - 1).trimEnd()}...`;
}

function summarizeUnknown(value: unknown): string {
  if (typeof value === "string") {
    return summarizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }

  if (typeof value === "undefined") {
    return "(undefined)";
  }

  try {
    return summarizeText(JSON.stringify(value));
  } catch {
    return "[unserializable tool result]";
  }
}

function buildCompactionMarkerSummary(marker: CompactionMarkerMessagePart): string {
  if (marker.kind === "meta_summary") {
    return `Conversation summaries compacted through summary ${marker.coversUpToSummaryId ?? "unknown"} (${marker.compactedCount} summaries).`;
  }

  return `Conversation messages compacted through message ${marker.coversUpToMessageId ?? "unknown"} (${marker.compactedCount} messages).`;
}

function roleLabel(role: TranscriptEntryRole): string {
  switch (role) {
    case "tool_result":
      return "Tool Result";
    case "compaction_marker":
      return "Compaction Marker";
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "system":
      return "System";
  }
}

export class TranscriptStore {
  private readonly entries: TranscriptEntry[];
  private turnCounter: number;

  constructor(entries: TranscriptEntry[] = []) {
    this.entries = entries.map((entry) => ({ ...entry }));
    this.turnCounter = this.entries.reduce((highest, entry) => Math.max(highest, entry.turnIndex), -1) + 1;
  }

  static fromEntries(entries: TranscriptEntry[]): TranscriptStore {
    return new TranscriptStore(entries);
  }

  static fromMessages(messages: Message[]): TranscriptStore {
    const store = new TranscriptStore();

    for (const message of messages) {
      store.appendMessage(message, message.role !== "system");

      for (const part of message.parts ?? []) {
        if (part.type === "tool_result") {
          store.appendToolResult(message.id, message.createdAt, part);
        }

        if (part.type === "compaction_marker") {
          store.appendCompactionMarker(message.id, message.createdAt, part);
        }
      }
    }

    return store;
  }

  append(entry: Omit<TranscriptEntry, "turnIndex">): TranscriptEntry {
    const fullEntry: TranscriptEntry = {
      ...entry,
      turnIndex: this.turnCounter++,
    };

    this.entries.push(fullEntry);
    return fullEntry;
  }

  appendMessage(
    message: Pick<Message, "id" | "role" | "content" | "createdAt" | "tokenEstimate">,
    inContextWindow: boolean,
  ): TranscriptEntry {
    return this.append({
      timestamp: message.createdAt,
      role: message.role,
      contentSummary: summarizeText(message.content),
      contentHash: hashText(message.content),
      tokenEstimate: message.tokenEstimate,
      inContextWindow,
      sourceMessageId: message.id,
    });
  }

  appendToolResult(
    messageId: string,
    timestamp: string,
    part: Extract<MessagePart, { type: "tool_result" }>,
  ): TranscriptEntry {
    const contentSummary = `${part.name}: ${summarizeUnknown(part.result)}`;

    return this.append({
      timestamp,
      role: "tool_result",
      contentSummary,
      contentHash: hashText(contentSummary),
      tokenEstimate: Math.ceil(contentSummary.length / 4),
      inContextWindow: true,
      sourceMessageId: messageId,
      ...(part.toolInvocationId ? { toolInvocationId: part.toolInvocationId } : {}),
    });
  }

  appendCompactionMarker(
    messageId: string,
    timestamp: string,
    marker: CompactionMarkerMessagePart,
  ): TranscriptEntry {
    const contentSummary = buildCompactionMarkerSummary(marker);

    return this.append({
      timestamp,
      role: "compaction_marker",
      contentSummary,
      contentHash: hashText(contentSummary),
      tokenEstimate: 0,
      inContextWindow: false,
      sourceMessageId: messageId,
      compactedCount: marker.compactedCount,
      compactionKind: marker.kind,
      ...(marker.coversUpToMessageId ? { coversUpToMessageId: marker.coversUpToMessageId } : {}),
      ...(marker.coversUpToSummaryId ? { coversUpToSummaryId: marker.coversUpToSummaryId } : {}),
    });
  }

  replay(): TranscriptEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  exportAsJson(): TranscriptEntry[] {
    return this.replay();
  }

  exportAsMarkdown(): string {
    return this.entries
      .filter((entry) => entry.role !== "compaction_marker")
      .map((entry) => `**[${roleLabel(entry.role)}]** ${entry.contentSummary}`)
      .join("\n\n")
      .trim();
  }
}

export function buildTranscriptFromMessages(messages: Message[]): TranscriptEntry[] {
  return TranscriptStore.fromMessages(messages).exportAsJson();
}