import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  writeToolCoverageEvalArtifacts,
  writeToolWorkflowEvalArtifacts,
} from "@/lib/evals/eval-artifacts";
import type { ToolCoverageEvalReport } from "@/lib/evals/tool-coverage";
import type { ToolWorkflowCoverageEvalReport } from "@/lib/evals/tool-workflow-coverage";

describe("eval artifact writers", () => {
  it("writes durable workflow conversation artifacts with redacted raw JSON", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ordo-workflow-artifacts-"));
    const report: ToolWorkflowCoverageEvalReport = {
      startedAt: "2026-05-03T16:00:00.000Z",
      completedAt: "2026-05-03T16:00:01.000Z",
      total: 1,
      passed: 1,
      failed: 0,
      registryToolCount: 69,
      workflowCoveredToolNames: ["generate_audio", "compose_media"],
      results: [{
        scenario: {
          id: "media-image-audio-video-fixture",
          name: "Reusable image plus generated audio to composed video",
          role: "ADMIN",
          userId: "usr_eval",
          conversationId: "conv_eval",
          toolNames: ["generate_audio"],
          userPrompt: "Generate audio and compose media.",
          systemPrompt: "Use tools.",
          completionToken: "TOOL_WORKFLOW_EVAL_DONE:media-image-audio-video-fixture",
          maxToolRounds: 4,
        },
        passed: true,
        checkpoints: [{ id: "target_workflow_tools_called", passed: true, details: "ok" }],
        model: "stub-live-model",
        stopReason: "end_turn",
        assistantText: "TOOL_WORKFLOW_EVAL_DONE:media-image-audio-video-fixture",
        toolCalls: [{
          name: "generate_audio",
          args: { text: "hello" },
          toolInvocationId: "toolu_audio",
        }],
        toolResults: [{
          name: "generate_audio",
          isError: false,
          toolInvocationId: "toolu_audio",
          result: {
            jobId: "job_eval_audio_1",
            secretToken: "super-secret",
            artifactRefs: [{ assetId: "asset_eval_audio_1" }],
          },
        }],
      }],
    };

    const artifacts = await writeToolWorkflowEvalArtifacts(report, {
      rootDir,
      runId: "run 1",
    });

    expect(artifacts.directory).toBe(path.join(rootDir, "run-1"));
    expect(artifacts.files.map((file) => path.basename(file)).sort()).toEqual([
      "report.json",
      "scenario-media-image-audio-video-fixture.md",
      "summary.md",
    ]);
    await expect(stat(path.join(artifacts.directory, "summary.md"))).resolves.toBeDefined();

    const rawReport = await readFile(path.join(artifacts.directory, "report.json"), "utf8");
    expect(rawReport).not.toContain("super-secret");
    expect(rawReport).toContain("[redacted]");

    const scenario = await readFile(
      path.join(artifacts.directory, "scenario-media-image-audio-video-fixture.md"),
      "utf8",
    );
    expect(scenario).toContain("## Tool Timeline");
    expect(scenario).toContain("generate_audio");
    expect(scenario).toContain("asset_eval_audio_1");
  });

  it("writes concise single-tool coverage artifacts", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ordo-tool-artifacts-"));
    const report: ToolCoverageEvalReport = {
      startedAt: "2026-05-03T17:00:00.000Z",
      completedAt: "2026-05-03T17:00:01.000Z",
      total: 1,
      passed: 1,
      failed: 0,
      results: [{
        case: {
          toolName: "calculator",
          role: "ADMIN",
          category: "math",
          executionMode: "inline",
          promptExposure: "default_prompt",
          schema: {
            name: "calculator",
            description: "Calculate.",
            input_schema: { type: "object", properties: {}, additionalProperties: false },
          },
          userPrompt: "Use calculator.",
        },
        passed: true,
        checkpoints: [{ id: "target_tool_called_once", passed: true, details: "ok" }],
        model: "stub-live-model",
        stopReason: "end_turn",
        assistantText: "TOOL_EVAL_DONE:calculator",
        toolCalls: [],
        toolResults: [],
      }],
    };

    const artifacts = await writeToolCoverageEvalArtifacts(report, {
      rootDir,
      runId: "coverage",
    });

    const summary = await readFile(path.join(artifacts.directory, "summary.md"), "utf8");
    expect(summary).toContain("Live Tool Coverage Eval");
    expect(summary).toContain("PASS calculator");
  });
});
