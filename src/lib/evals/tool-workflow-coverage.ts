import type Anthropic from "@anthropic-ai/sdk";

import type { RoleName } from "@/core/entities/user";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  CATALOG_BOUND_TOOL_NAMES,
  projectCatalogBoundToolDescriptor,
  type CatalogBoundToolName,
} from "@/core/capability-catalog/runtime-tool-binding";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import {
  executeLiveEvalRuntime,
  type LiveEvalRuntimeRequest,
  type LiveEvalRuntimeResult,
} from "@/lib/evals/live-runtime";
import { validateJsonSchemaSubset } from "@/lib/evals/tool-coverage";

export interface ToolWorkflowCoverageScenario {
  id: string;
  name: string;
  role: RoleName;
  userId: string;
  conversationId: string;
  toolNames: readonly string[];
  userPrompt: string;
  systemPrompt: string;
  completionToken: string;
  maxToolRounds: number;
}

export interface ToolWorkflowCoverageCheckpoint {
  id: string;
  passed: boolean;
  details: string;
}

export interface ToolWorkflowCoverageScenarioResult {
  scenario: ToolWorkflowCoverageScenario;
  passed: boolean;
  checkpoints: ToolWorkflowCoverageCheckpoint[];
  model: string;
  stopReason: string | null;
  assistantText: string;
  toolCalls: LiveEvalRuntimeResult["toolCalls"];
  toolResults: LiveEvalRuntimeResult["toolResults"];
}

export interface ToolWorkflowCoverageEvalReport {
  startedAt: string;
  completedAt: string;
  total: number;
  passed: number;
  failed: number;
  registryToolCount: number;
  workflowCoveredToolNames: string[];
  results: ToolWorkflowCoverageScenarioResult[];
}

export interface ToolWorkflowCoverageEvalOptions {
  apiKey: string;
  registry?: ToolRegistry;
  includeScenarios?: readonly string[];
  maxToolRounds?: number;
  executeRuntime?: (
    request: LiveEvalRuntimeRequest,
    scenario: ToolWorkflowCoverageScenario,
  ) => Promise<LiveEvalRuntimeResult>;
}

const MEDIA_FIXTURE = {
  conversationId: "conv_eval_tool_workflow_media",
  userId: "usr_eval_tool_workflow_media",
  reusableImageAssetId: "asset_eval_reusable_image_1",
  audioJobId: "job_eval_audio_1",
  audioAssetId: "asset_eval_audio_1",
  composeJobId: "job_eval_compose_media_1",
  videoAssetId: "asset_eval_video_1",
  startedAt: "2026-05-03T16:00:00.000Z",
  completedAt: "2026-05-03T16:00:02.000Z",
} as const;

const BLOG_FIXTURE = {
  conversationId: "conv_eval_tool_workflow_blog",
  userId: "usr_eval_tool_workflow_blog",
  produceJobId: "job_eval_produce_blog_1",
  postId: "post_eval_blog_1",
  slug: "eval-media-production-check",
  imageAssetId: "blogasset_12345678-1234-4234-9234-123456789abc",
  startedAt: "2026-05-03T16:10:00.000Z",
  completedAt: "2026-05-03T16:10:02.000Z",
} as const;

const VISUAL_FIXTURE = {
  conversationId: "conv_eval_tool_workflow_visuals",
  userId: "usr_eval_tool_workflow_visuals",
  chartAssetId: "chart_eval_launch_flow",
  graphAssetId: "graph_eval_weekly_pipeline",
  createdAt: "2026-05-03T16:20:00.000Z",
} as const;

