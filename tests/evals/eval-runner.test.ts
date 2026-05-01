import { describe, expect, it } from "vitest";

import { runDeterministicEvalScenario } from "@/lib/evals/runner";

describe("eval deterministic runner", () => {
  it("preserves continuity across anonymous signup migration", async () => {
    const execution = await runDeterministicEvalScenario("anonymous-signup-continuity");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "signup", passed: true }),
        expect.objectContaining({ id: "continuity", passed: true }),
      ]),
    );
    expect(execution.observations.filter((observation) => observation.kind === "message")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: expect.objectContaining({ content: expect.stringContaining("I signed up") }) }),
        expect.objectContaining({ data: expect.objectContaining({ content: expect.stringContaining("conversation stays intact") }) }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "state_transition",
          data: expect.objectContaining({ transition: "conversation_migrated" }),
        }),
      ]),
    );
  });

  it("records a no-tool deterministic scenario without tool_call observations", async () => {
    const execution = await runDeterministicEvalScenario("mcp-tool-avoidance");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tool-avoided", passed: true }),
      ]),
    );
    expect(execution.observations.filter((observation) => observation.kind === "tool_call")).toEqual([]);
  });

  it("records a positive calculator tool call with arguments and expected result", async () => {
    const execution = await runDeterministicEvalScenario("mcp-calculator-must-use");
    const toolCall = execution.observations.find((observation) => observation.kind === "tool_call");

    expect(toolCall).toMatchObject({
      data: {
        toolId: "calculator",
        args: { operation: "multiply", a: 14, b: 3 },
        result: 42,
        matchedExpected: true,
      },
    });
    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tool-called", passed: true }),
        expect.objectContaining({ id: "answer-correct", passed: true }),
      ]),
    );
  });

  it("records routing reroute transitions deterministically", async () => {
    const execution = await runDeterministicEvalScenario("misclassification-reroute");

    expect(execution.finalState.lane).toBe("development");
    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "reroute", passed: true }),
        expect.objectContaining({ id: "updated-next-step", passed: true }),
      ]),
    );
  });

  it("returns canonical corpus references and grounded prefetch payloads", async () => {
    const execution = await runDeterministicEvalScenario("integrity-canonical-corpus-reference-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "canonical-path-returned", passed: true }),
        expect.objectContaining({ id: "resolver-path-returned", passed: true }),
        expect.objectContaining({ id: "grounding-followup-honest", passed: true }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "tool_call", data: expect.objectContaining({ toolId: "search_corpus" }) }),
      ]),
    );
    expect(execution.finalState.recommendation).toContain("/library/");
  });

  it("records audio failure recovery without losing transcript guidance", async () => {
    const execution = await runDeterministicEvalScenario("integrity-audio-recovery-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "audio-failure-detected", passed: true }),
        expect.objectContaining({ id: "fallback-transcript-visible", passed: true }),
        expect.objectContaining({ id: "recovery-guidance-visible", passed: true }),
      ]),
    );
    expect(execution.finalState.recommendation).toContain("Retry audio generation");
  });

  it("proves the media workflow package completes a video without assistant polling", async () => {
    const execution = await runDeterministicEvalScenario("media-workflow-video-completion-deterministic");
    const toolCallIds = execution.observations
      .filter((observation) => observation.kind === "tool_call")
      .map((observation) => observation.data.toolId);

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "workflow-created", passed: true }),
        expect.objectContaining({ id: "compose-auto-enqueued", passed: true }),
        expect.objectContaining({ id: "workflow-final-video", passed: true }),
        expect.objectContaining({ id: "chat-renders-workflow", passed: true }),
        expect.objectContaining({ id: "status-polling-avoided", passed: true }),
      ]),
    );
    expect(toolCallIds).toEqual(expect.arrayContaining(["generate_audio", "compose_media"]));
    expect(toolCallIds).not.toEqual(
      expect.arrayContaining(["list_my_jobs", "get_my_job_status", "list_deferred_jobs", "get_deferred_job_status"]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "state_transition",
          data: expect.objectContaining({
            transition: "media_workflow_succeeded",
            finalAssetId: "uf_eval_bloom_video",
          }),
        }),
      ]),
    );
    expect(execution.finalState.recommendation).toContain("final video artifact");
  });

  it("suppresses malformed UI suggestion tags and repairs canonical action params", async () => {
    const execution = await runDeterministicEvalScenario("integrity-malformed-ui-tags-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "suggestions-suppressed", passed: true }),
        expect.objectContaining({ id: "actions-repaired", passed: true }),
        expect.objectContaining({ id: "canonical-action-params", passed: true }),
      ]),
    );
    expect(execution.finalState.recommendation).toBe("/library");
  });

  it("resolves session resolution signals correctly for deterministic models", async () => {
    const execution = await runDeterministicEvalScenario("integrity-session-resolution-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "resolution-advanced", passed: true }),
        expect.objectContaining({ id: "resolution-resolved", passed: true }),
      ]),
    );
  });

  it("evaluates retrieval quality correctly for deterministic models", async () => {
    const execution = await runDeterministicEvalScenario("integrity-retrieval-quality-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "quality-strong", passed: true }),
        expect.objectContaining({ id: "quality-partial", passed: true }),
        expect.objectContaining({ id: "quality-none", passed: true }),
      ]),
    );
  });

  it("creates an estimate-ready deal for the deterministic organization buyer funnel", async () => {
    const execution = await runDeterministicEvalScenario("organization-buyer-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "qualification", passed: true }),
        expect.objectContaining({ id: "consultation-or-deal", passed: true }),
        expect.objectContaining({ id: "approved-next-step", passed: true }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "state_transition", data: expect.objectContaining({ transition: "deal_created" }) }),
      ]),
    );
  });

  it("creates a founder-approved training recommendation for the deterministic learner funnel", async () => {
    const execution = await runDeterministicEvalScenario("individual-learner-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "training-fit", passed: true }),
        expect.objectContaining({ id: "training-path-created", passed: true }),
        expect.objectContaining({ id: "approved-recommendation", passed: true }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "state_transition", data: expect.objectContaining({ transition: "training_path_recommended" }) }),
      ]),
    );
  });

  it("surfaces an active deferred blog job through status tools without creating a rerun", async () => {
    const execution = await runDeterministicEvalScenario("blog-job-status-continuity-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "active-job-visible", passed: true }),
        expect.objectContaining({ id: "status-read-no-rerun", passed: true }),
        expect.objectContaining({ id: "progress-preserved", passed: true }),
      ]),
    );
    expect(execution.finalState.toolCalls).toEqual(
      expect.arrayContaining(["list_deferred_jobs", "get_deferred_job_status"]),
    );
  });

  it("covers the explicit job-id status-check conversation shape without creating a rerun", async () => {
    const execution = await runDeterministicEvalScenario("blog-explicit-status-check-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "conversation-shape-preserved", passed: true }),
        expect.objectContaining({ id: "explicit-status-explained", passed: true }),
        expect.objectContaining({ id: "status-read-no-rerun", passed: true }),
      ]),
    );
    expect(execution.finalState.toolCalls).toEqual(
      expect.arrayContaining(["list_deferred_jobs", "get_deferred_job_status"]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "message",
          data: expect.objectContaining({ content: "Produce a blog post on my capabilities" }),
        }),
        expect.objectContaining({
          kind: "message",
          data: expect.objectContaining({ content: expect.stringContaining("Check the status of job job_") }),
        }),
        expect.objectContaining({
          kind: "message",
          data: expect.objectContaining({ content: expect.stringContaining("is still running") }),
        }),
      ]),
    );
  });

  it("records dedupe copy that clearly states reuse of the existing blog job", async () => {
    const execution = await runDeterministicEvalScenario("blog-job-dedupe-clarity-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dedupe-detected", passed: true }),
        expect.objectContaining({ id: "reuse-copy-clear", passed: true }),
        expect.objectContaining({ id: "single-job-preserved", passed: true }),
      ]),
    );
    expect(execution.finalState.recommendation).toContain("Using existing Produce Blog Article job");
  });

  it("preserves the produced draft id and exposes a correct publish handoff", async () => {
    const execution = await runDeterministicEvalScenario("blog-produce-publish-handoff-deterministic");

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "post-id-preserved", passed: true }),
        expect.objectContaining({ id: "publish-action-visible", passed: true }),
        expect.objectContaining({ id: "publish-command-correct", passed: true }),
      ]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "tool_call", data: expect.objectContaining({ toolId: "publish_content" }) }),
      ]),
    );
  });

  it("recovers a completed blog job from durable reconciliation after missed SSE delivery", async () => {
    const execution = await runDeterministicEvalScenario("blog-missed-sse-recovery-deterministic");
    const toolCallIds = execution.observations
      .filter((observation) => observation.kind === "tool_call")
      .map((observation) => observation.data.toolId);

    expect(execution.checkpointResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "terminal-job-recovered", passed: true }),
        expect.objectContaining({ id: "summary-preserved", passed: true }),
        expect.objectContaining({ id: "post-id-available", passed: true }),
      ]),
    );
    expect(toolCallIds).not.toEqual(expect.arrayContaining(["list_deferred_jobs", "get_deferred_job_status"]));
    expect(execution.finalState.toolCalls).not.toEqual(
      expect.arrayContaining(["list_deferred_jobs", "get_deferred_job_status"]),
    );
    expect(execution.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "state_transition",
          data: expect.objectContaining({ source: "durable_job_reconciliation" }),
        }),
      ]),
    );
    expect(execution.finalState.recommendation).toContain("Recovered terminal job");
  });
});
