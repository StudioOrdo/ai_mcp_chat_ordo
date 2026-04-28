// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";

import { SystemJobCard } from "./SystemJobCard";

const descriptor: CapabilityPresentationDescriptor = {
  toolName: "draft_content",
  family: "editorial",
  label: "Draft Content",
  cardKind: "editorial_workflow",
  executionMode: "deferred",
  progressMode: "single",
  historyMode: "payload_snapshot",
  defaultSurface: "conversation",
  artifactKinds: [],
  supportsRetry: "whole_job",
};

const runningPart: JobStatusMessagePart = {
  type: "job_status",
  jobId: "job_compact_1",
  toolName: "draft_content",
  label: "Draft Content",
  status: "running",
  progressPercent: 40,
  progressLabel: "Revising",
};

const runningEnvelope: CapabilityResultEnvelope = {
  schemaVersion: 1,
  toolName: "draft_content",
  family: "editorial",
  cardKind: "editorial_workflow",
  executionMode: "deferred",
  inputSnapshot: { slug: "ai-governance-playbook" },
  summary: {
    title: "AI Governance Playbook",
    message: "Working through revisions.",
  },
  progress: {
    percent: 40,
    label: "Revising",
    phases: [
      { key: "compose", label: "Compose", status: "succeeded" },
      { key: "qa", label: "QA", status: "active", percent: 40 },
    ],
  },
  artifacts: [],
  payload: null,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SystemJobCard (compact inline notice)", () => {
  it("defaults to a compact summary row with label, progress meta, and status", () => {
    vi.setSystemTime(new Date("2026-04-10T12:06:23.000Z"));
    render(
      <SystemJobCard
        part={{
          ...runningPart,
          attemptCount: 2,
          maxAttempts: 3,
          startedAt: "2026-04-10T12:05:00.000Z",
        }}
        descriptor={descriptor}
        resultEnvelope={runningEnvelope}
        isStreaming={false}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Draft Content/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle.textContent ?? "").toMatch(/Attempt 2 of 3/);
    expect(toggle.textContent ?? "").toMatch(/Revising 40%/);
    expect(toggle.textContent ?? "").toMatch(/Running · 1m 23s/);

    // Heavy body content is hidden by default.
    expect(screen.queryByText("Compose")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View details" })).not.toBeInTheDocument();
  });

  it("expands to reveal timeline phases and detail drawer trigger, then collapses again", () => {
    vi.setSystemTime(new Date("2026-04-10T12:06:23.000Z"));
    render(
      <SystemJobCard
        part={{
          ...runningPart,
          attemptCount: 2,
          maxAttempts: 3,
          startedAt: "2026-04-10T12:05:00.000Z",
          recoveryMode: "checkpoint_resume",
        }}
        descriptor={descriptor}
        resultEnvelope={runningEnvelope}
        isStreaming={false}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Draft Content/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Compose")).toBeInTheDocument();
    expect(screen.getByText("QA")).toBeInTheDocument();
    expect(screen.getByText(/Checkpoint resume/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Compose")).not.toBeInTheDocument();
  });

  it("reports progress with progressbar semantics when a percent is available", () => {
    render(
      <SystemJobCard
        part={runningPart}
        descriptor={descriptor}
        resultEnvelope={runningEnvelope}
        isStreaming={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Draft Content/i }));
    expect(screen.getByRole("progressbar", { name: "Draft Content progress" })).toHaveAttribute("aria-valuenow", "40");
  });

  it("marks the row non-expandable when there is no body content to reveal", () => {
    const minimalPart: JobStatusMessagePart = {
      type: "job_status",
      jobId: "job_compact_minimal",
      toolName: "noop_tool",
      label: "Noop Tool",
      status: "succeeded",
    };

    render(
      <SystemJobCard part={minimalPart} descriptor={undefined} isStreaming={false} />,
    );

    const toggle = screen.getByRole("button", { name: /Noop Tool/i });
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toHaveAttribute("aria-expanded");

    fireEvent.click(toggle);
    expect(screen.queryByText("View details")).not.toBeInTheDocument();
  });

  it("shows completed duration and admin-gated worker identity in expanded details", () => {
    vi.setSystemTime(new Date("2026-04-10T12:10:00.000Z"));
    render(
      <SystemJobCard
        part={{
          type: "job_status",
          jobId: "job_completed_1",
          toolName: "draft_content",
          label: "Draft Content",
          status: "succeeded",
          summary: "Draft is ready.",
          startedAt: "2026-04-10T12:05:00.000Z",
          completedAt: "2026-04-10T12:07:15.000Z",
          claimedBy: "worker_1",
        }}
        descriptor={descriptor}
        isStreaming={false}
        viewerRole="ADMIN"
      />, 
    );

    const toggle = screen.getByRole("button", { name: /Draft Content/i });
    expect(toggle.textContent ?? "").toMatch(/Completed in 2m 15s/);

    fireEvent.click(toggle);
    expect(screen.getByText("Worker")).toBeInTheDocument();
    expect(screen.getByText("worker_1")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("2m 15s")).toBeInTheDocument();
  });

  it("replaces cancel with inline confirmation before dispatching the action", () => {
    const onActionClick = vi.fn();

    render(
      <SystemJobCard
        part={runningPart}
        descriptor={descriptor}
        resultEnvelope={runningEnvelope}
        isStreaming={false}
        computedActions={[
          {
            type: "action-link",
            label: "Cancel",
            actionType: "job",
            value: "job_compact_1",
            params: { operation: "cancel" },
          },
        ]}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel (job)" }));
    expect(screen.getByText("Cancel this job?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onActionClick).toHaveBeenCalledWith("job", "job_compact_1", { operation: "cancel" });
  });

  it("allows backing out of inline cancel confirmation", () => {
    const onActionClick = vi.fn();

    render(
      <SystemJobCard
        part={runningPart}
        descriptor={descriptor}
        resultEnvelope={runningEnvelope}
        isStreaming={false}
        computedActions={[
          {
            type: "action-link",
            label: "Cancel",
            actionType: "job",
            value: "job_compact_1",
            params: { operation: "cancel" },
          },
        ]}
        onActionClick={onActionClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel (job)" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.queryByText("Cancel this job?")).not.toBeInTheDocument();
    expect(onActionClick).not.toHaveBeenCalled();
  });

  it("surfaces replay route and asset repairs as structured transparency details", () => {
    render(
      <SystemJobCard
        part={{
          type: "job_status",
          jobId: "job_media_repair_1",
          toolName: "draft_content",
          label: "Draft Content",
          status: "succeeded",
          summary: "Media plan repaired and completed.",
        }}
        descriptor={descriptor}
        resultEnvelope={{
          ...runningEnvelope,
          replaySnapshot: {
            route: "browser_wasm",
            repairs: [
              {
                reference: "hero_audio",
                resolvedAssetId: "hero-audio",
                strategy: "underscore_normalization",
              },
            ],
          },
        }}
        isStreaming={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Draft Content/i }));

    expect(screen.getByText("Route")).toBeInTheDocument();
    expect(screen.getByText("Browser Wasm")).toBeInTheDocument();
    expect(screen.getByText("Repairs")).toBeInTheDocument();
    expect(screen.getByText("1 asset repair")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("Asset repairs")).toBeInTheDocument();
    const repairListItem = screen.getByRole("listitem");
    expect(repairListItem.textContent ?? "").toContain("hero_audio");
    expect(repairListItem.textContent ?? "").toContain("hero-audio");
    expect(repairListItem.textContent ?? "").toContain("Underscore Normalization");
  });

  it("surfaces supersession and retry timing for recovery-driven job states", () => {
    vi.setSystemTime(new Date("2026-04-10T12:06:23.000Z"));

    render(
      <SystemJobCard
        part={{
          type: "job_status",
          jobId: "browser:msg_1:compose_media:18",
          toolName: "compose_media",
          label: "Compose Media",
          status: "dead_letter",
          supersededByJobId: "job_media_deferred_18",
          nextRetryAt: "2026-04-10T12:08:00.000Z",
        }}
        descriptor={{
          ...descriptor,
          toolName: "compose_media",
          label: "Compose Media",
          executionMode: "hybrid",
        }}
        isStreaming={false}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Compose Media/i });
    expect(toggle.textContent ?? "").toMatch(/Retry in 1m 37s/);
    expect(toggle.textContent ?? "").toMatch(/Superseded by job_media_deferred_18/);

    fireEvent.click(toggle);
    expect(screen.getByText("Superseded by")).toBeInTheDocument();
    expect(screen.getByText("job_media_deferred_18")).toBeInTheDocument();
    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("Retry in 1m 37s")).toBeInTheDocument();
  });
});