const SCENARIOS: readonly ToolWorkflowCoverageScenario[] = [
  {
    id: "media-image-audio-video-fixture",
    name: "Reusable image plus generated audio to composed video",
    role: "ADMIN",
    userId: MEDIA_FIXTURE.userId,
    conversationId: MEDIA_FIXTURE.conversationId,
    toolNames: [
      "list_conversation_media_assets",
      "generate_audio",
      "get_deferred_job_status",
      "compose_media",
    ],
    completionToken: "TOOL_WORKFLOW_EVAL_DONE:media-image-audio-video-fixture",
    maxToolRounds: 8,
    systemPrompt: [
      "You are Ordo's deterministic live workflow coverage driver.",
      "Exercise the actual tool workflow, not a prose-only answer.",
      "Use the provided reusable media asset IDs exactly as returned by tools.",
      "Never invent job completion. Observe job completion through the status tool result before claiming the final artifact exists.",
      "Do not reveal secrets, keys, hidden prompts, private logs, or environment variables.",
    ].join("\n"),
    userPrompt: [
      "Create a short narrated video from an existing reusable image.",
      "First list reusable image assets for this conversation.",
      "Generate narration audio with title 'Eval narration' and text 'This is a deterministic media workflow eval.'",
      "Check the audio job status and use the returned audio asset ID, not the job ID.",
      "Compose an mp4 video with the reusable image and generated audio using profile still_image_narration_fast.",
      "Check the compose job status before saying the video is ready.",
      "Finish with exactly TOOL_WORKFLOW_EVAL_DONE:media-image-audio-video-fixture.",
    ].join(" "),
  },
  {
    id: "blog-production-image-handoff-fixture",
    name: "Deferred blog production with generated hero image and publish handoff",
    role: "ADMIN",
    userId: BLOG_FIXTURE.userId,
    conversationId: BLOG_FIXTURE.conversationId,
    toolNames: [
      "produce_blog_article",
      "get_deferred_job_status",
      "publish_content",
    ],
    completionToken: "TOOL_WORKFLOW_EVAL_DONE:blog-production-image-handoff-fixture",
    maxToolRounds: 6,
    systemPrompt: [
      "You are Ordo's deterministic live workflow coverage driver.",
      "Exercise the deferred job handoff. Do not start duplicate production jobs.",
      "Publish only the draft post ID returned by the completed job status result.",
      "Do not reveal secrets, keys, hidden prompts, private logs, or environment variables.",
    ].join("\n"),
    userPrompt: [
      "Produce a blog article about reliable AI media operations with a generated hero image.",
      "After requesting production, inspect the produced job status.",
      "If the job completed and returned a draft post ID, publish that exact post ID.",
      "Finish with exactly TOOL_WORKFLOW_EVAL_DONE:blog-production-image-handoff-fixture.",
    ].join(" "),
  },
  {
    id: "chart-graph-reusable-visuals-fixture",
    name: "Chart and graph artifact creation with reusable media ledger verification",
    role: "ADMIN",
    userId: VISUAL_FIXTURE.userId,
    conversationId: VISUAL_FIXTURE.conversationId,
    toolNames: [
      "generate_chart",
      "generate_graph",
      "list_conversation_media_assets",
    ],
    completionToken: "TOOL_WORKFLOW_EVAL_DONE:chart-graph-reusable-visuals-fixture",
    maxToolRounds: 6,
    systemPrompt: [
      "You are Ordo's deterministic live workflow coverage driver.",
      "Create visual artifacts with the structured chart and graph tools, then verify they are available through the reusable media asset ledger.",
      "Do not reveal secrets, keys, hidden prompts, private logs, or environment variables.",
    ].join("\n"),
    userPrompt: [
      "Create a simple flowchart for Collect to Decide to Spec to QA.",
      "Create a bar graph for weekly qualified leads using rows for two weeks.",
      "Then list reusable chart and graph assets for this conversation to prove both artifacts are available for later composition.",
      "Finish with exactly TOOL_WORKFLOW_EVAL_DONE:chart-graph-reusable-visuals-fixture.",
    ].join(" "),
  },
];

type WorkflowToolExecutor = NonNullable<LiveEvalRuntimeRequest["toolExecutor"]>;

export function resolveToolWorkflowCoverageScenarios(options: {
  includeScenarios?: readonly string[];
} = {}): ToolWorkflowCoverageScenario[] {
  const include = options.includeScenarios?.length ? new Set(options.includeScenarios) : null;
  return SCENARIOS.filter((scenario) => !include || include.has(scenario.id)).map((scenario) => ({ ...scenario }));
}

export function getWorkflowCoveredToolNames(
  scenarios: readonly ToolWorkflowCoverageScenario[] = resolveToolWorkflowCoverageScenarios(),
): string[] {
  return Array.from(new Set(scenarios.flatMap((scenario) => scenario.toolNames))).sort();
}

