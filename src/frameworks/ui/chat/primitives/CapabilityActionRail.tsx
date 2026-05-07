import type { InlineNode, ActionLinkType } from "@/core/entities/rich-content";
import { OperationActionButton } from "@/frameworks/ui/operations/OperationActionButton";
import { resolveActionNodeIntent } from "@/frameworks/ui/operations/operation-ui-intent";

type ActionNode = Extract<InlineNode, { type: "action-link" }>;

export interface CapabilityActionRailProps {
  actions?: InlineNode[] | null;
  onActionClick?: (
    actionType: ActionLinkType,
    value: string,
    params?: Record<string, string>,
  ) => void;
}

function isActionNode(node: InlineNode): node is ActionNode {
  return node.type === "action-link";
}

export function CapabilityActionRail({
  actions,
  onActionClick,
}: CapabilityActionRailProps) {
  const actionNodes = actions?.filter(isActionNode) ?? [];

  if (actionNodes.length === 0) {
    return null;
  }

  return (
    <div className="ui-capability-action-rail" data-capability-action-rail="true">
      {actionNodes.map((action, index) => (
        (() => {
          const disabledReason = action.actionType === "operation" ? action.params?.disabledReason : undefined;
          const isDisabled = Boolean(disabledReason);
          if (action.actionType === "operation") {
            return (
              <OperationActionButton
                key={`${action.label}-${index}`}
                action={action}
                compact
                onActionClick={onActionClick}
              />
            );
          }

          return (
            <button
              key={`${action.label}-${index}`}
              type="button"
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                onActionClick?.(action.actionType, action.value, action.params);
              }}
              className={`ui-capability-action focus-ring ${isDisabled ? "cursor-not-allowed opacity-55" : ""}`}
              data-action-intent={resolveActionNodeIntent(action)}
              data-chat-action-link={action.actionType}
              title={disabledReason}
              aria-label={`${action.label} (${action.actionType})`}
            >
              {action.label}
            </button>
          );
        })()
      ))}
    </div>
  );
}
