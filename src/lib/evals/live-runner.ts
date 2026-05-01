import type Anthropic from "@anthropic-ai/sdk";

import { BlogPostDataMapper } from "@/adapters/BlogPostDataMapper";
import { JobQueueDataMapper } from "@/adapters/JobQueueDataMapper";
import type { ConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { isDealCustomerVisibleStatus } from "@/core/entities/deal-record";
import { isTrainingPathCustomerVisibleStatus } from "@/core/entities/training-path-record";
import { executePublishContent } from "@/core/use-cases/tools/admin-content.tool";
import { createSystemPromptBuilder } from "@/lib/chat/policy";
import type { PromptRuntimeResult } from "@/lib/chat/prompt-runtime";
import { buildCanonicalJobSnapshot, getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import { compactProvenance } from "@/lib/prompts/prompt-provenance-store";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";
import type { EvalObservation, EvalRunConfig, EvalScenario, EvalTargetEnvironment } from "./domain";
import { resolveEvalRuntimeConfig } from "./config";
import { getEvalScenarioById } from "./scenarios";
import { inflateDeterministicSeedPack, type DeterministicEvalToolFixture, type InflatedDeterministicEvalSeedPack } from "./seeding";
import { resolveLiveEvalScenarioFixture } from "./live-scenarios";
import { createEvalWorkspace, type EvalWorkspace } from "./workspace";
import { executeLiveEvalRuntime, type LiveEvalRuntimeRequest, type LiveEvalRuntimeResult } from "./live-runtime";
import type { EvalCheckpointResult } from "./runner";
import {
  evaluateRuntimeSelfKnowledgeAnswer,
  type RuntimeSelfKnowledgeInspectionPayload,
} from "./runtime-integrity-checks";

export interface LiveEvalExecution {
  scenario: EvalScenario;
  run: EvalRunConfig;
  observations: EvalObservation[];
  checkpointResults: EvalCheckpointResult[];
  stopReason: string | null;
  finalState: {
    lane: string | null;
    recommendation: string | null;
    toolCalls: string[];
    promptProvenance: ReturnType<typeof compactProvenance> | null;
  };
}

function createCheckpointResult(
  scenario: EvalScenario,
  checkpointId: string,
  passed: boolean,
  details: string | null,
): EvalCheckpointResult {
  const checkpoint = scenario.expectedCheckpoints.find((candidate) => candidate.id === checkpointId);

  if (!checkpoint) {
    throw new Error(`Unknown checkpoint ${checkpointId} for scenario ${scenario.id}`);
  }

  return {
    id: checkpoint.id,
    label: checkpoint.label,
    required: checkpoint.required,
    passed,
    details,
  };
}

function pushMessageObservation(
  observations: EvalObservation[],
  at: string,
  role: string,
  content: string,
): void {
  observations.push({
    kind: "message",
    at,
    data: {
      role,
      content,
    },
  });
}

function pushCheckpointObservations(observations: EvalObservation[], run: EvalRunConfig, checkpointResults: EvalCheckpointResult[]): void {
  for (const checkpoint of checkpointResults) {
    observations.push({
      kind: "checkpoint",
      at: run.startedAt,
      data: {
        checkpointId: checkpoint.id,
        passed: checkpoint.passed,
        details: checkpoint.details,
      },
    });
  }
}

function pushConversationEventObservations(
  observations: EvalObservation[],
  events: Array<{ type: string; metadata: Record<string, unknown>; createdAt: string }>,
): void {
  for (const event of events) {
    observations.push({
      kind: "state_transition",
      at: event.createdAt,
      data: {
        transition: event.type,
        ...event.metadata,
      },
    });
  }
}

function buildPromptTimestamp(index: number): string {
  return new Date(Date.parse("2026-03-20T19:00:00.000Z") + index * 60_000).toISOString();
}

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function matchesToolFixtureArgs(args: Record<string, unknown>, fixture: DeterministicEvalToolFixture): boolean {
  return Object.entries(fixture.args).every(([key, value]) => args[key] === value);
}

interface LiveBlogScenarioState {
  draftPostId: string;
  draftSlug: string;
  draftTitle: string;
  produceJobId: string;
  produceJobStatus: "running" | "succeeded";
}

const LIVE_BLOG_SCENARIOS = new Set([
  "live-blog-job-status-and-publish-handoff",
  "live-blog-job-reuse-instead-of-rerun",
  "live-blog-completion-recovery",
]);

async function seedLiveBlogScenarioState(options: {
  scenarioId: string;
  workspace: EvalWorkspace;
  conversationId: string;
  userId: string;
}): Promise<LiveBlogScenarioState | null> {
  if (!LIVE_BLOG_SCENARIOS.has(options.scenarioId)) {
    return null;
  }

  const blogRepo = new BlogPostDataMapper(options.workspace.db);
  const jobRepo = new JobQueueDataMapper(options.workspace.db);
  const isRunningScenario = options.scenarioId === "live-blog-job-reuse-instead-of-rerun";
  const slug = options.scenarioId === "live-blog-completion-recovery"
    ? "blog-recovery-playbook"
    : "blog-operator-playbook";
  const title = options.scenarioId === "live-blog-completion-recovery"
    ? "Blog Recovery Playbook"
    : "Blog Operator Playbook";
  const draftPost = await blogRepo.create({
    slug,
    title,
    description: "Live eval draft used for deferred blog job continuity.",
    content: `# ${title}\n\nDeferred blog workflow output.`,
    createdByUserId: options.userId,
  });
  const produceJob = await jobRepo.createJob({
    conversationId: options.conversationId,
    userId: options.userId,
    toolName: "produce_blog_article",
    dedupeKey: `produce:${slug}`,
    requestPayload: {
      brief: `Create ${title}.`,
    },
  });

  if (isRunningScenario) {
    await jobRepo.updateJobStatus(produceJob.id, {
      status: "running",
      startedAt: "2026-03-20T19:11:10.000Z",
      progressPercent: 34,
      progressLabel: "Reviewing article",
      claimedBy: "eval_live_worker",
      leaseExpiresAt: "2026-03-20T19:16:10.000Z",
    });
    await jobRepo.appendEvent({
      jobId: produceJob.id,
      conversationId: options.conversationId,
      eventType: "progress",
      payload: {
        progressPercent: 34,
        progressLabel: "Reviewing article",
      },
    });
  } else {
    await jobRepo.updateJobStatus(produceJob.id, {
      status: "succeeded",
      startedAt: "2026-03-20T19:01:10.000Z",
      completedAt: "2026-03-20T19:03:00.000Z",
      resultPayload: {
        id: draftPost.id,
        slug: draftPost.slug,
        title: draftPost.title,
        status: "draft",
        imageAssetId: "asset_live_blog_1",
        stages: [
          "compose_blog_article",
          "qa_blog_article",
          "resolve_blog_article_qa",
          "generate_blog_image_prompt",
          "generate_blog_image",
          "draft_content",
        ],
        summary: `Produced draft "${draftPost.title}" at /journal/${draftPost.slug} with hero asset asset_live_blog_1.`,
      },
    });
    await jobRepo.appendEvent({
      jobId: produceJob.id,
      conversationId: options.conversationId,
      eventType: "result",
      payload: {
        result: {
          id: draftPost.id,
          slug: draftPost.slug,
          title: draftPost.title,
          status: "draft",
          imageAssetId: "asset_live_blog_1",
          stages: [
            "compose_blog_article",
            "qa_blog_article",
            "resolve_blog_article_qa",
            "generate_blog_image_prompt",
            "generate_blog_image",
            "draft_content",
          ],
          summary: `Produced draft "${draftPost.title}" at /journal/${draftPost.slug} with hero asset asset_live_blog_1.`,
        },
      },
    });
  }

  return {
    draftPostId: draftPost.id,
    draftSlug: draftPost.slug,
    draftTitle: draftPost.title,
    produceJobId: produceJob.id,
    produceJobStatus: isRunningScenario ? "running" : "succeeded",
  };
}

function createLiveEvalToolExecutor(options: {
  scenarioId: string;
  role: LiveEvalRuntimeRequest["role"];
  userId: string;
  inflated: InflatedDeterministicEvalSeedPack;
  workspace: EvalWorkspace;
  conversationId: string;
  currentPageSnapshot?: LiveEvalRuntimeRequest["currentPageSnapshot"];
  promptRuntime?: PromptRuntimeResult | null;
}): LiveEvalRuntimeRequest["toolExecutor"] | undefined {
  const execContext: ToolExecutionContext = {
    role: options.role,
    userId: options.userId,
    conversationId: options.conversationId,
    currentPathname: options.currentPageSnapshot?.pathname,
    currentPageSnapshot: options.currentPageSnapshot,
    ...(options.promptRuntime ? { promptRuntime: options.promptRuntime } : {}),
  };
  const baseExecutor = getAgentPlatformFacade().getExecutionSurface().executor;

  if (LIVE_BLOG_SCENARIOS.has(options.scenarioId)) {
    const jobRepo = new JobQueueDataMapper(options.workspace.db);
    const blogRepo = new BlogPostDataMapper(options.workspace.db);

    return async (name, input) => {
      if (name === "list_deferred_jobs") {
        const activeOnly = typeof input.active_only === "boolean" ? input.active_only : true;
        const limit = typeof input.limit === "number" ? Math.min(Math.max(input.limit, 1), 25) : 10;
        const jobs = await jobRepo.listJobsByConversation(options.conversationId, {
          statuses: activeOnly ? getActiveJobStatuses() : undefined,
          limit,
        });
        const snapshots = await Promise.all(jobs.map(async (job) => {
          const event = await jobRepo.findLatestEventForJob(job.id);
          return buildCanonicalJobSnapshot(job, event);
        }));
        return { ok: true, jobs: snapshots };
      }

      if (name === "get_deferred_job_status") {
        const jobId = typeof input.job_id === "string" ? input.job_id : "";
        const job = await jobRepo.findJobById(jobId);
        if (!job) {
          throw new Error(`Deferred job not found: ${jobId}`);
        }
        const event = await jobRepo.findLatestEventForJob(job.id);
        return { ok: true, job: buildCanonicalJobSnapshot(job, event) };
      }

      if (name === "publish_content") {
        const postId = typeof input.post_id === "string" ? input.post_id : "";
        return executePublishContent(blogRepo, { post_id: postId }, { userId: options.userId, role: options.role });
      }

      return baseExecutor(name, input, execContext);
    };
  }

  if (options.scenarioId !== "mcp-tool-choice-and-recovery") {
    return (name, input) => baseExecutor(name, input, execContext);
  }

  const recoveryFixture = options.inflated.pack.toolFixtures[0];

  if (!recoveryFixture) {
    return (name, input) => baseExecutor(name, input, execContext);
  }

  let remainingInjectedFailures = 1;

  return async (name, input) => {
    if (
      name === recoveryFixture.toolId
      && remainingInjectedFailures > 0
      && matchesToolFixtureArgs(input, recoveryFixture)
    ) {
      remainingInjectedFailures -= 1;
      throw new Error("Calculator temporarily unavailable. Retry once with the same arguments.");
    }

    return baseExecutor(name, input, execContext);
  };
}

const FUNNEL_FOCUSED_LIVE_SCENARIOS = new Set([
  "organization-buyer-funnel",
  "individual-learner-funnel",
  "development-prospect-funnel",
]);

function isFunnelFocusedLiveScenario(scenarioId: string): boolean {
  return FUNNEL_FOCUSED_LIVE_SCENARIOS.has(scenarioId);
}

async function buildLiveEvalSystemPrompt(
  scenarioId: string,
  role: LiveEvalRuntimeRequest["role"],
  routingSnapshot: ConversationRoutingSnapshot,
  currentPageSnapshot?: LiveEvalRuntimeRequest["currentPageSnapshot"],
): Promise<{
  systemPrompt: string;
  promptRuntime: PromptRuntimeResult;
  promptProvenance: ReturnType<typeof compactProvenance>;
}> {
  const builder = await createSystemPromptBuilder(role, {
    surface: "live_eval",
    ...(currentPageSnapshot ? { currentPageSnapshot } : {}),
  });

  if (isFunnelFocusedLiveScenario(scenarioId)) {
    builder.withSection({
      key: "live_eval_funnel_directive",
      content: [
      "",
      "[Live eval funnel directive]",
      "Treat the current conversation and seeded workflow state as the only relevant context for this response.",
      "The user is asking for the concrete next commercial step in this exact conversation, not for general library research.",
      "Do not use corpus-content tools unless the user explicitly asks for library or reference material.",
      "Prefer a direct answer that advances this conversation toward a founder-approved estimate, training recommendation, or scoping step.",
      "Keep the answer short and decisive.",
      ].join("\n"),
      priority: 41,
    });
  }

  builder.withRoutingContext(routingSnapshot);
  const promptRuntime = await builder.buildResult();

  return {
    systemPrompt: promptRuntime.text,
    promptRuntime,
    promptProvenance: compactProvenance(promptRuntime),
  };
}

function getLiveEvalToolsForScenario(
  scenarioId: string,
  _role: LiveEvalRuntimeRequest["role"],
): Anthropic.Tool[] | undefined {
  if (!isFunnelFocusedLiveScenario(scenarioId)) {
    return undefined;
  }

  return [];
}

function createLiveRunConfig(
  scenario: EvalScenario,
  seedSetId: string,
  now: Date,
  apiKey: string,
  env?: Record<string, string | undefined>,
  targetEnvironmentOverride?: EvalTargetEnvironment,
): EvalRunConfig {
  const targetEnvironment = targetEnvironmentOverride ?? scenario.targetEnvironment;
  const runtime = resolveEvalRuntimeConfig({
    env: {
      ...env,
      EVAL_LIVE_ENABLED: "true",
      EVAL_TARGET_ENV: targetEnvironment,
      EVAL_SEED_SET_ID: seedSetId,
      ANTHROPIC_API_KEY: apiKey,
    },
    now,
  });

  return {
    scenarioId: scenario.id,
    layer: scenario.layer,
    targetEnvironment: scenario.targetEnvironment,
    mode: runtime.mode,
    modelProvider: runtime.modelProvider,
    modelName: runtime.modelName,
    seedSetId: runtime.seedSetId,
    startedAt: runtime.startedAt,
  };
}

function buildToolObservations(
  observations: EvalObservation[],
  run: EvalRunConfig,
  runtimeResult: LiveEvalRuntimeResult,
): string[] {
  const toolCalls = runtimeResult.toolCalls.map((call) => call.name);

  runtimeResult.toolCalls.forEach((call, index) => {
    const toolResult = runtimeResult.toolResults[index];
    observations.push({
      kind: "tool_call",
      at: run.startedAt,
      data: {
        toolId: call.name,
        args: call.args,
        result: toolResult?.result ?? null,
        matchedExpected: toolResult ? !toolResult.isError : false,
        error: toolResult?.isError ? toolResult.result : undefined,
      },
    });
  });

  return toolCalls;
}

export async function runLiveEvalScenario(
  scenarioId: string,
  options: {
    now?: Date;
    env?: Record<string, string | undefined>;
    apiKey?: string;
    targetEnvironmentOverride?: EvalTargetEnvironment;
    runtimeRequestOverrides?: Partial<Omit<LiveEvalRuntimeRequest, "apiKey" | "role" | "userId" | "messages">>;
    executeRuntime?: (request: LiveEvalRuntimeRequest) => Promise<LiveEvalRuntimeResult>;
  } = {},
): Promise<LiveEvalExecution> {
  const scenario = getEvalScenarioById(scenarioId);

  if (scenario.layer !== "live_model") {
    throw new Error(`Scenario ${scenarioId} is not live_model.`);
  }

  const fixture = resolveLiveEvalScenarioFixture(scenarioId);
  const workspace = createEvalWorkspace();
  const now = options.now ?? new Date("2026-03-20T20:00:00.000Z");
  const apiKey = options.apiKey ?? options.env?.ANTHROPIC_API_KEY ?? "test-live-key";
  const run = createLiveRunConfig(
    scenario,
    fixture.seedPack.seedSetId,
    now,
    apiKey,
    options.env,
    options.targetEnvironmentOverride,
  );
  const observations: EvalObservation[] = [];
  const checkpointResults: EvalCheckpointResult[] = [];
  let stopReason: string | null = null;
  let finalLane: string | null = null;
  let finalRecommendation: string | null = null;
  let toolCalls: string[] = [];
  let liveBlogState: LiveBlogScenarioState | null = null;

  try {
    const inflated = await inflateDeterministicSeedPack(workspace, fixture.seedPack);
    const primaryConversationId = inflated.refs.primaryConversationId;

    if (!primaryConversationId) {
      throw new Error(`Live eval fixture ${scenarioId} is missing primaryConversationId.`);
    }

    const seededConversation = await workspace.conversationRepo.findById(primaryConversationId);

    if (!seededConversation) {
      throw new Error(`Primary conversation ${primaryConversationId} was not seeded.`);
    }

    const seededMessages = await workspace.listMessages(primaryConversationId);
    for (const message of seededMessages) {
      pushMessageObservation(observations, message.createdAt, message.role, message.content);
    }

    finalLane = seededConversation.routingSnapshot.lane;
    finalRecommendation = seededConversation.routingSnapshot.recommendedNextStep;
    liveBlogState = await seedLiveBlogScenarioState({
      scenarioId,
      workspace,
      conversationId: primaryConversationId,
      userId: fixture.userId,
    });

    if (scenarioId === "live-anonymous-signup-continuity") {
      const anonymousUserId = inflated.refs.anonymousUserId;
      const authenticatedUserId = inflated.refs.authenticatedUserId;

      if (!anonymousUserId || !authenticatedUserId) {
        throw new Error("Live anonymous signup continuity requires both anonymous and authenticated user refs.");
      }

      await workspace.conversationRepo.transferOwnership(anonymousUserId, authenticatedUserId);
      observations.push({
        kind: "state_transition",
        at: run.startedAt,
        data: {
          transition: "conversation_migrated",
          fromUserId: anonymousUserId,
          toUserId: authenticatedUserId,
          conversationId: primaryConversationId,
        },
      });
    }

    const promptMessages = fixture.promptMessages;
    const { systemPrompt, promptRuntime, promptProvenance } = await buildLiveEvalSystemPrompt(
      scenarioId,
      fixture.role,
      seededConversation.routingSnapshot,
      fixture.currentPageSnapshot,
    );
    const tools = getLiveEvalToolsForScenario(scenarioId, fixture.role);
    const toolExecutor = options.runtimeRequestOverrides?.toolExecutor
      ?? createLiveEvalToolExecutor({
        scenarioId,
        role: fixture.role,
        userId: fixture.userId,
        inflated,
        workspace,
        conversationId: primaryConversationId,
        currentPageSnapshot: fixture.currentPageSnapshot,
        promptRuntime,
      });
    const anthropicMessages: Anthropic.MessageParam[] = seededMessages.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));

    for (const [index, promptMessage] of promptMessages.entries()) {
      if (typeof promptMessage.content === "string") {
        const createdAt = buildPromptTimestamp(index);
        await workspace.appendMessage({
          conversationId: primaryConversationId,
          role: promptMessage.role as "user" | "assistant",
          content: promptMessage.content,
          createdAt,
        });
        pushMessageObservation(observations, createdAt, promptMessage.role, promptMessage.content);
      }
      anthropicMessages.push(promptMessage);
    }

    const executeRuntime = options.executeRuntime ?? executeLiveEvalRuntime;
    const runtimeResult = await executeRuntime({
      apiKey,
      role: fixture.role,
      userId: fixture.userId,
      messages: anthropicMessages,
      currentPathname: fixture.currentPageSnapshot?.pathname,
      currentPageSnapshot: fixture.currentPageSnapshot,
      systemPrompt,
      promptRuntime,
      tools,
      toolExecutor,
      ...options.runtimeRequestOverrides,
    });

    run.modelName = runtimeResult.model;
    stopReason = runtimeResult.stopReason;
    toolCalls = buildToolObservations(observations, run, runtimeResult);

    if (runtimeResult.assistantText.trim().length > 0) {
      await workspace.appendMessage({
        conversationId: primaryConversationId,
        role: "assistant",
        content: runtimeResult.assistantText,
      });
      pushMessageObservation(observations, run.startedAt, "assistant", runtimeResult.assistantText);
    }

    switch (scenarioId) {
      case "live-anonymous-high-intent-loss": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);
        const consultationRequest = await workspace.consultationRequestRepo.findByConversationId(primaryConversationId);
        const frictionReason = runtimeResult.assistantText.trim().length > 0
          ? runtimeResult.assistantText
          : "Anonymous high-intent conversation ended before signup.";

        checkpointResults.push(
          createCheckpointResult(scenario, "anonymous-discovery", seededMessages.length > 0, null),
          createCheckpointResult(
            scenario,
            "dropout-detected",
            lead === null && consultationRequest === null,
            lead || consultationRequest ? "A downstream record exists, so this is not a dropout." : null,
          ),
          createCheckpointResult(scenario, "friction-summary", frictionReason.length > 0, frictionReason),
        );

        stopReason = stopReason ?? "journey_stopped_before_signup";
        finalRecommendation = frictionReason;
        break;
      }
      case "live-anonymous-signup-continuity": {
        const authenticatedUserId = inflated.refs.authenticatedUserId;
        const migratedConversation = await workspace.conversationRepo.findById(primaryConversationId);
        const activeConversation = authenticatedUserId
          ? await workspace.conversationRepo.findActiveByUser(authenticatedUserId)
          : null;
        const updatedMessages = await workspace.listMessages(primaryConversationId);
        const postSignupExchange = updatedMessages.length >= seededMessages.length + 2;

        checkpointResults.push(
          createCheckpointResult(scenario, "anonymous-discovery", seededMessages.length > 0, null),
          createCheckpointResult(scenario, "signup", migratedConversation?.userId === authenticatedUserId, null),
          createCheckpointResult(
            scenario,
            "continuity",
            migratedConversation?.convertedFrom === inflated.refs.anonymousUserId
              && activeConversation?.id === primaryConversationId
              && postSignupExchange
              && runtimeResult.assistantText.trim().length > 0,
            postSignupExchange ? null : "Post-signup continued exchange was not preserved.",
          ),
        );

        finalLane = migratedConversation?.routingSnapshot.lane ?? finalLane;
        finalRecommendation =
          runtimeResult.assistantText
          || migratedConversation?.routingSnapshot.recommendedNextStep
          || finalRecommendation;
        stopReason = stopReason ?? null;
        break;
      }
      case "organization-buyer-funnel": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);
        const consultationRequest = await workspace.consultationRequestRepo.findByConversationId(primaryConversationId);
        let visibleDeal = null;

        if (consultationRequest && containsAny(runtimeResult.assistantText, [/estimate/i, /proposal/i, /founder-approved/i, /next step/i])) {
          const createdDeal = await workspace.dealWorkflow.createFromConsultationRequest("admin_eval_live", consultationRequest.id);
          visibleDeal = await workspace.dealRepo.updateStatus(createdDeal.id, "estimate_ready", {
            founderNote: "Founder approved the next-step recommendation.",
          });
        }

        pushConversationEventObservations(observations, await workspace.listConversationEvents(primaryConversationId));

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "qualification",
            lead?.triageState === "qualified" && consultationRequest?.status === "reviewed",
            consultationRequest?.status ?? "Missing reviewed consultation request.",
          ),
          createCheckpointResult(
            scenario,
            "consultation-or-deal",
            visibleDeal !== null,
            visibleDeal?.id ?? "Live response did not produce a scoped deal.",
          ),
          createCheckpointResult(
            scenario,
            "approved-next-step",
            visibleDeal !== null && isDealCustomerVisibleStatus(visibleDeal.status),
            visibleDeal?.status ?? "Missing customer-visible deal status.",
          ),
        );

        finalLane = visibleDeal?.lane ?? finalLane;
        finalRecommendation = visibleDeal?.nextAction ?? runtimeResult.assistantText;
        break;
      }
      case "individual-learner-funnel": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);
        let visibleTrainingPath = null;

        if (lead && containsAny(runtimeResult.assistantText, [/training/i, /operator/i, /apprenticeship/i, /mentorship/i, /recommend/i])) {
          const createdTrainingPath = await workspace.trainingWorkflow.createFromQualifiedLead("admin_eval_live", lead.id);
          visibleTrainingPath = await workspace.trainingPathRepo.updateStatus(createdTrainingPath.id, "recommended", {
            founderNote: "Founder approved the training recommendation.",
          });
        }

        pushConversationEventObservations(observations, await workspace.listConversationEvents(primaryConversationId));

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "training-fit",
            lead?.triageState === "qualified" && lead.trainingFit === "career_transition",
            lead?.trainingFit ?? "Missing training fit.",
          ),
          createCheckpointResult(
            scenario,
            "training-path-created",
            visibleTrainingPath !== null,
            visibleTrainingPath?.id ?? "Live response did not produce a training path.",
          ),
          createCheckpointResult(
            scenario,
            "approved-recommendation",
            visibleTrainingPath !== null && isTrainingPathCustomerVisibleStatus(visibleTrainingPath.status),
            visibleTrainingPath?.status ?? "Missing customer-visible training-path status.",
          ),
        );

        finalLane = visibleTrainingPath?.lane ?? finalLane;
        finalRecommendation = visibleTrainingPath?.customerSummary ?? runtimeResult.assistantText;
        break;
      }
      case "live-runtime-self-knowledge-honesty": {
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const assistantText = runtimeResult.assistantText;
        const inspectedRuntime = runtimeResult.toolResults.find(
          (toolResult) => toolResult.name === "inspect_runtime_context" && !toolResult.isError,
        )?.result as RuntimeSelfKnowledgeInspectionPayload | undefined;
        const evaluation = evaluateRuntimeSelfKnowledgeAnswer(assistantText, inspectedRuntime);

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "runtime-inspection-used",
            calledToolIds.has("inspect_runtime_context"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "verified-tools-reported",
            evaluation.verifiedToolsReported,
            JSON.stringify({
              toolCount: inspectedRuntime?.toolCount ?? null,
              assistantText,
            }),
          ),
          createCheckpointResult(
            scenario,
            "page-context-reported",
            evaluation.pageContextReported,
            JSON.stringify({
              currentPathname: inspectedRuntime?.currentPathname ?? null,
              expectedPageTokens: evaluation.expectedPageTokens,
              assistantText,
            }),
          ),
        );

        finalRecommendation = assistantText;
        break;
      }
      case "live-current-page-truthfulness": {
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const assistantText = runtimeResult.assistantText;

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "authoritative-page-read",
            calledToolIds.has("get_current_page") || calledToolIds.has("inspect_runtime_context"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "stale-memory-overridden",
            !/you are on the blog page/i.test(assistantText) && (assistantText.includes("The Sage") || assistantText.includes("/library/archetype-atlas/ch04-the-sage")),
            assistantText,
          ),
          createCheckpointResult(
            scenario,
            "page-truthful-answer",
            assistantText.includes("/library/archetype-atlas/ch04-the-sage") || assistantText.includes("The Sage"),
            assistantText,
          ),
        );

        finalRecommendation = assistantText;
        break;
      }
      case "live-duplicate-navigation-avoidance": {
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const navigateResult = runtimeResult.toolResults.find((toolResult) => toolResult.name === "navigate_to_page")?.result as {
          path?: string;
        } | undefined;

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "canonical-navigation-tool-used",
            calledToolIds.has("navigate_to_page"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "legacy-navigation-tool-avoided",
            !calledToolIds.has("navigate"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "validated-route-returned",
            navigateResult?.path === "/profile",
            JSON.stringify(navigateResult ?? null),
          ),
        );

        finalRecommendation = runtimeResult.assistantText;
        break;
      }
      case "live-blog-job-status-and-publish-handoff": {
        const blogRepo = new BlogPostDataMapper(workspace.db);
        const publishedDraft = liveBlogState ? await blogRepo.findById(liveBlogState.draftPostId) : null;
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const publishedClearly = containsAny(runtimeResult.assistantText, [/published/i, /ready/i, /live/i, /journal/i]);

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "job-inspected",
            calledToolIds.has("list_deferred_jobs") && calledToolIds.has("get_deferred_job_status"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "publish-triggered",
            calledToolIds.has("publish_content"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "publish-complete",
            publishedDraft?.status === "published" && publishedClearly,
            publishedDraft?.status ?? runtimeResult.assistantText,
          ),
        );

        finalRecommendation = runtimeResult.assistantText;
        break;
      }
      case "live-blog-job-reuse-instead-of-rerun": {
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const activeStatusExplained = containsAny(runtimeResult.assistantText, [/running/i, /in progress/i, /queued/i, /existing job/i]);
        const rerunAvoided = !calledToolIds.has("produce_blog_article");

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "existing-job-found",
            calledToolIds.has("list_deferred_jobs") && calledToolIds.has("get_deferred_job_status"),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "rerun-avoided",
            rerunAvoided,
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "active-status-explained",
            activeStatusExplained,
            runtimeResult.assistantText,
          ),
        );

        finalRecommendation = runtimeResult.assistantText;
        break;
      }
      case "live-blog-completion-recovery": {
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const explainedPublishReadiness = containsAny(runtimeResult.assistantText, [/ready to publish/i, /publish-ready/i, /draft is ready/i, /ready for publish/i]);
        const rerunAvoided = !calledToolIds.has("produce_blog_article");

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "terminal-job-recovered",
            explainedPublishReadiness && rerunAvoided,
            runtimeResult.assistantText || JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "publish-readiness-explained",
            explainedPublishReadiness,
            runtimeResult.assistantText,
          ),
          createCheckpointResult(
            scenario,
            "completion-visible-without-rerun",
            rerunAvoided,
            JSON.stringify(Array.from(calledToolIds)),
          ),
        );

        finalRecommendation = runtimeResult.assistantText;
        break;
      }
      case "development-prospect-funnel": {
        const lead = await workspace.leadRepo.findByConversationId(primaryConversationId);
        let visibleDeal = null;

        if (lead && containsAny(runtimeResult.assistantText, [/scope/i, /scoping/i, /estimate/i, /implementation/i, /delivery/i])) {
          const createdDeal = await workspace.dealWorkflow.createFromQualifiedLead("admin_eval_live", lead.id);
          visibleDeal = await workspace.dealRepo.updateStatus(createdDeal.id, "estimate_ready", {
            founderNote: "Founder approved the scoped development next step.",
          });
        }

        pushConversationEventObservations(observations, await workspace.listConversationEvents(primaryConversationId));

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "technical-qualification",
            Boolean(lead?.technicalEnvironment),
            lead?.technicalEnvironment ?? "Missing technical environment.",
          ),
          createCheckpointResult(
            scenario,
            "deal-created",
            visibleDeal !== null,
            visibleDeal?.id ?? "Live response did not produce a development deal.",
          ),
          createCheckpointResult(
            scenario,
            "approved-next-step",
            visibleDeal !== null && isDealCustomerVisibleStatus(visibleDeal.status),
            visibleDeal?.status ?? "Missing customer-visible deal status.",
          ),
        );

        finalLane = visibleDeal?.lane ?? finalLane;
        finalRecommendation = visibleDeal?.nextAction ?? runtimeResult.assistantText;
        break;
      }
      case "mcp-tool-choice-and-recovery": {
        const expectedToolIds = scenario.expectedToolBehaviors.flatMap((behavior) => behavior.toolIds);
        const matchingToolCall = runtimeResult.toolCalls.find((toolCall) => expectedToolIds.includes(toolCall.name));
        const hadToolError = runtimeResult.toolResults.some((toolResult) => toolResult.isError);
        const recoveredClearly = hadToolError
          ? containsAny(runtimeResult.assistantText, [/recover/i, /fallback/i, /manually/i, /could not/i, /alternative/i, /retry/i, /retried/i, /succeeded/i, /confirmed/i])
          : true;

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "tool-selection",
            Boolean(matchingToolCall),
            matchingToolCall?.name ?? "No expected tool was called.",
          ),
          createCheckpointResult(
            scenario,
            "tool-arguments",
            Boolean(matchingToolCall) && Object.keys(matchingToolCall?.args ?? {}).length > 0,
            matchingToolCall ? JSON.stringify(matchingToolCall.args) : "No tool arguments were captured.",
          ),
          createCheckpointResult(
            scenario,
            "tool-recovery",
            recoveredClearly,
            hadToolError ? runtimeResult.assistantText || "Tool failed without a clear recovery." : "No tool failure occurred.",
          ),
        );

        finalRecommendation = runtimeResult.assistantText;
        break;
      }
      case "mcp-multi-tool-synthesis": {
        const calledToolIds = new Set(runtimeResult.toolCalls.map((toolCall) => toolCall.name));
        const requiredToolIds = ["web_search", "calculator"];

        checkpointResults.push(
          createCheckpointResult(
            scenario,
            "multi-tool-selection",
            requiredToolIds.every((toolId) => calledToolIds.has(toolId)),
            JSON.stringify(Array.from(calledToolIds)),
          ),
          createCheckpointResult(
            scenario,
            "result-combination",
            runtimeResult.toolResults.length >= 2,
            `Observed ${runtimeResult.toolResults.length} tool results.`,
          ),
          createCheckpointResult(
            scenario,
            "final-answer-accuracy",
            runtimeResult.assistantText.trim().length > 0,
            runtimeResult.assistantText || "Final synthesized answer was empty.",
          ),
        );

        finalRecommendation = runtimeResult.assistantText;
        break;
      }
      default:
        throw new Error(`No live eval runner is implemented for scenario ${scenarioId}.`);
    }

    observations.push({
      kind: "summary",
      at: run.startedAt,
      data: {
        stopReason,
        finalLane,
        finalRecommendation,
        model: runtimeResult.model,
        assistantText: runtimeResult.assistantText,
        toolRoundCount: runtimeResult.toolRoundCount,
        promptProvenance,
      },
    });

    pushCheckpointObservations(observations, run, checkpointResults);

    return {
      scenario,
      run,
      observations,
      checkpointResults,
      stopReason,
      finalState: {
        lane: finalLane,
        recommendation: finalRecommendation,
        toolCalls,
        promptProvenance,
      },
    };
  } finally {
    workspace.destroy();
  }
}
