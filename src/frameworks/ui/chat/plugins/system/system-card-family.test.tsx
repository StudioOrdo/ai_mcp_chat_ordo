// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";

import { ErrorCard } from "./ErrorCard";
import { CapabilityDetailDrawer } from "./CapabilityDetailDrawer";
import { JobStatusFallbackCard } from "./JobStatusFallbackCard";
import { ProgressStripBubble } from "./ProgressStripBubble";

const editorialDescriptor: CapabilityPresentationDescriptor = {
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

describe("system card family", () => {
  it("renders the shared system job shell for running transcript parts", () => {
    const onActionClick = vi.fn();

    render(
      <JobStatusFallbackCard
        part={{
          type: "job_status",
          jobId: "job_editorial_1",
          toolName: "draft_content",
          label: "Draft Content",
          status: "running",
          progressPercent: 45,
          progressLabel: "Revising",
        }}
        descriptor={editorialDescriptor}
        resultEnvelope={{
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
            percent: 45,
            label: "Revising",
            phases: [
              { key: "compose", label: "Compose", status: "succeeded" },
              { key: "qa", label: "QA", status: "active", percent: 45 },
            ],
          },
          artifacts: [
            {
              kind: "image",
              label: "Preview asset",
              mimeType: "image/png",
              uri: "/api/assets/asset_1",
            },
          ],
          payload: null,
        }}
        computedActions={[
          {
            type: "action-link",
            label: "Open workspace",
            actionType: "route",
            value: "/admin/editorial/post_1",
          },
        ]}
        isStreaming={false}
        onActionClick={onActionClick}
      />,
    );

    const card = screen.getByRole("region", { name: "Draft Content status" });
    expect(card).toHaveAttribute("data-capability-card", "true");
    expect(card).toHaveAttribute("data-capability-state", "running");
    expect(screen.getByText(/Revising 45%/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Draft Content/i }));
    expect(screen.getByText("Compose")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open workspace (route)" }));
    expect(onActionClick).toHaveBeenCalledWith("route", "/admin/editorial/post_1", undefined);

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByText("Input snapshot")).toBeInTheDocument();
    expect(screen.getByText(/ai-governance-playbook/)).toBeInTheDocument();
  });

  it("keeps the error adapter on the shared alert shell", () => {
    const onActionClick = vi.fn();

    render(
      <ErrorCard
        part={{
          type: "job_status",
          jobId: "job_failed_1",
          toolName: "generate_graph",
          label: "Generate Graph",
          status: "failed",
          error: "Graph generation timed out.",
          failureClass: "terminal",
          recoveryMode: "rerun",
        }}
        computedActions={[
          {
            type: "action-link",
            label: "Retry",
            actionType: "send",
            value: "Retry graph generation.",
          },
        ]}
        isStreaming={false}
        onActionClick={onActionClick}
      />,
    );

    const alert = screen.getByRole("alert", { name: "Generate Graph failed" });
    expect(alert).toHaveAttribute("data-capability-card", "true");
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("terminal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry (send)" }));
    expect(onActionClick).toHaveBeenCalledWith("send", "Retry graph generation.", undefined);
  });

  it("keeps the progress bubble presentational and drawer payload-first", () => {
    render(
      <>
        <ProgressStripBubble
          label="Encoding"
          status="active"
          value="65%"
          actionSlot={<button type="button">Pause</button>}
        />
        <CapabilityDetailDrawer
          triggerLabel="View payload"
          title="Draft payload"
          summary="Structured transcript snapshot"
          sections={[
            {
              title: "Payload",
              content: <p>payload detail</p>,
            },
          ]}
        />
      </>,
    );

    expect(screen.getByText("Encoding").closest('[data-capability-progress-bubble="true"]')).toHaveAttribute(
      "data-capability-phase-status",
      "active",
    );
    expect(screen.getByText("Pause")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View payload" }));
    expect(screen.getByText("Draft payload")).toBeInTheDocument();
    expect(screen.getByText("payload detail")).toBeInTheDocument();
  });
});
