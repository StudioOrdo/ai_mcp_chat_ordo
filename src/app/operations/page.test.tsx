import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOperationsWorkspaceAccessMock, loadOperationsWorkspaceMock } = vi.hoisted(() => ({
  requireOperationsWorkspaceAccessMock: vi.fn(),
  loadOperationsWorkspaceMock: vi.fn(),
}));

vi.mock("@/lib/operations/operations-access", () => ({
  requireOperationsWorkspaceAccess: requireOperationsWorkspaceAccessMock,
}));

vi.mock("@/lib/operations/operation-workspace-loader", () => ({
  loadOperationsWorkspace: loadOperationsWorkspaceMock,
}));

import OperationsPage from "./page";

describe("OperationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOperationsWorkspaceAccessMock.mockResolvedValue({ id: "usr_staff", email: "s@example.com", name: "Staff", roles: ["STAFF"] });
    loadOperationsWorkspaceMock.mockResolvedValue({
      cards: [],
      totalCount: 0,
      filters: {},
      health: {
        totalActiveOperations: 0,
        activeByStatus: {},
        activeByKind: {},
        failedCount: 0,
        blockedCount: 0,
        oldestActiveOperationAgeMs: null,
        pendingDestructiveActions: 0,
      },
    });
  });

  it("loads the shared operations workspace for staff/admin users", async () => {
    render(await OperationsPage({ searchParams: Promise.resolve({ status: "draft" }) }));

    expect(screen.getByText("Operation Queue")).toBeInTheDocument();
    expect(requireOperationsWorkspaceAccessMock).toHaveBeenCalled();
    expect(loadOperationsWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({ id: "usr_staff" }), { status: "draft" });
  });
});
