import type { Message } from "@/core/entities/conversation";
import type { RoleName } from "@/core/entities/user";
import {
  DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
  OperationPromptGrounding,
  type OperationPromptGroundingSnapshot,
} from "@/core/use-cases/operations/OperationPromptGrounding";
import { getOperationRepository } from "@/adapters/RepositoryFactory";
import {
  buildOperationPromptGroundingSection,
  type OperationPromptGroundingPromptSection,
} from "@/lib/operations/operation-prompt-grounding";
import { extractOperationToolEvidence } from "@/lib/operations/operation-tool-evidence";
import { logDegradation } from "@/lib/observability/logger";
import { REASON_CODES } from "@/lib/observability/reason-codes";

export interface OperationPromptGroundingBuildResult {
  snapshot: OperationPromptGroundingSnapshot;
  section: OperationPromptGroundingPromptSection | null;
}

export async function buildOperationPromptGroundingForConversation(options: {
  conversationId: string;
  userId: string;
  role: RoleName;
  latestUserText: string;
  messages: readonly Message[];
  contextWindowGuard?: {
    status: string;
    reasons: readonly string[];
  };
  now?: string;
}): Promise<OperationPromptGroundingBuildResult> {
  let snapshot: OperationPromptGroundingSnapshot;
  try {
    const toolEvidence = extractOperationToolEvidence(options.messages);
    const grounding = new OperationPromptGrounding(getOperationRepository());
    snapshot = await grounding.build({
      conversationId: options.conversationId,
      userId: options.userId,
      role: options.role,
      latestUserText: options.latestUserText,
      toolEvidence,
      now: options.now,
    });
  } catch (error) {
    snapshot = buildUnavailableSnapshot(options, error);
  }

  if (snapshot.status === "unavailable") {
    logDegradation(
      REASON_CODES.UNKNOWN_ROUTE_ERROR,
      "Operation prompt grounding unavailable; continuing with explicit prompt warning",
      { conversationId: options.conversationId },
    );
  }

  return {
    snapshot,
    section: buildOperationPromptGroundingSection(snapshot),
  };
}

function buildUnavailableSnapshot(
  options: {
    conversationId: string;
    now?: string;
  },
  error: unknown,
): OperationPromptGroundingSnapshot {
  return {
    generatedAt: options.now ?? new Date().toISOString(),
    conversationId: options.conversationId,
    status: "unavailable",
    includeInPrompt: true,
    operations: [],
    toolEvidence: [],
    budget: {
      ...DEFAULT_OPERATION_PROMPT_GROUNDING_BUDGET,
      operationsDropped: 0,
      eventsDropped: 0,
      artifactsDropped: 0,
      actionsDropped: 0,
      toolEvidenceDropped: 0,
    },
    warnings: [
      `operation_grounding_unavailable:${error instanceof Error ? error.message : String(error)}`,
    ],
  };
}
