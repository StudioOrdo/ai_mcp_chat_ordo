import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CanonicalMediaWorkflowSnapshot } from "@/lib/media/workflows/media-workflow-read-model";

import { MediaWorkflowCard } from "./MediaWorkflowCard";

function makeWorkflow(overrides: Partial<CanonicalMediaWorkflowSnapshot> = {}): CanonicalMediaWorkflowSnapshot {
  return {
    workflowId: "mwf_1",
    conversationId: "conv_1",
    userId: "usr_1",
    title: "Bloom video",
    requestedDeliverable: "video",
    status: "running",
    stage: { key: "compose_media", label: "Compose video", progressPercent: 50 },
    steps: [
      { stepId: "step_audio", kind: "generate_audio", status: "ready", jobId: "job_audio", assetId: "uf_audio", label: "Generate audio" },
      { stepId: "step_compose", kind: "compose_media", status: "running", jobId: "job_compose", assetId: null, label: "Compose video" },
    ],
    finalArtifact: null,
    failure: { code: null, message: null },
    linkedJobIds: ["job_audio", "job_compose"],
    linkedJobs: [],
    originMessageId: "msg_assistant",
    originTurnId: null,
    createdAt: "2026-05-01T17:00:00.000Z",
    updatedAt: "2026-05-01T17:01:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("MediaWorkflowCard", () => {
  it("renders running workflow stage and dependency rows", () => {
    render(<MediaWorkflowCard workflow={makeWorkflow()} />);

    expect(screen.getByLabelText("Bloom video workflow Running")).toHaveTextContent("Bloom video");
    expect(screen.getByText("Generate audio")).toBeInTheDocument();
    expect(screen.getAllByText("Compose video").length).toBeGreaterThan(0);
  });

  it("renders completed video workflows through the media player card", () => {
    render(<MediaWorkflowCard workflow={makeWorkflow({
      status: "succeeded",
      stage: { key: "succeeded", label: "Video ready", progressPercent: 100 },
      finalArtifact: { assetId: "uf_video_done", kind: "video" },
      completedAt: "2026-05-01T17:02:00.000Z",
    })} />);

    expect(screen.getByLabelText("Media render result")).toHaveTextContent("Bloom video");
    expect(screen.getByLabelText("video asset")).toHaveAttribute("src", "/api/user-files/uf_video_done");
  });
});
