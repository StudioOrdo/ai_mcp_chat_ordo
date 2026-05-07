import { describe, expect, it, vi } from "vitest";

import type { LiveEvalRuntimeRequest, LiveEvalRuntimeResult } from "@/lib/evals/live-runtime";
import {
  getWorkflowCoveredToolNames,
  resolveToolWorkflowCoverageScenarios,
  runLiveToolWorkflowCoverageEval,
  verifyToolWorkflowCoverageResult,
  type ToolWorkflowCoverageScenario,
} from "@/lib/evals/tool-workflow-coverage";

type ToolCall = LiveEvalRuntimeResult["toolCalls"][number];
type ToolResult = LiveEvalRuntimeResult["toolResults"][number];

function pushCall(
  toolCalls: ToolCall[],
  toolResults: ToolResult[],
  name: string,
  args: Record<string, unknown>,
  result: unknown,
  toolInvocationId: string,
): void {
  toolCalls.push({ name, args, toolInvocationId });
  toolResults.push({ name, result, isError: false, toolInvocationId });
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function firstAssetId(result: unknown): string {
  const record = requireRecord(result, "list_conversation_media_assets result");
  const assets = record.assets;
  if (!Array.isArray(assets)) {
    throw new Error("Fixture asset list must contain assets.");
  }

  const first = requireRecord(assets[0], "first asset");
  if (typeof first.assetId !== "string") {
    throw new Error("First fixture asset is missing assetId.");
  }

  return first.assetId;
}

function jobIdFromResult(result: unknown): string {
  const record = requireRecord(result, "job creation result");
  if (typeof record.jobId !== "string") {
    throw new Error("Fixture job creation result is missing jobId.");
  }

  return record.jobId;
}

function resultPayloadFromStatus(result: unknown): Record<string, unknown> {
  const record = requireRecord(result, "job status result");
  const job = requireRecord(record.job, "job status result job");
  return requireRecord(job.resultPayload, "job status result payload");
}

async function executeScriptedWorkflow(
  request: LiveEvalRuntimeRequest,
  scenario: ToolWorkflowCoverageScenario,
): Promise<LiveEvalRuntimeResult> {
  if (!request.toolExecutor) {
    throw new Error("Expected a workflow fixture tool executor.");
  }

  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];
  const exec = async (name: string, args: Record<string, unknown>, toolInvocationId: string) => {
    const result = await request.toolExecutor!(name, args, toolInvocationId);
    pushCall(toolCalls, toolResults, name, args, result, toolInvocationId);
    return result;
  };

  if (scenario.id === "media-image-audio-video-fixture") {
    const listed = await exec("list_conversation_media_assets", { kinds: ["image"], limit: 5 }, "toolu_eval_list_media");
    const imageAssetId = firstAssetId(listed);
    const audio = await exec(
      "generate_audio",
      { title: "Eval narration", text: "This is a deterministic media workflow eval." },
      "toolu_eval_audio",
    );
    const audioJobId = jobIdFromResult(audio);
    const audioStatus = await exec("get_deferred_job_status", { job_id: audioJobId }, "toolu_eval_audio_status");
    const audioAssetId = resultPayloadFromStatus(audioStatus).assetId;
    if (typeof audioAssetId !== "string") {
      throw new Error("Audio status result is missing assetId.");
    }

    const composePlan = {
      id: "plan_eval_media_workflow",
      conversationId: scenario.conversationId,
      visualClips: [{ assetId: imageAssetId, kind: "image", duration: 4.2 }],
      audioClips: [{ assetId: audioAssetId, kind: "audio" }],
      profile: "still_image_narration_fast",
      subtitlePolicy: "none",
      waveformPolicy: "none",
      outputFormat: "mp4",
    };
    const compose = await exec("compose_media", { plan: composePlan }, "toolu_eval_compose");
    const composeJobId = jobIdFromResult(compose);
    await exec("get_deferred_job_status", { job_id: composeJobId }, "toolu_eval_compose_status");
  } else if (scenario.id === "blog-production-image-handoff-fixture") {
    const produce = await exec(
      "produce_blog_article",
      { brief: "Reliable AI media operations", audience: "operators" },
      "toolu_eval_blog_produce",
    );
    const produceJobId = jobIdFromResult(produce);
    const status = await exec("get_deferred_job_status", { job_id: produceJobId }, "toolu_eval_blog_status");
    const postId = resultPayloadFromStatus(status).id;
    if (typeof postId !== "string") {
      throw new Error("Blog status result is missing post id.");
    }
    await exec("publish_content", { post_id: postId }, "toolu_eval_blog_publish");
  } else if (scenario.id === "chart-graph-reusable-visuals-fixture") {
    await exec(
      "generate_chart",
      {
        title: "Operating loop",
        spec: {
          chartType: "flowchart",
          direction: "LR",
          nodes: [
            { id: "collect", label: "Collect" },
            { id: "decide", label: "Decide" },
            { id: "spec", label: "Spec" },
            { id: "qa", label: "QA" },
          ],
          edges: [
            { from: "collect", to: "decide" },
            { from: "decide", to: "spec" },
            { from: "spec", to: "qa" },
          ],
        },
      },
      "toolu_eval_chart",
    );
    await exec(
      "generate_graph",
      {
        title: "Qualified leads",
        data: {
          rows: [
            { week: "2026-04-20", qualified: 4 },
            { week: "2026-04-27", qualified: 7 },
          ],
        },
        spec: {
          graphType: "bar",
          x: { field: "week", type: "temporal" },
          y: { field: "qualified", type: "quantitative" },
        },
      },
      "toolu_eval_graph",
    );
    await exec(
      "list_conversation_media_assets",
      { kinds: ["chart", "graph"], limit: 10 },
      "toolu_eval_list_visuals",
    );
  } else {
    throw new Error(`No scripted runtime for scenario ${scenario.id}.`);
  }

  return {
    model: "stub-live-model",
    assistantText: `${scenario.completionToken}`,
    stopReason: "end_turn",
    toolRoundCount: toolCalls.length,
    toolCalls,
    toolResults,
    systemPrompt: request.systemPrompt ?? "",
    toolCount: request.tools?.length ?? 0,
  };
}

