"use client";

import { useState } from "react";

import type { OperationActionConfirmation } from "@/core/entities/operation";
import type { OperationActionLinkModel } from "@/lib/operations/operation-action-view-model";

export interface OperationActionConfirmationRequest {
  model: OperationActionLinkModel;
  label: string;
}

export type OperationActionConfirmationResolver = (
  model: OperationActionLinkModel,
  label?: string,
) => Promise<OperationActionConfirmation | null | undefined>;

export interface OperationActionConfirmationDialogProps {
  request: OperationActionConfirmationRequest | null;
  onCancel: () => void;
  onConfirm: (confirmation: OperationActionConfirmation) => void;
}

export function OperationActionConfirmationDialog({
  request,
  onCancel,
  onConfirm,
}: OperationActionConfirmationDialogProps) {
  const [phrase, setPhrase] = useState("");

  if (!request) {
    return null;
  }

  const expectedPhrase = request.model.confirmationText?.trim() ?? "";
  const needsPhrase = request.model.confirmPolicy === "phrase";
  const isDanger = request.model.riskLevel === "destructive" || request.model.riskLevel === "high";
  const canConfirm = !needsPhrase || (expectedPhrase ? phrase === expectedPhrase : phrase.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/28 px-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="operation-confirmation-title"
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl"
        data-operation-confirmation-dialog="true"
        data-operation-confirmation-risk={request.model.riskLevel}
      >
        <h2 id="operation-confirmation-title" className="text-base font-semibold text-foreground">
          Confirm operation action
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground/68">
          {isDanger
            ? "This action can change appliance state. Confirm it only if the operation card matches what you intend."
            : "Confirm this operation action before Ordo dispatches it."}
        </p>
        <dl className="mt-4 grid gap-2 rounded-lg border border-border/60 bg-surface-muted/35 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-foreground/54">Action</dt>
            <dd className="font-semibold text-foreground">{request.label}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-foreground/54">Operation</dt>
            <dd className="font-mono text-xs text-foreground/72">{request.model.operationId}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-foreground/54">Risk</dt>
            <dd className="font-semibold capitalize text-foreground">{request.model.riskLevel}</dd>
          </div>
        </dl>

        {needsPhrase ? (
          <label className="mt-4 block text-sm font-medium text-foreground">
            Type the confirmation phrase
            {expectedPhrase ? (
              <code className="mt-2 block rounded-md bg-surface-muted px-2 py-1 font-mono text-xs text-foreground/78">{expectedPhrase}</code>
            ) : null}
            <input
              value={phrase}
              onChange={(event) => setPhrase(event.currentTarget.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-ring"
              autoFocus
            />
          </label>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setPhrase("");
              onCancel();
            }}
            className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground/70 hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              const confirmation: OperationActionConfirmation = needsPhrase
                ? { confirmed: true, phrase }
                : request.model.confirmPolicy === "admin_reauth"
                  ? { reauthenticated: true }
                  : { confirmed: true };
              setPhrase("");
              onConfirm(confirmation);
            }}
            className="rounded-md border border-accent-interactive/35 bg-accent-interactive/10 px-3 py-2 text-sm font-semibold text-accent-interactive hover:bg-accent-interactive/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Confirm action
          </button>
        </div>
      </section>
    </div>
  );
}
