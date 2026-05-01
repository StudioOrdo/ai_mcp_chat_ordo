// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JobsRail } from "./JobsRail";
import type { JobsRailModel } from "./resolve-jobs-rail";

const baseModel: JobsRailModel = {
  primaryState: "needs_input",
  syncState: "live",
  syncLabel: "Live",
  activeCount: 1,
  attentionCount: 1,
  completedCount: 0,
  items: [
    {
      jobId: "job_policy",
      conversationId: "conv_1",
      toolName: "compose_media",
      title: "Compose media",
      subtitle: "Policy failure",
      state: "needs_input",
      statusLabel: "Needs revision",
      progressLabel: null,
      progressPercent: null,
      updatedAt: "2026-04-29T12:00:00.000Z",
      failureClass: "policy",
      actions: [
        {
          kind: "revise",
          label: "Revise",
          actionType: "send",
          value: "Help me revise the request.",
          primary: true,
        },
      ],
    },
  ],
  overflowActions: [
    {
      kind: "open",
      label: "Open jobs workspace",
      actionType: "route",
      value: "/jobs",
      primary: false,
    },
  ],
};

describe("JobsRail", () => {
  it("opens the drawer and dispatches primary job actions", () => {
    const onAction = vi.fn();

    render(
      <JobsRail
        model={baseModel}
        utilityActions={{
          canCopyTranscript: true,
          canExportConversation: true,
          canImportConversation: true,
        }}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Jobs, 2 jobs, 1 running · 1 needs input, Live/ }));
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ kind: "revise" }));
  });

  it("keeps conversation utility actions reachable from the drawer", () => {
    const onCopyTranscript = vi.fn();

    render(
      <JobsRail
        model={baseModel}
        utilityActions={{
          canCopyTranscript: true,
          canExportConversation: true,
          canImportConversation: true,
          onCopyTranscript,
        }}
        onAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Jobs/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Copy transcript" }));

    expect(onCopyTranscript).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and restores focus to the trigger", () => {
    render(
      <JobsRail
        model={baseModel}
        utilityActions={{
          canCopyTranscript: true,
          canExportConversation: true,
          canImportConversation: true,
        }}
        onAction={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Jobs/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Jobs" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Jobs" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
