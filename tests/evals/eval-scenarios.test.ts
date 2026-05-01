import { describe, expect, it } from "vitest";

import { EVAL_COHORTS, EVAL_SCENARIOS, getEvalScenarioById, validateEvalCatalog } from "@/lib/evals/scenarios";

describe("eval scenario catalog", () => {
  it("defines a valid cohort and scenario catalog", () => {
    expect(validateEvalCatalog()).toEqual([]);
  });

  it("covers the required first-wave scenario families", () => {
    expect(EVAL_SCENARIOS.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "anonymous-high-intent-dropout",
        "anonymous-signup-continuity",
        "live-anonymous-high-intent-loss",
        "live-anonymous-signup-continuity",
        "organization-buyer-funnel",
        "individual-learner-funnel",
        "development-prospect-funnel",
        "misclassification-reroute",
        "mcp-tool-choice-and-recovery",
        "mcp-tool-avoidance",
        "mcp-calculator-must-use",
        "mcp-multi-tool-synthesis",
        "integrity-canonical-corpus-reference-deterministic",
        "integrity-audio-recovery-deterministic",
        "media-workflow-video-completion-deterministic",
        "integrity-malformed-ui-tags-deterministic",
        "blog-job-status-continuity-deterministic",
        "blog-explicit-status-check-deterministic",
        "blog-job-dedupe-clarity-deterministic",
        "blog-produce-publish-handoff-deterministic",
        "blog-missed-sse-recovery-deterministic",
        "live-runtime-self-knowledge-honesty",
        "live-current-page-truthfulness",
        "live-duplicate-navigation-avoidance",
        "live-blog-job-status-and-publish-handoff",
        "live-blog-job-reuse-instead-of-rerun",
        "live-blog-completion-recovery",
      ]),
    );
  });

  it("references real cohorts from each scenario", () => {
    const cohortIds = new Set(EVAL_COHORTS.map((cohort) => cohort.id));

    for (const scenario of EVAL_SCENARIOS) {
      expect(cohortIds.has(scenario.cohortId)).toBe(true);
    }
  });

  it("exposes scenario lookup by id", () => {
    expect(getEvalScenarioById("mcp-tool-choice-and-recovery")).toMatchObject({
      cohortId: "tool-heavy-researcher",
      layer: "live_model",
    });

    expect(getEvalScenarioById("live-anonymous-signup-continuity")).toMatchObject({
      cohortId: "anonymous-learner",
      layer: "live_model",
    });

    expect(getEvalScenarioById("live-runtime-self-knowledge-honesty")).toMatchObject({
      cohortId: "runtime-integrity-auditor",
      layer: "live_model",
    });

    expect(getEvalScenarioById("media-workflow-video-completion-deterministic")).toMatchObject({
      cohortId: "signed-in-buyer",
      layer: "deterministic",
      expectedToolBehaviors: [
        expect.objectContaining({ policy: "avoid" }),
      ],
    });
  });

  it("covers the MCP no-tool and multi-tool scenario variants", () => {
    expect(getEvalScenarioById("mcp-tool-avoidance")).toMatchObject({
      layer: "deterministic",
      expectedToolBehaviors: [
        expect.objectContaining({ policy: "avoid" }),
      ],
    });

    expect(getEvalScenarioById("mcp-multi-tool-synthesis")).toMatchObject({
      expectedToolBehaviors: [
        expect.objectContaining({ toolIds: ["web_search", "calculator"] }),
      ],
    });

    expect(getEvalScenarioById("mcp-calculator-must-use")).toMatchObject({
      layer: "deterministic",
      expectedToolBehaviors: [
        expect.objectContaining({ policy: "must_use", toolIds: ["calculator"] }),
      ],
    });
  });
});
