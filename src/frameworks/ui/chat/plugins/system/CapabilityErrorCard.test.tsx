// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CapabilityErrorCard } from "./CapabilityErrorCard";

vi.mock("../../registry/capability-presentation-registry", () => ({
  resolveCapabilityDisplayLabel: ({ explicitLabel, descriptorLabel, fallbackLabel }: {
    explicitLabel?: string | null;
    descriptorLabel?: string | null;
    fallbackLabel: string;
  }) => explicitLabel?.trim() || descriptorLabel?.trim() || fallbackLabel,
  humanizeCapabilityToolName: (toolName: string) => toolName,
}));

function renderErrorCard(error: string) {
  render(
    <CapabilityErrorCard
      part={{
        type: "job_status",
        jobId: "job_media_1",
        toolName: "compose_media",
        label: "Compose Media",
        status: "failed",
        error,
        failureClass: "terminal",
      }}
      computedActions={[]}
      isStreaming={false}
      onActionClick={vi.fn()}
    />,
  );
}

describe("CapabilityErrorCard", () => {
  it("renders unresolved asset references in the summary", () => {
    renderErrorCard(
      "Compose media plan contains unresolved asset references: signal-stack-chart, signal-stack-narration",
    );

    expect(screen.getByText(/Compose media plan contains unresolved asset references/i)).toBeInTheDocument();
    expect(screen.getByText(/signal-stack-chart/)).toBeInTheDocument();
    expect(screen.getByText(/signal-stack-narration/)).toBeInTheDocument();
  });

  it("preserves long unresolved asset lists in the summary", () => {
    const assets = Array.from({ length: 52 }, (_, index) => `asset-${index + 1}`).join(", ");

    renderErrorCard(`Compose media plan contains unresolved asset references: ${assets}`);

    expect(screen.getByText(/asset-1/)).toBeInTheDocument();
    expect(screen.getByText(/asset-52/)).toBeInTheDocument();
  });

  it("renders the browser capacity error summary", () => {
    renderErrorCard("Local browser execution capacity is full for this capability.");

    expect(screen.getByText("Local browser execution capacity is full for this capability.")).toBeInTheDocument();
  });

  it("renders ffmpeg failures as plain summary text", () => {
    renderErrorCard("ffmpeg exited with code 1. stderr:\nframe=1 fps=0.5\nconversion failed");

    expect(screen.getByText(/ffmpeg exited with code 1/i)).toBeInTheDocument();
    expect(screen.getByText(/conversion failed/i)).toBeInTheDocument();
  });

  it("preserves unknown errors as plain text", () => {
    renderErrorCard("The render pipeline returned an unexpected response.");

    expect(screen.getByText("The render pipeline returned an unexpected response.")).toBeInTheDocument();
    expect(screen.queryByText("Show stderr")).not.toBeInTheDocument();
  });
});