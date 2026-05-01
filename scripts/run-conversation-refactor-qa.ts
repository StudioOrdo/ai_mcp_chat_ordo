#!/usr/bin/env tsx
import {
  CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES,
  writeConversationRefactorEvidenceArtifact,
  type ConversationRefactorQaStepResult,
} from "../src/lib/evals/conversation-refactor-evidence";
import {
  formatQaCommand,
  hasHelpFlag,
  printUsage,
  runQaCommandSteps,
  type QaCommandStep,
} from "./lib/qa-runner";

async function main(): Promise<void> {
  if (hasHelpFlag()) {
    printUsage([
      "Usage: tsx scripts/run-conversation-refactor-qa.ts",
      "Runs the conversation-refactor focused QA bundle, writes release/conversation-refactor-evidence.json, and exits non-zero on any failed step.",
    ]);
    return;
  }

  const steps: QaCommandStep[] = [
    {
      label: "conversation refactor focused suites",
      command: "npm",
      args: ["exec", "vitest", "run", ...CONVERSATION_REFACTOR_FOCUSED_TEST_SUITES],
    },
  ];

  const results: ConversationRefactorQaStepResult[] = runQaCommandSteps(steps).map((result) => ({
    label: result.label,
    command: formatQaCommand(result.command, result.args),
    status: result.status === "failed" ? "failed" : "passed",
  }));

  const { artifactPath, evidence } = writeConversationRefactorEvidenceArtifact({
    steps: results,
  });

  process.stdout.write(`\nConversation refactor evidence: ${artifactPath}\n`);
  process.stdout.write(`Conversation refactor status: ${evidence.status}\n`);

  if (evidence.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const { artifactPath } = writeConversationRefactorEvidenceArtifact({
    steps: [],
    blockingReasons: [error instanceof Error ? error.message : String(error)],
  });

  printUsage([
    "Usage: tsx scripts/run-conversation-refactor-qa.ts",
    "Runs the conversation-refactor focused QA bundle, writes release/conversation-refactor-evidence.json, and exits non-zero on any failed step.",
  ]);
  process.stderr.write(`Conversation refactor evidence: ${artifactPath}\n`);
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});