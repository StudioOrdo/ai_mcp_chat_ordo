import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { JobEvent, JobRequest } from "@/core/entities/job";
import { buildCanonicalJobSnapshot } from "@/lib/jobs/job-read-model";

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = join(process.cwd(), relativeDir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry}`;
    const absolutePath = join(process.cwd(), relativePath);

    if (statSync(absolutePath).isDirectory()) {
      return listSourceFiles(relativePath);
    }

    if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) {
      return [];
    }

    if (relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx")) {
      return [];
    }

    return [relativePath];
  });
}

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

function sourceFilesContaining(pattern: RegExp): string[] {
  return listSourceFiles("src")
    .filter((path) => pattern.test(readSource(path)))
    .sort();
}

function makeJob(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    id: "job_origin_bridge_1",
    conversationId: "conv_origin_1",
    userId: "usr_origin_1",
    toolName: "generate_blog_image",
    status: "queued",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: { prompt: "A luminous library" },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: "rerun",
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: "2026-04-30T20:29:48.067Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-04-30T20:29:48.069Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    id: "evt_origin_bridge_1",
    jobId: "job_origin_bridge_1",
    conversationId: "conv_origin_1",
    sequence: 1,
    eventType: "queued",
    payload: {},
    createdAt: "2026-04-30T20:29:48.069Z",
    ...overrides,
  };
}

describe("Phase 09a job state contract guardrails", () => {
  it("keeps production free of assistant job_status lifecycle writers", () => {
    expect(sourceFilesContaining(/DeferredJobConversationProjector/)).toEqual([]);
    expect(sourceFilesContaining(/createDeferredJobConversationProjector/)).toEqual([]);
    expect(sourceFilesContaining(/parts:\s*\[\s*nextPart\s*\]/)).toEqual([]);
    expect(sourceFilesContaining(/assistantParts\.push\(deferredJobResultToMessagePart/)).toEqual([]);
    expect(sourceFilesContaining(/assistantParts\.push\(nextPart\)/)).toEqual([]);
    expect(sourceFilesContaining(/id:\s*messageId\s*\?\?\s*`job_\$\{part\.jobId\}`/)).toEqual([]);
  });

  it("keeps deterministic job-message ids out of product chat placement", () => {
    expect(sourceFilesContaining(/getJobMessageId\(/)).toEqual([
      "src/lib/jobs/job-publication.ts",
      "src/lib/jobs/job-status-snapshots.ts",
      "src/lib/jobs/job-status.ts",
    ]);
  });

  it("keeps product readers off transcript job snapshot extraction", () => {
    expect(sourceFilesContaining(/extractJobStatusSnapshots/)).toEqual([]);
  });

  it("keeps default product message mutation bridges deleted", () => {
    expect(sourceFilesContaining(/upsertJobStatusMessage/)).toEqual([]);
    expect(sourceFilesContaining(/suppressStaleJobStatusMessages/)).toEqual([]);
  });

  it("keeps workspace restore from injecting transcript job-status payloads", () => {
    expect(sourceFilesContaining(/ComposeMediaRestoreHydration/)).toEqual([]);
    expect(sourceFilesContaining(/hydrateComposeMediaResultsFromDurableFiles/)).toEqual([]);
    expect(sourceFilesContaining(/canonical_restore/)).toEqual([]);
  });

  it("documents canonical product snapshots as the job read-model contract", () => {
    const snapshot = buildCanonicalJobSnapshot(makeJob(), makeEvent());

    expect(snapshot).toMatchObject({
      jobId: "job_origin_bridge_1",
      conversationId: "conv_origin_1",
      toolName: "generate_blog_image",
      status: "queued",
      origin: { fallback: "job_created_at" },
    });
    expect(snapshot).not.toHaveProperty("messageId");
    expect(snapshot).not.toHaveProperty("part");
  });

  it("does not encode deferred_job acknowledgement rendering as accepted product behavior", () => {
    expect(sourceFilesContaining(/deferredJobResultToMessagePart/)).toEqual([]);
  });
});
