import type {
  OperationGateFact,
  OperationIntentRouteResult,
} from "@/core/use-cases/operations/OperationIntent";
import type { OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import { operationActionsToMarkdown } from "@/lib/operations/operation-action-markdown";
import {
  operationSnapshotToCardModel,
  serializeOperationCardMarkdown,
} from "@/lib/operations/operation-presentation";

export function projectOperationIntentResult(result: OperationIntentRouteResult): string | null {
  switch (result.kind) {
    case "pass_through":
      return null;
    case "clarification_response":
    case "rejected_response":
      return result.message;
    case "created_operation":
      return projectOperationSnapshot({
        snapshot: result.snapshot,
        heading: "Operation Draft Created",
        reason: result.compilerOutput.summary,
        gates: result.blockingGates,
      });
    case "blocked_operation":
      return projectOperationSnapshot({
        snapshot: result.snapshot,
        heading: "Operation Blocked",
        reason: result.compilerOutput.summary,
        gates: result.blockingGates,
      });
    case "existing_operation":
      return projectOperationSnapshot({
        snapshot: result.snapshot,
        heading: "Existing Operation Found",
        reason: "I found an active operation for this conversation instead of creating a duplicate.",
        gates: readGatesFromSnapshot(result.snapshot),
      });
  }
}

export function projectOperationSnapshot(input: {
  snapshot: OperationSnapshot;
  heading: string;
  reason: string;
  gates?: readonly OperationGateFact[];
}): string {
  const operation = input.snapshot.operation;
  const lines = [
    serializeOperationCardMarkdown(operationSnapshotToCardModel(input.snapshot)),
    "",
    `**${input.heading}:** ${operation.title}`,
    "",
    `Status: \`${operation.status}\``,
    `Risk: \`${operation.riskLevel}\``,
    `Operation: \`${operation.id}\``,
    "",
    input.reason,
  ];

  const gates = input.gates ?? readGatesFromSnapshot(input.snapshot);
  if (gates.length > 0) {
    lines.push("", "**Gates**");
    for (const gate of gates) {
      lines.push(`- \`${gate.id}\`: ${gate.summary}${gate.remediation ? ` ${gate.remediation}` : ""}`);
    }
  }

  const disabledActions = input.snapshot.actions.filter((action) => !action.enabled && action.disabledReason);
  if (disabledActions.length > 0) {
    lines.push("", "**Disabled Actions**");
    for (const action of disabledActions) {
      lines.push(`- ${action.label}: ${action.disabledReason}`);
    }
  }

  if (input.snapshot.actions.length > 0) {
    lines.push("", operationActionsToMarkdown(input.snapshot.actions));
  }

  return lines.join("\n");
}

function readGatesFromSnapshot(snapshot: OperationSnapshot): OperationGateFact[] {
  const gates = snapshot.operation.input.gates;
  return Array.isArray(gates)
    ? gates.filter(isGateFact)
    : [];
}

function isGateFact(value: unknown): value is OperationGateFact {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as { id?: unknown }).id === "string"
    && typeof (value as { summary?: unknown }).summary === "string";
}