describe("live tool workflow coverage eval harness", () => {
  it("declares focused complex workflows over the registered tool surface", () => {
    const scenarios = resolveToolWorkflowCoverageScenarios();

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "media-image-audio-video-fixture",
      "blog-production-image-handoff-fixture",
      "chart-graph-reusable-visuals-fixture",
    ]);
    expect(getWorkflowCoveredToolNames(scenarios)).toEqual([
      "compose_media",
      "generate_audio",
      "generate_chart",
      "generate_graph",
      "get_deferred_job_status",
      "list_conversation_media_assets",
      "produce_blog_article",
      "publish_content",
    ]);
  });

  it("runs fixture-backed workflow evals without real media generation or durable mutation", async () => {
    const execution = await runLiveToolWorkflowCoverageEval({
      apiKey: "test-key",
      executeRuntime: vi.fn(executeScriptedWorkflow),
    });

    expect(execution).toMatchObject({
      total: 3,
      passed: 3,
      failed: 0,
    });
    expect(execution.registryToolCount).toBeGreaterThan(50);
    expect(execution.results.every((result) => result.checkpoints.every((checkpoint) => checkpoint.passed))).toBe(true);
  });

  it("fails the media workflow when compose_media uses a job id instead of the completed audio asset id", () => {
    const [scenario] = resolveToolWorkflowCoverageScenarios({
      includeScenarios: ["media-image-audio-video-fixture"],
    });
    expect(scenario).toBeDefined();

    const runtimeResult: LiveEvalRuntimeResult = {
      model: "stub-live-model",
      assistantText: scenario!.completionToken,
      stopReason: "end_turn",
      toolRoundCount: 5,
      toolCalls: [
        {
          name: "list_conversation_media_assets",
          args: { kinds: ["image"], limit: 5 },
          toolInvocationId: "toolu_list",
        },
        {
          name: "generate_audio",
          args: { title: "Eval narration", text: "This is a deterministic media workflow eval." },
          toolInvocationId: "toolu_audio",
        },
        {
          name: "get_deferred_job_status",
          args: { job_id: "job_eval_audio_1" },
          toolInvocationId: "toolu_audio_status",
        },
        {
          name: "compose_media",
          args: {
            plan: {
              id: "plan_bad",
              conversationId: scenario!.conversationId,
              visualClips: [{ assetId: "asset_eval_reusable_image_1", kind: "image" }],
              audioClips: [{ assetId: "job_eval_audio_1", kind: "audio" }],
              profile: "still_image_narration_fast",
              subtitlePolicy: "none",
              waveformPolicy: "none",
              outputFormat: "mp4",
            },
          },
          toolInvocationId: "toolu_compose",
        },
        {
          name: "get_deferred_job_status",
          args: { job_id: "job_eval_compose_media_1" },
          toolInvocationId: "toolu_compose_status",
        },
      ],
      toolResults: [
        { name: "list_conversation_media_assets", result: { ok: true }, isError: false, toolInvocationId: "toolu_list" },
        { name: "generate_audio", result: { jobId: "job_eval_audio_1" }, isError: false, toolInvocationId: "toolu_audio" },
        {
          name: "get_deferred_job_status",
          result: { ok: true, job: { jobId: "job_eval_audio_1", status: "succeeded", resultPayload: { assetId: "asset_eval_audio_1" } } },
          isError: false,
          toolInvocationId: "toolu_audio_status",
        },
        { name: "compose_media", result: { jobId: "job_eval_compose_media_1" }, isError: false, toolInvocationId: "toolu_compose" },
        {
          name: "get_deferred_job_status",
          result: {
            ok: true,
            job: {
              jobId: "job_eval_compose_media_1",
              status: "succeeded",
              resultPayload: { primaryAssetId: "asset_eval_video_1" },
            },
          },
          isError: false,
          toolInvocationId: "toolu_compose_status",
        },
      ],
      systemPrompt: "system",
      toolCount: scenario!.toolNames.length,
    };

    const checkpoints = verifyToolWorkflowCoverageResult(scenario!, runtimeResult);

    expect(checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "compose_plan_uses_asset_ids_not_job_ids", passed: false }),
      ]),
    );
  });
});
