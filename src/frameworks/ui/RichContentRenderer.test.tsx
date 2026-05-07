import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { RichContentRenderer } from "./RichContentRenderer";
import type { RichContent, InlineNode } from "../../core/entities/rich-content";

vi.mock("../../components/MermaidRenderer", () => ({
  MermaidRenderer: ({ code, title, caption, downloadFileName }: { code: string; title?: string; caption?: string; downloadFileName?: string }) => (
    <div
      data-testid="mermaid-renderer"
      data-code={code}
      data-title={title ?? ""}
      data-caption={caption ?? ""}
      data-download-file-name={downloadFileName ?? ""}
    >
      {title ?? caption ?? "Mermaid"}
    </div>
  ),
}));

vi.mock("../../components/GraphRenderer", () => ({
  GraphRenderer: ({ graph, title, caption, summary, downloadFileName, dataPreview }: { graph: { kind: string }; title?: string; caption?: string; summary?: string; downloadFileName?: string; dataPreview?: Array<Record<string, unknown>> }) => (
    <div
      data-testid="graph-renderer"
      data-kind={graph.kind}
      data-title={title ?? ""}
      data-caption={caption ?? ""}
      data-summary={summary ?? ""}
      data-download-file-name={downloadFileName ?? ""}
      data-preview-count={String(dataPreview?.length ?? 0)}
    >
      {title ?? caption ?? graph.kind}
    </div>
  ),
}));

vi.mock("../../components/AudioPlayer", () => ({
  AudioPlayer: ({ title, text, assetId, provider, generationStatus, estimatedDurationSeconds, estimatedGenerationSeconds }: {
    title: string;
    text: string;
    assetId?: string;
    provider?: string;
    generationStatus?: string;
    estimatedDurationSeconds?: number;
    estimatedGenerationSeconds?: number;
  }) => (
    <div
      data-testid="audio-player"
      data-title={title}
      data-text={text}
      data-asset-id={assetId ?? ""}
      data-provider={provider ?? ""}
      data-generation-status={generationStatus ?? ""}
      data-estimated-duration={String(estimatedDurationSeconds ?? "")}
      data-estimated-generation={String(estimatedGenerationSeconds ?? "")}
    />
  ),
}));

