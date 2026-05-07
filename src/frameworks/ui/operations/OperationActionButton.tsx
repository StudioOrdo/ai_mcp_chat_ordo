import type { ActionLinkInlineNode, ActionLinkType } from "@/core/entities/rich-content";
import { resolveActionNodeIntent, resolveOperationActionIntent } from "@/frameworks/ui/operations/operation-ui-intent";

export interface OperationActionButtonProps {
  action?: ActionLinkInlineNode;
  label?: string;
  actionType?: ActionLinkType;
  value?: string;
  params?: Record<string, string>;
  disabled?: boolean;
  compact?: boolean;
  includeActionTypeInLabel?: boolean;
  onActionClick?: (actionType: ActionLinkType, value: string, params?: Record<string, string>) => void;
}

export function OperationActionButton({
  action,
  label = action?.label ?? "",
  actionType = action?.actionType ?? "operation",
  value = action?.value ?? "",
  params = action?.params,
  disabled = false,
  compact = false,
  includeActionTypeInLabel = true,
  onActionClick,
}: OperationActionButtonProps) {
  const disabledReason = actionType === "operation" ? params?.disabledReason : undefined;
  const isDisabled = disabled || Boolean(disabledReason);
  const intent = action
    ? resolveActionNodeIntent(action)
    : resolveOperationActionIntent({ actionType, label, value, params });

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        onActionClick?.(actionType, value, params);
      }}
      className={classForIntent(intent, isDisabled, compact)}
      data-chat-action-link={actionType}
      data-chat-action-chip={actionType}
      data-operation-action={actionType === "operation" ? "true" : undefined}
      data-action-intent={intent}
      title={disabledReason}
      aria-label={includeActionTypeInLabel ? `${label} (${actionType})` : label}
    >
      {label}
    </button>
  );
}

function classForIntent(intent: "primary" | "secondary" | "danger", disabled: boolean, compact: boolean): string {
  const base = `ui-operation-action-button inline-flex min-h-8 items-center gap-(--space-2) rounded-lg border-2 ${compact ? "px-(--space-2) py-1 text-[0.75rem]" : "px-(--space-inset-compact) py-(--space-1) text-[0.82rem]"} font-semibold no-underline shadow-[0_10px_22px_-18px_color-mix(in_srgb,var(--shadow-base)_42%,transparent)] transition-[background-color,border-color,color,box-shadow,transform] focus-ring`;

  if (disabled) {
    return `${base} cursor-not-allowed border-foreground/14 bg-surface-muted/55 text-foreground/42 shadow-none`;
  }

  if (intent === "danger") {
    return `${base} border-[color:color-mix(in_srgb,var(--danger,#b42318)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--danger,#b42318)_12%,var(--surface))] text-[color:var(--danger,#b42318)] hover:border-[color:color-mix(in_srgb,var(--danger,#b42318)_58%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--danger,#b42318)_18%,var(--surface))] active:translate-y-px`;
  }

  if (intent === "primary") {
    return `${base} border-accent-interactive/46 bg-accent-interactive/12 text-accent-interactive hover:border-accent-interactive/64 hover:bg-accent-interactive/18 active:translate-y-px`;
  }

  return `${base} border-border bg-surface-muted/70 text-foreground/78 hover:border-accent-interactive/34 hover:bg-surface-muted active:translate-y-px`;
}
