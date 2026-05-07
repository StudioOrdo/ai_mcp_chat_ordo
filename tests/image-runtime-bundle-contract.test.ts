import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function runnerStage(dockerfile: string) {
  const marker = "FROM node:${NODE_VERSION}-alpine AS runner";
  const index = dockerfile.indexOf(marker);
  if (index === -1) {
    throw new Error("Dockerfile runner stage marker not found.");
  }
  return dockerfile.slice(index);
}

function copyLines(source: string) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("COPY "));
}

describe("image runtime bundle contract", () => {
  it("keeps the runner COPY list constrained to the approved runtime bundle", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");
    const copies = copyLines(runnerStage(dockerfile));

    expect(copies).toEqual([
      "COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules",
      "COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json",
      "COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json",
      "COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts",
      "COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next",
      "COPY --from=builder --chown=nextjs:nodejs /app/public ./public",
      "COPY --from=builder --chown=nextjs:nodejs /app/docs/_corpus ./docs/_corpus",
      "COPY --from=builder --chown=nextjs:nodejs /app/release/manifest.json ./release/manifest.json",
      "COPY --from=builder --chown=nextjs:nodejs /app/config ./config",
      "COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts",
      "COPY --from=builder --chown=nextjs:nodejs /app/mcp ./mcp",
      "COPY --from=builder --chown=nextjs:nodejs /app/src ./src",
      "COPY --from=rust-builder --chown=nextjs:nodejs /app/target/release/ordo-backup ./bin/ordo-backup",
    ]);
  });

  it("does not copy broad host-only directories into the runner", () => {
    const runnerCopies = copyLines(runnerStage(readWorkspaceFile("Dockerfile"))).join("\n");

    const forbiddenCopies = [
      "/app/docs ./docs",
      "/app/release ./release",
      "/app/tests",
      "/app/.github",
      "/app/.git",
      "/app/.data",
      "/app/.runtime-logs",
      "/app/.playwright-data",
      "/app/coverage",
      "/app/test-results",
      "/app/playwright-report",
      "/app/docs/_debug",
      "/app/docs/_review",
      "/app/docs/_refactor",
      "/app/docs/_archive",
      "/app/docs/me.txt",
      ".env.local",
      ".env",
    ];

    for (const forbidden of forbiddenCopies) {
      expect(runnerCopies).not.toContain(forbidden);
    }
  });

  it("keeps docker build context exclusions for local-only and secret-bearing files", () => {
    const dockerignore = readWorkspaceFile(".dockerignore");

    for (const requiredPattern of [
      "node_modules",
      ".next",
      "coverage",
      ".data",
      ".runtime-logs",
      ".playwright-data",
      "playwright-report",
      "test-results",
      ".git",
      "npm-debug.log*",
      "*.log",
      "*.jsonl",
      "*.tsbuildinfo",
      ".env",
      ".env.*",
      "tests",
      ".github",
      "vitest.config.ts",
      "lighthouse-prod.json",
      "lint_results.txt",
    ]) {
      expect(dockerignore).toContain(requiredPattern);
    }
  });

  it("does not use secret-shaped Dockerfile env placeholders during build", () => {
    const dockerfile = readWorkspaceFile("Dockerfile");
    expect(dockerfile).not.toContain("ENV ANTHROPIC_API_KEY=");
    expect(dockerfile).not.toContain("ENV OPENAI_API_KEY=");
    expect(dockerfile).not.toContain("docker-build-placeholder");
  });

  it("re-includes only the runtime corpus markdown needed by librarian and library flows", () => {
    const dockerignore = readWorkspaceFile(".dockerignore");

    expect(dockerignore).toContain("*.md");
    expect(dockerignore).toContain("!README.md");
    expect(dockerignore).toContain("!docs/_corpus/**/*.md");
    expect(dockerignore).toContain("!docs/_corpus/**/book.json");
  });

  it("documents why TypeScript runtime paths are still intentionally retained", () => {
    const phaseDoc = readWorkspaceFile(
      "docs/_refactor/appliance-lifecycle-proof/phases/05c-image-minimization-and-runtime-bundle.md",
    );
    const startServer = readWorkspaceFile("scripts/start-server.mjs");
    const mcpAdapter = readWorkspaceFile("src/lib/capabilities/mcp-stdio-adapter.ts");

    expect(startServer).toContain('node_modules", "tsx", "dist", "cli.mjs"');
    expect(startServer).toContain('"scripts/process-deferred-jobs.ts"');
    expect(startServer).toContain('"scripts/media-worker-server.ts"');
    expect(startServer).toContain('"scripts/process-backup-scheduler.ts"');
    expect(mcpAdapter).toContain('node_modules", ".bin"');
    expect(mcpAdapter).toContain("config.entrypoint");

    for (const retainedPath of [
      "`node_modules`",
      "`tsconfig.json`",
      "`next.config.ts`",
      "`scripts`",
      "`mcp`",
      "`src`",
    ]) {
      expect(phaseDoc).toContain(retainedPath);
    }
  });
});
