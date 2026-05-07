import type { JobRequest } from "@/core/entities/job";
import type { MediaCompositionClip, MediaCompositionPlan } from "@/core/entities/media-composition";
import type { JobQueueRepository } from "@/core/use-cases/JobQueueRepository";
import type { MaterializationRepository } from "@/core/use-cases/MaterializationRepository";
import {
  mediaWorkflowOperationStepId,
  type MediaWorkflowJobOperationMetadata,
} from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import { enqueueComposeMediaDeferredJob } from "@/lib/jobs/compose-media-deferred-job";

import type { SqliteMediaWorkflowRepository } from "./sqlite-media-workflow-repository";
import type { MediaWorkflowSnapshot, MediaWorkflowStep, MediaWorkflowStepKind } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOperationMetadataForStep(
  snapshot: MediaWorkflowSnapshot,
  step: MediaWorkflowStep,
): MediaWorkflowJobOperationMetadata | undefined {
  const operation = snapshot.workflow.request["operation"];
  if (!isRecord(operation)) {
    return undefined;
  }
  if (
    typeof operation["operationId"] !== "string"
    || typeof operation["actionId"] !== "string"
    || operation["operationKind"] !== "media_workflow"
  ) {
    return undefined;
  }

  return {
    operationId: operation["operationId"],
    actionId: operation["actionId"],
    operationKind: "media_workflow",
    workflowId: snapshot.workflow.id,
    workflowStepId: step.id,
    stepId: mediaWorkflowOperationStepId(operation["operationId"], step.id),
  };
}

function extractArtifactAssetId(resultPayload: unknown, kind: "audio" | "video"): string | null {
  if (!isRecord(resultPayload)) {
    return null;
  }

  const artifacts = resultPayload["artifacts"];
  if (!Array.isArray(artifacts)) {
    return null;
  }

  for (const artifact of artifacts) {
    if (!isRecord(artifact)) {
      continue;
    }

    if (artifact["kind"] === kind && typeof artifact["assetId"] === "string") {
      return artifact["assetId"];
    }
  }

  return null;
}

function getReadyAsset(step: MediaWorkflowStep): string | null {
  return step.status === "ready" && step.assetId ? step.assetId : null;
}

function isTerminalWorkflow(status: string): boolean {
  return status === "failed" || status === "succeeded" || status === "canceled";
}

function expectedToolNameForStep(stepKind: MediaWorkflowStepKind): string | null {
  switch (stepKind) {
    case "generate_audio":
      return "generate_audio";
    case "compose_media":
      return "compose_media";
    case "generate_image":
      return "generate_blog_image";
    case "generate_chart":
    case "reuse_asset":
      return null;
  }
}

function inferVisualClipKind(step: MediaWorkflowStep): MediaCompositionClip["kind"] {
  if (step.kind === "generate_chart" || step.assetId?.startsWith("chart_")) {
    return "chart";
  }

  if (step.assetId?.startsWith("graph_")) {
    return "graph";
  }

  if (step.kind === "compose_media" || step.kind === "generate_audio") {
    return "image";
  }

  return "image";
}

function findVisualStep(snapshot: MediaWorkflowSnapshot): MediaWorkflowStep | null {
  return snapshot.steps.find((step) =>
    step.kind === "generate_chart"
    || step.kind === "generate_image"
    || step.kind === "reuse_asset"
  ) ?? null;
}

function buildComposePlan(snapshot: MediaWorkflowSnapshot, composeStep: MediaWorkflowStep): MediaCompositionPlan | null {
  const visualStep = findVisualStep(snapshot);
  const audioStep = snapshot.steps.find((step) => step.kind === "generate_audio");
  const visualAssetId = visualStep ? getReadyAsset(visualStep) : null;
  const audioAssetId = audioStep ? getReadyAsset(audioStep) : null;

  if (!visualStep || !visualAssetId || !audioAssetId) {
    return null;
  }

  const resolution = isRecord(composeStep.input["resolution"])
    && typeof composeStep.input["resolution"]["width"] === "number"
    && typeof composeStep.input["resolution"]["height"] === "number"
    ? {
        width: composeStep.input["resolution"]["width"],
        height: composeStep.input["resolution"]["height"],
      }
    : { width: 1024, height: 1536 };

  return {
    id: typeof composeStep.input["planId"] === "string"
      ? composeStep.input["planId"]
      : `${snapshot.workflow.id}_compose`,
    conversationId: snapshot.workflow.conversationId,
    visualClips: [{
      assetId: visualAssetId,
      kind: inferVisualClipKind(visualStep),
      duration: 30,
    }],
    audioClips: [{
      assetId: audioAssetId,
      kind: "audio",
    }],
    profile: "still_image_narration_fast",
    subtitlePolicy: "none",
    waveformPolicy: "none",
    outputFormat: "mp4",
    resolution,
  };
}

