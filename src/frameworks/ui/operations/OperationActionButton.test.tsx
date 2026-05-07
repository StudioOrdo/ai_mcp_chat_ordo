import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OperationActionButton } from "./OperationActionButton";

describe("OperationActionButton", () => {
  it("renders operation actions as explicit operation buttons", () => {
    const onActionClick = vi.fn();

    render(
      <OperationActionButton
        label="Execute restore"
        value="op_1"
        params={{
          operationId: "op_1",
          actionId: "act_1",
          idempotencyKey: "idem_1",
          operationRevision: "1",
          riskLevel: "destructive",
        }}
        onActionClick={onActionClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Execute restore (operation)" });
    expect(button).toHaveAttribute("data-operation-action", "true");
    expect(button).toHaveAttribute("data-action-intent", "danger");
    fireEvent.click(button);
    expect(onActionClick).toHaveBeenCalledWith("operation", "op_1", expect.objectContaining({ actionId: "act_1" }));
  });

  it("does not dispatch disabled operation actions", () => {
    const onActionClick = vi.fn();

    render(
      <OperationActionButton
        label="Run action"
        value="op_1"
        params={{
          operationId: "op_1",
          actionId: "act_1",
          idempotencyKey: "idem_1",
          operationRevision: "1",
          disabledReason: "Action has expired.",
        }}
        onActionClick={onActionClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Run action (operation)" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Action has expired.");
    fireEvent.click(button);
    expect(onActionClick).not.toHaveBeenCalled();
  });
});
