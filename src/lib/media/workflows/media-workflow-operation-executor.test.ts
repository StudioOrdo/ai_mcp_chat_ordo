import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import { OperationDataMapper } from "@/adapters/OperationDataMapper";
import { createMediaWorkflowCreateAction } from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import { OperationActionDispatchService } from "@/core/use-cases/operations/OperationActionDispatch";
import { ensureSchema } from "@/lib/db/schema";

import { MediaWorkflowOperationExecutor } from "./media-workflow-operation-executor";
import { MediaWorkflowOperationReconciler } from "./media-workflow-operation-reconciler";
import { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";

const NOW = "2026-05-03T12:00:00.000Z";

let idSequence = 0;
function idFactory(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${idSequence}`;
}

describe("MediaWorkflowOperationExecutor", () => {
  let db: Database.Database;
  let operations: OperationDataMapper;
  let jobs: JobQueueDataMapper;
  let workflows: SqliteMediaWorkflowRepository;
  let reconciler: MediaWorkflowOperationReconciler;
  let dispatch: OperationActionDispatchService;

  beforeEach(() => {
    idSequence = 0;
    db = new Database(":memory:");
    ensureSchema(db);
    db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run("usr_1", "user@test.com", "User");
    db.prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)").run("conv_1", "usr_1", "Media test");
    operations = new OperationDataMapper(db);
    jobs = new JobQueueDataMapper(db);
    workflows = new SqliteMediaWorkflowRepository(db);
    reconciler = new MediaWorkflowOperationReconciler({
      operations,
      workflows,
      jobs,
      idFactory,
      now: () => NOW,
    });
    dispatch = new OperationActionDispatchService({
      repository: operations,
      executors: [new MediaWorkflowOperationExecutor({
        workflowRepository: workflows,
        jobRepository: jobs,
        idFactory,
        reconcile: async (operationId, workflowId) => {
          if (workflowId) {
            await reconciler.reconcileWorkflow(workflowId, operationId);
          } else if (operationId) {
            await reconciler.reconcileOperation(operationId);
          }
        },
      })],
    });
  });

  afterEach(() => {
    db.close();
  });

  async function createMediaOperation(payload: Record<string, unknown>) {
    const created = await operations.createOperation({
      id: "op_media",
      kind: "media_workflow",
      title: "Generate audio",
      status: "draft",
      riskLevel: "medium",
      conversationId: "conv_1",
      createdByUserId: "usr_1",
      createdByRole: "AUTHENTICATED",
      now: NOW,
    });
    const action = createMediaWorkflowCreateAction({
      operationId: created.operation.id,
      operationRevision: created.operation.revision,
      idFactory,
      payload,
    });
    await operations.replaceActions({ operationId: created.operation.id, actions: [action], now: NOW });
    return action;
  }

  it("creates one generated-audio workflow, operation step, and initial job", async () => {
    const action = await createMediaOperation({
      requestedDeliverable: "audio",
      template: "generated_audio",
      idempotencyKey: "media_create_1",
      audio: {
        title: "Audio",
        text: "Make this narration.",
      },
    });

    const result = await dispatch.dispatch({
      operationId: "op_media",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    const workflow = workflows.findWorkflowByOperationId("op_media");
    expect(workflow?.workflow.status).toBe("queued");
    expect(workflow?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "generate_audio", status: "queued", jobId: expect.stringMatching(/^job_/) }),
    ]));
    expect(result.snapshot.operation.status).toBe("queued");
    expect(result.snapshot.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "media.generate_audio",
        status: "ready",
        jobId: workflow?.steps[0]?.jobId,
      }),
    ]));

    const job = workflow?.steps[0]?.jobId ? await jobs.findJobById(workflow.steps[0].jobId) : null;
    expect(job?.requestPayload.operation).toMatchObject({
      operationId: "op_media",
      operationKind: "media_workflow",
      workflowId: workflow?.workflow.id,
      workflowStepId: workflow?.steps[0]?.id,
    });
  });

  it("does not duplicate a workflow when create is dispatched again with the same accepted action idempotency", async () => {
    const action = await createMediaOperation({
      requestedDeliverable: "audio",
      template: "generated_audio",
      idempotencyKey: "media_create_1",
      audio: {
        title: "Audio",
        text: "Make this narration.",
      },
    });

    const request = {
      operationId: "op_media",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED" as const,
      confirmation: { confirmed: true },
      now: NOW,
    };
    await dispatch.dispatch(request);
    await dispatch.dispatch(request);

    expect(workflows.listWorkflowsByConversation("conv_1")).toHaveLength(1);
  });

  it("blocks unsupported templates before hidden job enqueueing", async () => {
    const action = await createMediaOperation({
      requestedDeliverable: "video",
      template: "freeform_request",
      idempotencyKey: "media_create_unsupported",
      requestedText: "make a video",
    });

    const result = await dispatch.dispatch({
      operationId: "op_media",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    expect(result.snapshot.operation.status).toBe("blocked");
    expect(result.snapshot.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "media.compose",
        status: "blocked",
        error: expect.objectContaining({ code: "MEDIA_WORKFLOW_TEMPLATE_UNSUPPORTED" }),
      }),
    ]));
    expect(workflows.listWorkflowsByConversation("conv_1")).toHaveLength(0);
  });

  it("retries a failed audio step with exactly one replacement job", async () => {
    const action = await createMediaOperation({
      requestedDeliverable: "audio",
      template: "generated_audio",
      idempotencyKey: "media_create_1",
      audio: {
        title: "Audio",
        text: "Make this narration.",
      },
    });
    await dispatch.dispatch({
      operationId: "op_media",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    const workflow = workflows.findWorkflowByOperationId("op_media");
    const step = workflow?.steps[0];
    const originalJobId = step?.jobId;
    expect(workflow?.workflow.status).toBe("queued");
    expect(originalJobId).toBeTruthy();

    await jobs.updateJobStatus(originalJobId!, {
      status: "failed",
      errorMessage: "Provider timeout.",
      completedAt: NOW,
    });
    workflows.updateStep({
      stepId: step!.id,
      status: "failed",
      failureCode: "provider_timeout",
      failureMessage: "Provider timeout.",
      eventType: "step_failed",
      eventPayload: { failureCode: "provider_timeout" },
      updatedAt: NOW,
    });
    workflows.markWorkflowFailed({
      workflowId: workflow!.workflow.id,
      failureCode: "provider_timeout",
      failureMessage: "Provider timeout.",
      completedAt: NOW,
    });
    await reconciler.reconcileOperation("op_media");

    const retry = (await operations.listAvailableActions("op_media"))
      .find((candidate) => candidate.actionType === "media.workflow.retry_step");
    expect(retry).toBeTruthy();

    const result = await dispatch.dispatch({
      operationId: "op_media",
      actionId: retry!.id,
      idempotencyKey: retry!.idempotencyKey,
      clientOperationRevision: retry!.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    const retriedWorkflow = workflows.findWorkflowByOperationId("op_media");
    const retriedStep = retriedWorkflow?.steps[0];
    expect(retriedWorkflow?.workflow.status).toBe("queued");
    expect(retriedStep?.status).toBe("queued");
    expect(retriedStep?.jobId).toBeTruthy();
    expect(retriedStep?.jobId).not.toBe(originalJobId);
    expect((await jobs.findJobById(retriedStep!.jobId!))?.requestPayload.operation).toMatchObject({
      operationId: "op_media",
      workflowId: retriedWorkflow?.workflow.id,
      workflowStepId: retriedStep?.id,
      actionId: retry?.id,
    });
    expect((await jobs.listJobsByConversation("conv_1")).filter((job) => job.toolName === "generate_audio")).toHaveLength(2);
    expect(result.snapshot.operation.status).toBe("queued");
  });

  it("cancels queued media jobs and projects the operation as cancelled", async () => {
    const action = await createMediaOperation({
      requestedDeliverable: "audio",
      template: "generated_audio",
      idempotencyKey: "media_create_1",
      audio: {
        title: "Audio",
        text: "Make this narration.",
      },
    });
    await dispatch.dispatch({
      operationId: "op_media",
      actionId: action.id,
      idempotencyKey: action.idempotencyKey,
      clientOperationRevision: action.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    const cancel = (await operations.listAvailableActions("op_media"))
      .find((candidate) => candidate.actionType === "media.workflow.cancel");
    expect(cancel).toBeTruthy();

    const result = await dispatch.dispatch({
      operationId: "op_media",
      actionId: cancel!.id,
      idempotencyKey: cancel!.idempotencyKey,
      clientOperationRevision: cancel!.operationRevision,
      actorUserId: "usr_1",
      actorRole: "AUTHENTICATED",
      confirmation: { confirmed: true },
      now: NOW,
    });

    const workflow = workflows.findWorkflowByOperationId("op_media");
    const jobId = workflow?.steps[0]?.jobId;
    const job = jobId ? await jobs.findJobById(jobId) : null;
    expect(workflow?.workflow.status).toBe("canceled");
    expect(job?.status).toBe("canceled");
    expect(result.snapshot.operation.status).toBe("cancelled");
  });
});