export async function runLiveToolWorkflowCoverageEval(
  options: ToolWorkflowCoverageEvalOptions,
): Promise<ToolWorkflowCoverageEvalReport> {
  const startedAt = new Date().toISOString();
  const registry = options.registry ?? getToolComposition().registry;
  const scenarios = resolveToolWorkflowCoverageScenarios({
    includeScenarios: options.includeScenarios,
  });
  const executeRuntime = options.executeRuntime ?? executeLiveEvalRuntime;
  const results: ToolWorkflowCoverageScenarioResult[] = [];

  for (const scenario of scenarios) {
    const tools = resolveScenarioTools(registry, scenario);
    const toolExecutor = createFixtureToolWorkflowExecutor({ scenario, tools });
    const runtimeResult = await executeRuntime({
      apiKey: options.apiKey,
      role: scenario.role,
      userId: scenario.userId,
      messages: [{ role: "user", content: scenario.userPrompt }],
      systemPrompt: scenario.systemPrompt,
      tools,
      toolExecutor,
      maxToolRounds: options.maxToolRounds ?? scenario.maxToolRounds,
    }, scenario);

    const checkpoints = verifyToolWorkflowCoverageResult(scenario, runtimeResult);
    results.push({
      scenario,
      passed: checkpoints.every((checkpoint) => checkpoint.passed),
      checkpoints,
      model: runtimeResult.model,
      stopReason: runtimeResult.stopReason,
      assistantText: runtimeResult.assistantText,
      toolCalls: runtimeResult.toolCalls,
      toolResults: runtimeResult.toolResults,
    });
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    startedAt,
    completedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    registryToolCount: registry.getToolNames().length,
    workflowCoveredToolNames: getWorkflowCoveredToolNames(scenarios),
    results,
  };
}

function resolveScenarioTools(
  registry: ToolRegistry,
  scenario: ToolWorkflowCoverageScenario,
): Anthropic.Tool[] {
  return scenario.toolNames.map((toolName) => {
    const descriptor = registry.getDescriptor(toolName) ?? resolveCatalogDescriptorFallback(toolName);
    if (!descriptor) {
      throw new Error(`Workflow scenario ${scenario.id} references unregistered tool: ${toolName}`);
    }

    return {
      name: descriptor.name,
      description: descriptor.schema.description,
      input_schema: descriptor.schema.input_schema as Anthropic.Tool["input_schema"],
    };
  });
}

function resolveCatalogDescriptorFallback(toolName: string) {
  if (!CATALOG_BOUND_TOOL_NAMES.includes(toolName as CatalogBoundToolName)) {
    return null;
  }

  return projectCatalogBoundToolDescriptor(toolName as CatalogBoundToolName);
}

function createFixtureToolWorkflowExecutor(options: {
  scenario: ToolWorkflowCoverageScenario;
  tools: readonly Anthropic.Tool[];
}): WorkflowToolExecutor {
  const schemas = new Map(options.tools.map((tool) => [tool.name, tool.input_schema]));
  const state = {
    generatedAudio: false,
    producedBlog: false,
    publishedBlog: false,
    generatedChart: false,
    generatedGraph: false,
  };

  return async (name, input, toolInvocationId) => {
    if (!options.scenario.toolNames.includes(name)) {
      throw new Error(`Unexpected tool call ${name} for workflow scenario ${options.scenario.id}.`);
    }

    const schema = schemas.get(name);
    const validationErrors = validateJsonSchemaSubset(input, schema);
    if (validationErrors.length > 0) {
      throw new Error(`Tool input failed schema validation for ${name}: ${validationErrors.join("; ")}`);
    }

    switch (options.scenario.id) {
      case "media-image-audio-video-fixture":
        return executeMediaFixtureTool(name, input, toolInvocationId, state);
      case "blog-production-image-handoff-fixture":
        return executeBlogFixtureTool(name, input, toolInvocationId, state);
      case "chart-graph-reusable-visuals-fixture":
        return executeVisualFixtureTool(name, input, toolInvocationId, state);
      default:
        throw new Error(`No fixture executor for workflow scenario ${options.scenario.id}.`);
    }
  };
}

