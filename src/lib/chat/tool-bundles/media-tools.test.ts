import { describe, expect, it, vi } from "vitest";

const {
  jobQueueRepository,
  userFileRepository,
  projectCatalogBoundToolDescriptorMock,
} = vi.hoisted(() => ({
  jobQueueRepository: { appendEvent: vi.fn() },
  userFileRepository: { findById: vi.fn() },
  projectCatalogBoundToolDescriptorMock: vi.fn((toolName: string) => ({
    name: toolName,
    schema: {
      description: "",
      input_schema: { type: "object", properties: {} },
    },
    command: {
      execute: vi.fn(),
    },
    roles: "ALL" as const,
    category: "system" as const,
  })),
}));

vi.mock("@/core/capability-catalog/runtime-tool-binding", () => ({
  projectCatalogBoundToolDescriptor: projectCatalogBoundToolDescriptorMock,
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getJobQueueRepository: () => jobQueueRepository,
      getUserFileDataMapper: () => userFileRepository,
    })
  };
});

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { registerMediaTools } from "./media-tools";

describe("registerMediaTools", () => {
  it("wires compose_media with both job and user file repositories", () => {
    const registry = new ToolRegistry();

    registerMediaTools(registry);

    expect(projectCatalogBoundToolDescriptorMock).toHaveBeenCalledWith("compose_media", {
      jobQueueRepository,
    });
    expect(projectCatalogBoundToolDescriptorMock).toHaveBeenCalledWith("list_conversation_media_assets", {
      userFileRepository,
    });
  });
});