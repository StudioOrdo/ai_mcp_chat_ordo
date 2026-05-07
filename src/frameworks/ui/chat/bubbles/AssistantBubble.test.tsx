// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PresentedMessage, ToolRenderEntry } from "@/adapters/ChatPresenter";
import type { CapabilityPresentationDescriptor } from "@/core/entities/capability-presentation";
import type { CapabilityResultEnvelope } from "@/core/entities/capability-result";
import { AssistantBubbleContent, MessageActionChips } from "./AssistantBubble";

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

const mediaDescriptor: CapabilityPresentationDescriptor = {
  toolName: "compose_media",
  family: "artifact",
  label: "Compose Media",
  cardKind: "media_render",
  executionMode: "hybrid",
  progressMode: "single",
  historyMode: "payload_snapshot",
  defaultSurface: "conversation",
  artifactKinds: ["video"],
  supportsRetry: "whole_job",
};

function makeEnvelope(assetId: string): CapabilityResultEnvelope {
  return {
    schemaVersion: 1,
    toolName: "compose_media",
    family: "artifact",
    cardKind: "media_render",
    executionMode: "hybrid",
    inputSnapshot: { planId: `plan-${assetId}` },
    summary: { title: "Media Composition", statusLine: "succeeded" },
    payload: {
      route: "browser_wasm",
      planId: `plan-${assetId}`,
      primaryAssetId: assetId,
      outputFormat: "mp4",
    },
    artifacts: [
      {
        kind: "video",
        label: `Video ${assetId}`,
        mimeType: "video/mp4",
        assetId,
        uri: `/api/user-files/${assetId}`,
        retentionClass: "conversation",
        source: "generated",
      },
    ],
  };
}

function makeMessage(toolRenderEntries: ToolRenderEntry[]): PresentedMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    rawContent: "Rendered media.",
    responseState: "closed",
    content: {
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Rendered media." }],
        },
      ],
    },
    commands: [],
    suggestions: [],
    actions: [],
    attachments: [],
    status: "confirmed",
    timestamp: "12:00",
    toolRenderEntries,
  };
}

describe("AssistantBubbleContent", () => {
  it("groups consecutive successful media render entries into a gallery", () => {
    const message = makeMessage([
      {
        kind: "tool-call",
        name: "compose_media",
        args: { planId: "plan-1" },
        result: { ok: true },
        descriptor: mediaDescriptor,
        resultEnvelope: makeEnvelope("asset-1"),
      },
      {
        kind: "tool-call",
        name: "compose_media",
        args: { planId: "plan-2" },
        result: { ok: true },
        descriptor: mediaDescriptor,
        resultEnvelope: makeEnvelope("asset-2"),
      },
    ]);

    render(
      <AssistantBubbleContent
        message={message}
        isStreaming={false}
        onLinkClick={vi.fn()}
        onActionClick={vi.fn()}
        displayText=""
        isTyping={false}
      />,
    );

    expect(screen.getByRole("region", { name: "Media Composition gallery" })).toBeInTheDocument();
    expect(screen.getByText("Media Composition · 2 items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview Video asset-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview Video asset-2" })).toBeInTheDocument();
  });

  it("keeps a single successful media render entry as a normal card", () => {
    const message = makeMessage([
      {
        kind: "tool-call",
        name: "compose_media",
        args: { planId: "plan-1" },
        result: { ok: true },
        descriptor: mediaDescriptor,
        resultEnvelope: makeEnvelope("asset-1"),
      },
    ]);

    render(
      <AssistantBubbleContent
        message={message}
        isStreaming={false}
        onLinkClick={vi.fn()}
        onActionClick={vi.fn()}
        displayText=""
        isTyping={false}
      />,
    );

    expect(screen.queryByRole("region", { name: "Media Composition gallery" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Compose Media status" })).toHaveAttribute("data-capability-kind", "media_render");
  });
});

describe("MessageActionChips", () => {
  it("renders operation actions as explicit buttons and dispatches by operationId", () => {
    const onActionClick = vi.fn();
    const params = {
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      operationRevision: "2",
      riskLevel: "high",
    };

    render(
      <MessageActionChips
        actions={[{ label: "Execute restore", action: "operation", params }]}
        onActionClick={onActionClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Execute restore" });
    expect(button).toHaveAttribute("data-chat-action-chip", "operation");
    expect(button).toHaveAttribute("data-operation-action", "true");
    expect(button).toHaveAttribute("data-action-intent", "danger");
    fireEvent.click(button);
    expect(onActionClick).toHaveBeenCalledWith("operation", "op_1", params);
  });

  it("keeps disabled operation actions visible but non-dispatching", () => {
    const onActionClick = vi.fn();

    render(
      <MessageActionChips
        actions={[
          {
            label: "Execute restore",
            action: "operation",
            params: {
              operationId: "op_1",
              actionId: "action_1",
              idempotencyKey: "idem_1",
              operationRevision: "2",
              disabledReason: "Action has expired.",
            },
          },
        ]}
        onActionClick={onActionClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Execute restore" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Action has expired.");
    fireEvent.click(button);
    expect(onActionClick).not.toHaveBeenCalled();
  });
});
