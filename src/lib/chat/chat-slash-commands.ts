import type { Command } from "@/core/commands/Command";
import { CommandRegistry } from "@/core/commands/CommandRegistry";
import type { ConversationInteractor } from "@/core/use-cases/ConversationInteractor";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import type { SummarizationInteractor } from "@/core/use-cases/SummarizationInteractor";
import type { Message } from "@/core/entities/conversation";
import type { RoleName } from "@/core/entities/user";
import { embedConversation } from "@/lib/chat/embed-conversation";
import { logDegradation } from "@/lib/observability/logger";
import { getActiveJobStatuses } from "@/lib/jobs/job-read-model";

export interface ChatSlashCommandContext {
  conversationId: string;
  userId: string;
  role: RoleName;
  isAnonymous: boolean;
  interactor: ConversationInteractor;
  summarizationInteractor: SummarizationInteractor;
  jobStatusQuery: JobStatusQuery;
}

export interface ChatSlashCommandResult {
  conversationId: string;
  replyText: string | null;
  streamText?: string | null;
}

export interface ParsedChatSlashCommand {
  kind: "supported";
  command: ChatSlashCommand;
  commandName: string;
  argsText: string;
}

export interface UnsupportedChatSlashCommand {
  kind: "unsupported";
  commandName: string;
  argsText: string;
}

export interface EmptyChatSlashCommand {
  kind: "empty";
}

export type ResolvedChatSlashCommand =
  | ParsedChatSlashCommand
  | UnsupportedChatSlashCommand
  | EmptyChatSlashCommand;

type ChatSlashCommand = Omit<Command, "execute"> & {
  execute(context?: ChatSlashCommandContext): Promise<ChatSlashCommandResult>;
};

const SLASH_COMMAND_PATTERN = /^\/([^\s/]*)(?:\s+(.*))?$/i;
const VALID_COMMAND_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/i;

function buildAssistantMessagePayload(text: string) {
  return {
    content: text,
    parts: [{ type: "text" as const, text }],
  };
}

function countCompactionBoundaries(messages: Message[]): number {
  return messages.reduce((count, message) => {
    return count + message.parts.filter(
      (part) => part.type === "summary" || part.type === "meta_summary" || part.type === "compaction_marker",
    ).length;
  }, 0);
}

function formatActiveJobSummary(
  jobs: Awaited<ReturnType<JobStatusQuery["listConversationJobSnapshots"]>>,
): string {
  if (jobs.length === 0) {
    return "Active jobs: none.";
  }

  const jobSummary = jobs
    .map((job) => {
      const progress = job.progressLabel ? ` (${job.progressLabel})` : "";
      return `${job.label}: ${job.status}${progress}`;
    })
    .join("; ");

  return `Active jobs: ${jobSummary}.`;
}

class ClearConversationCommand implements ChatSlashCommand {
  readonly id = "clear";
  readonly title = "Clear Conversation";
  readonly category = "Chat";

  async execute(context?: ChatSlashCommandContext): Promise<ChatSlashCommandResult> {
    if (!context) {
      throw new Error("Clear conversation command requires runtime context.");
    }

    const clearedConversationId = context.conversationId;
    const archived = await context.interactor.archiveActive(context.userId);

    if (archived) {
      const replyText = "Started a fresh conversation. The previous thread was archived.";
      await context.interactor.appendMessage(
        {
          conversationId: clearedConversationId,
          role: "assistant",
          ...buildAssistantMessagePayload(replyText),
        },
        context.userId,
      );

      if (!context.isAnonymous) {
        embedConversation(clearedConversationId, context.userId).catch((error) => {
          logDegradation(
            "ARCHIVE_EMBEDDING_ERROR",
            "Embedding error during slash-command clear",
            { conversationId: clearedConversationId },
            error,
          );
        });
      }
    }

    const nextConversation = await context.interactor.ensureActive(context.userId);
    return {
      conversationId: nextConversation.id,
      replyText: archived
        ? "Started a fresh conversation. The previous thread was archived."
        : "Started a fresh conversation.",
      streamText: null,
    };
  }
}

class CompactConversationCommand implements ChatSlashCommand {
  readonly id = "compact";
  readonly title = "Compact Conversation";
  readonly category = "Chat";

  async execute(context?: ChatSlashCommandContext): Promise<ChatSlashCommandResult> {
    if (!context) {
      throw new Error("Compact conversation command requires runtime context.");
    }

    const before = await context.interactor.get(context.conversationId, context.userId);
    const compactedBefore = countCompactionBoundaries(before.messages);

    await context.summarizationInteractor.summarizeIfNeeded(context.conversationId);

    const after = await context.interactor.get(context.conversationId, context.userId);
    const compactedAfter = countCompactionBoundaries(after.messages);
    const replyText = compactedAfter > compactedBefore
      ? `Conversation compacted. Summary boundaries increased from ${compactedBefore} to ${compactedAfter}.`
      : `No compaction was needed. The conversation currently has ${after.conversation.messageCount} messages.`;

    await context.interactor.appendMessage(
      {
        conversationId: context.conversationId,
        role: "assistant",
        ...buildAssistantMessagePayload(replyText),
      },
      context.userId,
    );

    return {
      conversationId: context.conversationId,
      replyText,
    };
  }
}

