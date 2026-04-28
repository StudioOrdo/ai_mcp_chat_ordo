import { describe, expect, it } from "vitest";

import {
  canRerouteBrowserShortExplainerPlan,
  deriveBrowserShortExplainerNarrationOverrides,
} from "./browser-short-explainer";

describe("deriveBrowserShortExplainerNarrationOverrides", () => {
  it("derives title, hook, and closing text from narration copy", () => {
    expect(deriveBrowserShortExplainerNarrationOverrides({
      narrationTitle: "Signal Stack",
      narrationText: "Signal starts at capture. Processing shapes the frame. Finish with a crisp takeaway.",
    })).toEqual({
      title: "Signal Stack",
      hookText: "Signal starts at capture.",
      closingText: "Finish with a crisp takeaway.",
    });
  });

  it("preserves explicit overrides when they are already present", () => {
    expect(deriveBrowserShortExplainerNarrationOverrides({
      existingOverrides: {
        title: "Locked Title",
        hookText: "Existing hook",
      },
      narrationTitle: "Signal Stack",
      narrationText: "Signal starts at capture. Processing shapes the frame. Finish with a crisp takeaway.",
    })).toEqual({
      title: "Locked Title",
      hookText: "Existing hook",
      closingText: "Finish with a crisp takeaway.",
    });
  });
});

describe("canRerouteBrowserShortExplainerPlan", () => {
  it("allows burned browser_short_explainer plans to reroute to the server", () => {
    expect(canRerouteBrowserShortExplainerPlan({
      mode: "browser_short_explainer",
      subtitlePolicy: "burned",
    })).toBe(true);
  });

  it("allows non-burned browser_short_explainer plans to reroute to the server", () => {
    expect(canRerouteBrowserShortExplainerPlan({
      mode: "browser_short_explainer",
      subtitlePolicy: "none",
    })).toBe(true);
  });
});