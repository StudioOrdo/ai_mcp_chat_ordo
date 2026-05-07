import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import { ensureSchema } from "@/lib/db/schema";

import { MediaWorkflowOperationReconciler } from "./media-workflow-operation-reconciler";
import { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";
import type { MediaWorkflowDraft } from "./types";

const NOW = "2026-05-03T12:00:00.000Z";

function idFactory(prefix: string): string {
  return `${prefix}_1`;
}

function draft(overrides: {
  workflow?: Partial<MediaWorkflowDraft["workflow"]>;
  steps?: MediaWorkflowDraft["steps"];
  initialEvent?: MediaWorkflowDraft["initialEvent"];
} = {}): MediaWorkflowDraft {
  const base: MediaWorkflowDraft = {
    workflow: {
      id: "mwf_1",
      userId: "usr_1",
      conversationId: "conv_1",
      originMessageId: "msg_1",
      originTurnId: null,
      requestedDeliverable: "audio",
      title: "Audio workflow",
      status: "succeeded",
      finalAssetId: "uf_audio_1",
      request: {
        operation: {
          operationId: "op_media",
          actionId: "act_media",
          operationKind: "media_workflow",
        },
      },
      createdAt: NOW,
      updatedAt: NOW,
      completedAt: NOW,
    },
    steps: [{
      id: "mwfs_audio",
      workflowId: "mwf_1",
      sequence: 1,
      kind: "generate_audio",
      status: "ready",
      assetId: "uf_audio_1",
      output: {
        assetId: "uf_audio_1",
        materializationId: "mat_audio_1",
      },
      createdAt: NOW,
      updatedAt: NOW,
    }],
    initialEvent: {
      eventType: "workflow_created",
      payload: { template: "generated_audio" },
      createdAt: NOW,
    },
  };

  return {
    ...base,
    ...overrides,
    workflow: { ...base.workflow, ...overrides.workflow },
    steps: overrides.steps ?? base.steps,
  };
}

describe("MediaWorkflowOperationReconciler", () => {
  let db: Database.Database;
  let operations: OperationDataMapper;
  let workflows: SqliteMediaWorkflowRepository;
  let reconciler: MediaWorkflowOperationReconciler;

  beforeEach(async () => {
    db = new Database(":memory:");
    ensureSchema(db);
    db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_1", "user@test.com", "User");
    db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run("conv_1", "usr_1", "Media test");
    operations = new OperationDataMapper(db);
    workflows = new SqliteMediaWorkflowRepository(db);
    reconciler = new MediaWorkflowOperationReconciler({
      operations,
      workflows,
      idFactory,
      now: () => NOW,
    });
    await operations.createOperation({
      id: "op_media",
      kind: "media_workflow",
      title: "Audio workflow",
      status: "draft",
      riskLevel: "medium",
      conversationId: "conv_1",
      createdByUserId: "usr_1",
      createdByRole: "AUTHENTICATED",
      now: NOW,
    });
  });

  afterEach(() => {
    db.close();
  });

  it("maps ready media steps to succeeded operation steps and projects artifacts idempotently", async () => {
    workflows.createWorkflow(draft());

    await reconciler.reconcileOperation("op_media");
    await reconciler.reconcileOperation("op_media");

    const snapshot = await operations.findOperationById("op_media");
    expect(snapshot?.operation.status).toBe("succeeded");
    expect(snapshot?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "op_media:media_step:mwfs_audio",
        kind: "media.generate_audio",
        status: "succeeded",
        resourceRef: {
          type: "media_asset",
          id: "uf_audio_1",
          uri: "media-asset:uf_audio_1",
        },
      }),
    ]));
    expect(snapshot?.artifacts.map((artifact) => artifact.kind).sort()).toEqual([
      "materialization",
      "media_asset",
      "media_workflow",
    ]);
    expect(snapshot?.events.filter((event) => event.payload.source === "media_workflow")).toHaveLength(1);
  });

  it("exposes retry only for retryable failed workflow steps", async () => {
    workflows.createWorkflow(draft({
      workflow: {
        status: "failed",
        finalAssetId: null,
        failureCode: "transient",
        failureMessage: "Audio failed.",
        completedAt: NOW,
      },
      steps: [{
        id: "mwfs_audio",
        workflowId: "mwf_1",
        sequence: 1,
        kind: "generate_audio",
        status: "failed",
        failureCode: "transient",
        failureMessage: "Audio failed.",
        input: {
          title: "Audio",
          text: "Retry this",
        },
        createdAt: NOW,
        updatedAt: NOW,
      }],
      initialEvent: {
        eventType: "step_failed",
        payload: { failureCode: "transient" },
        createdAt: NOW,
      },
    }));

    await reconciler.reconcileOperation("op_media");

    const actions = await operations.listAvailableActions("op_media");
    expect(actions).toEqual([
      expect.objectContaining({
        actionType: "media.workflow.retry_step",
        payload: expect.objectContaining({
          workflowId: "mwf_1",
          stepId: "mwfs_audio",
        }),
      }),
    ]);
  });
});
