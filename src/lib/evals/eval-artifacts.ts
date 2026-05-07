import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ToolCoverageEvalReport } from "@/lib/evals/tool-coverage";
import type {
  ToolWorkflowCoverageEvalReport,
  ToolWorkflowCoverageScenarioResult,
} from "@/lib/evals/tool-workflow-coverage";

export interface EvalArtifactWriteOptions {
  rootDir?: string;
  runId?: string;
}

export interface EvalArtifactWriteResult {
  directory: string;
  files: string[];
}

const DEFAULT_ARTIFACT_ROOT = path.join(
  process.cwd(),
  ".runtime-logs",
  "eval-artifacts",
);

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|authorization|bearer|cookie|password|secret|token)/i;

export async function writeToolWorkflowEvalArtifacts(
  report: ToolWorkflowCoverageEvalReport,
  options: EvalArtifactWriteOptions = {},
): Promise<EvalArtifactWriteResult> {
  const directory = resolveArtifactDirectory("tool-workflows", report.startedAt, options);
  await mkdir(directory, { recursive: true });

  const files: string[] = [];
  await writeArtifact(directory, files, "report.json", `${JSON.stringify(redactValue(report), null, 2)}\n`);
  await writeArtifact(directory, files, "summary.md", renderWorkflowSummary(report));

  for (const result of report.results) {
    await writeArtifact(
      directory,
      files,
      `scenario-${toSafeFileName(result.scenario.id)}.md`,
      renderWorkflowScenario(result),
    );
  }

  return { directory, files };
}

export async function writeToolCoverageEvalArtifacts(
  report: ToolCoverageEvalReport,
  options: EvalArtifactWriteOptions = {},
): Promise<EvalArtifactWriteResult> {
  const directory = resolveArtifactDirectory("tool-coverage", report.startedAt, options);
  await mkdir(directory, { recursive: true });

  const files: string[] = [];
  await writeArtifact(directory, files, "report.json", `${JSON.stringify(redactValue(report), null, 2)}\n`);
  await writeArtifact(directory, files, "summary.md", renderToolCoverageSummary(report));

  return { directory, files };
}

function resolveArtifactDirectory(
  kind: string,
  startedAt: string,
  options: EvalArtifactWriteOptions,
): string {
  const rootDir = options.rootDir ?? path.join(DEFAULT_ARTIFACT_ROOT, kind);
  const runId = options.runId ?? startedAt.replace(/[:.]/g, "-");
  return path.resolve(rootDir, toSafeFileName(runId));
}

async function writeArtifact(
  directory: string,
  files: string[],
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = path.join(directory, relativePath);
  await writeFile(filePath, content, "utf8");
  files.push(filePath);
}

