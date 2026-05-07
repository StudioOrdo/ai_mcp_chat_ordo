import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OperationCardModel } from "@/core/entities/rich-content";
import { OperationCard } from "./OperationCard";

const card: OperationCardModel = {
  operationId: "op_1",
  title: "Restore appliance",
  kind: "restore_execute",
  status: "awaiting_confirmation",
  statusLabel: "awaiting confirmation",
  statusTone: "active",
  riskLevel: "destructive",
  riskLabel: "destructive",
  summary: "Restore from a backup.",
  progressPercent: 50,
  updatedAt: "2026-05-03T12:00:00.000Z",
  latestEventLabel: "action exposed",
  artifactCount: 1,
  actionCount: 1,
  actions: [{
    type: "action-link",
    label: "Execute Restore",
    actionType: "operation",
    value: "op_1",
    params: {
      operationId: "op_1",
      actionId: "act_1",
      idempotencyKey: "idem_1",
      operationRevision: "2",
      riskLevel: "destructive",
    },
  }],
};

describe("OperationCard", () => {
  it("renders operation truth and dispatches card actions", () => {
    const onActionClick = vi.fn();
    render(<OperationCard operation={card} onActionClick={onActionClick} />);

    expect(screen.getByText("Restore appliance")).toBeInTheDocument();
    expect(screen.getByText("awaiting confirmation")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Execute Restore (operation)" }));
    expect(onActionClick).toHaveBeenCalledWith("operation", "op_1", expect.objectContaining({ actionId: "act_1" }));
  });
});