describe("RichContentRenderer", () => {
  it("should render a paragraph", () => {
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };

    render(<RichContentRenderer content={content} />);
    expect(screen.getByText("Hello world")).toBeDefined();
  });

  it("should render bold text", () => {
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This is " },
            { type: "bold", content: [{ type: "text", text: "bold" }] },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} />);
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("should render a library link and handle clicks", () => {
    const onClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "library-link", slug: "my-chapter" }],
        },
      ],
    };

    render(<RichContentRenderer content={content} onLinkClick={onClick} />);
    const link = screen.getByText("my chapter");
    link.click();
    expect(onClick).toHaveBeenCalledWith("my-chapter");
  });

  it("should render a list", () => {
    const content: RichContent = {
      blocks: [
        {
          type: "list",
          items: [
            [{ type: "text", text: "item 1" }],
            [{ type: "text", text: "item 2" }],
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} />);
    expect(screen.getByText("item 1")).toBeDefined();
    expect(screen.getByText("item 2")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("should render an operator brief as section cards", () => {
    const content: RichContent = {
      blocks: [
        {
          type: "operator-brief",
          sections: [
            {
              label: "NOW",
              summary: [{ type: "text", text: "Handle the founder response first." }],
              items: [[{ type: "text", text: "Reply to Alex" }]],
            },
            {
              label: "NEXT",
              summary: [{ type: "text", text: "Review routing drift." }],
            },
            {
              label: "WAIT",
              summary: [{ type: "text", text: "Leave funnel cleanup for later." }],
            },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} />);
    expect(screen.getByLabelText("NOW")).toBeInTheDocument();
    expect(screen.getByLabelText("NEXT")).toBeInTheDocument();
    expect(screen.getByLabelText("WAIT")).toBeInTheDocument();
    expect(screen.getByText("Reply to Alex")).toBeInTheDocument();
  });

  it("passes mermaid title, caption, and filename through to the chart renderer", async () => {
    const content: RichContent = {
      blocks: [
        {
          type: "code-block",
          code: "flowchart TD\nA --> B",
          language: "mermaid",
          title: "Anonymous Funnel",
          caption: "Live drop-off view",
          downloadFileName: "anonymous_funnel",
        },
      ],
    };

    render(<RichContentRenderer content={content} />);

    const renderer = await screen.findByTestId("mermaid-renderer");
    expect(renderer).toHaveAttribute("data-title", "Anonymous Funnel");
    expect(renderer).toHaveAttribute("data-caption", "Live drop-off view");
    expect(renderer).toHaveAttribute("data-download-file-name", "anonymous_funnel");
  });

  it("passes graph metadata through to the graph renderer", async () => {
    const content: RichContent = {
      blocks: [
        {
          type: "graph",
          title: "Lead trend",
          caption: "Weekly qualified leads",
          summary: "Qualified leads increased week over week.",
          downloadFileName: "lead_trend",
          dataPreview: [
            { week: "W1", leads: 4 },
            { week: "W2", leads: 7 },
          ],
          graph: {
            kind: "line",
            data: [
              { week: "W1", leads: 4 },
              { week: "W2", leads: 7 },
            ],
            x: { field: "week", type: "ordinal" },
            y: { field: "leads", type: "quantitative" },
          },
        },
      ],
    };

    render(<RichContentRenderer content={content} />);

    const renderer = await screen.findByTestId("graph-renderer", undefined, { timeout: 5000 });
    expect(renderer).toHaveAttribute("data-kind", "line");
    expect(renderer).toHaveAttribute("data-title", "Lead trend");
    expect(renderer).toHaveAttribute("data-caption", "Weekly qualified leads");
    expect(renderer).toHaveAttribute("data-summary", "Qualified leads increased week over week.");
    expect(renderer).toHaveAttribute("data-download-file-name", "lead_trend");
    expect(renderer).toHaveAttribute("data-preview-count", "2");
  });

  it("passes structured audio metadata through to the audio renderer", async () => {
    const content: RichContent = {
      blocks: [
        {
          type: "audio",
          title: "Founder memo",
          text: "Weekly review audio",
          assetId: "uf_audio_1",
          provider: "user-file-cache",
          generationStatus: "cached_asset",
          estimatedDurationSeconds: 12,
          estimatedGenerationSeconds: 3,
        },
      ],
    };

    render(<RichContentRenderer content={content} />);

    const player = await screen.findByTestId("audio-player");
    expect(player).toHaveAttribute("data-asset-id", "uf_audio_1");
    expect(player).toHaveAttribute("data-provider", "user-file-cache");
    expect(player).toHaveAttribute("data-generation-status", "cached_asset");
    expect(player).toHaveAttribute("data-estimated-duration", "12");
    expect(player).toHaveAttribute("data-estimated-generation", "3");
  });

  it("renders a durable job-status card", () => {
    const content: RichContent = {
      blocks: [
        {
          type: "job-status",
          jobId: "job_1",
          label: "Draft Content",
          toolName: "draft_content",
          status: "running",
          progressPercent: 60,
          progressLabel: "Drafting",
        },
      ],
    };

    render(<RichContentRenderer content={content} />);

    expect(screen.getByLabelText("Draft Content status")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText(/Drafting\s+60%/)).toBeInTheDocument();
  });

  it("renders operation-card blocks as first-class operation cards", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "operation-card",
          operation: {
            operationId: "op_1",
            title: "Open Help",
            kind: "help_flow",
            status: "draft",
            statusLabel: "draft",
            statusTone: "neutral",
            riskLevel: "info",
            riskLabel: "info",
            summary: "Open governed help.",
            progressPercent: null,
            updatedAt: "2026-05-03T12:00:00.000Z",
            latestEventLabel: null,
            artifactCount: 0,
            actionCount: 1,
            actions: [{
              type: "action-link",
              label: "Search Help",
              actionType: "operation",
              value: "op_1",
              params: {
                operationId: "op_1",
                actionId: "act_1",
                idempotencyKey: "idem_1",
                operationRevision: "1",
              },
            }],
          },
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);

    expect(screen.getByText("Open Help")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search Help (operation)" }));
    expect(onActionClick).toHaveBeenCalledWith("operation", "op_1", expect.objectContaining({ actionId: "act_1" }));
  });

  it("renders job-status actions and dispatches them", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "job-status",
          jobId: "job_1",
          label: "Draft Content",
          toolName: "draft_content",
          status: "succeeded",
          summary: "Draft ready.",
          actions: [
            { type: "action-link", label: "Open feed item", actionType: "route", value: "/feed/launch-plan" },
            { type: "action-link", label: "Publish", actionType: "send", value: "Publish the draft post." },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Open feed item (route)" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish (send)" }));

    expect(onActionClick).toHaveBeenNthCalledWith(1, "route", "/feed/launch-plan", undefined);
    expect(onActionClick).toHaveBeenNthCalledWith(2, "send", "Publish the draft post.", undefined);
  });

  it("should render an action link as a button and dispatch onActionClick", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "action-link", label: "Morgan Lee", actionType: "conversation", value: "conv_001" },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    const button = screen.getByRole("button", { name: "Morgan Lee (conversation)" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-chat-action-link", "conversation");
    fireEvent.click(button);
    expect(onActionClick).toHaveBeenCalledWith("conversation", "conv_001", undefined);
  });

  it("should render action link with params and dispatch them on click", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "action-link", label: "Send offer", actionType: "send", value: "Draft offer", params: { tone: "formal" } },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Send offer (send)" }));
    expect(onActionClick).toHaveBeenCalledWith("send", "Draft offer", { tone: "formal" });
  });

  it("renders operation actions as durable buttons with danger styling", () => {
    const onActionClick = vi.fn();
    const params = {
      operationId: "op_1",
      actionId: "action_1",
      idempotencyKey: "idem_1",
      operationRevision: "3",
      riskLevel: "destructive",
      confirmPolicy: "phrase",
    };
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "action-link", label: "Execute restore", actionType: "operation", value: "op_1", params },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    const button = screen.getByRole("button", { name: "Execute restore (operation)" });
    expect(button).toHaveAttribute("data-chat-action-link", "operation");
    expect(button).toHaveAttribute("data-operation-action", "true");
    expect(button).toHaveAttribute("data-action-intent", "danger");
    expect(button.className).toContain("ui-operation-action-button");

    fireEvent.click(button);
    expect(onActionClick).toHaveBeenCalledWith("operation", "op_1", params);
  });

  it("renders disabled operation actions with a reason and blocks dispatch", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "action-link",
              label: "Execute restore",
              actionType: "operation",
              value: "op_1",
              params: {
                operationId: "op_1",
                actionId: "action_1",
                idempotencyKey: "idem_1",
                operationRevision: "3",
                disabledReason: "Action has expired.",
              },
            },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    const button = screen.getByRole("button", { name: "Execute restore (operation)" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Action has expired.");

    fireEvent.click(button);
    expect(onActionClick).not.toHaveBeenCalled();
  });

  it("should render external action links and dispatch them on click", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "action-link", label: "Open referral link", actionType: "external", value: "https://studioordo.com/r/mentor-42" },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Open referral link (external)" }));
    expect(onActionClick).toHaveBeenCalledWith("external", "https://studioordo.com/r/mentor-42", undefined);
  });

  it("should render action link as no-op when onActionClick is not provided", () => {
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "action-link", label: "Go home", actionType: "route", value: "/home" },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} />);
    const button = screen.getByRole("button", { name: "Go home (route)" });
    // Should not throw when clicked without handler
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
  });

  it("should render multiple action links in the same paragraph", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "action-link", label: "Thread A", actionType: "conversation", value: "conv_a" },
            { type: "text", text: " or " },
            { type: "action-link", label: "Thread B", actionType: "conversation", value: "conv_b" },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onActionClick).toHaveBeenCalledWith("conversation", "conv_a", undefined);
    fireEvent.click(buttons[1]);
    expect(onActionClick).toHaveBeenCalledWith("conversation", "conv_b", undefined);
  });

  it("should render action link adjacent to library-link in same sentence", () => {
    const onActionClick = vi.fn();
    const onLinkClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            { type: "library-link", slug: "audit-guide" },
            { type: "text", text: " then " },
            { type: "action-link", label: "Run audit", actionType: "send", value: "run audit" },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onLinkClick={onLinkClick} onActionClick={onActionClick} />);
    fireEvent.click(screen.getByText("audit guide"));
    expect(onLinkClick).toHaveBeenCalledWith("audit-guide");
    fireEvent.click(screen.getByRole("button", { name: "Run audit (send)" }));
    expect(onActionClick).toHaveBeenCalledWith("send", "run audit", undefined);
  });

  it("should render action link inside a list item", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "list",
          items: [
            [
              { type: "text", text: "Step 1: " },
              { type: "action-link", label: "Open feed", actionType: "route", value: "/feed" },
            ],
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    const button = screen.getByRole("button", { name: "Open feed (route)" });
    expect(button.closest("li")).not.toBeNull();
    fireEvent.click(button);
    expect(onActionClick).toHaveBeenCalledWith("route", "/feed", undefined);
  });

  it("should render action link inside operator brief card", () => {
    const onActionClick = vi.fn();
    const content: RichContent = {
      blocks: [
        {
          type: "operator-brief",
          sections: [
            {
              label: "NOW",
              summary: [
                { type: "text", text: "Reply to " },
                { type: "action-link", label: "Morgan Lee", actionType: "conversation", value: "conv_morgan" },
              ],
            },
          ],
        },
      ],
    };

    render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
    const button = screen.getByRole("button", { name: "Morgan Lee (conversation)" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onActionClick).toHaveBeenCalledWith("conversation", "conv_morgan", undefined);
  });

  describe("operator brief with action links", () => {
    it("renders action links inside NOW/NEXT/WAIT card sections", () => {
      const onActionClick = vi.fn();
      const content: RichContent = {
        blocks: [
          {
            type: "operator-brief",
            sections: [
              {
                label: "NOW",
                summary: [
                  { type: "text", text: "Reply to " },
                  { type: "action-link", label: "Morgan Lee", actionType: "conversation", value: "conv_001" },
                ],
              },
              {
                label: "NEXT",
                summary: [
                  { type: "text", text: "Review " },
                  { type: "action-link", label: "audit report", actionType: "route", value: "/reports/audit" },
                ],
              },
              {
                label: "WAIT",
                summary: [
                  { type: "text", text: "Pending " },
                  { type: "action-link", label: "design review", actionType: "corpus", value: "design-review" },
                ],
              },
            ],
          },
        ],
      };

      render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
      expect(screen.getByRole("button", { name: "Morgan Lee (conversation)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "audit report (route)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "design review (corpus)" })).toBeInTheDocument();
    });

    it("action links are visually distinct from bold text (different node type)", () => {
      const content: RichContent = {
        blocks: [
          {
            type: "operator-brief",
            sections: [
              {
                label: "NOW",
                summary: [
                  { type: "bold", content: [{ type: "text", text: "Important" }] },
                  { type: "text", text: " — contact " },
                  { type: "action-link", label: "Morgan Lee", actionType: "conversation", value: "conv_001" },
                ],
              },
            ],
          },
        ],
      };

      const { container } = render(<RichContentRenderer content={content} />);
      const bold = container.querySelector("strong");
      const actionButton = container.querySelector('[data-chat-action-link="conversation"]');
      expect(bold).not.toBeNull();
      expect(actionButton).not.toBeNull();
      expect(bold?.tagName).toBe("STRONG");
      expect(actionButton?.tagName.toLowerCase()).toBe("button");
    });

    it("renders action links nested inside bold text", () => {
      const onActionClick = vi.fn();
      const content: RichContent = {
        blocks: [
          {
            type: "paragraph",
            content: [
              {
                type: "bold",
                content: [
                  { type: "text", text: "1. " },
                  { type: "action-link", label: "The Outlaw", actionType: "corpus", value: "the-outlaw" },
                  { type: "text", text: " — Reform" },
                ],
              },
            ],
          },
        ],
      };

      render(<RichContentRenderer content={content} onActionClick={onActionClick} />);

      const button = screen.getByRole("button", { name: "The Outlaw (corpus)" });
      expect(button.closest("strong")).not.toBeNull();
      fireEvent.click(button);
      expect(onActionClick).toHaveBeenCalledWith("corpus", "the-outlaw", undefined);
    });

    it("operator brief with 3 cards each containing 2 action links produces correct node count", () => {
      const onActionClick = vi.fn();
      const makeSection = (label: "NOW" | "NEXT" | "WAIT", slug1: string, slug2: string): { label: "NOW" | "NEXT" | "WAIT"; summary: InlineNode[] } => ({
        label,
        summary: [
          { type: "action-link" as const, label: `Link ${slug1}`, actionType: "conversation" as const, value: slug1 },
          { type: "text" as const, text: " and " },
          { type: "action-link" as const, label: `Link ${slug2}`, actionType: "route" as const, value: `/${slug2}` },
        ],
      });

      const content: RichContent = {
        blocks: [
          {
            type: "operator-brief",
            sections: [
              makeSection("NOW", "a", "b"),
              makeSection("NEXT", "c", "d"),
              makeSection("WAIT", "e", "f"),
            ],
          },
        ],
      };

      const { container } = render(<RichContentRenderer content={content} onActionClick={onActionClick} />);
      const actionLinks = container.querySelectorAll('[data-chat-action-link]');
      expect(actionLinks).toHaveLength(6);
    });
  });
});
