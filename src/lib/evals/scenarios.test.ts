import { describe, expect, it } from "vitest";

import { getEvalScenarioById, validateEvalCatalog } from "./scenarios";

const STATUS_TOOL_CLASSIFICATIONS = [
  {
    scenarioId: "member-job-status-summary-deterministic",
    classification: "explicit_status",
    expectedBehavior: { policy: "must_use", toolIds: ["list_my_jobs"] },
  },
  {
    scenarioId: "member-explicit-job-status-deterministic",
    classification: "explicit_status",
    expectedBehavior: { policy: "must_use", toolIds: ["get_my_job_status"] },
  },
  {
    scenarioId: "member-all-jobs-list-deterministic",
    classification: "explicit_status",
    expectedBehavior: { policy: "must_use", toolIds: ["list_my_jobs"] },
  },
  {
    scenarioId: "blog-job-status-continuity-deterministic",
    classification: "diagnostic_status",
    expectedBehavior: { policy: "must_use", toolIds: ["list_deferred_jobs", "get_deferred_job_status"] },
  },
  {
    scenarioId: "blog-explicit-status-check-deterministic",
    classification: "explicit_status",
    expectedBehavior: { policy: "must_use", toolIds: ["list_deferred_jobs", "get_deferred_job_status"] },
  },
  {
    scenarioId: "blog-job-dedupe-clarity-deterministic",
    classification: "reuse_diagnostic",
    expectedBehavior: { policy: "must_use", toolIds: ["list_deferred_jobs", "get_deferred_job_status"] },
  },
  {
    scenarioId: "live-blog-job-status-and-publish-handoff",
    classification: "publish_handoff",
    expectedBehavior: { policy: "must_use", toolIds: ["list_deferred_jobs", "get_deferred_job_status", "publish_content"] },
  },
  {
    scenarioId: "live-blog-job-reuse-instead-of-rerun",
    classification: "reuse_diagnostic",
    expectedBehavior: { policy: "must_use", toolIds: ["list_deferred_jobs", "get_deferred_job_status"] },
  },
  {
    scenarioId: "blog-missed-sse-recovery-deterministic",
    classification: "event_reconciliation_recovery",
    expectedBehavior: { policy: "recover", toolIds: [] },
  },
  {
    scenarioId: "live-blog-completion-recovery",
    classification: "event_reconciliation_recovery",
    expectedBehavior: { policy: "recover", toolIds: [] },
  },
] as const;

function getBehaviorPolicies(scenarioId: string) {
  return getEvalScenarioById(scenarioId).expectedToolBehaviors.map((behavior) => ({
    policy: behavior.policy,
    toolIds: behavior.toolIds,
  }));
}

describe("eval scenario status-tool guardrails", () => {
  it("keeps the eval catalog valid", () => {
    expect(validateEvalCatalog()).toEqual([]);
  });

  it("classifies every job-status eval as explicit status, diagnostics, handoff, or recovery", () => {
    const classifications = STATUS_TOOL_CLASSIFICATIONS.map((entry) => entry.classification);

    expect(classifications).toEqual(expect.arrayContaining([
      "explicit_status",
      "diagnostic_status",
      "reuse_diagnostic",
      "publish_handoff",
      "event_reconciliation_recovery",
    ]));

    for (const entry of STATUS_TOOL_CLASSIFICATIONS) {
      expect(getBehaviorPolicies(entry.scenarioId)).toContainEqual(entry.expectedBehavior);
    }
  });

  it("keeps explicit status-check scenarios on status-tool must-use policies", () => {
    expect(getBehaviorPolicies("member-job-status-summary-deterministic")).toContainEqual({
      policy: "must_use",
      toolIds: ["list_my_jobs"],
    });
    expect(getBehaviorPolicies("member-explicit-job-status-deterministic")).toContainEqual({
      policy: "must_use",
      toolIds: ["get_my_job_status"],
    });
    expect(getBehaviorPolicies("member-all-jobs-list-deterministic")).toContainEqual({
      policy: "must_use",
      toolIds: ["list_my_jobs"],
    });
    expect(getBehaviorPolicies("blog-explicit-status-check-deterministic")).toContainEqual({
      policy: "must_use",
      toolIds: ["list_deferred_jobs", "get_deferred_job_status"],
    });
  });

  it("does not require status tools for missed-SSE or completion recovery proof", () => {
    expect(getBehaviorPolicies("blog-missed-sse-recovery-deterministic")).toEqual([
      { policy: "recover", toolIds: [] },
    ]);
    expect(getBehaviorPolicies("live-blog-completion-recovery")).toEqual([
      { policy: "recover", toolIds: [] },
    ]);
  });
});