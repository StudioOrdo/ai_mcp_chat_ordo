// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InspectThemeCard } from "./InspectThemeCard";
import { JournalWorkflowCard } from "./JournalWorkflowCard";
import { ProfileCard } from "./ProfileCard";
import { ReferralQrCard } from "./ReferralQrCard";
import { WebSearchCard } from "./WebSearchCard";
import type { ToolPluginProps } from "../../registry/types";

function createRunningPart(toolName: string, label: string) {
  return {
    type: "job_status" as const,
    jobId: `job_${toolName}`,
    toolName,
    label,
    status: "running" as const,
    progressLabel: "Working",
  };
}

function renderCard(
  Component: React.ComponentType<ToolPluginProps>,
  part: ToolPluginProps["part"],
  props: Partial<ToolPluginProps> = {},
) {
  render(
    <Component
      part={part}
      isStreaming={false}
      {...props}
    />,
  );
}

describe("custom tool card compliance", () => {
  it("falls back instead of rendering null when inspect theme has no tool call", () => {
    renderCard(InspectThemeCard, createRunningPart("inspect_theme", "Inspect Theme"));

    expect(screen.getByText("Inspect Theme")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back instead of rendering null when profile payload is invalid", () => {
    renderCard(ProfileCard, createRunningPart("get_my_profile", "Get My Profile"), {
      toolCall: {
        name: "get_my_profile",
        args: {},
        result: { action: "get_my_profile" },
      },
    });

    expect(screen.getByText("Get My Profile")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back instead of rendering null when referral qr payload is invalid", () => {
    renderCard(ReferralQrCard, createRunningPart("get_my_referral_qr", "Get My Referral Qr"), {
      toolCall: {
        name: "get_my_referral_qr",
        args: {},
        result: { action: "get_my_referral_qr" },
      },
    });

    expect(screen.getByText("Get My Referral Qr")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back instead of rendering a blank web search when query args are missing", () => {
    renderCard(WebSearchCard, createRunningPart("admin_web_search", "Admin Web Search"), {
      toolCall: {
        name: "admin_web_search",
        args: {},
        result: "Success. Web search results rendered in the chat UI.",
      },
    });

    expect(screen.getByText("Admin Web Search")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back instead of rendering malformed preference payloads", () => {
    renderCard(ProfileCard, createRunningPart("set_preference", "Set Preference"), {
      toolCall: {
        name: "set_preference",
        args: { key: "preferred_name", value: "Keith" },
        result: "not json",
      },
    });

    expect(screen.getByText("Set Preference")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back instead of rendering malformed journal payloads", () => {
    renderCard(JournalWorkflowCard, createRunningPart("list_journal_posts", "List Journal Posts"), {
      toolCall: {
        name: "list_journal_posts",
        args: {},
        result: { action: "list_journal_posts" },
      },
    });

    expect(screen.getByText("List Journal Posts")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("falls back instead of refetching when a completed web search lacks a structured payload", () => {
    renderCard(WebSearchCard, {
      type: "job_status",
      jobId: "job_admin_web_search_completed",
      toolName: "admin_web_search",
      label: "Admin Web Search",
      status: "succeeded",
      summary: "Completed",
    }, {
      toolCall: {
        name: "admin_web_search",
        args: { query: "ordo site architecture" },
        result: "Success. Web search results rendered in the chat UI.",
      },
    });

    expect(screen.getByText("Admin Web Search")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});