function renderWorkflowSummary(report: ToolWorkflowCoverageEvalReport): string {
  const lines = [
    "# Live Tool Workflow Eval",
    "",
    `Started: ${report.startedAt}`,
    `Completed: ${report.completedAt}`,
    `Result: ${report.passed}/${report.total} passed`,
    `Registry tools: ${report.registryToolCount}`,
    `Workflow-covered tools: ${report.workflowCoveredToolNames.join(", ") || "none"}`,
    "",
    "## Scenarios",
    "",
  ];

  for (const result of report.results) {
    lines.push(
      `- ${result.passed ? "PASS" : "FAIL"} ${result.scenario.id}: ${result.scenario.name}`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderWorkflowScenario(result: ToolWorkflowCoverageScenarioResult): string {
  const lines = [
    `# ${result.scenario.name}`,
    "",
    `Scenario: ${result.scenario.id}`,
    `Result: ${result.passed ? "PASS" : "FAIL"}`,
    `Model: ${result.model}`,
    `Stop reason: ${result.stopReason ?? "unknown"}`,
    "",
    "## Prompt",
    "",
    "System:",
    "",
    fence(result.scenario.systemPrompt, "text"),
    "",
    "User:",
    "",
    fence(result.scenario.userPrompt, "text"),
    "",
    "## Assistant",
    "",
    fence(result.assistantText || "(empty)", "text"),
    "",
    "## Checkpoints",
    "",
  ];

  for (const checkpoint of result.checkpoints) {
    lines.push(
      `- ${checkpoint.passed ? "PASS" : "FAIL"} ${checkpoint.id}: ${checkpoint.details}`,
    );
  }

  lines.push("", "## Tool Timeline", "");
  for (const call of result.toolCalls) {
    const matchingResult = result.toolResults.find(
      (toolResult) => toolResult.toolInvocationId === call.toolInvocationId,
    );
    lines.push(
      `### ${call.name}`,
      "",
      `Invocation: ${call.toolInvocationId}`,
      "",
      "Arguments:",
      "",
      fence(JSON.stringify(redactValue(call.args), null, 2), "json"),
      "",
      "Result:",
      "",
      fence(JSON.stringify(redactValue(summarizeValue(matchingResult?.result ?? null)), null, 2), "json"),
      "",
    );
  }

  const artifactValues = collectNamedValues(result.toolResults, [
    "assetId",
    "primaryAssetId",
    "postId",
    "jobId",
    "operationId",
  ]);
  if (artifactValues.length > 0) {
    lines.push("## Observed IDs", "");
    for (const value of artifactValues) {
      lines.push(`- ${value.key}: ${value.value}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderToolCoverageSummary(report: ToolCoverageEvalReport): string {
  const lines = [
    "# Live Tool Coverage Eval",
    "",
    `Started: ${report.startedAt}`,
    `Completed: ${report.completedAt}`,
    `Result: ${report.passed}/${report.total} passed`,
    "",
    "## Tools",
    "",
  ];

  for (const result of report.results) {
    lines.push(
      `- ${result.passed ? "PASS" : "FAIL"} ${result.case.toolName} (${result.case.role}, ${result.case.executionMode}, ${result.case.promptExposure})`,
    );
    if (!result.passed) {
      for (const checkpoint of result.checkpoints.filter((checkpoint) => !checkpoint.passed)) {
        lines.push(`  - ${checkpoint.id}: ${checkpoint.details}`);
      }
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function fence(content: string, language: string): string {
  return ["```" + language, content, "```"].join("\n");
}

function toSafeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 160);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entry),
    ]),
  );
}

function summarizeValue(value: unknown, depth = 0): unknown {
  const redacted = redactValue(value);
  if (typeof redacted === "string") {
    return redacted.length > 1_200 ? `${redacted.slice(0, 1_200)}...` : redacted;
  }

  if (typeof redacted !== "object" || redacted === null) {
    return redacted;
  }

  if (Array.isArray(redacted)) {
    return depth >= 3
      ? { type: "array", length: redacted.length }
      : redacted.slice(0, 20).map((entry) => summarizeValue(entry, depth + 1));
  }

  const entries = Object.entries(redacted as Record<string, unknown>).slice(0, 40);
  return Object.fromEntries(entries.map(([key, entry]) => [key, summarizeValue(entry, depth + 1)]));
}

function collectNamedValues(
  value: unknown,
  keys: readonly string[],
  output: Array<{ key: string; value: string }> = [],
): Array<{ key: string; value: string }> {
  if (Array.isArray(value)) {
    for (const entry of value) collectNamedValues(entry, keys, output);
    return dedupeNamedValues(output);
  }

  if (typeof value !== "object" || value === null) {
    return dedupeNamedValues(output);
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (keys.includes(key) && typeof entry === "string") {
      output.push({ key, value: entry });
    }
    collectNamedValues(entry, keys, output);
  }

  return dedupeNamedValues(output);
}

function dedupeNamedValues(
  values: Array<{ key: string; value: string }>,
): Array<{ key: string; value: string }> {
  const seen = new Set<string>();
  return values.filter((entry) => {
    const id = `${entry.key}:${entry.value}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
