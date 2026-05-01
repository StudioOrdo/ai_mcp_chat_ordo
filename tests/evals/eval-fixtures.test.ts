import { describe, expect, it } from "vitest";

import { resolveLiveEvalScenarioFixture } from "@/lib/evals/live-scenarios";
import { resolveDeterministicSeedPack } from "@/lib/evals/seeding";

describe("eval deterministic seed packs", () => {
  it("resolves a deterministic seed pack with stable refs", () => {
    const pack = resolveDeterministicSeedPack("anonymous-signup-continuity");

    expect(pack.seedSetId).toBe("seed-anon-signup-v1");
    expect(pack.refs).toEqual({
      primaryConversationId: "conv_eval_signup_continuity",
      anonymousUserId: "anon_eval_signup",
      authenticatedUserId: "usr_eval_signup",
    });
    expect(pack.conversations[0]?.messages).toHaveLength(2);
  });

  it("rejects live-model scenarios for deterministic seed lookup", () => {
    expect(() => resolveDeterministicSeedPack("organization-buyer-funnel")).toThrow(
      "Scenario organization-buyer-funnel is live_model; deterministic seed packs only support deterministic scenarios.",
    );
  });

  it("includes a positive calculator tool fixture for deterministic tool coverage", () => {
    const pack = resolveDeterministicSeedPack("mcp-calculator-must-use");

    expect(pack.toolFixtures).toEqual([
      expect.objectContaining({
        id: "tool_fixture_calculator_1",
        toolId: "calculator",
        expectedResult: 42,
      }),
    ]);
  });

  it("includes downstream workflow fixtures for deterministic buyer coverage", () => {
    const pack = resolveDeterministicSeedPack("organization-buyer-deterministic");

    expect(pack.conversationEvents).toEqual([
      expect.objectContaining({ type: "organization_lane_confirmed" }),
    ]);
    expect(pack.leads).toEqual([
      expect.objectContaining({ lane: "organization", triageState: "qualified" }),
    ]);
    expect(pack.consultationRequests).toEqual([
      expect.objectContaining({ lane: "organization", status: "reviewed" }),
    ]);
  });

  it("includes a deterministic media workflow fixture for video completion coverage", () => {
    const pack = resolveDeterministicSeedPack("media-workflow-video-completion-deterministic");

    expect(pack.seedSetId).toBe("seed-media-workflow-video-v1");
    expect(pack.refs).toEqual(
      expect.objectContaining({
        primaryConversationId: "conv_eval_media_workflow_video",
        authenticatedUserId: "usr_eval_media_workflow",
      }),
    );
    expect(pack.conversations[0]?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("short video") }),
        expect.objectContaining({ content: expect.stringContaining("composing the final video") }),
      ]),
    );
  });

  it("defines a live fixture for anonymous signup continuity", () => {
    const fixture = resolveLiveEvalScenarioFixture("live-anonymous-signup-continuity");

    expect(fixture.role).toBe("AUTHENTICATED");
    expect(fixture.seedPack.refs).toEqual(
      expect.objectContaining({
        primaryConversationId: "conv_eval_live_signup_continuity",
        anonymousUserId: "anon_eval_live_signup",
        authenticatedUserId: "usr_eval_live_signup",
      }),
    );
    expect(fixture.promptMessages).toEqual([
      expect.objectContaining({ role: "user" }),
    ]);
  });
});