class ExportConversationCommand implements ChatSlashCommand {
  readonly id = "export";
  readonly title = "Export Conversation";
  readonly category = "Chat";

  async execute(context?: ChatSlashCommandContext): Promise<ChatSlashCommandResult> {
    if (!context) {
      throw new Error("Export conversation command requires runtime context.");
    }

    const exportPath = `/api/conversations/${encodeURIComponent(context.conversationId)}/export`;
    const replyText = `Conversation export is ready. [Download the JSON export](?external=${encodeURIComponent(exportPath)})`;

    await context.interactor.appendMessage(
      {
        conversationId: context.conversationId,
        role: "assistant",
        ...buildAssistantMessagePayload(replyText),
      },
      context.userId,
    );

    return {
      conversationId: context.conversationId,
      replyText,
    };
  }
}

class StatusConversationCommand implements ChatSlashCommand {
  readonly id = "status";
  readonly title = "Conversation Status";
  readonly category = "Chat";

  async execute(context?: ChatSlashCommandContext): Promise<ChatSlashCommandResult> {
    if (!context) {
      throw new Error("Conversation status command requires runtime context.");
    }

    const { conversation } = await context.interactor.get(context.conversationId, context.userId);
    const activeJobs = await context.jobStatusQuery.listConversationJobSnapshots(
      context.conversationId,
      {
        statuses: getActiveJobStatuses(),
        limit: 5,
      },
    );

    const confidence = conversation.routingSnapshot.confidence == null
      ? "unknown confidence"
      : `${Math.round(conversation.routingSnapshot.confidence * 100)}% confidence`;

    const replyText = [
      `Conversation status: ${conversation.status}.`,
      `Messages: ${conversation.messageCount}.`,
      `Lane: ${conversation.routingSnapshot.lane} (${confidence}).`,
      conversation.routingSnapshot.detectedNeedSummary
        ? `Signals: ${conversation.routingSnapshot.detectedNeedSummary}`
        : "Signals: none recorded.",
      conversation.routingSnapshot.recommendedNextStep
        ? `Next step: ${conversation.routingSnapshot.recommendedNextStep}`
        : "Next step: none recorded.",
      `Last tool: ${conversation.lastToolUsed ?? "none"}.`,
      formatActiveJobSummary(activeJobs),
    ].join("\n");

    await context.interactor.appendMessage(
      {
        conversationId: context.conversationId,
        role: "assistant",
        ...buildAssistantMessagePayload(replyText),
      },
      context.userId,
    );

    return {
      conversationId: context.conversationId,
      replyText,
    };
  }
}

let cachedRegistry: CommandRegistry | null = null;

function getChatSlashCommandRegistry(): CommandRegistry {
  if (!cachedRegistry) {
    cachedRegistry = CommandRegistry.create([
      new ClearConversationCommand(),
      new CompactConversationCommand(),
      new ExportConversationCommand(),
      new StatusConversationCommand(),
    ]);
  }

  return cachedRegistry;
}

function parseSlashCommand(text: string): { commandName: string | null; argsText: string } | null {
  const match = SLASH_COMMAND_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }

  return {
    commandName: match[1] ? match[1].toLowerCase() : null,
    argsText: match[2]?.trim() ?? "",
  };
}

export function getSupportedChatSlashCommandNames(): string[] {
  return getChatSlashCommandRegistry()
    .getAllCommands()
    .map((command) => command.id)
    .sort((left, right) => left.localeCompare(right));
}

function formatSupportedChatSlashCommands(): string {
  return getSupportedChatSlashCommandNames()
    .map((commandName) => `/${commandName}`)
    .join(", ");
}

export function createEmptyChatSlashCommandMessage(): string {
  return `Enter a slash command after "/". Available commands: ${formatSupportedChatSlashCommands()}.`;
}

export function createUnsupportedChatSlashCommandMessage(commandName: string): string {
  return `Unsupported slash command "/${commandName}". Available commands: ${formatSupportedChatSlashCommands()}.`;
}

export function resolveChatSlashCommand(text: string): ResolvedChatSlashCommand | null {
  const parsed = parseSlashCommand(text);
  if (!parsed) {
    return null;
  }

  if (!parsed.commandName) {
    return { kind: "empty" };
  }

  if (!VALID_COMMAND_NAME_PATTERN.test(parsed.commandName)) {
    return {
      kind: "unsupported",
      commandName: parsed.commandName,
      argsText: parsed.argsText,
    };
  }

  const command = getChatSlashCommandRegistry().resolveCommand(parsed.commandName) as ChatSlashCommand | undefined;
  if (!command) {
    return {
      kind: "unsupported",
      commandName: parsed.commandName,
      argsText: parsed.argsText,
    };
  }

  return {
    kind: "supported",
    command,
    commandName: parsed.commandName,
    argsText: parsed.argsText,
  };
}

/** @internal */
export function _resetChatSlashCommandRegistry(): void {
  cachedRegistry = null;
}