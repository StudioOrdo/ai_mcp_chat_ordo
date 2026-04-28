import type { StreamEvent } from "../core/entities/chat-stream";
import type {
  ChatStream,
  ChatStreamProvider,
  FetchChatStreamOptions,
} from "../core/use-cases/ChatStreamProvider";
import { logDegradation } from "@/lib/observability/logger";
import { 
  ConversationIdParser,
  EventParser, 
  ErrorParser,
  GenerationInterruptedParser,
  GenerationStoppedParser,
  JobCanceledParser,
  JobCompletedParser,
  JobFailedParser,
  JobProgressParser,
  JobQueuedParser,
  JobStartedParser,
  StreamIdParser,
  TextDeltaParser, 
  ToolCallParser, 
  ToolResultParser 
} from "./chat/EventParserStrategy";

export class ChatStreamAdapter implements ChatStreamProvider {
  private readonly parser = new EventParser([
    new TextDeltaParser(),
    new ToolCallParser(),
    new ToolResultParser(),
    new StreamIdParser(),
    new ConversationIdParser(),
    new GenerationStoppedParser(),
    new GenerationInterruptedParser(),
    new JobQueuedParser(),
    new JobStartedParser(),
    new JobProgressParser(),
    new JobCompletedParser(),
    new JobCanceledParser(),
    new JobFailedParser(),
    new ErrorParser()
  ]);

  async fetchStream(
    messages: { role: string; content: string }[],
    options?: FetchChatStreamOptions,
  ): Promise<ChatStream> {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        conversationId: options?.conversationId,
        currentPathname: options?.currentPathname,
        currentPageSnapshot: options?.currentPageSnapshot,
        attachments: options?.attachments,
        taskOriginHandoff: options?.taskOriginHandoff,
        mediaContinuityHandoff: options?.mediaContinuityHandoff,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let isCancelled = false;
    const parser = this.parser;

    const eventIterator = async function* (): AsyncIterableIterator<StreamEvent> {
      let buffer = "";
      try {
        while (!isCancelled) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              const event = parser.parse(data);
              if (event) yield event;
            } catch {
              logDegradation("SSE_JSON_PARSE_ERROR", "Invalid SSE JSON", { data: dataStr.slice(0, 200) });
            }
          }
        }

        buffer += decoder.decode();
        for (const line of buffer.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            const event = parser.parse(data);
            if (event) yield event;
          } catch {
            logDegradation("SSE_JSON_PARSE_ERROR", "Invalid SSE JSON", { data: dataStr.slice(0, 200) });
          }
        }

        yield { type: "done" };
      } catch (error) {
        yield { type: "error", message: error instanceof Error ? error.message : "Unknown stream error" };
      }
    };

    return {
      events: eventIterator,
      cancel: () => { 
        isCancelled = true; 
        reader.cancel(); 
      }
    };
  }
}
