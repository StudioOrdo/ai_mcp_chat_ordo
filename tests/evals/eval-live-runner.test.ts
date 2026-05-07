import { afterEach, describe, expect, it, vi } from "vitest";

import { executeLiveEvalRuntime } from "@/lib/evals/live-runtime";
import { runLiveEvalScenario } from "@/lib/evals/live-runner";
import * as agentPlatformFacadeRoot from "@/lib/platform/agent-platform-facade-root";

import { createProviderBoundaryHarness } from "../helpers/provider-boundary-harness";

describe("eval live runtime and runner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes the injected live runtime adapter with the real stream boundary shape", async () => {
    const invokeStream = vi.fn().mockResolvedValue({
      model: "claude-haiku-4-5",
      assistantText: "ok",
      stopReason: "end_turn",
      toolRoundCount: 1,
      toolCalls: [],
      toolResults: [],
    });

    const result = await executeLiveEvalRuntime({
      apiKey: "test-key",
      role: "AUTHENTICATED",
      userId: "usr_test",
      messages: [{ role: "user", content: "hello" }],
      systemPrompt: "system",
      tools: [],
      toolExecutor: vi.fn(),
      invokeStream,
    });

    expect(invokeStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        model: "claude-haiku-4-5",
        assistantText: "ok",
        stopReason: "end_turn",
        systemPrompt: "system",
        toolCount: 0,
      }),
    );
  });

  it("uses prompt-visible tools for the default live eval model surface", async () => {
    const invokeStream = vi.fn().mockResolvedValue({
      model: "claude-haiku-4-5",
      assistantText: "ok",
      stopReason: "end_turn",
      toolRoundCount: 0,
      toolCalls: [],
      toolResults: [],
    });
    const getSchemasForRole = vi.fn().mockReturnValue([
      { name: "inspect_runtime_context", description: "Executable diagnostic.", input_schema: {} },
      { name: "search_corpus", description: "Search.", input_schema: {} },
    ]);
    const getPromptVisibleSchemasForRole = vi.fn().mockReturnValue([
      { name: "search_corpus", description: "Search.", input_schema: {} },
    ]);
    const executor = vi.fn();

    vi.spyOn(agentPlatformFacadeRoot, "getAgentPlatformFacade").mockReturnValue({
      getExecutionSurface: () => ({
        registry: {
          getSchemasForRole,
          getPromptVisibleSchemasForRole,
        },
        executor,
      }),
    } as never);

    const result = await executeLiveEvalRuntime({
      apiKey: "test-key",
      role: "AUTHENTICATED",
      userId: "usr_test",
      messages: [{ role: "user", content: "hello" }],
      systemPrompt: "system",
      invokeStream,
    });

    expect(getSchemasForRole).not.toHaveBeenCalled();
    expect(getPromptVisibleSchemasForRole).toHaveBeenCalledWith("AUTHENTICATED", {
      mode: "default_chat",
    });
    expect(invokeStream.mock.calls[0]?.[0].tools.map((tool: { name: string }) => tool.name)).toEqual([
      "search_corpus",
    ]);
    expect(result.toolCount).toBe(1);
  });

  it("reuses the shared provider-boundary harness for live runtime tool execution", async () => {
    const toolExecutor = vi.fn().mockResolvedValue({
      action: "inspect_runtime_context",
      ok: true,
    });
    const providerHarness = createProviderBoundaryHarness({
      steps: [
        { type: "delta", text: "Checking runtime. " },
        {
          type: "tool",
          name: "inspect_runtime_context",
          args: { includePrompt: true },
        },
        { type: "delta", text: "Done." },
      ],
    });

    const result = await executeLiveEvalRuntime({
      apiKey: "test-key",
      role: "AUTHENTICATED",
      userId: "usr_test",
      messages: [{ role: "user", content: "hello" }],
      systemPrompt: "system",
      tools: [
        {
          name: "inspect_runtime_context",
          description: "Inspect runtime context.",
          input_schema: { type: "object", properties: {} },
        },
      ],
      toolExecutor,
      invokeStream: providerHarness.invokeStream,
    });

    expect(providerHarness.calls[0]?.request.tools.map((tool) => tool.name)).toEqual([
      "inspect_runtime_context",
    ]);
    expect(providerHarness.calls[0]?.request.systemPrompt).toBe("system");
    expect(toolExecutor).toHaveBeenCalledWith("inspect_runtime_context", {
      includePrompt: true,
    }, expect.any(String));
    expect(result.assistantText).toBe("Checking runtime. Done.");
    expect(result.toolCalls).toEqual([
      expect.objectContaining({
        name: "inspect_runtime_context",
        args: { includePrompt: true },
        toolInvocationId: expect.any(String),
      }),
    ]);
  });

  it("captures tool failures through the shared provider-boundary harness without short-circuiting the loop", async () => {
    const toolExecutor = vi.fn().mockRejectedValue(new Error("temporarily unavailable"));
    const providerHarness = createProviderBoundaryHarness({
      steps: [
        {
          type: "tool",
          name: "inspect_runtime_context",
          args: { includePrompt: true },
        },
        { type: "delta", text: "Recovered." },
      ],
    });

    const result = await executeLiveEvalRuntime({
      apiKey: "test-key",
      role: "AUTHENTICATED",
      userId: "usr_test",
      messages: [{ role: "user", content: "hello" }],
      systemPrompt: "system",
      tools: [
        {
          name: "inspect_runtime_context",
          description: "Inspect runtime context.",
          input_schema: { type: "object", properties: {} },
        },
      ],
      toolExecutor,
      invokeStream: providerHarness.invokeStream,
    });

    expect(providerHarness.calls[0]?.request.messages).toEqual([
      { role: "user", content: "hello" },
    ]);
    expect(providerHarness.calls[0]?.request.signalProvided).toBe(false);
    expect(result.assistantText).toBe("Recovered.");
    expect(result.toolResults).toEqual([
      expect.objectContaining({
        name: "inspect_runtime_context",
        result: "temporarily unavailable",
        isError: true,
        toolInvocationId: expect.any(String),
      }),
    ]);
  });

  it("records live anonymous signup continuity with a post-signup continued exchange", async () => {
    const execution = await runLiveEvalScenario("live-anonymous-signup-continuity", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "Your next step is an apprenticeship screening recommendation.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "signup", passed: true }),
        expect.objectContaining({ id: "continuity", passed: true }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "state_transition", data: expect.objectContaining({ transition: "conversation_migrated" }) }),
        expect.objectContaining({ kind: "summary", data: expect.objectContaining({ stopReason: "end_turn" }) }),
      ]),
    );
  });

  it("fails closed when a live eval is requested without a key", async () => {
    await expect(
      runLiveEvalScenario("organization-buyer-funnel", {
        apiKey: "",
      }),
    ).rejects.toThrow("Live evals require ANTHROPIC_API_KEY or API__ANTHROPIC_API_KEY.");
  });

  it("captures tool recovery observations and edge-case stop reasons", async () => {
    const execution = await runLiveEvalScenario("mcp-tool-choice-and-recovery", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "The calculator failed once, so I recovered with a manual fallback explanation.",
        stopReason: "max_tool_rounds_exhausted",
        toolRoundCount: 4,
        toolCalls: [
          { name: "calculator", args: { operation: "add", a: 4, b: 5 } },
        ],
        toolResults: [
          { name: "calculator", result: "temporarily unavailable", isError: true },
        ],
        systemPrompt: "system",
        toolCount: 1,
      }),
    });

    expect(execution.stopReason).toBe("max_tool_rounds_exhausted");
    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tool-selection", passed: true }),
        expect.objectContaining({ id: "tool-arguments", passed: true }),
        expect.objectContaining({ id: "tool-recovery", passed: true }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "tool_call", data: expect.objectContaining({ toolId: "calculator", error: "temporarily unavailable" }) }),
      ]),
    );
  });

  it("injects a one-time calculator failure fixture for the live recovery scenario", async () => {
    const execution = await runLiveEvalScenario("mcp-tool-choice-and-recovery", {
      executeRuntime: vi.fn().mockImplementation(async (request) => {
        const toolExecutor = request.toolExecutor;

        if (!toolExecutor) {
          throw new Error("Expected a tool executor for the recovery scenario.");
        }

        let firstError = "";
        try {
          await toolExecutor("calculator", { operation: "add", a: 4, b: 5 });
        } catch (error) {
          firstError = error instanceof Error ? error.message : String(error);
        }

        const secondResult = await toolExecutor("calculator", { operation: "add", a: 4, b: 5 });

        return {
          model: "claude-sonnet-4-6",
          assistantText: `The calculator failed once, so I retried with the same inputs and recovered with the final total of ${String(secondResult)}.`,
          stopReason: "end_turn",
          toolRoundCount: 2,
          toolCalls: [
            { name: "calculator", args: { operation: "add", a: 4, b: 5 } },
            { name: "calculator", args: { operation: "add", a: 4, b: 5 } },
          ],
          toolResults: [
            { name: "calculator", result: firstError, isError: true },
            { name: "calculator", result: secondResult, isError: false },
          ],
          systemPrompt: request.systemPrompt ?? "system",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tool-selection", passed: true }),
        expect.objectContaining({ id: "tool-arguments", passed: true }),
        expect.objectContaining({ id: "tool-recovery", passed: true }),
      ]),
    );
  });

  it("creates a visible downstream deal for the organization buyer funnel", async () => {
    const execution = await runLiveEvalScenario("organization-buyer-funnel", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-sonnet-4-6",
        assistantText: "You are ready for a founder-approved estimate and proposal next step.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.run.modelName).toBe("claude-sonnet-4-6");
    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "qualification", passed: true }),
        expect.objectContaining({ id: "consultation-or-deal", passed: true }),
        expect.objectContaining({ id: "approved-next-step", passed: true }),
      ]),
    );
  });

  it("injects routing context and removes corpus tools for live funnel scenarios", async () => {
    const executeRuntime = vi.fn().mockResolvedValue({
      model: "claude-sonnet-4-6",
      assistantText: "Founder-approved estimate ready.",
      stopReason: "end_turn",
      toolRoundCount: 1,
      toolCalls: [],
      toolResults: [],
      systemPrompt: "system",
      toolCount: 0,
    });

    await runLiveEvalScenario("organization-buyer-funnel", {
      executeRuntime,
    });

    expect(executeRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [],
      }),
    );
    expect(executeRuntime.mock.calls[0]?.[0]?.systemPrompt).toContain("[Live eval funnel directive]");
    expect(executeRuntime.mock.calls[0]?.[0]?.systemPrompt).toContain("lane=organization");
    expect(executeRuntime.mock.calls[0]?.[0]?.systemPrompt).toContain("recommended_next_step=\"Prepare a founder-reviewed estimate-ready next step.\"");
  });

  it("uses runtime inspection for live self-knowledge answers", async () => {
    const execution = await runLiveEvalScenario("live-runtime-self-knowledge-honesty", {
      executeRuntime: vi.fn().mockImplementation(async (request) => {
        const toolExecutor = request.toolExecutor;

        if (!toolExecutor) {
          throw new Error("Expected a runtime inspection tool executor.");
        }

        const inspected = await toolExecutor("inspect_runtime_context", { includeTools: true }) as {
          toolCount: number;
          currentPathname: string | null;
        };

        return {
          model: "claude-sonnet-4-6",
          assistantText: `Runtime inspection shows ${inspected.toolCount} available capabilities, and the current page is ${inspected.currentPathname}.`,
          stopReason: "end_turn",
          toolRoundCount: 1,
          toolCalls: [
            { name: "inspect_runtime_context", args: { includeTools: true } },
          ],
          toolResults: [
            { name: "inspect_runtime_context", result: inspected, isError: false },
          ],
          systemPrompt: request.systemPrompt ?? "system",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "runtime-inspection-used", passed: true }),
        expect.objectContaining({ id: "verified-tools-reported", passed: true }),
        expect.objectContaining({ id: "page-context-reported", passed: true }),
      ]),
    );
  });

  it("returns prompt provenance from runtime inspection for live eval prompts", async () => {
    const executeRuntime = vi.fn().mockImplementation(async (request) => {
      const toolExecutor = request.toolExecutor;

      if (!toolExecutor) {
        throw new Error("Expected a runtime inspection tool executor.");
      }

      const inspected = await toolExecutor("inspect_runtime_context", {
        includePrompt: true,
      }) as {
        promptRuntime: {
          surface: string;
          effectiveHash: string;
          sections: Array<{ key: string }>;
          redacted: boolean;
        } | null;
      };

      expect(inspected.promptRuntime).toEqual(
        expect.objectContaining({
          surface: "live_eval",
          effectiveHash: expect.any(String),
          redacted: true,
        }),
      );
      expect(inspected.promptRuntime?.sections.map((section) => section.key)).toEqual(
        expect.arrayContaining(["live_eval_funnel_directive", "routing"]),
      );

      return {
        model: "claude-sonnet-4-6",
        assistantText: "Prompt provenance inspected.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [
          { name: "inspect_runtime_context", args: { includePrompt: true } },
        ],
        toolResults: [
          { name: "inspect_runtime_context", result: inspected, isError: false },
        ],
        systemPrompt: request.systemPrompt ?? "system",
        toolCount: request.tools?.length ?? 0,
      };
    });

    const execution = await runLiveEvalScenario("organization-buyer-funnel", {
      executeRuntime,
    });

    expect(executeRuntime).toHaveBeenCalledTimes(1);
    expect(execution.finalState.promptProvenance).toEqual(
      expect.objectContaining({
        surface: "live_eval",
        effectiveHash: expect.any(String),
      }),
    );
  });

  it("injects authoritative page context for live current-page truthfulness", async () => {
    const executeRuntime = vi.fn().mockImplementation(async (request) => {
      const toolExecutor = request.toolExecutor;

      if (!toolExecutor) {
        throw new Error("Expected a current-page tool executor.");
      }

      const currentPage = await toolExecutor("get_current_page", {}) as {
        pathname: string;
        mainHeading: string | null;
      };

      return {
        model: "claude-sonnet-4-6",
        assistantText: `No. You are on ${currentPage.pathname}, and the current page is ${currentPage.mainHeading}.`,
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [
          { name: "get_current_page", args: {} },
        ],
        toolResults: [
          { name: "get_current_page", result: currentPage, isError: false },
        ],
        systemPrompt: request.systemPrompt ?? "system",
        toolCount: request.tools?.length ?? 0,
      };
    });

    const execution = await runLiveEvalScenario("live-current-page-truthfulness", {
      executeRuntime,
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "authoritative-page-read", passed: true }),
        expect.objectContaining({ id: "stale-memory-overridden", passed: true }),
        expect.objectContaining({ id: "page-truthful-answer", passed: true }),
      ]),
    );
    expect(executeRuntime.mock.calls[0]?.[0]?.systemPrompt).toContain("[Authoritative current page snapshot]");
  });

  it("uses navigate_to_page and avoids legacy navigate in live navigation flows", async () => {
    const execution = await runLiveEvalScenario("live-duplicate-navigation-avoidance", {
      executeRuntime: vi.fn().mockImplementation(async (request) => {
        const toolExecutor = request.toolExecutor;

        if (!toolExecutor) {
          throw new Error("Expected a navigation tool executor.");
        }

        const navigationResult = await toolExecutor("navigate_to_page", { path: "/profile" }) as {
          path: string;
        };

        return {
          model: "claude-sonnet-4-6",
          assistantText: `Navigating to ${navigationResult.path}.`,
          stopReason: "end_turn",
          toolRoundCount: 1,
          toolCalls: [
            { name: "navigate_to_page", args: { path: "/profile" } },
          ],
          toolResults: [
            { name: "navigate_to_page", result: navigationResult, isError: false },
          ],
          systemPrompt: request.systemPrompt ?? "system",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "canonical-navigation-tool-used", passed: true }),
        expect.objectContaining({ id: "legacy-navigation-tool-avoided", passed: true }),
        expect.objectContaining({ id: "validated-route-returned", passed: true }),
      ]),
    );
  });

  it("inspects a completed blog job and publishes the produced draft in the live runner", async () => {
    const execution = await runLiveEvalScenario("live-blog-job-status-and-publish-handoff", {
      executeRuntime: vi.fn().mockImplementation(async (request) => {
        const toolExecutor = request.toolExecutor;

        if (!toolExecutor) {
          throw new Error("Expected a tool executor for the live blog status scenario.");
        }

        const listed = await toolExecutor("list_deferred_jobs", { active_only: false, limit: 5 }) as {
          jobs: Array<{ jobId: string }>;
        };
        const jobId = listed.jobs[0]?.jobId;

        if (!jobId) {
          throw new Error("Expected a seeded deferred job.");
        }

        const status = await toolExecutor("get_deferred_job_status", { job_id: jobId }) as {
          job: { resultPayload: { id: string; slug: string } };
        };
        const postId = status.job.resultPayload.id;
        const publish = await toolExecutor("publish_content", { post_id: postId });

        return {
          model: "claude-sonnet-4-6",
          assistantText: `Published the completed draft at /blog/${status.job.resultPayload.slug}.`,
          stopReason: "end_turn",
          toolRoundCount: 3,
          toolCalls: [
            { name: "list_deferred_jobs", args: { active_only: false, limit: 5 } },
            { name: "get_deferred_job_status", args: { job_id: jobId } },
            { name: "publish_content", args: { post_id: postId } },
          ],
          toolResults: [
            { name: "list_deferred_jobs", result: listed, isError: false },
            { name: "get_deferred_job_status", result: status, isError: false },
            { name: "publish_content", result: publish, isError: false },
          ],
          systemPrompt: request.systemPrompt ?? "system",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "job-inspected", passed: true }),
        expect.objectContaining({ id: "publish-triggered", passed: true }),
        expect.objectContaining({ id: "publish-complete", passed: true }),
      ]),
    );
  });

  it("reuses an existing running blog job instead of rerunning production in the live runner", async () => {
    const execution = await runLiveEvalScenario("live-blog-job-reuse-instead-of-rerun", {
      executeRuntime: vi.fn().mockImplementation(async (request) => {
        const toolExecutor = request.toolExecutor;

        if (!toolExecutor) {
          throw new Error("Expected a tool executor for the live blog reuse scenario.");
        }

        const listed = await toolExecutor("list_deferred_jobs", { active_only: true, limit: 5 }) as {
          jobs: Array<{ jobId: string; progressLabel?: string }>;
        };
        const jobId = listed.jobs[0]?.jobId;

        if (!jobId) {
          throw new Error("Expected an active deferred job.");
        }

        const status = await toolExecutor("get_deferred_job_status", { job_id: jobId });

        return {
          model: "claude-sonnet-4-6",
          assistantText: "The existing job is still running, so I am reusing it instead of starting over.",
          stopReason: "end_turn",
          toolRoundCount: 2,
          toolCalls: [
            { name: "list_deferred_jobs", args: { active_only: true, limit: 5 } },
            { name: "get_deferred_job_status", args: { job_id: jobId } },
          ],
          toolResults: [
            { name: "list_deferred_jobs", result: listed, isError: false },
            { name: "get_deferred_job_status", result: status, isError: false },
          ],
          systemPrompt: request.systemPrompt ?? "system",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "existing-job-found", passed: true }),
        expect.objectContaining({ id: "rerun-avoided", passed: true }),
        expect.objectContaining({ id: "active-status-explained", passed: true }),
      ]),
    );
  });

  it("recovers a completed blog job through durable state in the live runner", async () => {
    const execution = await runLiveEvalScenario("live-blog-completion-recovery", {
      executeRuntime: vi.fn().mockImplementation(async (request) => {
        return {
          model: "claude-sonnet-4-6",
          assistantText: "I recovered the completed draft from the latest durable job state, and it is ready to publish without rerunning production.",
          stopReason: "end_turn",
          toolRoundCount: 0,
          toolCalls: [],
          toolResults: [],
          systemPrompt: request.systemPrompt ?? "system",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "terminal-job-recovered", passed: true }),
        expect.objectContaining({ id: "publish-readiness-explained", passed: true }),
        expect.objectContaining({ id: "completion-visible-without-rerun", passed: true }),
      ]),
    );
    expect(execution.finalState.toolCalls).not.toEqual(
      expect.arrayContaining(["list_deferred_jobs", "get_deferred_job_status", "produce_blog_article"]),
    );
  });

  it("fails the organization buyer funnel when the live response never reaches deal creation", async () => {
    const execution = await runLiveEvalScenario("organization-buyer-funnel", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "You should gather more context before we decide anything.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "consultation-or-deal", passed: false }),
        expect.objectContaining({ id: "approved-next-step", passed: false }),
      ]),
    );
  });

  it("creates a visible training recommendation for the individual learner funnel", async () => {
    const execution = await runLiveEvalScenario("individual-learner-funnel", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "I recommend an apprenticeship screening and a founder-approved training recommendation.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "training-fit", passed: true }),
        expect.objectContaining({ id: "training-path-created", passed: true }),
        expect.objectContaining({ id: "approved-recommendation", passed: true }),
      ]),
    );
  });

  it("fails the learner funnel when the recommendation is too weak to create a training path", async () => {
    const execution = await runLiveEvalScenario("individual-learner-funnel", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "You should think about your goals a little more first.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "training-path-created", passed: false }),
        expect.objectContaining({ id: "approved-recommendation", passed: false }),
      ]),
    );
  });

  it("creates a scoping-ready deal for the development prospect funnel", async () => {
    const execution = await runLiveEvalScenario("development-prospect-funnel", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-sonnet-4-6",
        assistantText: "You are ready for a scoping and estimate conversation for implementation delivery.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "technical-qualification", passed: true }),
        expect.objectContaining({ id: "deal-created", passed: true }),
        expect.objectContaining({ id: "approved-next-step", passed: true }),
      ]),
    );
  });

  it("fails the development prospect funnel when the response never reaches scoping", async () => {
    const execution = await runLiveEvalScenario("development-prospect-funnel", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "This still sounds early, so keep exploring the problem first.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [],
        toolResults: [],
        systemPrompt: "system",
        toolCount: 0,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "deal-created", passed: false }),
        expect.objectContaining({ id: "approved-next-step", passed: false }),
      ]),
    );
  });

  it("captures multi-tool synthesis when both tools are used and combined", async () => {
    const execution = await runLiveEvalScenario("mcp-multi-tool-synthesis", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-sonnet-4-6",
        assistantText: "I combined the search context with the calculator result into one answer.",
        stopReason: "end_turn",
        toolRoundCount: 2,
        toolCalls: [
          { name: "web_search", args: { query: "pricing baseline" } },
          { name: "calculator", args: { operation: "add", a: 2, b: 3 } },
        ],
        toolResults: [
          { name: "web_search", result: { hits: 2 }, isError: false },
          { name: "calculator", result: 5, isError: false },
        ],
        systemPrompt: "system",
        toolCount: 2,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "multi-tool-selection", passed: true }),
        expect.objectContaining({ id: "result-combination", passed: true }),
        expect.objectContaining({ id: "final-answer-accuracy", passed: true }),
      ]),
    );
  });

  it("fails multi-tool synthesis when only one tool is used", async () => {
    const execution = await runLiveEvalScenario("mcp-multi-tool-synthesis", {
      executeRuntime: vi.fn().mockResolvedValue({
        model: "claude-haiku-4-5",
        assistantText: "I only used search.",
        stopReason: "end_turn",
        toolRoundCount: 1,
        toolCalls: [
          { name: "web_search", args: { query: "pricing baseline" } },
        ],
        toolResults: [
          { name: "web_search", result: { hits: 1 }, isError: false },
        ],
        systemPrompt: "system",
        toolCount: 1,
      }),
    });

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "multi-tool-selection", passed: false }),
      ]),
    );
  });
});
