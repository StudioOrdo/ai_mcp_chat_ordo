import { describe, expect, it, vi } from "vitest";

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import { getToolComposition } from "@/lib/chat/tool-composition-root";
import {
  resolveToolCoverageCases,
  runLiveToolCoverageEval,
  validateJsonSchemaSubset,
  verifyToolCoverageResult,
} from "@/lib/evals/tool-coverage";

function descriptor(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    name: "calculator",
    schema: {
      description: "Add two numbers.",
      input_schema: {
        type: "object",
        required: ["operation", "a", "b"],
        properties: {
          operation: { type: "string", enum: ["add"] },
          a: { type: "number" },
          b: { type: "number" },
        },
        additionalProperties: false,
      },
    },
    command: {
      execute: vi.fn(async () => ({ total: 5 })),
    },
    roles: "ALL",
    category: "math",
    ...overrides,
  };
}

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(descriptor());
  return registry;
}

describe("live tool coverage eval harness", () => {
  it("builds one coverage case for every registered production tool", () => {
    const registry = getToolComposition().registry;
    const cases = resolveToolCoverageCases({ registry });

    expect(cases.map((testCase) => testCase.toolName)).toEqual(registry.getToolNames().sort());
    expect(cases.length).toBeGreaterThan(50);
    expect(cases.every((testCase) => testCase.schema.name === testCase.toolName)).toBe(true);
    expect(cases.every((testCase) => testCase.userPrompt.includes(`"${testCase.toolName}"`))).toBe(true);
  });

  it("validates the advertised input schema subset before accepting dry-run execution", () => {
    const schema = descriptor().schema.input_schema;

    expect(validateJsonSchemaSubset({ operation: "add", a: 2, b: 3 }, schema)).toEqual([]);
    expect(validateJsonSchemaSubset({ operation: "add", a: 2 }, schema)).toEqual([
      "$.b is required.",
    ]);
    expect(validateJsonSchemaSubset({ operation: "multiply", a: 2, b: 3 }, schema)).toEqual([
      "$.operation must be one of add",
    ]);
  });

  it("runs a live-model-shaped dry-run eval and deterministically verifies the tool call", async () => {
    const execution = await runLiveToolCoverageEval({
      apiKey: "test-key",
      registry: createRegistry(),
      executeRuntime: vi.fn(async (request, testCase) => {
        const args = { operation: "add", a: 2, b: 3 };
        const result = await request.toolExecutor?.(testCase.toolName, args, "toolu_eval_1");

        return {
          model: "stub-live-model",
          assistantText: `TOOL_EVAL_DONE:${testCase.toolName}`,
          stopReason: "end_turn",
          toolRoundCount: 1,
          toolCalls: [{ name: testCase.toolName, args, toolInvocationId: "toolu_eval_1" }],
          toolResults: [{ name: testCase.toolName, result, isError: false, toolInvocationId: "toolu_eval_1" }],
          systemPrompt: request.systemPrompt ?? "",
          toolCount: request.tools?.length ?? 0,
        };
      }),
    });

    expect(execution).toMatchObject({
      total: 1,
      passed: 1,
      failed: 0,
    });
    expect(execution.results[0]?.checkpoints.every((checkpoint) => checkpoint.passed)).toBe(true);
  });

  it("fails closed when the model calls the wrong tool or skips the acknowledgement token", () => {
    const [testCase] = resolveToolCoverageCases({ registry: createRegistry() });
    const checkpoints = verifyToolCoverageResult(testCase!, {
      model: "stub-live-model",
      assistantText: "Done.",
      stopReason: "end_turn",
      toolRoundCount: 1,
      toolCalls: [{ name: "wrong_tool", args: {}, toolInvocationId: "toolu_wrong" }],
      toolResults: [{ name: "wrong_tool", result: { ok: true }, isError: false, toolInvocationId: "toolu_wrong" }],
      systemPrompt: "system",
      toolCount: 1,
    });

    expect(checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "target_tool_called_once", passed: false }),
        expect.objectContaining({ id: "no_unexpected_tools", passed: false }),
        expect.objectContaining({ id: "assistant_acknowledged_tool_eval", passed: false }),
      ]),
    );
  });
});
