import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";

const {
  getEffectiveManifestSyncMock,
  summarizeByStateMock,
  updateToolMock,
  updateToolsMock,
} = vi.hoisted(() => ({
  getEffectiveManifestSyncMock: vi.fn(),
  summarizeByStateMock: vi.fn(),
  updateToolMock: vi.fn(),
  updateToolsMock: vi.fn(),
}));

vi.mock("@/lib/tools/tool-availability-service", () => ({
  getToolAvailabilityService: () => ({
    getEffectiveManifestSync: getEffectiveManifestSyncMock,
    summarizeByState: summarizeByStateMock,
  }),
}));

vi.mock("@/lib/tools/tool-settings-service", () => ({
  getToolSettingsService: () => ({
    updateTool: updateToolMock,
    updateTools: updateToolsMock,
  }),
}));

import { executeConfigureToolAvailability } from "./configure-tool-availability.tool";

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.setBundles([{
    id: "admin",
    displayName: "Admin Tools",
    toolNames: ["calculator", "inspect_runtime_context", "admin_search"],
  }]);
  return registry;
}

function manifestFor(tools: Array<{ name: string; staticLocked?: boolean }>) {
  return {
    version: "v1",
    warnings: [],
    tools: tools.map((tool) => ({
      name: tool.name,
      staticLocked: tool.staticLocked ?? false,
    })),
  };
}

describe("configure_tool_availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEffectiveManifestSyncMock.mockReturnValue(manifestFor([
      { name: "calculator" },
      { name: "inspect_runtime_context" },
      { name: "admin_search" },
    ]));
    summarizeByStateMock.mockReturnValue({ enabled: 3 });
    updateToolMock.mockResolvedValue({ overrides: { enabled: [], disabled: ["calculator"] }, warnings: [] });
    updateToolsMock.mockResolvedValue({ overrides: { enabled: [], disabled: ["calculator"] }, warnings: [] });
  });

  it("is admin-only", async () => {
    await expect(executeConfigureToolAvailability(
      createRegistry(),
      { action: "summarize_manifest" },
      { role: "AUTHENTICATED", userId: "user-1" },
    )).rejects.toThrow("admin-only");
  });

  it("does not disable protected tools", async () => {
    const result = await executeConfigureToolAvailability(
      createRegistry(),
      { action: "disable_tool", tool_name: "inspect_runtime_context" },
      { role: "ADMIN", userId: "admin-1" },
    );

    expect(result).toMatchObject({
      changed: false,
      warnings: [{ code: "protected_tool_not_disabled" }],
    });
    expect(updateToolMock).not.toHaveBeenCalled();
  });

  it("does not write overrides for statically locked tools", async () => {
    getEffectiveManifestSyncMock.mockReturnValue(manifestFor([
      { name: "calculator", staticLocked: true },
    ]));

    const result = await executeConfigureToolAvailability(
      createRegistry(),
      { action: "enable_tool", tool_name: "calculator" },
      { role: "ADMIN", userId: "admin-1" },
    );

    expect(result).toMatchObject({
      changed: false,
      warnings: [{ code: "static_config_locked" }],
    });
    expect(updateToolMock).not.toHaveBeenCalled();
  });

  it("skips protected and statically locked tools in bundle disables", async () => {
    getEffectiveManifestSyncMock.mockReturnValue(manifestFor([
      { name: "calculator" },
      { name: "inspect_runtime_context" },
      { name: "admin_search", staticLocked: true },
    ]));

    const result = await executeConfigureToolAvailability(
      createRegistry(),
      { action: "disable_bundle", bundle_id: "admin" },
      { role: "ADMIN", userId: "admin-1" },
    );

    expect(updateToolsMock).toHaveBeenCalledWith(["calculator"], false);
    expect(result).toMatchObject({
      affectedTools: ["calculator"],
      skippedProtectedTools: ["inspect_runtime_context"],
      skippedStaticLockedTools: ["admin_search"],
    });
  });
});
