import type { MessagePart } from "@/core/entities/message-parts";
import { getMediaWorkflowOrchestrator, getMediaWorkflowRepository } from "@/adapters/RepositoryFactory";
import type { ChatRuntimeHook, TurnCompletionSuccessHookState } from "@/lib/chat/runtime-hooks";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPartName(part: MessagePart): string | null {
  const record = part as unknown as Record<string, unknown>;
  return typeof record["name"] === "string" ? record["name"] : null;
}

function getPartResult(part: MessagePart): Record<string, unknown> | null {
  const record = part as unknown as Record<string, unknown>;
  return isRecord(record["result"]) ? record["result"] : null;
}

function getPartArgs(part: MessagePart): Record<string, unknown> | null {
  const record = part as unknown as Record<string, unknown>;
  return isRecord(record["args"]) ? record["args"] : null;
}

function getChartAssetId(parts: readonly MessagePart[]): string | null {
  for (const part of parts) {
    if (getPartName(part) !== "generate_chart") {
      continue;
    }

    const result = getPartResult(part);
    if (typeof result?.["assetId"] === "string") {
      return result["assetId"];
    }
  }

  return null;
}

function getAudioCall(parts: readonly MessagePart[]): { title: string; text: string } | null {
  for (const part of parts) {
    if (getPartName(part) !== "generate_audio") {
      continue;
    }

    const args = getPartArgs(part);
    if (typeof args?.["title"] === "string" && typeof args?.["text"] === "string") {
      return {
        title: args["title"],
        text: args["text"],
      };
    }
  }

  return null;
}

function getAudioJobId(parts: readonly MessagePart[]): string | null {
  for (const part of parts) {
    if (getPartName(part) !== "generate_audio") {
      continue;
    }

    const result = getPartResult(part);
    const deferredJob = isRecord(result?.["deferred_job"]) ? result["deferred_job"] : null;
    if (typeof deferredJob?.["jobId"] === "string") {
      return deferredJob["jobId"];
    }
  }

  return null;
}

function hasComposeCall(parts: readonly MessagePart[]): boolean {
  return parts.some((part) => getPartName(part) === "compose_media");
}

function looksLikeVideoCompositionPromise(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes("video") || normalized.includes("compose");
}

export class MediaWorkflowTurnHook implements ChatRuntimeHook {
  readonly failureMode = "best_effort";

  async afterTurnCompletion(state: TurnCompletionSuccessHookState): Promise<void> {
    if (state.status !== "completed" || !state.persistedMessageId || hasComposeCall(state.assistantParts)) {
      return;
    }

    if (!looksLikeVideoCompositionPromise(state.assistantText)) {
      return;
    }

    const chartAssetId = getChartAssetId(state.assistantParts);
    const audio = getAudioCall(state.assistantParts);
    const audioJobId = getAudioJobId(state.assistantParts);
    if (!chartAssetId || !audio || !audioJobId) {
      return;
    }

    const repository = getMediaWorkflowRepository();
    const existing = repository
      .listWorkflowsByConversation(state.conversationId)
      .find((snapshot) => snapshot.workflow.originMessageId === state.persistedMessageId);
    if (existing) {
      await getMediaWorkflowOrchestrator().reconcileRunnableWorkflows({
        conversationId: state.conversationId,
        userId: state.userId,
        limit: 5,
      });
      return;
    }

    await getMediaWorkflowOrchestrator().reconcileRunnableWorkflows({
      conversationId: state.conversationId,
      userId: state.userId,
      limit: 5,
    });
  }
}
