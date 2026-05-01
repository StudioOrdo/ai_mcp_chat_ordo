#!/usr/bin/env tsx
import {
  RUNTIME_INTEGRITY_FOCUSED_TEST_SUITES,
  writeRuntimeIntegrityQaEvidenceArtifact,
  type RuntimeIntegrityQaStepResult,
} from "../src/lib/evals/runtime-integrity-evidence";
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
      "Usage: npm run qa:runtime-integrity",
      "Runs the focused runtime-truthfulness and retrieval-integrity bundle, writes release/runtime-integrity-evidence.json, and exits non-zero on any blocker.",
    ]);
    return;
  }

  const steps: QaCommandStep[] = [
    {
      label: "integrity eval suites",
      command: "npm",
      args: ["exec", "vitest", "run", ...RUNTIME_INTEGRITY_FOCUSED_TEST_SUITES],
    },
    {
      label: "production build",
      command: "npm",
      args: ["run", "build"],
    },
  ];

  const results: RuntimeIntegrityQaStepResult[] = runQaCommandSteps(steps).map((result) => ({
    label: result.label,
    command: formatQaCommand(result.command, result.args),
    status: result.status === "failed" ? "failed" : "passed",
  }));

  const blockingReasons = results
    .filter((result) => result.status === "failed")
    .map((result) => `Failed step: ${result.label}.`);
  const { artifactPath, evidence } = writeRuntimeIntegrityQaEvidenceArtifact({
    steps: results,
    blockingReasons,
  });

  process.stdout.write(`\nRuntime integrity evidence: ${artifactPath}\n`);
  process.stdout.write(`Runtime integrity status: ${evidence.status}\n`);

  if (evidence.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const { artifactPath } = writeRuntimeIntegrityQaEvidenceArtifact({
    steps: [],
    blockingReasons: [error instanceof Error ? error.message : String(error)],
  });

  printUsage([
    "Usage: npm run qa:runtime-integrity",
    "Runs the focused runtime-truthfulness and retrieval-integrity bundle, writes release/runtime-integrity-evidence.json, and exits non-zero on any blocker.",
  ]);
  process.stderr.write(`Runtime integrity evidence: ${artifactPath}\n`);
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});