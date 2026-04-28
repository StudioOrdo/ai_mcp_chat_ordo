import type { MessagePart } from "./message-parts";
import type { LifecycleEnvelope } from "./lifecycle";
import type { CoachEnvelope } from "./coach";

export type MessageRole = "user" | "assistant" | "system";

export type ChatResponseState = "open" | "closed" | "needs_input";

export interface FailedSendMetadata {
  retryKey: string;
  failedUserMessageId: string;
}

export interface ChatMessageMetadata {
  failedSend?: FailedSendMetadata;
  responseState?: ChatResponseState;
  lifecycle?: LifecycleEnvelope;
  coach?: CoachEnvelope;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  parts?: MessagePart[];
  metadata?: ChatMessageMetadata;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
}

export function extractToolCalls(parts?: MessagePart[]): ToolCallInfo[] {
  if (!parts) return [];
  const calls: ToolCallInfo[] = [];
  for (const part of parts) {
    if (part.type === "tool_call") {
      calls.push({ name: part.name, args: part.args });
    }
  }
  return calls;
}