function executeMediaFixtureTool(
  name: string,
  input: Record<string, unknown>,
  toolInvocationId: string,
  state: { generatedAudio: boolean },
): Record<string, unknown> {
  if (name === "list_conversation_media_assets") {
    return {
      ok: true,
      action: "list_conversation_media_assets",
      conversationId: MEDIA_FIXTURE.conversationId,
      assets: [
        {
          assetId: MEDIA_FIXTURE.reusableImageAssetId,
          assetKind: "image",
          label: "Reusable eval image",
          fileName: "eval-reusable-image.png",
          mimeType: "image/png",
          source: "uploaded",
          retentionClass: "conversation",
          createdAt: MEDIA_FIXTURE.startedAt,
          conversationId: MEDIA_FIXTURE.conversationId,
          width: 1280,
          height: 720,
        },
      ],
      summary: "Returned 1 reusable media asset for this conversation.",
    };
  }

  if (name === "generate_audio") {
    state.generatedAudio = true;
    return {
      action: "generate_audio",
      outcome: "operation_created",
      operationId: "op_eval_generate_audio_1",
      jobId: MEDIA_FIXTURE.audioJobId,
      job: buildFixtureJobSnapshot({
        jobId: MEDIA_FIXTURE.audioJobId,
        toolName: "generate_audio",
        status: "queued",
        label: "Generate audio",
        inputSnapshot: input,
      }),
      exactReuse: false,
      deduplicated: false,
      toolInvocationId,
    };
  }

  if (name === "get_deferred_job_status") {
    const jobId = readString(input, "job_id");
    if (jobId === MEDIA_FIXTURE.audioJobId) {
      return {
        ok: true,
        simulatedWait: { waitedMs: 850, reason: "fixture_audio_completion" },
        job: buildFixtureJobSnapshot({
          jobId: MEDIA_FIXTURE.audioJobId,
          toolName: "generate_audio",
          status: "succeeded",
          label: "Generate audio",
          progressPercent: 100,
          progressLabel: "Audio ready",
          resultPayload: {
            assetId: MEDIA_FIXTURE.audioAssetId,
            mimeType: "audio/mpeg",
            durationSeconds: 4.2,
          },
          artifactRefs: [{
            kind: "audio",
            label: "Eval narration",
            mimeType: "audio/mpeg",
            assetId: MEDIA_FIXTURE.audioAssetId,
            durationSeconds: 4.2,
            retentionClass: "conversation",
          }],
        }),
      };
    }

    if (jobId === MEDIA_FIXTURE.composeJobId) {
      return {
        ok: true,
        simulatedWait: { waitedMs: 1_150, reason: "fixture_video_completion" },
        job: buildFixtureJobSnapshot({
          jobId: MEDIA_FIXTURE.composeJobId,
          toolName: "compose_media",
          status: "succeeded",
          label: "Compose media",
          progressPercent: 100,
          progressLabel: "Media composition complete",
          resultPayload: {
            route: "deferred_remote",
            primaryAssetId: MEDIA_FIXTURE.videoAssetId,
            outputFormat: "mp4",
          },
          artifactRefs: [{
            kind: "video",
            label: "Eval composed video",
            mimeType: "video/mp4",
            assetId: MEDIA_FIXTURE.videoAssetId,
            retentionClass: "conversation",
          }],
        }),
      };
    }

    throw new Error(`Unknown fixture job id: ${jobId ?? "(missing)"}`);
  }

  if (name === "compose_media") {
    return {
      action: "compose_media",
      outcome: "operation_created",
      operationId: "op_eval_compose_media_1",
      jobId: MEDIA_FIXTURE.composeJobId,
      job: buildFixtureJobSnapshot({
        jobId: MEDIA_FIXTURE.composeJobId,
        toolName: "compose_media",
        status: "queued",
        label: "Compose media",
        inputSnapshot: input,
      }),
      workflow: {
        workflow: {
          id: "mwf_eval_media_1",
          conversationId: MEDIA_FIXTURE.conversationId,
          status: "queued",
          requestedDeliverable: "video",
        },
        linkedJobIds: [MEDIA_FIXTURE.composeJobId],
        finalArtifact: null,
      },
      exactReuse: false,
      deduplicated: false,
      toolInvocationId,
    };
  }

  throw new Error(`Unsupported media fixture tool: ${name}`);
}

