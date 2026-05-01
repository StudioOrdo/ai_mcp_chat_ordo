// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TranscriptRecallCard } from "./TranscriptRecallCard";

describe("TranscriptRecallCard", () => {
  it("renders transcript recall results with transcript-specific framing", () => {
    render(
      <TranscriptRecallCard
        part={{
          type: "job_status",
          jobId: "job_transcript_1",
          toolName: "search_my_conversations",
          label: "Transcript Recall",
          status: "succeeded",
        }}
        toolCall={{
          name: "search_my_conversations",
          args: { query: "pricing", max_results: 3 },
          result: "1. [high] (turn 4)\nWe discussed pricing assumptions.",
        }}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Past conversation turns" })).toBeInTheDocument();
    expect(screen.getByText("Transcript matches")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Transcript excerpts/i }));
    expect(screen.getByText(/We discussed pricing assumptions\./)).toBeInTheDocument();
  });
});
