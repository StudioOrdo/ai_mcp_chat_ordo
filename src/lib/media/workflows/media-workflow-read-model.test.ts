import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { ensureSchema } from "@/lib/db/schema";

import { createChartAudioVideoWorkflowDraft } from "./factory";
import { MediaWorkflowReadModel } from "./media-workflow-read-model";
import { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  ensureSchema(db);
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_1", "user@test.com", "User");
  db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run("conv_1", "usr_1", "Media test");
  return db;
}

describe("MediaWorkflowReadModel", () => {
  it("projects a running chart/audio/video workflow with linked jobs", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await jobRepository.createJob({
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "generate_audio",
      requestPayload: { title: "Audio", text: "Narration" },
      initiatorType: "user",
    });
    workflowRepository.createWorkflow(createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      originMessageId: "msg_assistant",
      title: "Bloom video",
      chart: { assetId: "chart_bloom" },
      audio: { title: "Audio", text: "Narration", jobId: audioJob.id },
      now: "2026-05-01T17:00:00.000Z",
    }));

    const [workflow] = await new MediaWorkflowReadModel({
      workflowRepository,
    }).listConversationWorkflows("conv_1");

    expect(workflow).toMatchObject({
      title: "Bloom video",
      status: "queued",
      requestedDeliverable: "video",
      originMessageId: "msg_assistant",
      linkedJobIds: [audioJob.id],
      finalArtifact: null,
    });
    expect(workflow?.steps.map((step) => [step.kind, step.status])).toEqual([
      ["generate_chart", "ready"],
      ["generate_audio", "queued"],
      ["compose_media", "pending"],
    ]);
  });

  it("projects a succeeded workflow with the final video artifact", async () => {
    const db = createDb();
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const snapshot = workflowRepository.createWorkflow(createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Completed video",
      chart: { assetId: "chart_done" },
      audio: { title: "Audio", text: "Narration" },
      now: "2026-05-01T17:00:00.000Z",
    }));
    const audioStep = snapshot.steps.find((step) => step.kind === "generate_audio")!;
    const composeStep = snapshot.steps.find((step) => step.kind === "compose_media")!;
    workflowRepository.updateStep({
      stepId: audioStep.id,
      status: "ready",
      assetId: "uf_audio_done",
      output: { assetId: "uf_audio_done" },
    });
    workflowRepository.updateStep({
      stepId: composeStep.id,
      status: "ready",
      assetId: "uf_video_done",
      output: { assetId: "uf_video_done" },
    });
    workflowRepository.markWorkflowSucceeded({
      workflowId: snapshot.workflow.id,
      finalAssetId: "uf_video_done",
    });

    const [workflow] = await new MediaWorkflowReadModel({ workflowRepository }).listConversationWorkflows("conv_1");

    expect(workflow?.status).toBe("succeeded");
    expect(workflow?.stage).toMatchObject({ key: "succeeded", progressPercent: 100 });
    expect(workflow?.finalArtifact).toEqual({ assetId: "uf_video_done", kind: "video" });
  });

  it("does not treat ready dependencies or unrelated compose jobs as the workflow final artifact", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await jobRepository.createJob({
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "generate_audio",
      requestPayload: { title: "Audio", text: "Narration" },
      initiatorType: "user",
    });
    await jobRepository.createJob({
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "compose_media",
      requestPayload: { plan: { id: "old_plan" } },
      initiatorType: "user",
    });
    const snapshot = workflowRepository.createWorkflow(createChartAudioVideoWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      originMessageId: "msg_assistant",
      title: "Bloom video",
      chart: { assetId: "chart_bloom" },
      audio: { title: "Audio", text: "Narration", jobId: audioJob.id },
      now: "2026-05-01T17:00:00.000Z",
    }));
    const audioStep = snapshot.steps.find((step) => step.kind === "generate_audio")!;
    workflowRepository.markWorkflowRunning({ workflowId: snapshot.workflow.id });
    workflowRepository.updateStep({
      stepId: audioStep.id,
      status: "ready",
      assetId: "uf_audio_done",
      output: { assetId: "uf_audio_done" },
    });

    const [workflow] = await new MediaWorkflowReadModel({ workflowRepository }).listConversationWorkflows("conv_1");

    expect(workflow?.status).toBe("running");
    expect(workflow?.linkedJobIds).toEqual([audioJob.id]);
    expect(workflow?.finalArtifact).toBeNull();
    expect(workflow?.steps.find((step) => step.kind === "compose_media")).toMatchObject({
      status: "pending",
      assetId: null,
    });
  });
});
