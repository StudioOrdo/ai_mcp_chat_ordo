import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

function listSourceFiles(directory: string): string[] {
  const absolute = join(REPO_ROOT, directory);
  const entries = readdirSync(absolute);
  const files: string[] = [];

  for (const entry of entries) {
    const candidate = join(absolute, entry);
    const stat = statSync(candidate);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(relative(REPO_ROOT, candidate)));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(candidate);
    }
  }

  return files;
}

function readFiles(directories: string[]): Array<{ path: string; content: string }> {
  return directories.flatMap((directory) =>
    listSourceFiles(directory).map((path) => ({
      path: relative(REPO_ROOT, path),
      content: readFileSync(path, "utf8"),
    })),
  );
}

describe("media workflow architecture guardrails", () => {
  it("keeps workflow advancement out of frontend presentation and hook layers", () => {
    const forbiddenPatterns = [
      /\bMediaWorkflowOrchestrator\b/,
      /\badvanceByJobId\b/,
      /\badvanceWorkflow\b/,
      /\breconcileRunnableWorkflows\b/,
      /\benqueueComposeMediaDeferredJob\b/,
      /\benqueueGenerateAudioDeferredJob\b/,
      /\.createWorkflow\(/,
    ];

    const offenders = readFiles([
      "src/hooks",
      "src/frameworks/ui",
      "src/components/jobs",
    ]).flatMap((file) =>
      forbiddenPatterns
        .filter((pattern) => pattern.test(file.content))
        .map((pattern) => `${file.path} matched ${pattern.source}`),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps chat and jobs surfaces on the canonical workflow read projection", () => {
    const requiredReferences = new Map([
      ["src/adapters/ChatPresenter.ts", ["filterPrimaryJobSnapshotsForWorkflows", "CanonicalMediaWorkflowSnapshot"]],
      ["src/hooks/usePresentedChatMessages.ts", ["workflowSnapshots", "CanonicalMediaWorkflowSnapshot"]],
      ["src/hooks/chat/useJobStateStore.ts", ["useWorkflowStateStore", "CanonicalMediaWorkflowSnapshot"]],
      ["src/app/api/chat/jobs/route.ts", ["MediaWorkflowReadModel", "listConversationWorkflows"]],
      ["src/app/api/jobs/route.ts", ["MediaWorkflowReadModel", "listUserWorkflows"]],
      ["src/components/jobs/JobsWorkspace.tsx", ["EMPTY_WORKFLOWS", "CanonicalMediaWorkflowSnapshot"]],
    ]);

    const missing = [...requiredReferences.entries()].flatMap(([path, needles]) => {
      const content = readFileSync(join(REPO_ROOT, path), "utf8");
      return needles
        .filter((needle) => !content.includes(needle))
        .map((needle) => `${path} missing ${needle}`);
    });

    expect(missing).toEqual([]);
  });

  it("keeps job status tools classified as diagnostics instead of media workflow orchestration", () => {
    const jobCapabilityContent = readFileSync(
      join(REPO_ROOT, "src/core/capability-catalog/families/job-capabilities.ts"),
      "utf8",
    );
    const profileCapabilityContent = readFileSync(
      join(REPO_ROOT, "src/core/capability-catalog/families/profile-capabilities.ts"),
      "utf8",
    );

    expect(jobCapabilityContent).toContain("explicit inspection and diagnostics");
    expect(jobCapabilityContent).toContain("do not repeatedly poll unchanged job status as a waiting loop");
    expect(profileCapabilityContent).toContain("explicit inspection and diagnostics");
    expect(profileCapabilityContent).toContain("do not repeatedly poll unchanged job status as a waiting loop");
  });
});
