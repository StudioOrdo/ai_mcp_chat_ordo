// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelationshipMemoryCard } from "./RelationshipMemoryCard";

describe("RelationshipMemoryCard", () => {
  it("renders relationship-memory results with continuity-specific framing", () => {
    render(
      <RelationshipMemoryCard
        part={{
          type: "job_status",
          jobId: "job_memory_1",
          toolName: "search_relationship_memory",
          label: "Relationship Memory",
          status: "succeeded",
        }}
        toolCall={{
          name: "search_relationship_memory",
          args: { query: "launch", memory_types: ["goal"] },
          result: "1. [goal] Launch the revenue triage offer this month.",
        }}
        isStreaming={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Continuity memory" })).toBeInTheDocument();
    expect(screen.getByText("Memory matches")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Memory details/i }));
    expect(screen.getAllByText(/Launch the revenue triage offer this month\./)).toHaveLength(2);
  });
});
