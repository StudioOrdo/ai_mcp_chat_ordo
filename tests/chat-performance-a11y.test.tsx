import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import fs from "node:fs";
import path from "node:path";

/* ── CSS performance foundations ── */

const chatCss = fs.readFileSync(
  path.resolve(__dirname, "../src/app/styles/chat.css"),
  "utf-8",
);

describe("chat CSS performance foundations", () => {
  it("applies content-visibility: auto to off-screen messages", () => {
    expect(chatCss).toContain("content-visibility: auto");
    expect(chatCss).toContain("contain-intrinsic-size: auto 120px");
  });

  it("sets overflow-anchor for stable scroll", () => {
    expect(chatCss).toContain("overflow-anchor: auto");
    expect(chatCss).toContain("overflow-anchor: none");
  });

  it("includes View Transitions API progressive enhancement", () => {
    expect(chatCss).toContain("@supports (view-transition-name: none)");
    expect(chatCss).toContain("view-transition-name: chat-typing-indicator");
    expect(chatCss).toContain("view-transition-name: chat-suggestion-band");
  });

  it("includes @starting-style for suggestion entry animation", () => {
    expect(chatCss).toContain("@starting-style");
    expect(chatCss).toContain(".ui-chat-suggestion-band-entry");
  });
});

/* ── Plugin card ARIA coverage ── */

import { InspectThemeCard } from "@/frameworks/ui/chat/plugins/custom/InspectThemeCard";
import { ProfileCard } from "@/frameworks/ui/chat/plugins/custom/ProfileCard";
import { ReferralQrCard } from "@/frameworks/ui/chat/plugins/custom/ReferralQrCard";
import { JournalWorkflowCard } from "@/frameworks/ui/chat/plugins/custom/JournalWorkflowCard";
import { AudioPlayerCard } from "@/frameworks/ui/chat/plugins/custom/AudioPlayerCard";
import { ErrorCard } from "@/frameworks/ui/chat/plugins/system/ErrorCard";

describe("plugin card ARIA roles", () => {
  it("InspectThemeCard renders role=region", () => {
    const toolCall = {
      name: "inspect_theme",
      args: {},
      result: {
        action: "inspect_theme",
        message: "Current theme state",
        supported_theme_ids: ["sacred", "liturgical"],
        ordered_theme_profiles: [
          {
            id: "sacred",
            name: "Sacred",
            motionIntent: "calm",
            shadowIntent: "soft",
            densityDefaults: { standard: "normal", dataDense: "compact", touch: "relaxed" },
            primaryAttributes: ["reverent"],
          },
        ],
        approved_control_axes: [
          { id: "motion", label: "Motion", options: ["calm", "dynamic"], defaultValue: "calm", mutationTools: ["adjust_ui"] },
        ],
        active_theme_state: { available: true, reason: "" },
      },
    };
    const { container } = render(<InspectThemeCard toolCall={toolCall} isStreaming={false} />);
    const region = container.querySelector("[role='region']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Inspect Theme result");
  });

  it("ProfileCard renders role=region", () => {
    const toolCall = {
      name: "get_my_profile",
      args: {},
      result: {
        action: "get_my_profile",
        profile: {
          name: "Test User",
          email: "test@example.com",
          affiliate_enabled: false,
        },
      },
    };
    const { container } = render(<ProfileCard toolCall={toolCall} isStreaming={false} />);
    const region = container.querySelector("[role='region']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Get My Profile result");
  });

  it("ReferralQrCard renders role=region", () => {
    const toolCall = {
      name: "get_my_referral_qr",
      args: {},
      result: {
        action: "get_my_referral_qr",
        referral_code: "ABC123",
        referral_url: "https://example.com/r/ABC123",
        qr_code_url: "https://example.com/qr/ABC123.png",
      },
    };
    const { container } = render(<ReferralQrCard toolCall={toolCall} isStreaming={false} />);
    const region = container.querySelector("[role='region']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Get My Referral QR result");
  });

  it("JournalWorkflowCard renders role=region", () => {
    const toolCall = {
      name: "get_journal_workflow_summary",
      args: {},
      result: {
        action: "get_journal_workflow_summary",
        summary: "Queue overview",
        counts: { draft: 1, review: 0, approved: 0, blocked: 0, ready_to_publish: 0, active_jobs: 0 },
      },
    };
    const { container } = render(<JournalWorkflowCard toolCall={toolCall} isStreaming={false} />);
    const region = container.querySelector("[role='region']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Journal workflow result");
  });

  it("AudioPlayerCard renders role=region from canonical job state", () => {
    const part = {
      type: "job_status" as const,
      jobId: "job_audio_a11y_1",
      toolName: "generate_audio",
      label: "Generate Audio",
      status: "succeeded" as const,
      resultPayload: {
        action: "generate_audio",
        title: "Test Audio",
        text: "Hello world",
        assetId: "uf_audio_a11y_1",
        provider: "user-file-cache",
        generationStatus: "cached_asset" as const,
        estimatedDurationSeconds: 30,
        estimatedGenerationSeconds: 5,
      },
    };
    const { container } = render(<AudioPlayerCard part={part} isStreaming={false} />);
    const region = container.querySelector("[role='region']");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Generate Audio result");
  });

  it("ErrorCard renders role=alert", () => {
    const part = {
      type: "job_status" as const,
      jobId: "err-1",
      toolName: "test_tool",
      label: "Test Tool",
      status: "failed" as const,
      summary: "Something went wrong",
      progressPercent: null,
      progressLabel: null,
      title: undefined,
      subtitle: undefined,
      error: "Connection refused",
    };
    const { container } = render(<ErrorCard part={part} isStreaming={false} />);
    const alert = container.querySelector("[role='alert']");
    // ErrorCard sets role=alert but delegates aria-live handling to parent context or uses polite
    expect(alert).not.toBeNull();
  });
});
