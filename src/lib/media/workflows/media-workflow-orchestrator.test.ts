import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import type { MaterializationRecord } from "@/core/entities/materialization";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { ensureSchema } from "@/lib/db/schema";

import { createChartAudioVideoWorkflowDraft, createGeneratedAudioWorkflowDraft } from "./factory";
import { MediaWorkflowJobBinder, MediaWorkflowOrchestrator } from "./orchestrator";
import { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";
import type { MediaWorkflowDraft, MediaWorkflowSnapshot } from "./types";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  ensureSchema(db);
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_1", "user@test.com", "User");
  db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_2", "other@test.com", "Other User");
  db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run("conv_1", "usr_1", "Media test");
  db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run("conv_2", "usr_2", "Other media test");
  return db;
}

async function createAudioJob(jobRepository: JobQueueDataMapper) {
  return jobRepository.createJob({
    conversationId: "conv_1",
    userId: "usr_1",
    toolName: "generate_audio",
    requestPayload: {
      title: "Bloom audio",
      text: "Bloom text",
    },
    dedupeKey: "generate_audio:bloom",
    initiatorType: "user",
  });
}

function createWorkflowWithAudioJob(
  workflowRepository: SqliteMediaWorkflowRepository,
  audioJobId: string,
): MediaWorkflowSnapshot {
  return workflowRepository.createWorkflow(createChartAudioVideoWorkflowDraft({
    userId: "usr_1",
    conversationId: "conv_1",
    originMessageId: "msg_assistant",
    title: "Bloom video",
    chart: {
      assetId: "chart_blooms_ai",
    },
    audio: {
      title: "Bloom audio",
      text: "Bloom text",
      jobId: audioJobId,
    },
    now: "2026-05-01T16:47:35.000Z",
  }));
}

async function markAudioJobSucceeded(jobRepository: JobQueueDataMapper, audioJobId: string): Promise<void> {
  await jobRepository.updateJobStatus(audioJobId, {
    status: "succeeded",
    resultPayload: {
      schemaVersion: 1,
      toolName: "generate_audio",
      artifacts: [{
        kind: "audio",
        assetId: "uf_audio_bloom",
        mimeType: "audio/mpeg",
      }],
    },
    completedAt: "2026-05-01T16:47:45.000Z",
  });
}

function createReusableMaterializationRepository(outputAssetId: string): MaterializationRepository {
  const materialization: MaterializationRecord = {
    id: "mat_reused_video",
    userId: "usr_1",
    conversationId: "conv_1",
    materializationKey: "reused-key",
    toolName: "compose_media",
    pipelineVersion: "compose_media:v1",
    status: "ready",
    reusePolicy: "same_user",
    inputSourceRefs: [],
    outputRefs: [{
      kind: "asset",
      id: outputAssetId,
      userId: "usr_1",
      conversationId: "conv_1",
    }],
    evidenceRefs: [],
    producedByJobId: "job_previous_compose",
    supersededByRecordId: null,
    createdAt: "2026-05-01T16:40:00.000Z",
    updatedAt: "2026-05-01T16:40:00.000Z",
  };

  return {
    findById: async () => null,
    findByMaterializationKey: async () => null,
    findByProducedJobId: async () => null,
    listByConversation: async () => [],
    findLatestByOutputRef: async () => null,
    findReusableSuccess: async () => materialization,
    upsert: async (record) => record,
    markSuperseded: async () => null,
  };
}

