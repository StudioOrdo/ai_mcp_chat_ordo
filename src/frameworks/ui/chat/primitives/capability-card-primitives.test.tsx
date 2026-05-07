// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CapabilityActionRail } from "./CapabilityActionRail";
import { CapabilityArtifactRail } from "./CapabilityArtifactRail";
import { CapabilityCardHeader } from "./CapabilityCardHeader";
import { CapabilityCardShell } from "./CapabilityCardShell";
import { CapabilityContextPanel } from "./CapabilityContextPanel";
import { CapabilityDisclosure } from "./CapabilityDisclosure";
import { CapabilityMetricStrip } from "./CapabilityMetricStrip";
import { CapabilityTimeline } from "./CapabilityTimeline";

describe("capability card primitives", () => {
  it("renders shared shell semantics, disclosure behavior, and action routing", () => {
    const onActionClick = vi.fn();

    render(
      <CapabilityCardShell
        descriptor={{ family: "editorial", cardKind: "editorial_workflow" }}
        state="running"
        ariaLabel="Editorial capability"
      >
        <CapabilityCardHeader
          eyebrow="Draft Content"
          title="AI Governance Playbook"
          subtitle="Awaiting review"
          statusLabel="Running"
          statusMeta="45%"
        />
        <CapabilityMetricStrip items={[{ label: "Decision", value: "Needs revisions" }]} />
        <CapabilityContextPanel items={[{ label: "Slug", value: "/journal/ai-governance-playbook" }]} />
        <CapabilityDisclosure label="Draft preview">
          <p>Preview body</p>
        </CapabilityDisclosure>
        <CapabilityActionRail
          actions={[
            {
              type: "action-link",
              label: "Publish",
              actionType: "send",
              value: "Publish post_1",
            },
          ]}
          onActionClick={onActionClick}
        />
      </CapabilityCardShell>,
    );

    const card = screen.getByRole("region", { name: "Editorial capability" });
    expect(card).toHaveAttribute("data-capability-card", "true");
    expect(card).toHaveAttribute("data-capability-tone", "editorial");
    expect(card).toHaveAttribute("data-capability-kind", "editorial_workflow");
    expect(card).toHaveAttribute("data-capability-state", "running");
    expect(screen.queryByText("Preview body")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Draft preview/i }));

    expect(screen.getByText("Preview body")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publish (send)" }));

    expect(onActionClick).toHaveBeenCalledWith("send", "Publish post_1", undefined);
  });

  it("marks restore workflow actions with button intent hooks", () => {
    render(
      <CapabilityActionRail
        actions={[
          {
            type: "action-link",
            label: "Execute Restore",
            actionType: "operation",
            value: "op_restore_1",
            params: { riskLevel: "destructive" },
          },
          {
            type: "action-link",
            label: "Cancel Restore",
            actionType: "operation",
            value: "op_restore_1",
            params: { riskLevel: "destructive" },
          },
          {
            type: "action-link",
            label: "List Backups",
            actionType: "tool",
            value: "List appliance backups",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Execute Restore (operation)" })).toHaveAttribute("data-action-intent", "danger");
    expect(screen.getByRole("button", { name: "Cancel Restore (operation)" })).toHaveAttribute("data-action-intent", "danger");
    expect(screen.getByRole("button", { name: "List Backups (tool)" })).toHaveAttribute("data-action-intent", "secondary");
  });

  it("renders artifact and timeline primitives with semantic status hooks", () => {
    render(
      <CapabilityCardShell ariaLabel="System capability" state="succeeded">
        <CapabilityArtifactRail
          items={[{ label: "Preview asset", href: "/api/assets/asset_1", meta: "image/png" }]}
        />
        <CapabilityTimeline
          title="Progress"
          items={[
            { label: "Queued", status: "succeeded" },
            { label: "Rendering", status: "active", meta: "65%" },
          ]}
        />
      </CapabilityCardShell>,
    );

    expect(screen.getByRole("link", { name: "Preview asset" })).toHaveAttribute("href", "/api/assets/asset_1");
    expect(screen.getByText("Rendering").closest('[data-capability-timeline-item="true"]')).toHaveAttribute(
      "data-capability-phase-status",
      "active",
    );
  });
});