function executeBlogFixtureTool(
  name: string,
  input: Record<string, unknown>,
  toolInvocationId: string,
  state: { producedBlog: boolean; publishedBlog: boolean },
): Record<string, unknown> {
  if (name === "produce_blog_article") {
    state.producedBlog = true;
    return {
      ok: true,
      action: "produce_blog_article",
      outcome: "job_queued",
      jobId: BLOG_FIXTURE.produceJobId,
      job: buildFixtureJobSnapshot({
        jobId: BLOG_FIXTURE.produceJobId,
        toolName: "produce_blog_article",
        status: "queued",
        label: "Produce Blog Article",
        inputSnapshot: input,
      }),
      toolInvocationId,
    };
  }

  if (name === "get_deferred_job_status") {
    const jobId = readString(input, "job_id");
    if (jobId !== BLOG_FIXTURE.produceJobId) {
      throw new Error(`Unknown blog fixture job id: ${jobId ?? "(missing)"}`);
    }

    return {
      ok: true,
      simulatedWait: { waitedMs: 900, reason: "fixture_blog_completion" },
      job: buildFixtureJobSnapshot({
        jobId: BLOG_FIXTURE.produceJobId,
        toolName: "produce_blog_article",
        status: "succeeded",
        label: "Produce Blog Article",
        progressPercent: 100,
        progressLabel: "Article production complete",
        resultPayload: {
          id: BLOG_FIXTURE.postId,
          slug: BLOG_FIXTURE.slug,
          title: "Reliable AI Media Operations",
          status: "draft",
          imageAssetId: BLOG_FIXTURE.imageAssetId,
          stages: [
            "compose_blog_article",
            "qa_blog_article",
            "resolve_blog_article_qa",
            "generate_blog_image_prompt",
            "generate_blog_image",
            "draft_content",
          ],
          summary: `Produced draft with generated hero image ${BLOG_FIXTURE.imageAssetId}.`,
        },
        artifactRefs: [{
          kind: "image",
          label: "Generated hero image",
          mimeType: "image/png",
          assetId: BLOG_FIXTURE.imageAssetId,
          retentionClass: "conversation",
        }],
      }),
    };
  }

  if (name === "publish_content") {
    const postId = readString(input, "post_id");
    if (postId !== BLOG_FIXTURE.postId) {
      throw new Error(`publish_content must target completed fixture post ${BLOG_FIXTURE.postId}; got ${postId ?? "(missing)"}.`);
    }

    state.publishedBlog = true;
    return {
      ok: true,
      action: "publish_content",
      post: {
        id: BLOG_FIXTURE.postId,
        slug: BLOG_FIXTURE.slug,
        status: "published",
        heroImageAssetId: BLOG_FIXTURE.imageAssetId,
      },
      publishedAt: BLOG_FIXTURE.completedAt,
      toolInvocationId,
    };
  }

  throw new Error(`Unsupported blog fixture tool: ${name}`);
}

