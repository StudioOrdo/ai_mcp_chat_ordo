import { beforeEach, describe, expect, it, vi } from "vitest";

import { createConversationRouteRequest } from "../../../../../tests/helpers/conversation-route-fixture";

const { getWorkspaceRestoreReader, resolveUserId } = vi.hoisted(() => ({
  getWorkspaceRestoreReader: vi.fn(),
  resolveUserId: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getWorkspaceRestoreReader,
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId,
}));

import { GET } from "./route";

describe("workspace restore route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 when the resolved owner has no active workspace state to restore", async () => {
    resolveUserId.mockResolvedValue({ userId: "anon_123", isAnonymous: true });
    getWorkspaceRestoreReader.mockReturnValue({
      findActiveByUser: vi.fn().mockResolvedValue({
        workspace: null,
        activeJobs: [],
        attentionNeededJobs: [],
        assets: [],
        workflow: null,
        operatorTransition: null,
        trustDistribution: null,
        memory: null,
        recentTranscript: [],
        migration: null,
        restoreMeta: {
          schemaVersion: 1,
          restoredAt: "2026-04-28T21:00:00.000Z",
          source: "durable_read_model",
        },
      }),
    });

    const response = await GET(createConversationRouteRequest("/api/workspace/restore"));

    expect(response.status).toBe(204);
    expect(resolveUserId).toHaveBeenCalled();
  });

  it("restores the active workspace when there is durable state to hydrate", async () => {
    resolveUserId.mockResolvedValue({ userId: "anon_123", isAnonymous: true });
    getWorkspaceRestoreReader.mockReturnValue({
      findActiveByUser: vi.fn().mockResolvedValue({
        workspace: {
          conversationId: "conv_active",
          userId: "anon_123",
          title: "Active workspace",
          status: "active",
          currentObjective: "Reconnect",
          recommendedNextStep: "Review continuity",
          updatedAt: "2026-04-28T21:00:00.000Z",
        },
        activeJobs: [],
        attentionNeededJobs: [],
        assets: [],
        workflow: null,
        operatorTransition: null,
        trustDistribution: null,
        memory: null,
        recentTranscript: [],
        migration: null,
        restoreMeta: {
          schemaVersion: 1,
          restoredAt: "2026-04-28T21:00:00.000Z",
          source: "durable_read_model",
        },
      }),
    });

    const response = await GET(createConversationRouteRequest("/api/workspace/restore"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.restoreMeta.source).toBe("durable_read_model");
    expect(payload.workspace.conversationId).toBe("conv_active");
  });

  it("restores a specific workspace by conversation id for the resolved owner", async () => {
    const findByConversationId = vi.fn().mockResolvedValue({
      workspace: { id: "workspace:conv_1", userId: "usr_1" },
      activeJobs: [],
      attentionNeededJobs: [],
      assets: [],
      workflow: null,
      operatorTransition: null,
      trustDistribution: null,
      memory: null,
      recentTranscript: [],
      migration: null,
      restoreMeta: {
        schemaVersion: 1,
        restoredAt: "2026-04-28T21:00:00.000Z",
        source: "durable_read_model",
      },
    });

    resolveUserId.mockResolvedValue({ userId: "usr_1", isAnonymous: false });
    getWorkspaceRestoreReader.mockReturnValue({
      findByConversationId,
      findActiveByUser: vi.fn(),
    });

    const response = await GET(createConversationRouteRequest("/api/workspace/restore?conversationId=conv_1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findByConversationId).toHaveBeenCalledWith("usr_1", "conv_1");
    expect(payload.workspace.id).toBe("workspace:conv_1");
  });

  it("returns 404 when the requested workspace is missing or owned by another user", async () => {
    resolveUserId.mockResolvedValue({ userId: "usr_1", isAnonymous: false });
    getWorkspaceRestoreReader.mockReturnValue({
      findByConversationId: vi.fn().mockResolvedValue(null),
      findActiveByUser: vi.fn(),
    });

    const response = await GET(createConversationRouteRequest("/api/workspace/restore?conversationId=conv_404"));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Workspace not found");
  });
});