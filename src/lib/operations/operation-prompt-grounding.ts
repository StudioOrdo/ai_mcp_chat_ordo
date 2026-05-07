import type {
  OperationPromptGroundingSnapshot,
  OperationPromptGroundingToolEvidence,
} from "@/core/use-cases/operations/OperationPromptGrounding";

export interface OperationPromptGroundingPromptSection {
  key: "operation_grounding";
  priority: 43;
  content: string;
  payload: {
    status: OperationPromptGroundingSnapshot["status"];
    generatedAt: string;
    conversationId: string;
    operationRefs: Array<{
      operationId: string;
      kind: string;
      status: string;
      revision: number;
      groundingReason: string;
    }>;
    toolEvidenceRefs: Array<{
      messageId: string;
      toolInvocationId: string | null;
      toolName: string;
      evidenceKind: string;
      relatedOperationId: string | null;
    }>;
    warnings: string[];
  };
}

export function buildOperationPromptGroundingSection(
  snapshot: OperationPromptGroundingSnapshot,
): OperationPromptGroundingPromptSection | null {
  if (!snapshot.includeInPrompt) {
    return null;
  }

  return {
    key: "operation_grounding",
    priority: 43,
    content: buildOperationGroundingPromptText(snapshot),
    payload: {
      status: snapshot.status,
      generatedAt: snapshot.generatedAt,
      conversationId: snapshot.conversationId,
      operationRefs: snapshot.operations.map((operation) => ({
        operationId: operation.operationId,
        kind: operation.kind,
        status: operation.status,
        revision: operation.revision,
        groundingReason: operation.groundingReason,
      })),
      toolEvidenceRefs: snapshot.toolEvidence.map((evidence) => ({
        messageId: evidence.messageId,
        toolInvocationId: evidence.toolInvocationId,
        toolName: evidence.toolName,
        evidenceKind: evidence.evidenceKind,
        relatedOperationId: evidence.relatedOperationId,
      })),
      warnings: snapshot.warnings,
    },
  };
}

export function buildOperationGroundingPromptText(
  snapshot: OperationPromptGroundingSnapshot,
): string {
  if (snapshot.status === "unavailable") {
    return [
      "[Server operation grounding]",
      "Operation grounding is unavailable for this turn. Do not claim that an operation completed, failed, or is ready unless the current message explicitly contains trusted operation state.",
      ...snapshot.warnings.map((warning) => `- warning: ${warning}`),
    ].join("\n");
  }

  if (snapshot.status === "empty") {
    return [
      "[Server operation grounding]",
      "No current operation state was found for this conversation. Do not infer operation success, failure, readiness, or available actions from chat text alone.",
      ...snapshot.warnings.map((warning) => `- warning: ${warning}`),
    ].join("\n");
  }

  const lines = [
    "[Server operation grounding]",
    "This block is authoritative for operation state. Do not infer operation success, failure, or available actions from chat text if it conflicts with this block.",
    "Ledger status beats chat text. Operation events beat tool result prose. Tool result evidence can explain what happened, but cannot mark an operation complete unless operation status says so.",
    "If an action is not listed as available here, do not tell the user to click it or imply it can be executed.",
  ];

  for (const operation of snapshot.operations) {
    lines.push(
      "",
      `Operation ${operation.operationId} (${operation.kind})`,
      `- title: ${operation.title}`,
      `- status: ${operation.status}`,
      `- risk: ${operation.riskLevel}`,
      `- revision: ${operation.revision}`,
      `- current step: ${operation.currentStepId ?? "none"}`,
      `- reason included: ${operation.groundingReason}`,
    );

    if (operation.summary) {
      lines.push(`- summary: ${operation.summary}`);
    }
    if (operation.error) {
      lines.push(`- error: ${operation.error.code} - ${operation.error.message}`);
    }
    lines.push(`- progress: ${operation.progress.percentComplete}% complete`);

    lines.push("- latest events:");
    if (operation.latestEvents.length === 0) {
      lines.push("  - none");
    } else {
      for (const event of operation.latestEvents) {
        lines.push(`  - #${event.sequence} ${event.type} at ${event.createdAt}: ${event.payloadSummary}`);
      }
    }

    lines.push("- available actions:");
    if (operation.availableActions.length === 0) {
      lines.push("  - none");
    } else {
      for (const action of operation.availableActions) {
        const disabled = action.enabled === false && action.disabledReason
          ? ` disabled=${action.disabledReason}`
          : "";
        const risk = action.riskLevel ? ` risk=${action.riskLevel}` : "";
        const confirm = action.confirmPolicy ? ` confirm=${action.confirmPolicy}` : "";
        lines.push(`  - ${action.id} (${action.actionType}): ${action.label}${risk}${confirm}${disabled}`);
      }
    }

    lines.push("- artifacts:");
    if (operation.artifacts.length === 0) {
      lines.push("  - none");
    } else {
      for (const artifact of operation.artifacts) {
        lines.push(`  - ${artifact.label}: ${artifact.uri}`);
      }
    }
  }

  appendToolEvidence(lines, snapshot.toolEvidence);

  const promptText = lines.join("\n");
  const maxCharacters = snapshot.budget.maxSerializedSectionCharacters;
  if (promptText.length <= maxCharacters) {
    return promptText;
  }

  return `${promptText.slice(0, Math.max(0, maxCharacters - 80))}\n[operation grounding truncated to prompt budget]`;
}

function appendToolEvidence(
  lines: string[],
  toolEvidence: readonly OperationPromptGroundingToolEvidence[],
): void {
  lines.push("", "Relevant tool evidence:");
  if (toolEvidence.length === 0) {
    lines.push("- none");
    return;
  }

  for (const evidence of toolEvidence) {
    const invocation = evidence.toolInvocationId ? ` ${evidence.toolInvocationId}` : "";
    const relation = evidence.relatedOperationId ? ` related=${evidence.relatedOperationId}` : "";
    const descriptor = `${evidence.toolName} ${evidence.evidenceKind}${invocation}${relation}`;
    const error = evidence.error ? ` failed - ${evidence.error}` : evidence.summary;
    lines.push(`- ${descriptor}: ${error.trimStart()}`);
  }
}