export class MediaWorkflowDependencyResolver {
  resolve(snapshot: MediaWorkflowSnapshot, step: MediaWorkflowStep): "eligible" | "waiting" | "failed" {
    for (const dependencyId of step.dependsOnStepIds) {
      const dependency = snapshot.steps.find((candidate) => candidate.id === dependencyId);
      if (!dependency || dependency.status === "failed" || dependency.status === "blocked") {
        return "failed";
      }

      if (dependency.status !== "ready" && dependency.status !== "skipped") {
        return "waiting";
      }
    }

    return "eligible";
  }
}

export class MediaWorkflowJobBinder {
  bindJobToStep(input: {
    workflowRepository: SqliteMediaWorkflowRepository;
    snapshot: MediaWorkflowSnapshot;
    step: MediaWorkflowStep;
    job: JobRequest;
  }): MediaWorkflowSnapshot {
    if (input.job.conversationId !== input.snapshot.workflow.conversationId) {
      throw new Error(`Cannot bind job ${input.job.id} from another conversation to media workflow ${input.snapshot.workflow.id}.`);
    }

    if (input.job.userId !== input.snapshot.workflow.userId) {
      throw new Error(`Cannot bind job ${input.job.id} from another user to media workflow ${input.snapshot.workflow.id}.`);
    }

    const expectedToolName = expectedToolNameForStep(input.step.kind);
    if (expectedToolName && input.job.toolName !== expectedToolName) {
      throw new Error(`Cannot bind ${input.job.toolName} job to ${input.step.kind} media workflow step.`);
    }

    return input.workflowRepository.updateStep({
      stepId: input.step.id,
      status: input.job.status === "running" ? "running" : "queued",
      jobId: input.job.id,
      eventType: "step_queued",
      eventPayload: { jobId: input.job.id, toolName: input.job.toolName },
    });
  }
}

interface JobResultExtraction {
  assetId: string;
  output: Record<string, unknown>;
}

interface MediaWorkflowStepStrategy {
  canHandle(step: MediaWorkflowStep): boolean;
  extractJobResult(step: MediaWorkflowStep, job: JobRequest): JobResultExtraction | null;
}

class GeneratedAudioStepStrategy implements MediaWorkflowStepStrategy {
  canHandle(step: MediaWorkflowStep): boolean {
    return step.kind === "generate_audio";
  }

  extractJobResult(_step: MediaWorkflowStep, job: JobRequest): JobResultExtraction | null {
    if (job.toolName !== "generate_audio" || job.status !== "succeeded") {
      return null;
    }

    const assetId = extractArtifactAssetId(job.resultPayload, "audio");
    return assetId ? { assetId, output: { assetId, jobId: job.id, toolName: job.toolName } } : null;
  }
}

class ComposeMediaStepStrategy implements MediaWorkflowStepStrategy {
  canHandle(step: MediaWorkflowStep): boolean {
    return step.kind === "compose_media";
  }

  extractJobResult(_step: MediaWorkflowStep, job: JobRequest): JobResultExtraction | null {
    if (job.toolName !== "compose_media" || job.status !== "succeeded") {
      return null;
    }

    const assetId = extractArtifactAssetId(job.resultPayload, "video");
    return assetId ? { assetId, output: { assetId, jobId: job.id, toolName: job.toolName } } : null;
  }
}

class MediaWorkflowStepStrategyRegistry {
  private readonly strategies: readonly MediaWorkflowStepStrategy[] = [
    new GeneratedAudioStepStrategy(),
    new ComposeMediaStepStrategy(),
  ];

  forStep(step: MediaWorkflowStep): MediaWorkflowStepStrategy | null {
    return this.strategies.find((strategy) => strategy.canHandle(step)) ?? null;
  }
}

export class MediaWorkflowOrchestrator {
  private readonly dependencyResolver = new MediaWorkflowDependencyResolver();
  private readonly jobBinder = new MediaWorkflowJobBinder();
  private readonly stepStrategies = new MediaWorkflowStepStrategyRegistry();

  constructor(private readonly deps: {
    workflowRepository: SqliteMediaWorkflowRepository;
    jobRepository: JobQueueRepository;
    materializationRepository?: MaterializationRepository;
  }) {}

  async advanceByJobId(jobId: string): Promise<MediaWorkflowSnapshot | null> {
    const snapshot = this.deps.workflowRepository.findWorkflowByStepJobId(jobId);
    if (!snapshot) {
      return null;
    }

    return this.advanceWorkflow(snapshot.workflow.id);
  }

