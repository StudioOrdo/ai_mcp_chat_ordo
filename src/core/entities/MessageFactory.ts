import type { MessagePart } from "./message-parts";
import type { ChatMessage, ChatMessageMetadata } from "./chat-message";

/**
 * Message Factory (GoF Factory Method)
 * 
 * Standardizes the creation of ChatMessage entities ensuring 
 * consistent default values for id, timestamps, and metadata.
 */
export class MessageFactory {
  static create(
    role: "user" | "assistant", 
    content: string, 
    parts: MessagePart[] = [],
    metadata?: ChatMessageMetadata,
  ): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role,
      content,
      parts,
      metadata,
      timestamp: new Date()
    };
  }

  static createUserMessage(content: string, parts?: MessagePart[], metadata?: ChatMessageMetadata): ChatMessage {
    return this.create("user", content, parts ?? (content ? [{ type: "text", text: content }] : []), metadata);
  }

  static createAssistantMessage(content: string = "", parts: MessagePart[] = [], metadata?: ChatMessageMetadata): ChatMessage {
    return this.create("assistant", content, parts, metadata);
  }

  static createHeroMessage(content: string, suggestions: string[]): ChatMessage {
    const responseStateTag = `\n\n__response_state__:${JSON.stringify("open")}`;
    const suggestionTag = `\n\n__suggestions__:[${suggestions.map(s => `"${s}"`).join(",")}]`;
    return this.create("assistant", content + responseStateTag + suggestionTag, [], {
      responseState: "open",
    });
  }

  static createSystemMessage(metadata: ChatMessageMetadata): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: "system",
      content: "",
      parts: [],
      metadata,
      timestamp: new Date(),
    };
  }
}
