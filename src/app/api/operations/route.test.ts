import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { OperationRepository, OperationSnapshot, OperationSummary } from "@/core/use-cases/operations/OperationRepository";

const { getSessionUserMock, getOperationRepositoryMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getOperationRepositoryMock: vi.fn(),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual("@/lib/auth") as Record<string, unknown>;
  return { ...actual, getSessionUser: getSessionUserMock };
});

vi.mock("@/adapters/RepositoryFactory", () => ({
  getOperationRepository: getOperationRepositoryMock,
}));

import { GET, POST } from "./route";

function summary(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: "op_1",
    kind: "help_flow",
    title: "Open Help",
    status: "draft",
    riskLevel: "info",
    revision: 1,
    conversationId: "conv_1",
    currentStepId: null,
    summary: "Help summary",
    createdByUserId: "usr_1",
    createdByRole: "AUTHENTICATED",
    visibility: "conversation",
    createdAt: "2026-05-03T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z",
    completedAt: null,
    stepCount: 0,
    actionCount: 0,
    artifactCount: 0,
    eventCount: 0,
    latestEventType: null,
    latestEventAt: null,
    progress: {
      totalSteps: 0,
      pendingSteps: 0,
      readySteps: 0,
      runningSteps: 0,
      blockedSteps: 0,
      succeededSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percentComplete: 0,
    },
    ...overrides,
  };
}

function createRepository(): OperationRepository {
  let snapshot: OperationSnapshot | null = null;
  return {
    createOperation: vi.fn(async (input) => {
      snapshot = {
        operation: {
          id: input.id,
          kind: input.kind,
          revision: 1,
          title: input.title,
          status: input.status ?? "draft",
          riskLevel: input.riskLevel ?? "info",
          conversationId: input.conversationId ?? null,
          originMessageId: input.originMessageId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          createdByRole: input.createdByRole,
          visibility: input.visibility ?? "conversation",
          currentStepId: input.currentStepId ?? null,
          createdAt: input.now ?? "2026-05-03T12:00:00.000Z",
          updatedAt: input.now ?? "2026-05-03T12:00:00.000Z",
          completedAt: null,
          summary: input.summary ?? null,
          input: input.input ?? {},
          result: input.result ?? null,
          error: input.error ?? null,
        },
        steps: [],
        actions: [],
        events: [],
        artifacts: [],
      };
      return snapshot;
    }),
    replaceActions: vi.fn(async (input) => {
      if (!snapshot) throw new Error("missing snapshot");
      snapshot = { ...snapshot, actions: [...input.actions] };
      return snapshot;
    }),
    updateOperationStatus: vi.fn(),
    upsertStep: vi.fn(),
    transitionStep: vi.fn(),
    acceptAction: vi.fn(),
    appendEvent: vi.fn(),
    attachArtifact: vi.fn(),
    findOperationById: vi.fn(async () => snapshot),
    listOperationsByConversation: vi.fn(async () => []),
    listOperationsForUser: vi.fn(async () => [summary()]),
    listOperationsForAdmin: vi.fn(async () => [summary({ visibility: "staff", createdByUserId: null })]),
    listEvents: vi.fn(),
    listArtifacts: vi.fn(),
    listAvailableActions: vi.fn(),
    getConversationSummary: vi.fn(),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(async () => ({
      totalActiveOperations: 1,
      activeByStatus: { draft: 1 },
      activeByKind: { help_flow: 1 },
      failedCount: 0,
      blockedCount: 0,
      oldestActiveOperationAgeMs: 1000,
      pendingDestructiveActions: 0,
    })),
    getPromptGroundingSummary: vi.fn(),
  };
}

describe("/api/operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({ id: "usr_1", email: "u@example.com", name: "User", roles: ["AUTHENTICATED"] });
  });

  it("lists readable operations through repository read models", async () => {
    const repository = createRepository();
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await GET(new NextRequest("http://localhost/api/operations?status=draft"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.operations).toHaveLength(1);
    expect(payload.cards[0]).toMatchObject({ operationId: "op_1", title: "Open Help" });
    expect(repository.listOperationsForUser).toHaveBeenCalledWith("usr_1", expect.objectContaining({ status: "draft" }));
  });

  it("creates help operations through the operation intent router", async () => {
    const repository = createRepository();
    getOperationRepositoryMock.mockReturnValue(repository);

    const response = await POST(new NextRequest("http://localhost/api/operations", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conv_1",
        operationKind: "help_flow",
        requestedText: "help me with backups",
        explicitNewOperation: true,
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.routeResultKind).toBe("created_operation");
    expect(payload.operation.kind).toBe("help_flow");
    expect(payload.actions.map((action: { actionType: string }) => action.actionType)).toContain("help.search");
    expect(repository.createOperation).toHaveBeenCalled();
    expect(repository.replaceActions).toHaveBeenCalled();
  });
});