  async reconcileRunnableWorkflows(options: {
    conversationId?: string;
    userId?: string;
    limit?: number;
  } = {}): Promise<MediaWorkflowSnapshot[]> {
    const workflows = this.deps.workflowRepository.listRunnableWorkflows(options);
    const advanced: MediaWorkflowSnapshot[] = [];

    for (const workflow of workflows) {
      const updated = await this.advanceWorkflow(workflow.workflow.id);
      if (updated) {
        advanced.push(updated);
      }
    }

    return advanced;
  }

  async advanceWorkflow(workflowId: string): Promise<MediaWorkflowSnapshot | null> {
    let snapshot = this.deps.workflowRepository.findWorkflowById(workflowId);
    if (!snapshot || isTerminalWorkflow(snapshot.workflow.status)) {
      return snapshot;
    }

    const hasStartedWork = snapshot.steps.some((step) => step.status !== "pending");
    if (hasStartedWork && snapshot.workflow.status === "queued") {
      snapshot = this.deps.workflowRepository.markWorkflowRunning({ workflowId });
    }

    for (const step of snapshot.steps) {
      if (!step.jobId || step.status === "ready") {
        continue;
      }

      const job = await this.deps.jobRepository.findJobById(step.jobId);
      if (!job) {
        continue;
      }

      if (job.status === "failed" || job.status === "canceled") {
        const failureCode = job.failureClass ?? "job_failed";
        const failureMessage = job.errorMessage ?? `Linked ${job.toolName} job failed.`;
        this.deps.workflowRepository.updateStep({
          stepId: step.id,
          status: "failed",
          failureCode,
          failureMessage,
          eventType: "step_failed",
          eventPayload: { jobId: job.id, toolName: job.toolName, failureCode, failureMessage },
        });
        return this.deps.workflowRepository.markWorkflowFailed({
          workflowId,
          failureCode,
          failureMessage,
        });
      }

      if (job.status !== "succeeded") {
        continue;
      }

      const strategy = this.stepStrategies.forStep(step);
      const extracted = strategy?.extractJobResult(step, job) ?? null;
      if (!extracted) {
        continue;
      }

      snapshot = this.deps.workflowRepository.updateStep({
        stepId: step.id,
        status: "ready",
        assetId: extracted.assetId,
        output: extracted.output,
        eventType: "step_ready",
        eventPayload: extracted.output,
      });

      if (step.kind === "compose_media") {
        return this.deps.workflowRepository.markWorkflowSucceeded({
          workflowId,
          finalAssetId: extracted.assetId,
        });
      }
    }

    snapshot = this.deps.workflowRepository.findWorkflowById(workflowId);
    if (!snapshot || isTerminalWorkflow(snapshot.workflow.status)) {
      return snapshot;
    }

    const composeStep = snapshot.steps.find((step) => step.kind === "compose_media");
    if (!composeStep || composeStep.jobId || composeStep.status !== "pending") {
      return snapshot;
    }

    const eligibility = this.dependencyResolver.resolve(snapshot, composeStep);
    if (eligibility === "failed") {
      return this.deps.workflowRepository.markWorkflowFailed({
        workflowId,
        failureCode: "dependency_failed",
        failureMessage: "A required media workflow dependency failed.",
      });
    }
    if (eligibility !== "eligible") {
      return snapshot;
    }

    const plan = buildComposePlan(snapshot, composeStep);
    if (!plan) {
      return this.deps.workflowRepository.markWorkflowFailed({
        workflowId,
        failureCode: "invalid_compose_plan",
        failureMessage: "Eligible media workflow compose step could not build a valid composition plan.",
      });
    }

    const result = await enqueueComposeMediaDeferredJob({
      repository: this.deps.jobRepository,
      materializationRepository: this.deps.materializationRepository,
      conversationId: snapshot.workflow.conversationId,
      userId: snapshot.workflow.userId,
      plan,
      initiatorType: "system",
      priority: 5,
      operation: readOperationMetadataForStep(snapshot, composeStep),
    });

    if (result.outcome === "exact_reuse" && result.materialization?.outputRefs.length) {
      const output = result.materialization.outputRefs.find((ref) => ref.kind === "asset" && ref.id);
      if (output?.id) {
        this.deps.workflowRepository.updateStep({
          stepId: composeStep.id,
          status: "ready",
          assetId: output.id,
          output: { assetId: output.id, materializationId: result.materialization.id },
          eventType: "step_ready",
          eventPayload: { assetId: output.id, materializationId: result.materialization.id },
        });
        return this.deps.workflowRepository.markWorkflowSucceeded({
          workflowId,
          finalAssetId: output.id,
        });
      }
    }

    if (result.job) {
      return this.jobBinder.bindJobToStep({
        workflowRepository: this.deps.workflowRepository,
        snapshot,
        step: composeStep,
        job: result.job,
      });
    }

    return snapshot;
  }
}