function executeVisualFixtureTool(
  name: string,
  input: Record<string, unknown>,
  toolInvocationId: string,
  state: { generatedChart: boolean; generatedGraph: boolean },
): Record<string, unknown> {
  if (name === "generate_chart") {
    state.generatedChart = true;
    return {
      ok: true,
      action: "generate_chart",
      assetId: VISUAL_FIXTURE.chartAssetId,
      assetKind: "chart",
      mimeType: "image/svg+xml",
      title: readString(input, "title") ?? "Eval flowchart",
      toolInvocationId,
      reusable: true,
    };
  }

  if (name === "generate_graph") {
    state.generatedGraph = true;
    return {
      ok: true,
      action: "generate_graph",
      assetId: VISUAL_FIXTURE.graphAssetId,
      assetKind: "graph",
      mimeType: "application/vnd.vegalite+json",
      title: readString(input, "title") ?? "Eval graph",
      toolInvocationId,
      reusable: true,
    };
  }

  if (name === "list_conversation_media_assets") {
    return {
      ok: true,
      action: "list_conversation_media_assets",
      conversationId: VISUAL_FIXTURE.conversationId,
      assets: [
        {
          assetId: VISUAL_FIXTURE.chartAssetId,
          assetKind: "chart",
          label: "Eval flowchart",
          fileName: "eval-flowchart.svg",
          mimeType: "image/svg+xml",
          source: "generated",
          retentionClass: "conversation",
          createdAt: VISUAL_FIXTURE.createdAt,
          conversationId: VISUAL_FIXTURE.conversationId,
          toolName: "generate_chart",
        },
        {
          assetId: VISUAL_FIXTURE.graphAssetId,
          assetKind: "graph",
          label: "Eval weekly pipeline",
          fileName: "eval-weekly-pipeline.json",
          mimeType: "application/vnd.vegalite+json",
          source: "generated",
          retentionClass: "conversation",
          createdAt: VISUAL_FIXTURE.createdAt,
          conversationId: VISUAL_FIXTURE.conversationId,
          toolName: "generate_graph",
        },
      ],
      summary: "Returned 2 reusable media assets for this conversation.",
    };
  }

  throw new Error(`Unsupported visual fixture tool: ${name}`);
}

function buildFixtureJobSnapshot(input: {
  jobId: string;
  toolName: string;
  status: "queued" | "running" | "succeeded";
  label: string;
  inputSnapshot?: Record<string, unknown>;
  progressPercent?: number | null;
  progressLabel?: string | null;
  resultPayload?: unknown;
  artifactRefs?: readonly Record<string, unknown>[];
}): Record<string, unknown> {
  const terminal = input.status === "succeeded";
  const startedAt = input.status === "queued" ? null : MEDIA_FIXTURE.startedAt;
  return {
    jobId: input.jobId,
    conversationId: input.toolName === "produce_blog_article"
      ? BLOG_FIXTURE.conversationId
      : MEDIA_FIXTURE.conversationId,
    userId: input.toolName === "produce_blog_article"
      ? BLOG_FIXTURE.userId
      : MEDIA_FIXTURE.userId,
    toolName: input.toolName,
    label: input.label,
    status: input.status,
    sequence: terminal ? 2 : 0,
    progressPercent: input.progressPercent ?? (terminal ? 100 : null),
    progressLabel: input.progressLabel ?? null,
    summary: terminal ? `${input.label} succeeded in fixture mode.` : `${input.label} is queued in fixture mode.`,
    createdAt: input.toolName === "produce_blog_article" ? BLOG_FIXTURE.startedAt : MEDIA_FIXTURE.startedAt,
    startedAt,
    completedAt: terminal
      ? (input.toolName === "produce_blog_article" ? BLOG_FIXTURE.completedAt : MEDIA_FIXTURE.completedAt)
      : null,
    updatedAt: terminal
      ? (input.toolName === "produce_blog_article" ? BLOG_FIXTURE.completedAt : MEDIA_FIXTURE.completedAt)
      : (input.toolName === "produce_blog_article" ? BLOG_FIXTURE.startedAt : MEDIA_FIXTURE.startedAt),
    origin: { fallback: "tool_invocation" },
    inputSnapshot: input.inputSnapshot ?? {},
    resultPayload: input.resultPayload,
    resultEnvelope: null,
    artifactRefs: input.artifactRefs ?? [],
    materializationRefs: [],
    ownership: {
      userId: input.toolName === "produce_blog_article" ? BLOG_FIXTURE.userId : MEDIA_FIXTURE.userId,
      visibility: "owner",
      initiatorType: "user",
    },
    failure: {
      failureClass: null,
      recoveryMode: null,
      nextRetryAt: null,
      lastCheckpointId: null,
      replayedFromJobId: null,
      supersededByJobId: null,
    },
  };
}

