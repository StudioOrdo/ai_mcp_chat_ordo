import { describe, expect, it } from "vitest";

import { buildCoachPayloadForLifecycle } from "./coach-templates";
import type { LifecyclePayload, LifecycleVariant } from "@/core/entities/lifecycle";

function makeEvent(variant: LifecycleVariant): LifecyclePayload {
  return { variant, occurredAt: "2026-04-22T00:00:00.000Z" };
}

describe("buildCoachPayloadForLifecycle", () => {
  it("returns a coach payload for installed", () => {
    const payload = buildCoachPayloadForLifecycle(makeEvent("installed"));
    if (!payload) throw new Error("expected non-null payload for installed");
    expect(payload.variant).toBe("installed");
    expect(payload.steps.length).toBeGreaterThan(0);
    expect(payload.steps[0]?.status).toBe("active");
    expect(payload.currentStep).toBe(0);
  });

  it.each<LifecycleVariant>(["onboarded", "role_changed", "tier_upgraded"])(
    "returns a non-null coach payload for %s",
    (variant) => {
      const payload = buildCoachPayloadForLifecycle(makeEvent(variant));
      if (!payload) throw new Error(`expected non-null payload for ${variant}`);
      expect(payload.variant).toBe(variant);
      expect(payload.actions.length).toBeGreaterThan(0);
    },
  );

  it("returns null for capability_unlocked (no generic template yet)", () => {
    const payload = buildCoachPayloadForLifecycle(makeEvent("capability_unlocked"));
    expect(payload).toBeNull();
  });

  it("never drafts steps that reference premium-only content for the default tier user", () => {
    const upgraded = buildCoachPayloadForLifecycle(makeEvent("tier_upgraded"));
    const installed = buildCoachPayloadForLifecycle(makeEvent("installed"));
    if (!upgraded || !installed) throw new Error("expected both templates to resolve");
    const installedCopy = `${installed.title} ${installed.subtitle ?? ""} ${installed.steps.map((s) => `${s.label} ${s.detail ?? ""}`).join(" ")}`;
    expect(installedCopy.toLowerCase()).not.toContain("premium");
    expect(
      `${upgraded.title} ${upgraded.subtitle ?? ""}`.toLowerCase(),
    ).toContain("premium");
  });
});
