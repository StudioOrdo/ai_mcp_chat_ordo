import { describe, expect, it } from "vitest";

import {
  getJobPhaseDefinitions,
  normalizeJobProgressState,
  PRODUCE_BLOG_ARTICLE_PHASES,
} from "./job-progress-state";

describe("job-progress-state", () => {
  it("derives compatibility fields from phased produce_blog_article state", () => {
    const state = normalizeJobProgressState({
      toolName: "produce_blog_article",
      activePhaseKey: "qa_blog_article",
      phases: PRODUCE_BLOG_ARTICLE_PHASES.map((phase) => ({
        key: phase.key,
        label: phase.label,
        status:
          phase.key === "compose_blog_article"
            ? "succeeded"
            : phase.key === "qa_blog_article"
              ? "active"
              : "pending",
        percent: phase.key === "qa_blog_article" ? 60 : undefined,
      })),
    });

    expect(state.activePhaseKey).toBe("qa_blog_article");
    expect(state.progressLabel).toBe("Reviewing article");
    expect(state.progressPercent).toBe(42);
    expect(state.phases?.map((phase) => phase.key)).toEqual(PRODUCE_BLOG_ARTICLE_PHASES.map((phase) => phase.key));
  });

  it("returns terminal completion percent when all phases succeeded", () => {
    const state = normalizeJobProgressState({
      toolName: "produce_blog_article",
      phases: PRODUCE_BLOG_ARTICLE_PHASES.map((phase) => ({
        key: phase.key,
        label: phase.label,
        status: "succeeded",
      })),
      activePhaseKey: null,
    });

    expect(state.activePhaseKey).toBeNull();
    expect(state.progressPercent).toBe(100);
    expect(state.progressLabel).toBe("Saving draft");
  });

  it("falls back to legacy progress when no phase state exists", () => {
    expect(normalizeJobProgressState({
      progressPercent: 55,
      progressLabel: "Drafting",
    })).toEqual({
      progressPercent: 55,
      progressLabel: "Drafting",
    });
  });

  it("reads phase definitions from the capability runtime view", () => {
    expect(getJobPhaseDefinitions("compose_media")?.map((phase) => phase.key)).toEqual([
      "staging_assets",
      "rendering_media",
      "packaging_artifacts",
      "persisting",
      "verifying_playback",
    ]);
    expect(getJobPhaseDefinitions("not_a_real_tool")).toBeUndefined();
  });
});