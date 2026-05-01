// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { chatMessageViewportSpy } = vi.hoisted(() => ({
  chatMessageViewportSpy: vi.fn(),
}));

vi.mock("./ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock("./ChatMessageViewport", async () => {
  const React = await import("react");
  const { useToolPluginRegistry } = await import("./chat/registry/ToolPluginContext");
  const { createDefaultToolRegistry } = await import("./chat/registry/default-tool-registry");

  const expectedRenderer = createDefaultToolRegistry().getRenderer("generate_graph");

  const ViewportProbe = (props: { "data-renderer"?: string }) => {
    chatMessageViewportSpy(props);
    const registry = useToolPluginRegistry();
    const renderer = registry.getRenderer("generate_graph");

    return React.createElement(
      "div",
      {
        "data-testid": "tool-registry-probe",
        "data-renderer": renderer === expectedRenderer ? "custom" : "fallback",
      },
      renderer === expectedRenderer ? "custom" : "fallback",
    );
  };

  return {
    ChatMessageViewport: ViewportProbe,
    MemoizedChatMessageViewport: React.memo(ViewportProbe),
  };
});

import { ChatContentSurface } from "./ChatContentSurface";

function buildProps() {
  return {
    activeTrigger: null,
    canSend: true,
    canStopStream: false,
    dynamicSuggestions: [],
    input: "",
    inputRef: { current: null },
    isEmbedded: true,
    isFullScreen: false,
    isHeroState: false,
    isLoadingMessages: false,
    isSending: false,
    mentionIndex: 0,
    messages: [],
    onFileDrop: vi.fn(),
    onFileRemove: vi.fn(),
    onFileSelect: vi.fn(),
    onInputChange: vi.fn(),
    onLinkClick: vi.fn(),
    onActionClick: vi.fn(),
    onMentionIndexChange: vi.fn(),
    onSend: vi.fn(),
    onSuggestionClick: vi.fn(),
    onSuggestionSelect: vi.fn(),
    pendingFiles: [],
    productExperienceState: "conversation-history" as const,
    productExperienceSummary: null,
    scrollDependency: 0,
    searchQuery: "",
    suggestions: [],
  };
}

describe("ChatContentSurface", () => {
  it("provides the default tool registry to the message viewport", () => {
    render(<ChatContentSurface {...buildProps()} />);

    expect(screen.getByTestId("tool-registry-probe")).toHaveAttribute("data-renderer", "custom");
  });

  it("renders a canonical product experience summary above the transcript", () => {
    render(
      <ChatContentSurface
        {...buildProps()}
        productExperienceState="returning-active"
        productExperienceSummary={{
          headline: "Revenue follow-up workspace",
          objective: "Review the open launch plan",
          nextStep: "Open the jobs workspace and resolve the failed render.",
          statPills: ["1 item needs attention", "2 assets"],
          workflow: {
            modeLabel: "Revenue",
            originLabel: "Lead queue",
            relatedLabels: ["Launch plan", "Founding consult"],
            blockerLabel: "Setup details missing",
            actionLabel: "Continue business workflow",
            action: { label: "Continue business workflow", actionType: "route", value: "/jobs" },
          },
          transition: {
            modeLabel: "Community Affiliate",
            statusLabel: "Sharing",
            shareLabel: "Referral sharing ready",
            referralCode: "ORDO-42",
            actionLabel: "Share your referral QR",
            action: { label: "Share your referral QR", actionType: "route", value: "/referrals" },
          },
          jobs: {
            activeCount: 1,
            attentionCount: 1,
            items: [
              {
                id: "job_1",
                title: "Render launch plan",
                summary: "Failed at export stage",
                statusLabel: "Needs attention",
                action: { label: "Open jobs", actionType: "route", value: "/jobs" },
              },
            ],
            action: { label: "Open jobs", actionType: "route", value: "/jobs" },
          },
          assets: {
            count: 2,
            items: [
              { id: "asset_1", title: "Image asset", subtitle: "Ready" },
            ],
            action: { label: "Open media", actionType: "route", value: "/my/media" },
          },
          memory: {
            summary: "The operator wants to keep the launch offer concise.",
            typeLabel: "Preference",
            confidenceLabel: "88% confidence",
          },
        }}
      />,
    );

    expect(screen.getByText("Review the open launch plan")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Community Affiliate")).toBeInTheDocument();
    expect(screen.getByText("Render launch plan")).toBeInTheDocument();
    expect(screen.getByText("Open media")).toBeInTheDocument();
    expect(screen.getByText("The operator wants to keep the launch offer concise.")).toBeInTheDocument();
    expect(screen.getByTestId("tool-registry-probe").closest("[data-product-experience-state='returning-active']")).not.toBeNull();
  });

  it("does not render the legacy bottom progress rail", () => {
    render(
      <ChatContentSurface
        {...buildProps()}
        productExperienceState="returning-blocked"
        productExperienceSummary={{
          headline: "Launch workspace",
          objective: "Resolve the failed render",
          nextStep: "Open the jobs workspace.",
          statPills: ["1 item needs attention"],
          workflow: null,
          transition: null,
          jobs: {
            activeCount: 0,
            attentionCount: 1,
            items: [
              {
                id: "job_1",
                title: "Render launch plan",
                summary: "Export step failed",
                statusLabel: "Needs attention",
                action: { label: "Open jobs", actionType: "route", value: "/jobs" },
              },
            ],
            action: { label: "Open jobs", actionType: "route", value: "/jobs" },
          },
          assets: null,
          memory: null,
        }}
      />,
    );

    expect(screen.queryByTestId("chat-progress-strip")).toBeNull();
    expect(document.querySelector("[data-chat-bottom-rail='true']")).toBeNull();
    expect(screen.getByText("Render launch plan")).toBeInTheDocument();
  });
});