import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOperationsWorkspaceAccessMock, loadOperationDetailWorkspaceMock } = vi.hoisted(() => ({
  requireOperationsWorkspaceAccessMock: vi.fn(),
  loadOperationDetailWorkspaceMock: vi.fn(),
}));

vi.mock("@/lib/operations/operations-access", () => ({
  requireOperationsWorkspaceAccess: requireOperationsWorkspaceAccessMock,
}));

vi.mock("@/lib/operations/operation-workspace-loader", () => ({
  loadOperationDetailWorkspace: loadOperationDetailWorkspaceMock,
}));

import OperationDetailPage from "./page";

describe("OperationDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOperationsWorkspaceAccessMock.mockResolvedValue({ id: "usr_staff", email: "s@example.com", name: "Staff", roles: ["STAFF"] });
    loadOperationDetailWorkspaceMock.mockResolvedValue({
      card: {
        operationId: "op_1",
        title: "Open Help",
        kind: "help_flow",
        status: "draft",
        statusLabel: "draft",
        statusTone: "neutral",
        riskLevel: "info",
        riskLabel: "info",
        summary: null,
        progressPercent: null,
        updatedAt: "2026-05-03T12:00:00.000Z",
        latestEventLabel: null,
        artifactCount: 0,
        actionCount: 0,
        actions: [],
      },
      snapshot: {
        operation: { id: "op_1", title: "Open Help" },
        steps: [],
      },
      events: [],
      artifacts: [],
    });
  });

  it("loads operation detail through the shared workspace loader", async () => {
    render(await OperationDetailPage({ params: Promise.resolve({ operationId: "op_1" }) }));

    expect(screen.getAllByText("Open Help").length).toBeGreaterThan(0);
    expect(loadOperationDetailWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({ id: "usr_staff" }), "op_1");
  });
});
