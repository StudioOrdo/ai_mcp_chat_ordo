import { describe, expect, it } from "vitest";

import { projectWorkspaceRestorePayload } from "./WorkspaceRestoreProjector";

describe("projectWorkspaceRestorePayload", () => {
  it("returns an empty durable payload when no workspace exists", () => {
    const payload = projectWorkspaceRestorePayload({
      workspace: null,
      activeJobs: [],
      attentionNeededJobs: [],
      recentTranscript: [],
      restoredAt: "2026-04-28T21:00:00.000Z",
    });

    expect(payload).toEqual({
      workspace: null,
      activeJobs: [],
      attentionNeededJobs: [],
      assets: [],
      reusableMediaAssets: [],
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
  });

  it("projects the latest identity migration status into restore payloads", () => {
    const payload = projectWorkspaceRestorePayload({
      workspace: null,
      activeJobs: [],
      attentionNeededJobs: [],
      recentTranscript: [],
      migration: {
        id: "idmig_1",
        sourceUserId: "anon_seed",
        targetUserId: "usr_1",
        migratedConversationIds: ["conv_1"],
        migratedJobIds: [],
        migratedAssetIds: [],
        repairedMemoryRefs: [],
        repairedSearchSourceIds: [],
        objectCounts: [],
        repairRefs: [],
        status: "completed",
        currentStage: "completed",
        failureMessage: null,
        createdAt: "2026-04-28T20:59:00.000Z",
        completedAt: "2026-04-28T21:00:00.000Z",
      },
      restoredAt: "2026-04-28T21:00:00.000Z",
    });

    expect(payload.migration).toEqual(expect.objectContaining({ id: "idmig_1", status: "completed" }));
    expect(payload.reusableMediaAssets).toEqual([]);
  });
});
