import type { ActionLinkInlineNode } from "@/core/entities/rich-content";
import type { OperationAction } from "@/core/entities/operation";
import {
  operationActionToActionLink,
  operationActionsToActionLinks,
} from "@/lib/operations/operation-action-view-model";

export function operationActionToMarkdown(action: OperationAction): string {
  return operationActionLinkToMarkdown(operationActionToActionLink(action));
}

export function operationActionsToMarkdown(actions: readonly OperationAction[]): string {
  return operationActionsToActionLinks(actions)
    .map(operationActionLinkToMarkdown)
    .join(" ");
}

export function operationActionLinkToMarkdown(link: ActionLinkInlineNode): string {
  if (link.actionType !== "operation") {
    throw new Error("Only operation action links can be serialized by operationActionLinkToMarkdown.");
  }

  const query = [
    ["operation", link.value],
    ...Object.entries(link.params ?? {}),
  ].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");

  return `[${sanitizeLabel(link.label)}](?${query})`;
}

function sanitizeLabel(label: string): string {
  return label.replace(/[\[\]\n\r]/g, " ").replace(/\s+/g, " ").trim() || "Operation";
}
