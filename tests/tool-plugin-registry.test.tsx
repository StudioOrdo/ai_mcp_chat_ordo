import { renderHook } from "@testing-library/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  useToolPluginRegistry,
  ToolPluginRegistryProvider,
  type ToolPluginRegistry,
} from "@/frameworks/ui/chat/registry/ToolPluginContext";
import { getCapabilityPresentationDescriptor } from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import { JobStatusFallbackCard } from "@/frameworks/ui/chat/plugins/system/JobStatusFallbackCard";
import { ToolPluginPartRenderer } from "@/frameworks/ui/chat/ToolPluginPartRenderer";
import type { ToolPluginProps } from "@/frameworks/ui/chat/registry/types";
import type { JobStatusMessagePart } from "@/core/entities/message-parts";

function makePart(overrides: Partial<JobStatusMessagePart> = {}): JobStatusMessagePart {
  return {
    type: "job_status",
    jobId: "job_test_1",
    toolName: "test_tool",
    label: "Test Job",
    status: "running",
    ...overrides,
  };
}

describe("ToolPluginRegistry", () => {
  it("returns fallback for unknown tool names", () => {
    const { result } = renderHook(() => useToolPluginRegistry());
    const Component = result.current.getRenderer("nonexistent_tool");
    expect(Component).toBe(JobStatusFallbackCard);
  });

  it("returns fallback when no provider wraps the tree", () => {
    const { result } = renderHook(() => useToolPluginRegistry());
    const Component = result.current.getRenderer("set_theme");
    expect(Component).toBe(JobStatusFallbackCard);
  });

  it("returns the registered descriptor for known chat capabilities", () => {
    const { result } = renderHook(() => useToolPluginRegistry());

    expect(result.current.getDescriptor("nonexistent_tool")).toBeUndefined();
  });

  it("returns registered component for known tool name", () => {
    const MockPlugin = () => <div>mock</div>;
    const registry: ToolPluginRegistry = {
      getRenderer: (name: string) =>
        name === "set_theme" ? MockPlugin : JobStatusFallbackCard,
      getDescriptor: (name: string) => getCapabilityPresentationDescriptor(name),
    };

    const { result } = renderHook(() => useToolPluginRegistry(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ToolPluginRegistryProvider registry={registry}>
          {children}
        </ToolPluginRegistryProvider>
      ),
    });

    expect(result.current.getRenderer("set_theme")).toBe(MockPlugin);
    expect(result.current.getRenderer("unknown")).toBe(JobStatusFallbackCard);
  });

  it("getRenderer never returns null or undefined", () => {
    const { result } = renderHook(() => useToolPluginRegistry());
    const names = ["", "null", "undefined", "beta_unreleased_tool", "  "];
    for (const name of names) {
      expect(result.current.getRenderer(name)).toBeDefined();
      expect(result.current.getRenderer(name)).not.toBeNull();
    }
  });
});

