import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { OperationRepository, OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";

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

import { GET } from "./route";

const snapshot: OperationSnapshot = {
  operation: {
    id: "op_1",
    kind: "help_flow",
    revision: 1,
    title: "Open Help",
    status: "draft",
    riskLevel: "info",
    conversationId: "conv_1",
    originMessageId: null,
    createdByUserId: "usr_1",
    createdByRole: "AUTHENTICATED",
    visibility: "conversation",
    currentStepId: null,
    createdAt: "2026-05-03T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z",
    completedAt: null,
    summary: null,
    input: {},
    result: null,
    error: null,
  },
  steps: [],
  actions: [],
  events: [],
  artifacts: [],
};

function repository(): OperationRepository {
  return {
    createOperation: vi.fn(),
    updateOperationStatus: vi.fn(),
    upsertStep: vi.fn(),
    transitionStep: vi.fn(),
    replaceActions: vi.fn(),
    acceptAction: vi.fn(),
    appendEvent: vi.fn(),
    attachArtifact: vi.fn(),
    findOperationById: vi.fn(async () => snapshot),
    listOperationsByConversation: vi.fn(),
    listOperationsForUser: vi.fn(),
    listOperationsForAdmin: vi.fn(),
    listEvents: vi.fn(),
    listArtifacts: vi.fn(async () => [{
      id: "art_1",
      operationId: "op_1",
      stepId: null,
      kind: "document",
      uri: "ordo://artifact/1",
      label: "Evidence",
      metadata: {},
      createdAt: "2026-05-03T12:00:00.000Z",
    }]),
    listAvailableActions: vi.fn(),
    getConversationSummary: vi.fn(),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(),
    getPromptGroundingSummary: vi.fn(),
  };
}

describe("GET /api/operations/[operationId]/artifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({ id: "usr_1", email: "u@example.com", name: "User", roles: ["AUTHENTICATED"] });
  });

  it("returns operation artifacts through the repository", async () => {
    const repo = repository();
    getOperationRepositoryMock.mockReturnValue(repo);

    const response = await GET(new NextRequest("http://localhost/api/operations/op_1/artifacts?limit=5"), {
      params: Promise.resolve({ operationId: "op_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.artifacts[0].id).toBe("art_1");
    expect(repo.listArtifacts).toHaveBeenCalledWith("op_1", { afterSequence: undefined, limit: 5 });
  });
});