describe("MediaWorkflowOrchestrator", () => {
  it("enqueues compose_media when the linked audio dependency succeeds after the assistant turn", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);

    const audioJob = await createAudioJob(jobRepository);
    const workflow = createWorkflowWithAudioJob(workflowRepository, audioJob.id);
    await markAudioJobSucceeded(jobRepository, audioJob.id);

    const updated = await new MediaWorkflowOrchestrator({
      workflowRepository,
      jobRepository,
    }).advanceByJobId(audioJob.id);

    expect(updated?.workflow.status).toBe("running");
    expect(updated?.steps.map((step) => [step.kind, step.status, step.assetId])).toEqual([
      ["generate_chart", "ready", "chart_blooms_ai"],
      ["generate_audio", "ready", "uf_audio_bloom"],
      ["compose_media", "queued", null],
    ]);

    const composeStep = updated?.steps.find((step) => step.kind === "compose_media");
    expect(composeStep?.jobId).toMatch(/^job_/);

    const composeJob = composeStep?.jobId
      ? await jobRepository.findJobById(composeStep.jobId)
      : null;
    expect(composeJob).toMatchObject({
      toolName: "compose_media",
      conversationId: "conv_1",
      userId: "usr_1",
      status: "queued",
    });
    expect(composeJob?.requestPayload).toMatchObject({
      plan: {
        conversationId: "conv_1",
        visualClips: [{ assetId: "chart_blooms_ai", kind: "chart" }],
        audioClips: [{ assetId: "uf_audio_bloom", kind: "audio" }],
      },
    });

    expect(workflow.workflow.id).toBe(updated?.workflow.id);
  });

  it("does not enqueue duplicate compose jobs when advancement is retried", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    createWorkflowWithAudioJob(workflowRepository, audioJob.id);
    await markAudioJobSucceeded(jobRepository, audioJob.id);

    const orchestrator = new MediaWorkflowOrchestrator({ workflowRepository, jobRepository });
    const first = await orchestrator.advanceByJobId(audioJob.id);
    const second = await orchestrator.advanceByJobId(audioJob.id);

    const firstComposeStep = first?.steps.find((step) => step.kind === "compose_media");
    const secondComposeStep = second?.steps.find((step) => step.kind === "compose_media");
    expect(secondComposeStep?.jobId).toBe(firstComposeStep?.jobId);

    const composeJobs = await jobRepository.listJobsByConversation("conv_1", {
      statuses: ["queued", "running", "succeeded", "failed"],
      limit: 20,
    });
    expect(composeJobs.filter((job) => job.toolName === "compose_media")).toHaveLength(1);
  });

  it("marks the workflow failed when a linked dependency job reaches a terminal failure", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    createWorkflowWithAudioJob(workflowRepository, audioJob.id);

    await jobRepository.updateJobStatus(audioJob.id, {
      status: "failed",
      errorMessage: "Audio provider rejected the request.",
      failureClass: "terminal",
      completedAt: "2026-05-01T16:47:45.000Z",
    });

    const updated = await new MediaWorkflowOrchestrator({
      workflowRepository,
      jobRepository,
    }).advanceByJobId(audioJob.id);

    const audioStep = updated?.steps.find((step) => step.kind === "generate_audio");
    expect(updated?.workflow.status).toBe("failed");
    expect(updated?.workflow.failureCode).toBe("terminal");
    expect(audioStep?.status).toBe("failed");
    expect(audioStep?.failureMessage).toBe("Audio provider rejected the request.");
    expect(updated?.events.map((event) => event.eventType)).toContain("workflow_failed");
  });

  it("fails deterministically when an eligible compose step cannot build a plan", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    const audioOnlyDraft = createGeneratedAudioWorkflowDraft({
      userId: "usr_1",
      conversationId: "conv_1",
      title: "Broken video workflow",
      audio: {
        title: "Bloom audio",
        text: "Bloom text",
        jobId: audioJob.id,
      },
      now: "2026-05-01T16:47:35.000Z",
    });
    const audioStep = audioOnlyDraft.steps[0];
    const brokenVideoDraft: MediaWorkflowDraft = {
      workflow: {
        ...audioOnlyDraft.workflow,
        requestedDeliverable: "video",
      },
      steps: [
        audioStep,
        {
          id: "mwfs_broken_compose",
          workflowId: audioOnlyDraft.workflow.id,
          sequence: 2,
          kind: "compose_media",
          status: "pending",
          dependsOnStepIds: [audioStep.id],
          input: {
            planId: "broken_compose",
          },
          createdAt: "2026-05-01T16:47:35.000Z",
          updatedAt: "2026-05-01T16:47:35.000Z",
        },
      ],
      initialEvent: audioOnlyDraft.initialEvent,
    };
    workflowRepository.createWorkflow(brokenVideoDraft);
    await markAudioJobSucceeded(jobRepository, audioJob.id);

    const updated = await new MediaWorkflowOrchestrator({
      workflowRepository,
      jobRepository,
    }).advanceByJobId(audioJob.id);

    expect(updated?.workflow.status).toBe("failed");
    expect(updated?.workflow.failureCode).toBe("invalid_compose_plan");
    expect(updated?.workflow.failureMessage).toMatch(/could not build a valid composition plan/);
  });

  it("completes compose from exact materialization reuse without enqueueing duplicate work", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    createWorkflowWithAudioJob(workflowRepository, audioJob.id);
    await markAudioJobSucceeded(jobRepository, audioJob.id);

    const completed = await new MediaWorkflowOrchestrator({
      workflowRepository,
      jobRepository,
      materializationRepository: createReusableMaterializationRepository("uf_video_reused"),
    }).advanceByJobId(audioJob.id);

    const composeStep = completed?.steps.find((step) => step.kind === "compose_media");
    expect(completed?.workflow.status).toBe("succeeded");
    expect(completed?.workflow.finalAssetId).toBe("uf_video_reused");
    expect(composeStep?.status).toBe("ready");
    expect(composeStep?.assetId).toBe("uf_video_reused");

    const jobs = await jobRepository.listJobsByConversation("conv_1", { limit: 20 });
    expect(jobs.filter((job) => job.toolName === "compose_media")).toHaveLength(0);
  });

  it("reconciles runnable workflows when a terminal job event was missed", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    createWorkflowWithAudioJob(workflowRepository, audioJob.id);
    await markAudioJobSucceeded(jobRepository, audioJob.id);

    const advanced = await new MediaWorkflowOrchestrator({
      workflowRepository,
      jobRepository,
    }).reconcileRunnableWorkflows({ conversationId: "conv_1" });

    expect(advanced).toHaveLength(1);
    expect(advanced[0]?.steps.find((step) => step.kind === "generate_audio")?.status).toBe("ready");
    expect(advanced[0]?.steps.find((step) => step.kind === "compose_media")?.status).toBe("queued");
  });

  it("rejects binding jobs from the wrong owner, conversation, or tool", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    const workflow = createWorkflowWithAudioJob(workflowRepository, audioJob.id);
    const composeStep = workflow.steps.find((step) => step.kind === "compose_media");
    expect(composeStep).toBeDefined();

    const wrongConversationJob = await jobRepository.createJob({
      conversationId: "conv_2",
      userId: "usr_1",
      toolName: "compose_media",
      requestPayload: {},
      initiatorType: "system",
    });
    const wrongUserJob = await jobRepository.createJob({
      conversationId: "conv_1",
      userId: "usr_2",
      toolName: "compose_media",
      requestPayload: {},
      initiatorType: "system",
    });
    const wrongToolJob = await jobRepository.createJob({
      conversationId: "conv_1",
      userId: "usr_1",
      toolName: "generate_audio",
      requestPayload: {},
      initiatorType: "system",
    });

    const binder = new MediaWorkflowJobBinder();
    expect(() => binder.bindJobToStep({
      workflowRepository,
      snapshot: workflow,
      step: composeStep!,
      job: wrongConversationJob,
    })).toThrow(/another conversation/);
    expect(() => binder.bindJobToStep({
      workflowRepository,
      snapshot: workflow,
      step: composeStep!,
      job: wrongUserJob,
    })).toThrow(/another user/);
    expect(() => binder.bindJobToStep({
      workflowRepository,
      snapshot: workflow,
      step: composeStep!,
      job: wrongToolJob,
    })).toThrow(/Cannot bind generate_audio job to compose_media/);
  });

  it("marks the workflow succeeded when the compose job produces the final video asset", async () => {
    const db = createDb();
    const jobRepository = new JobQueueDataMapper(db);
    const workflowRepository = new SqliteMediaWorkflowRepository(db);
    const audioJob = await createAudioJob(jobRepository);
    createWorkflowWithAudioJob(workflowRepository, audioJob.id);
    await markAudioJobSucceeded(jobRepository, audioJob.id);

    const orchestrator = new MediaWorkflowOrchestrator({ workflowRepository, jobRepository });
    const withComposeJob = await orchestrator.advanceByJobId(audioJob.id);
    const composeJobId = withComposeJob?.steps.find((step) => step.kind === "compose_media")?.jobId;
    expect(composeJobId).toMatch(/^job_/);

    await jobRepository.updateJobStatus(composeJobId!, {
      status: "succeeded",
      resultPayload: {
        schemaVersion: 1,
        toolName: "compose_media",
        artifacts: [{
          kind: "video",
          assetId: "uf_video_bloom",
          mimeType: "video/mp4",
        }],
      },
      completedAt: "2026-05-01T16:48:15.000Z",
    });

    const completed = await orchestrator.advanceByJobId(composeJobId!);

    const composeStep = completed?.steps.find((step) => step.kind === "compose_media");
    expect(composeStep?.status).toBe("ready");
    expect(composeStep?.assetId).toBe("uf_video_bloom");
    expect(completed?.workflow.status).toBe("succeeded");
    expect(completed?.workflow.finalAssetId).toBe("uf_video_bloom");
  });
});
