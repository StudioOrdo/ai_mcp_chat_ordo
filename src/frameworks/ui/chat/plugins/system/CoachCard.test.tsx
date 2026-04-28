import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { createCoachEnvelope } from "./coach-descriptor";
import { CoachCard } from "./CoachCard";
import type { CoachPayload } from "@/core/entities/coach";

const basePayload: CoachPayload = {
  variant: "installed",
  title: "Finish setting up your workspace",
  subtitle: "A few quick steps to make the workspace yours.",
  steps: [
    { key: "one", label: "Set identity", status: "active" },
    { key: "two", label: "Ask first question", status: "pending" },
  ],
  currentStep: 0,
  actions: [
    { key: "go", kind: "navigate", label: "Open settings", href: "/admin/settings" },
  ],
};

describe("CoachCard", () => {
  it("renders title, subtitle, and eyebrow sourced from payload", () => {
    const envelope = createCoachEnvelope(basePayload);
    render(<CoachCard envelope={envelope} />);
    expect(screen.getByText("Finish setting up your workspace")).toBeInTheDocument();
    expect(
      screen.getByText("A few quick steps to make the workspace yours."),
    ).toBeInTheDocument();
    expect(screen.getByText("Next steps")).toBeInTheDocument();
  });

  it("renders each step and marks the current step as active", () => {
    const envelope = createCoachEnvelope(basePayload);
    const { container } = render(<CoachCard envelope={envelope} />);
    const items = container.querySelectorAll('[data-capability-timeline-item="true"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.getAttribute("data-capability-phase-status")).toBe("active");
    expect(items[1]?.getAttribute("data-capability-phase-status")).toBe("pending");
  });

  it("renders navigate action as an anchor with the supplied href", () => {
    const envelope = createCoachEnvelope(basePayload);
    render(<CoachCard envelope={envelope} />);
    const link = screen.getByRole("link", { name: "Open settings" });
    expect(link.getAttribute("href")).toBe("/admin/settings");
    expect(link.getAttribute("data-coach-action-kind")).toBe("navigate");
    expect(link.getAttribute("data-coach-action-key")).toBe("go");
  });

  it("returns null when payload is absent (null-guard contract)", () => {
    const envelope = createCoachEnvelope(basePayload);
    const stripped = { ...envelope, payload: null };
    const { container } = render(<CoachCard envelope={stripped} />);
    expect(container.firstChild).toBeNull();
  });

  it("marks succeeded steps as succeeded regardless of currentStep", () => {
    const envelope = createCoachEnvelope({
      ...basePayload,
      steps: [
        { key: "done", label: "Completed", status: "succeeded" },
        { key: "now", label: "In progress", status: "active" },
      ],
      currentStep: 1,
    });
    const { container } = render(<CoachCard envelope={envelope} />);
    const items = container.querySelectorAll('[data-capability-timeline-item="true"]');
    expect(items[0]?.getAttribute("data-capability-phase-status")).toBe("succeeded");
    expect(items[1]?.getAttribute("data-capability-phase-status")).toBe("active");
  });
});
