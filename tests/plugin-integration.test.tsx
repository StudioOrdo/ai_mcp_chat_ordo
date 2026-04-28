import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToolPluginPartRenderer } from "@/frameworks/ui/chat/ToolPluginPartRenderer";
import { getCapabilityPresentationDescriptor } from "@/frameworks/ui/chat/registry/capability-presentation-registry";
import { ToolPluginRegistryProvider, type ToolPluginRegistry } from "@/frameworks/ui/chat/registry/ToolPluginContext";
import { JobStatusFallbackCard } from "@/frameworks/ui/chat/plugins/system/JobStatusFallbackCard";

const MockPlugin = ({ toolCall }: { toolCall?: { name: string } }) => (
  <div data-testid="mock-plugin">{toolCall?.name}</div>
);

describe("ToolPluginPartRenderer integration", () => {
  it("renders the registered plugin for a tool-call entry", () => {
    const registry: ToolPluginRegistry = {
      getRenderer: (name: string) => (name === "generate_chart" ? MockPlugin : JobStatusFallbackCard),
      getDescriptor: (name: string) => getCapabilityPresentationDescriptor(name),
    };

    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          toolCall={{ name: "generate_chart", args: {}, result: { code: "graph TD" } }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByTestId("mock-plugin")).toHaveTextContent("generate_chart");
  });

  it("renders fallback content for an unknown tool-call entry", () => {
    render(
      <ToolPluginPartRenderer
        toolCall={{ name: "calculator", args: { expression: "2+2" }, result: 4 }}
        isStreaming={false}
      />,
    );

    expect(screen.getByText("Calculator")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("bypasses a mapped plugin when only a compatibility snapshot remains", () => {
    const registry: ToolPluginRegistry = {
      getRenderer: (name: string) => (name === "draft_content" ? MockPlugin : JobStatusFallbackCard),
      getDescriptor: (name: string) => getCapabilityPresentationDescriptor(name),
    };

    render(
      <ToolPluginRegistryProvider registry={registry}>
        <ToolPluginPartRenderer
          part={{
            type: "job_status",
            jobId: "job_legacy_1",
            toolName: "draft_content",
            label: "Draft Content",
            status: "succeeded",
            summary: "Historical draft summary.",
          }}
          isStreaming={false}
        />
      </ToolPluginRegistryProvider>,
    );

    expect(screen.getByTestId("mock-plugin")).toBeInTheDocument();
  });
});
