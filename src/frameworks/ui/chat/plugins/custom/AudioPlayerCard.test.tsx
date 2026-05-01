// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AudioPlayer", () => ({
  AudioPlayer: ({ title, provider, assetId }: { title: string; provider?: string; assetId?: string }) => (
    <div data-testid="mock-audio-player">
      {title}:{provider ?? "no-provider"}:{assetId ?? "no-asset"}
    </div>
  ),
}));

import { AudioPlayerCard } from "./AudioPlayerCard";
import type { ToolPluginProps } from "../../registry/types";

function createPart(overrides: Partial<NonNullable<ToolPluginProps["part"]>> = {}) {
  return {
    type: "job_status" as const,
    jobId: "job_audio_1",
    toolName: "generate_audio",
    label: "Generate Audio",
    status: "succeeded" as const,
    ...overrides,
  };
}

describe("AudioPlayerCard", () => {
  it("renders canonical structured audio payloads inside the shared artifact shell", async () => {
    render(
      <AudioPlayerCard
        part={createPart({
          resultPayload: {
            action: "generate_audio",
            title: "Founder memo",
            text: "Weekly review audio",
            assetId: "uf_audio_1",
            provider: "user-file-cache",
            generationStatus: "cached_asset",
            estimatedDurationSeconds: 12,
            estimatedGenerationSeconds: 3,
          },
        })}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole("region", { name: "Generate Audio result" })).toHaveAttribute(
      "data-capability-card",
      "true",
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(await screen.findByTestId("mock-audio-player")).toHaveTextContent(
      "Founder memo:user-file-cache:uf_audio_1",
    );
  });

  it("does not render product audio controls from direct transcript payloads", () => {
    render(
      <AudioPlayerCard
        toolCall={{
          name: "generate_audio",
          args: { title: "Founder memo", text: "Weekly review audio" },
          result: {
            action: "generate_audio",
            title: "Founder memo",
            text: "Weekly review audio",
            assetId: "uf_audio_direct_1",
            provider: "user-file-cache",
            generationStatus: "cached_asset",
          },
        }}
        isStreaming={false}
      />,
    );

    expect(screen.queryByTestId("mock-audio-player")).not.toBeInTheDocument();
  });

  it("renders canonical failure metadata for terminal audio jobs", () => {
    render(
      <AudioPlayerCard
        part={createPart({
          status: "failed",
          lifecyclePhase: "generation_failed_terminal",
          failureStage: "asset_generation",
          failureCode: "tts_provider_failed",
          error: "Speech provider failed.",
          title: "Founder memo",
        })}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole("alert", { name: "Generate Audio result" })).toBeInTheDocument();
    expect(screen.getByText("Speech provider failed.")).toBeInTheDocument();
    expect(screen.getByText("Asset Generation")).toBeInTheDocument();
    expect(screen.getByText("tts_provider_failed")).toBeInTheDocument();
  });

  it("renders playable audio when failed status still carries a durable asset", async () => {
    render(
      <AudioPlayerCard
        part={createPart({
          status: "failed",
          lifecyclePhase: "durable_asset_available",
          failureStage: "recovery",
          failureCode: "fallback_required",
          error: "Local browser execution was interrupted and must reroute to the server.",
          resultPayload: {
            action: "generate_audio",
            title: "Founder memo",
            text: "Weekly review audio",
            assetId: "uf_6e9cee49-5d47-4497-89d2-0171e4b73b36",
            provider: "user-file-cache",
            generationStatus: "cached_asset",
            estimatedDurationSeconds: 18,
            estimatedGenerationSeconds: 4,
          },
        })}
        isStreaming={false}
      />,
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: "Generate Audio result" })).not.toBeInTheDocument();
    expect(await screen.findByTestId("mock-audio-player")).toHaveTextContent(
      "Founder memo:user-file-cache:uf_6e9cee49-5d47-4497-89d2-0171e4b73b36",
    );
  });
});
