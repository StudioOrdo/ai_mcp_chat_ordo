import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PeopleStageChip } from "./PeopleStageChip";

describe("PeopleStageChip", () => {
  it("renders a relationship stage label with an evidence-backed count", () => {
    render(<PeopleStageChip label="Offer" count={2} />);

    expect(screen.getByText("Offer")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(document.querySelector('[data-people-stage-chip="Offer"]')).not.toBeNull();
  });
});
