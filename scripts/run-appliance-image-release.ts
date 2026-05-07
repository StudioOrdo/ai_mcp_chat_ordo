#!/usr/bin/env tsx
import { loadLocalEnv } from "./load-local-env";
import { runApplianceImageRelease, type ApplianceImageReleaseOptions } from "@/lib/appliance/release/appliance-image-release";

loadLocalEnv();

function printUsage(): void {
  process.stderr.write([
    "Usage: tsx scripts/run-appliance-image-release.ts [--allow-missing-scanners] [--full-test] [--keep-image] [--sign|--skip-sign] [--tag <image-tag>]",
    "Writes 05E appliance image release evidence under docs/_refactor/appliance-lifecycle-proof/evidence/.",
  ].join("\n") + "\n");
}

function parseArgs(argv: string[]): ApplianceImageReleaseOptions {
  const options: ApplianceImageReleaseOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--allow-missing-scanners") {
      options.allowMissingScanners = true;
      continue;
    }
    if (arg === "--full-test") {
      options.fullTest = true;
      continue;
    }
    if (arg === "--keep-image") {
      options.keepImage = true;
      continue;
    }
    if (arg === "--sign") {
      options.sign = true;
      continue;
    }
    if (arg === "--skip-sign") {
      options.skipSign = true;
      continue;
    }
    if (arg === "--tag" && argv[index + 1]) {
      options.tag = argv[index + 1];
      index += 1;
      continue;
    }
    const tagPrefix = "--tag=";
    if (arg.startsWith(tagPrefix)) {
      options.tag = arg.slice(tagPrefix.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(): Promise<void> {
  const result = await runApplianceImageRelease(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    status: result.evidence.status,
    image: result.evidence.image.tag,
    evidencePaths: result.evidencePaths,
    warnings: result.evidence.warnings,
    blockers: result.evidence.blockers,
  }, null, 2)}\n`);

  if (result.evidence.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  printUsage();
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