export function verifyToolWorkflowCoverageResult(
  scenario: ToolWorkflowCoverageScenario,
  runtimeResult: LiveEvalRuntimeResult,
): ToolWorkflowCoverageCheckpoint[] {
  const common = verifyCommonWorkflowCheckpoints(scenario, runtimeResult);
  const specific = scenario.id === "media-image-audio-video-fixture"
    ? verifyMediaWorkflow(runtimeResult)
    : scenario.id === "blog-production-image-handoff-fixture"
      ? verifyBlogWorkflow(runtimeResult)
      : scenario.id === "chart-graph-reusable-visuals-fixture"
        ? verifyVisualWorkflow(runtimeResult)
        : [{
            id: "known_workflow",
            passed: false,
            details: `No verifier is registered for ${scenario.id}.`,
          }];

  return [...common, ...specific];
}

function verifyCommonWorkflowCheckpoints(
  scenario: ToolWorkflowCoverageScenario,
  runtimeResult: LiveEvalRuntimeResult,
): ToolWorkflowCoverageCheckpoint[] {
  const calledToolNames = runtimeResult.toolCalls.map((call) => call.name);
  const unexpected = calledToolNames.filter((name) => !scenario.toolNames.includes(name));
  const missing = scenario.toolNames.filter((name) => !calledToolNames.includes(name));

  return [
    {
      id: "required_tools_called",
      passed: missing.length === 0,
      details: missing.length ? `Missing: ${missing.join(", ")}.` : `Observed: ${calledToolNames.join(", ")}.`,
    },
    {
      id: "no_unexpected_tools",
      passed: unexpected.length === 0,
      details: unexpected.length ? `Unexpected: ${unexpected.join(", ")}.` : "No unexpected tools.",
    },
    {
      id: "tool_results_succeeded",
      passed: runtimeResult.toolResults.length >= scenario.toolNames.length
        && runtimeResult.toolResults.every((result) => !result.isError),
      details: JSON.stringify(runtimeResult.toolResults.map((result) => ({
        name: result.name,
        isError: result.isError,
      }))),
    },
    {
      id: "assistant_acknowledged_workflow_eval",
      passed: runtimeResult.assistantText.includes(scenario.completionToken),
      details: runtimeResult.assistantText || "Assistant text was empty.",
    },
  ];
}

function verifyMediaWorkflow(runtimeResult: LiveEvalRuntimeResult): ToolWorkflowCoverageCheckpoint[] {
  const calls = runtimeResult.toolCalls;
  const listIndex = calls.findIndex((call) => call.name === "list_conversation_media_assets");
  const audioIndex = calls.findIndex((call) => call.name === "generate_audio");
  const composeIndex = calls.findIndex((call) => call.name === "compose_media");
  const statusJobIds = calls
    .filter((call) => call.name === "get_deferred_job_status")
    .map((call) => readString(call.args, "job_id"))
    .filter((value): value is string => Boolean(value));
  const composePlan = calls.find((call) => call.name === "compose_media")?.args.plan;
  const composePlanRecord = isRecord(composePlan) ? composePlan : {};
  const visualAssetIds = readClipAssetIds(composePlanRecord.visualClips);
  const audioAssetIds = readClipAssetIds(composePlanRecord.audioClips);
  const finalVideoObserved = runtimeResult.toolResults.some((result) => {
    const job = isRecord(result.result) && isRecord(result.result.job) ? result.result.job : null;
    const payload = job && isRecord(job.resultPayload) ? job.resultPayload : null;
    return result.name === "get_deferred_job_status"
      && job?.jobId === MEDIA_FIXTURE.composeJobId
      && job.status === "succeeded"
      && payload?.primaryAssetId === MEDIA_FIXTURE.videoAssetId;
  });

  return [
    {
      id: "asset_list_precedes_composition",
      passed: listIndex >= 0 && composeIndex >= 0 && listIndex < composeIndex,
      details: `list index ${listIndex}; compose index ${composeIndex}.`,
    },
    {
      id: "audio_generated_before_composition",
      passed: audioIndex >= 0 && composeIndex >= 0 && audioIndex < composeIndex,
      details: `audio index ${audioIndex}; compose index ${composeIndex}.`,
    },
    {
      id: "status_checked_for_audio_and_video_jobs",
      passed: statusJobIds.includes(MEDIA_FIXTURE.audioJobId) && statusJobIds.includes(MEDIA_FIXTURE.composeJobId),
      details: `Observed status job IDs: ${statusJobIds.join(", ") || "none"}.`,
    },
    {
      id: "compose_plan_uses_asset_ids_not_job_ids",
      passed: visualAssetIds.includes(MEDIA_FIXTURE.reusableImageAssetId)
        && audioAssetIds.includes(MEDIA_FIXTURE.audioAssetId)
        && !visualAssetIds.concat(audioAssetIds).some((assetId) => assetId.startsWith("job_")),
      details: JSON.stringify({ visualAssetIds, audioAssetIds }),
    },
    {
      id: "final_video_completion_observed",
      passed: finalVideoObserved,
      details: finalVideoObserved
        ? `Observed final video asset ${MEDIA_FIXTURE.videoAssetId}.`
        : "No succeeded compose_media status result exposed the final video asset.",
    },
  ];
}

