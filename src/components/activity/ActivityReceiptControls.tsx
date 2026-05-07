"use client";

import { useState } from "react";
import type { ActivityItem, ActivityReceiptAction } from "@/lib/activity";

interface ActivityReceiptControlsProps {
  item: ActivityItem;
  compact?: boolean;
  onItemUpdated?: (item: ActivityItem) => void;
  onItemDismissed?: (item: ActivityItem) => void;
  onError?: (message: string) => void;
}

const BUTTON_CLASS = "inline-flex min-h-8 items-center rounded-full border border-foreground/10 px-(--space-2) py-(--space-1) text-[0.72rem] font-semibold text-foreground/62 transition hover:border-foreground/18 hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-45";

async function patchReceipt(item: ActivityItem, action: ActivityReceiptAction): Promise<ActivityItem> {
  const response = await fetch(`/api/activity/${encodeURIComponent(item.id)}/receipt`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  const payload = await response.json().catch(() => null) as { activity?: ActivityItem; error?: string } | null;
  if (!response.ok || !payload?.activity) {
    throw new Error(payload?.error ?? "Unable to update activity receipt.");
  }

  return payload.activity;
}

export function ActivityReceiptControls({
  item,
  compact = false,
  onItemUpdated,
  onItemDismissed,
  onError,
}: ActivityReceiptControlsProps) {
  const [pendingAction, setPendingAction] = useState<ActivityReceiptAction | null>(null);
  const isPending = pendingAction !== null;

  async function applyAction(action: ActivityReceiptAction) {
    setPendingAction(action);
    try {
      const updated = await patchReceipt(item, action);
      if (action === "dismiss") {
        onItemDismissed?.(updated);
      } else {
        onItemUpdated?.(updated);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Unable to update activity receipt.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className={`flex flex-wrap gap-(--space-1) ${compact ? "mt-(--space-2)" : "mt-(--space-3)"}`}>
      {!item.receipt.readAt ? (
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={isPending}
          onClick={() => void applyAction("mark_read")}
        >
          {pendingAction === "mark_read" ? "Marking..." : "Mark read"}
        </button>
      ) : null}
      {item.bucket === "needs_attention" && !item.receipt.acknowledgedAt ? (
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={isPending}
          onClick={() => void applyAction("acknowledge")}
        >
          {pendingAction === "acknowledge" ? "Acknowledging..." : "Acknowledge"}
        </button>
      ) : null}
      <button
        type="button"
        className={BUTTON_CLASS}
        disabled={isPending}
        onClick={() => void applyAction(item.receipt.pinnedAt ? "unpin" : "pin")}
      >
        {pendingAction === "pin" || pendingAction === "unpin"
          ? "Updating..."
          : item.receipt.pinnedAt ? "Unpin" : "Pin"}
      </button>
      {!item.receipt.dismissedAt ? (
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={isPending}
          onClick={() => void applyAction("dismiss")}
        >
          {pendingAction === "dismiss" ? "Dismissing..." : "Dismiss"}
        </button>
      ) : null}
    </div>
  );
}