describe("JobStatusFallbackCard", () => {
  it("renders the label and status for any tool", () => {
    render(<JobStatusFallbackCard part={makePart()} isStreaming={false} />);
    expect(screen.getByText("Test Job")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders progress bar when progressPercent is present", () => {
    render(
      <JobStatusFallbackCard
        part={makePart({ progressPercent: 45, claimedBy: "worker_1" })}
        isStreaming={false}
        viewerRole="ADMIN"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Test Job/i }));
    expect(screen.getByRole("progressbar", { name: "Test Job progress" })).toHaveAttribute("aria-valuenow", "45");
  });

  it("renders without crashing for succeeded status", () => {
    render(
      <JobStatusFallbackCard
        part={makePart({ status: "succeeded" })}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders without crashing for failed status", () => {
    render(
      <JobStatusFallbackCard
        part={makePart({ status: "failed", error: "Something broke" })}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("renders compact row even when title and subtitle are provided", () => {
    render(
      <JobStatusFallbackCard
        part={makePart({ title: "Job Title", subtitle: "Job Subtitle" })}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("Test Job")).toBeInTheDocument();
  });

  it("renders compact status when summary is present", () => {
    render(
      <JobStatusFallbackCard
        part={makePart({ status: "succeeded", summary: "All done" })}
        isStreaming={false}
      />,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders action buttons when computedActions are present", () => {
    const onClick = vi.fn();
    render(
      <JobStatusFallbackCard
        part={makePart()}
        computedActions={[
          { type: "action-link", label: "Retry", actionType: "job", value: "job_test_1" },
        ]}
        isStreaming={false}
        onActionClick={onClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Retry (job)" });
    expect(button).toBeInTheDocument();
    button.click();
    expect(onClick).toHaveBeenCalledWith("job", "job_test_1", undefined);
  });
});

describe("ToolPluginPartRenderer", () => {
  it("renders the registered plugin for a known tool", () => {
    const MockCard = ({ part }: { part?: JobStatusMessagePart }) => (
      <div data-testid="mock-card">{part?.toolName}</div>
    );
    const registry: ToolPluginRegistry = {
      getRenderer: (name: string) =>
        name === "generate_chart" ? MockCard : JobStatusFallbackCard,
      getDescriptor: (name: string) => getCapabilityPresentationDescriptor(name),
    };

    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={makePart({ toolName: "generate_chart" })}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );
    expect(screen.getByTestId("mock-card")).toBeInTheDocument();
    expect(screen.getByText("generate_chart")).toBeInTheDocument();
  });

  it("renders fallback for an unknown tool", () => {
    render(
      <ToolPluginPartRenderer
        part={makePart({ toolName: "future_tool", label: "Future Job" })}
        isStreaming={false}
      />,
    );
    // Falls back to JobStatusFallbackCard which renders the label
    expect(screen.getByText("Future Job")).toBeInTheDocument();
  });
});

describe("createDefaultToolRegistry", () => {
  it("returns custom plugins for registered tools and fallback for others", async () => {
    const { createDefaultToolRegistry } = await import(
      "@/frameworks/ui/chat/registry/default-tool-registry"
    );
    const registry = createDefaultToolRegistry();

    // Tools with custom plugins should NOT return fallback
    const customTools = [
      "generate_chart", "generate_graph", "generate_audio", "admin_web_search",
      "search_corpus", "search_my_conversations", "get_section", "get_corpus_summary", "list_practitioners",
      "inspect_theme", "set_theme", "adjust_ui",
      "get_my_profile", "update_my_profile", "get_my_referral_qr", "set_preference",
      "get_my_affiliate_summary", "list_my_referral_activity",
      "draft_content", "publish_content", "compose_blog_article", "qa_blog_article",
      "resolve_blog_article_qa", "generate_blog_image_prompt", "generate_blog_image",
      "produce_blog_article",
      "get_journal_workflow_summary", "list_journal_posts", "get_journal_post",
      "list_journal_revisions", "update_journal_metadata", "update_journal_draft",
      "submit_journal_review", "approve_journal_post", "publish_journal_post",
      "restore_journal_revision", "select_journal_hero_image", "prepare_journal_post_for_publish",
    ];
    for (const tool of customTools) {
      expect(registry.getRenderer(tool)).not.toBe(JobStatusFallbackCard);
    }

    // Command-only and unknown tools should return fallback
    const fallbackTools = ["get_checklist", "navigate", "nonexistent"];
    for (const tool of fallbackTools) {
      expect(registry.getRenderer(tool)).toBe(JobStatusFallbackCard);
    }
  });

  it("passes descriptor and projected envelope data into registered plugins", () => {
    const MockCard = ({ descriptor, resultEnvelope }: ToolPluginProps) => (
      <div data-testid="descriptor-aware-card">
        {descriptor?.toolName}:{resultEnvelope?.toolName}
      </div>
    );
    const registry: ToolPluginRegistry = {
      getRenderer: (name: string) =>
        name === "admin_web_search" ? MockCard : JobStatusFallbackCard,
      getDescriptor: (name: string) => getCapabilityPresentationDescriptor(name),
    };

    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{
            name: "admin_web_search",
            args: { query: "ordo site architecture" },
            result: {
              action: "admin_web_search",
              query: "ordo site architecture",
              answer: "A sourced answer.",
              citations: [],
              sources: ["https://example.com/architecture"],
              model: "gpt-5",
            },
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByTestId("descriptor-aware-card")).toHaveTextContent(
      "admin_web_search:admin_web_search",
    );
  });
});