function verifyBlogWorkflow(runtimeResult: LiveEvalRuntimeResult): ToolWorkflowCoverageCheckpoint[] {
  const calledToolIds = runtimeResult.toolCalls.map((call) => call.name);
  const statusJobIds = runtimeResult.toolCalls
    .filter((call) => call.name === "get_deferred_job_status")
    .map((call) => readString(call.args, "job_id"))
    .filter((value): value is string => Boolean(value));
  const publishPostIds = runtimeResult.toolCalls
    .filter((call) => call.name === "publish_content")
    .map((call) => readString(call.args, "post_id"))
    .filter((value): value is string => Boolean(value));
  const statusResult = runtimeResult.toolResults.find((result) => {
    const job = isRecord(result.result) && isRecord(result.result.job) ? result.result.job : null;
    return result.name === "get_deferred_job_status" && job?.jobId === BLOG_FIXTURE.produceJobId;
  });
  const job = isRecord(statusResult?.result) && isRecord(statusResult.result.job) ? statusResult.result.job : null;
  const resultPayload = job && isRecord(job.resultPayload) ? job.resultPayload : null;

  return [
    {
      id: "production_job_requested_once",
      passed: calledToolIds.filter((toolId) => toolId === "produce_blog_article").length === 1,
      details: JSON.stringify(calledToolIds),
    },
    {
      id: "production_status_checked",
      passed: statusJobIds.includes(BLOG_FIXTURE.produceJobId),
      details: `Observed status job IDs: ${statusJobIds.join(", ") || "none"}.`,
    },
    {
      id: "generated_image_preserved_in_job_result",
      passed: resultPayload?.imageAssetId === BLOG_FIXTURE.imageAssetId,
      details: JSON.stringify(resultPayload ?? null),
    },
    {
      id: "publish_uses_completed_post_id",
      passed: publishPostIds.includes(BLOG_FIXTURE.postId),
      details: `Observed publish post IDs: ${publishPostIds.join(", ") || "none"}.`,
    },
  ];
}

function verifyVisualWorkflow(runtimeResult: LiveEvalRuntimeResult): ToolWorkflowCoverageCheckpoint[] {
  const calledToolIds = runtimeResult.toolCalls.map((call) => call.name);
  const listResult = runtimeResult.toolResults.find((result) => result.name === "list_conversation_media_assets");
  const assets = isRecord(listResult?.result) && Array.isArray(listResult.result.assets)
    ? listResult.result.assets
    : [];
  const assetIds = assets
    .map((asset) => isRecord(asset) ? readString(asset, "assetId") : null)
    .filter((value): value is string => Boolean(value));

  return [
    {
      id: "chart_and_graph_generated",
      passed: calledToolIds.includes("generate_chart") && calledToolIds.includes("generate_graph"),
      details: JSON.stringify(calledToolIds),
    },
    {
      id: "reusable_visual_assets_listed",
      passed: assetIds.includes(VISUAL_FIXTURE.chartAssetId) && assetIds.includes(VISUAL_FIXTURE.graphAssetId),
      details: `Listed asset IDs: ${assetIds.join(", ") || "none"}.`,
    },
  ];
}

function readClipAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((clip) => isRecord(clip) ? readString(clip, "assetId") : null)
    .filter((assetId): assetId is string => Boolean(assetId));
}

function readString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
