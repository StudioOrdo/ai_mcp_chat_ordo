#!/usr/bin/env tsx
/**
 * Sprint 7 QA Script — Hybrid FFmpeg Browser + Server Execution
 *
 * Runs the full verification bundle for Sprint 7:
 *   Task 7.1 – Media composition plan contracts
 *   Task 7.2 – Browser WASM executor + capability probe
 *   Task 7.3 – Server path + job capability registry
 *   Task 7.4 – MediaRenderCard + user-files route
 *   Task 7.5 – Build verification
 *
 * Usage:
 *   npm run qa:sprint-7
 *   npm run qa:sprint-7 -- --build-only      (skip tests, only build)
 *   npm run qa:sprint-7 -- --tests-only      (skip build)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const SPRINT_7_UNIT_TESTS = [
  // Task 7.1 — Plan contracts
  "src/lib/media/ffmpeg/media-composition-plan.test.ts",
  "src/lib/media/media-composition-asset-identity.test.ts",
  "src/core/use-cases/tools/list-conversation-media-assets.tool.test.ts",
  "src/lib/media/compose-media-preflight.test.ts",
  "src/lib/media/ffmpeg/media-execution-router.test.ts",

  // Task 7.2 — Browser WASM path
  "src/lib/media/browser-runtime/ffmpeg-capability-probe.test.ts",
  "src/lib/media/browser-runtime/ffmpeg-browser-executor.test.ts",
  "src/lib/media/browser-runtime/browser-capability-registry.test.ts",
  "src/lib/media/browser-runtime/job-snapshots.test.ts",

  // Task 7.3 — Server path + governance
  "src/lib/media/ffmpeg/server/ffmpeg-server-executor.test.ts",
  "src/core/use-cases/tools/compose-media.tool.test.ts",
  "src/lib/jobs/job-capability-registry.test.ts",
  "src/app/api/chat/jobs/route.test.ts",

  // Task 7.4 — UI card + file serving
  "src/frameworks/ui/chat/plugins/custom/MediaRenderCard.test.tsx",
  "src/app/api/user-files/[id]/route.test.ts",
];

function run(cmd: string, args: string[], label: string): void {
  process.stdout.write(`\n${"=".repeat(60)}\n► ${label}\n${"=".repeat(60)}\n`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      // Set node binary explicitly so vitest can find it
      PATH: `/opt/homebrew/Cellar/node@22/22.22.2_1/bin:${process.env["PATH"] ?? ""}`,
    },
  });

  if (result.error) {
    process.stderr.write(`Failed to spawn: ${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(`\n✗ ${label} FAILED (exit ${result.status ?? "unknown"})\n`);
    process.exit(result.status ?? 1);
  }

  process.stdout.write(`\n✓ ${label} passed\n`);
}

async function main(): Promise<void> {
  const buildOnly = process.argv.includes("--build-only");
  const testsOnly = process.argv.includes("--tests-only");

  process.stdout.write("\n🎬 Sprint 7 QA: Hybrid FFmpeg Browser + Server Execution\n\n");

  // Verify public WASM artifacts are present
  const { existsSync } = await import("node:fs");
  const wasmPath = path.join(ROOT, "public/ffmpeg-core/ffmpeg-core.wasm");
  const jsPath = path.join(ROOT, "public/ffmpeg-core/ffmpeg-core.js");

  if (!existsSync(wasmPath) || !existsSync(jsPath)) {
    process.stderr.write(
      `✗ WASM artifacts missing from public/ffmpeg-core/\n` +
      `  Run: cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.{js,wasm} public/ffmpeg-core/\n`,
    );
    process.exit(1);
  }
  process.stdout.write("✓ WASM artifacts present in public/ffmpeg-core/\n");

  if (!buildOnly) {
    run(
      "node_modules/.bin/vitest",
      ["run", ...SPRINT_7_UNIT_TESTS],
      "Sprint 7 — All unit tests",
    );
  }

  if (!testsOnly) {
    run(
      "node_modules/.bin/next",
      ["build"],
      "Sprint 7 — npm run build (TypeScript + Next.js)",
    );
  }

  process.stdout.write("\n🏁 Sprint 7 QA passed — all checks green.\n");
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
