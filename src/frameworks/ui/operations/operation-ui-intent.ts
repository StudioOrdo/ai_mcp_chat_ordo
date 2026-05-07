import type { ActionLinkInlineNode } from "@/core/entities/rich-content";
import type { OperationRiskLevel } from "@/core/entities/operation";

export type OperationActionVisualIntent = "primary" | "secondary" | "danger";

export function resolveOperationActionIntent(input: {
  actionType: string;
  label: string;
  value: string;
  params?: Record<string, string>;
}): OperationActionVisualIntent {
  if (input.actionType === "operation") {
    const riskLevel = input.params?.riskLevel as OperationRiskLevel | undefined;
    if (riskLevel === "destructive" || riskLevel === "high") return "danger";
    return "primary";
  }

  const label = input.label.toLowerCase();
  const value = input.value.toLowerCase();
  if (label.includes("cancel") || label.includes("delete") || value.includes("cancel")) {
    return "danger";
  }

  if (label.includes("execute") || label.includes("confirm") || label.includes("start") || label.includes("open")) {
    return "primary";
  }

  return "secondary";
}

export function resolveActionNodeIntent(action: ActionLinkInlineNode): OperationActionVisualIntent {
  return resolveOperationActionIntent({
    actionType: action.actionType,
    label: action.label,
    value: action.value,
    params: action.params,
  });
}
