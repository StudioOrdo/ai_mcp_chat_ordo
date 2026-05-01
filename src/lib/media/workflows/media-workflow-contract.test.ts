import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { ensureSchema } from "@/lib/db/schema";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";

import {
  createChartAudioVideoWorkflowDraft,
  createGeneratedAudioWorkflowDraft,
  createVisualAudioVideoWorkflowDraft,
} from "./factory";
import { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  ensureSchema(db);
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_1", "user@test.com", "User");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_2", "other@test.com", "Other");
  db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run("conv_1", "usr_1", "Media test");
  return db;
}

describe("media workflow contract", () => {
  it("persists the Bloom chart/audio/video request shape as one durable workflow", () => {
    const db = createDb();
    const repository = new SqliteMediaWorkflowRepository(db);
    const draft = createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      originMessageId: "msg_bloom_request",
      title: "Bloom's Taxonomy AI explainer",
      chart: {
        assetId: "chart_blooms_ai",
        title: "Bloom's Taxonomy in the Age of AI",
      },
      audio: {
        title: "Bloom's Taxonomy & AI - 30 Second Manifesto",
        text: "AI changes the bottom of Bloom's taxonomy.",
      },
      now: "2026-05-01T16:47:35.000Z",
    });

    const snapshot = repository.createWorkflow(draft);

    expect(snapshot.workflow).toMatchObject({
      userId: "usr_1",
      conversationId: "conv_1",
      originMessageId: "msg_bloom_request",
      requestedDeliverable: "video",
      status: "queued",
      finalAssetId: null,
    });
    expect(snapshot.steps.map((step) => [step.kind, step.status, step.assetId])).toEqual([
      ["generate_chart", "ready", "chart_blooms_ai"],
      ["generate_audio", "pending", null],
      ["compose_media", "pending", null],
    ]);
    expect(snapshot.steps[2].dependsOnStepIds).toEqual([
      snapshot.steps[0].id,
      snapshot.steps[1].id,
    ]);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({ eventType: "workflow_created" });
  });

  it("rejects job ids where governed asset ids are required", () => {
    expect(() => createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Bad workflow",
      chart: {
        assetId: "job_26dc3d17-5d4f-4650-9b7c-e7414aabf0ff",
      },
      audio: {
        title: "Audio",
        text: "Text",
      },
    })).toThrow(/not a job id/);
  });

  it("supports existing governed visual assets with generated audio and composed video", () => {
    const db = createDb();
    const repository = new SqliteMediaWorkflowRepository(db);

    const snapshot = repository.createWorkflow(createVisualAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Existing visual explainer",
      visual: {
        assetId: "uf_existing_image",
        kind: "reuse_asset",
      },
      audio: {
        title: "Narration",
        text: "Narration text",
      },
    }));

    expect(snapshot.workflow.request).toMatchObject({ template: "visual_audio_video" });
    expect(snapshot.steps.map((step) => [step.kind, step.status, step.assetId])).toEqual([
      ["reuse_asset", "ready", "uf_existing_image"],
      ["generate_audio", "pending", null],
      ["compose_media", "pending", null],
    ]);
  });

  it("supports generated audio as a non-composition baseline workflow", async () => {
    const db = createDb();
    const job = await new JobQueueDataMapper(db).createJob({
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "generate_audio",
      requestPayload: { title: "Audio", text: "Audio text" },
    });
    const repository = new SqliteMediaWorkflowRepository(db);

    const snapshot = repository.createWorkflow(createGeneratedAudioWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Audio only",
      audio: {
        title: "Audio",
        text: "Audio text",
        jobId: job.id,
      },
    }));

    expect(snapshot.workflow).toMatchObject({
      requestedDeliverable: "audio",
      status: "queued",
    });
    expect(snapshot.steps).toHaveLength(1);
    expect(snapshot.steps[0]).toMatchObject({
      kind: "generate_audio",
      status: "queued",
      jobId: job.id,
    });
  });

  it("rejects another user's asset during validated workflow creation", () => {
    const db = createDb();
    db.prepare(`
      INSERT INTO user_files (
        id, user_id, conversation_id, content_hash, file_type, status,
        file_name, mime_type, file_size, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "uf_other_user_image",
      "usr_2",
      null,
      "hash_other",
      "image",
      "ready",
      "other.png",
      "image/png",
      10,
      "{\"assetKind\":\"image\"}",
    );

    const repository = new SqliteMediaWorkflowRepository(db);
    const draft = createVisualAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Bad asset",
      visual: {
        assetId: "uf_other_user_image",
        kind: "reuse_asset",
      },
      audio: {
        title: "Audio",
        text: "Text",
      },
    });

    expect(() => repository.createValidatedWorkflow(draft)).toThrow(/not owned by workflow user/);
  });

  it("does not allow a final-artifact workflow to succeed without a final asset id", () => {
    const db = createDb();
    const repository = new SqliteMediaWorkflowRepository(db);
    const draft = createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Workflow",
      chart: { assetId: "chart_1" },
      audio: { title: "Audio", text: "Text" },
    });

    draft.workflow.status = "succeeded";
    draft.workflow.finalAssetId = null;

    expect(() => repository.createWorkflow(draft)).toThrow(/cannot succeed without a final asset id/);
  });

  it("does not allow a ready step without an asset id or explicit output", () => {
    const db = createDb();
    const repository = new SqliteMediaWorkflowRepository(db);
    const draft = createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Workflow",
      chart: { assetId: "chart_1" },
      audio: { title: "Audio", text: "Text" },
    });

    draft.steps[1].status = "ready";

    expect(() => repository.createWorkflow(draft)).toThrow(/ready media workflow step/);
  });

  it("marks a workflow succeeded only with a governed final asset id", () => {
    const db = createDb();
    const repository = new SqliteMediaWorkflowRepository(db);
    const snapshot = repository.createWorkflow(createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Workflow",
      chart: { assetId: "chart_1" },
      audio: { title: "Audio", text: "Text" },
      now: "2026-05-01T16:47:00.000Z",
    }));

    expect(() => repository.markWorkflowSucceeded({
      workflowId: snapshot.workflow.id,
      finalAssetId: "job_1",
    })).toThrow(/not a job id/);

    const updated = repository.markWorkflowSucceeded({
      workflowId: snapshot.workflow.id,
      finalAssetId: "uf_video_1",
      completedAt: "2026-05-01T16:48:00.000Z",
    });

    expect(updated.workflow).toMatchObject({
      status: "succeeded",
      finalAssetId: "uf_video_1",
      completedAt: "2026-05-01T16:48:00.000Z",
    });
    expect(updated.events.map((event) => event.eventType)).toEqual([
      "workflow_created",
      "workflow_succeeded",
    ]);
  });
});
