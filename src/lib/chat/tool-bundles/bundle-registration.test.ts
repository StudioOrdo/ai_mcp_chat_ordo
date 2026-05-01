import { describe, expect, it, vi } from "vitest";

const {
  projectCapabilityRuntimeNamesForBundleMock,
  projectCatalogBoundToolDescriptorMock,
  registerCatalogBoundToolsForBundleWithDepsResolverMock,
} = vi.hoisted(() => ({
  projectCapabilityRuntimeNamesForBundleMock: vi.fn(() => ["tool_alpha", "tool_beta"]),
  projectCatalogBoundToolDescriptorMock: vi.fn((toolName: string, deps: unknown) => ({
    name: toolName,
    schema: { description: "", input_schema: { type: "object", properties: {} } },
    command: { execute: vi.fn() },
    roles: "ALL" as const,
    category: "system" as const,
    deps,
  })),
  registerCatalogBoundToolsForBundleWithDepsResolverMock: vi.fn(
    (registry: ToolRegistry, _bundleId: string, resolveDeps?: (toolName: string) => unknown) => {
      for (const toolName of ["tool_alpha", "tool_beta"]) {
        registry.register(
          projectCatalogBoundToolDescriptorMock(toolName, resolveDeps?.(toolName) ?? {}),
        );
      }
    },
  ),
}));

vi.mock("@/core/platform/capability-runtime/CapabilityRuntime", () => ({
  projectCapabilityRuntimeNamesForBundle: projectCapabilityRuntimeNamesForBundleMock,
}));

vi.mock("@/core/capability-catalog/runtime-tool-binding", () => ({
  projectCatalogBoundToolDescriptor: projectCatalogBoundToolDescriptorMock,
  registerCatalogBoundToolsForBundleWithDepsResolver:
    registerCatalogBoundToolsForBundleWithDepsResolverMock,
}));

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

describe("catalog-bound bundle registration", () => {
  it("derives bundle tool names from the runtime projection", () => {
    const bundle = createCatalogBoundToolBundle("media", "Media Tools");

    expect(projectCapabilityRuntimeNamesForBundleMock).toHaveBeenCalledWith("media");
    expect(bundle).toEqual({
      id: "media",
      displayName: "Media Tools",
      toolNames: ["tool_alpha", "tool_beta"],
    });
  });

  it("registers each projected catalog-bound tool with per-tool binding deps", () => {
    const registry = new ToolRegistry();

    registerCatalogBoundToolBundle(
      registry,
      "media",
      { userFileRepository: "ufs", jobQueueRepository: "jobs" } as never,
      (toolName, deps: { userFileRepository: string; jobQueueRepository: string }) => (
        (toolName as string) === "tool_alpha"
          ? { jobQueueRepository: deps.jobQueueRepository }
          : { userFileRepository: deps.userFileRepository }
      ) as never,
    );

    expect(registerCatalogBoundToolsForBundleWithDepsResolverMock).toHaveBeenCalledWith(
      registry,
      "media",
      expect.any(Function),
    );
    expect(projectCatalogBoundToolDescriptorMock).toHaveBeenNthCalledWith(1, "tool_alpha", {
      jobQueueRepository: "jobs",
    });
    expect(projectCatalogBoundToolDescriptorMock).toHaveBeenNthCalledWith(2, "tool_beta", {
      userFileRepository: "ufs",
    });
    expect(registry.getToolNames()).toEqual(["tool_alpha", "tool_beta"]);
  });
});
