#!/usr/bin/env tsx
import { loadLocalEnv } from "./load-local-env";
import { writeReleaseEvidenceArtifacts } from "../src/lib/evals/release-evidence";

loadLocalEnv();

function readRepeatedFlags(name: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      continue;
    }

    const prefix = `${name}=`;
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    }
  }

  return values;
}

function printUsage(): void {
  process.stderr.write(
    [
      "Usage: node --env-file=.env.local --import tsx scripts/generate-release-evidence.ts [--warning <text>] [--manual-check <text>]",
      "Example: node --env-file=.env.local --import tsx scripts/generate-release-evidence.ts --manual-check 'Founder sign-off completed in dashboard.'",
    ].join("\n") + "\n",
  );
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const { evidence, qaEvidencePath, canarySummaryPath, runtimeIntegrityPath } = await writeReleaseEvidenceArtifacts({
    warnings: readRepeatedFlags("--warning"),
    manualChecks: readRepeatedFlags("--manual-check"),
  });

  process.stdout.write(`Release evidence status: ${evidence.status}\n`);
  process.stdout.write(`Runtime integrity evidence: ${runtimeIntegrityPath}\n`);
  process.stdout.write(`Canary summary: ${canarySummaryPath}\n`);
  process.stdout.write(`QA evidence: ${qaEvidencePath}\n`);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

  if (evidence.status === "blocked") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  printUsage();
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
