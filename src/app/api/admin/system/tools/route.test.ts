import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminPageAccessMock,
  getEffectiveManifestFromSettingsMock,
  summarizeByStateMock,
  updateToolMock,
  updateToolsMock,
  getBundlesMock,
} = vi.hoisted(() => ({
  requireAdminPageAccessMock: vi.fn(),
  getEffectiveManifestFromSettingsMock: vi.fn(),
  summarizeByStateMock: vi.fn(),
  updateToolMock: vi.fn(),
  updateToolsMock: vi.fn(),
  getBundlesMock: vi.fn(),
}));

vi.mock("@/lib/journal/admin-journal", () => ({
  requireAdminPageAccess: requireAdminPageAccessMock,
}));

vi.mock("@/lib/tools/tool-availability-service", () => ({
  getToolAvailabilityService: () => ({
    getEffectiveManifestFromSettings: getEffectiveManifestFromSettingsMock,
    summarizeByState: summarizeByStateMock,
  }),
}));

vi.mock("@/lib/tools/tool-settings-service", () => ({
  getToolSettingsService: () => ({
    updateTool: updateToolMock,
    updateTools: updateToolsMock,
  }),
}));

vi.mock("@/lib/chat/tool-composition-root", () => ({
  getToolComposition: () => ({
    registry: {
      getBundles: getBundlesMock,
    },
  }),
}));

import { GET, POST } from "./route";

const manifest = {
  tools: [],
  warnings: [],
  version: "v1",
};

describe("/api/admin/system/tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageAccessMock.mockResolvedValue({ id: "admin" });
    getEffectiveManifestFromSettingsMock.mockResolvedValue(manifest);
    summarizeByStateMock.mockReturnValue({ enabled: 1 });
    getBundlesMock.mockReturnValue([{
      id: "calculator",
      displayName: "Calculator Tools",
      toolNames: ["calculator"],
    }]);
  });

  it("requires admin access before listing tool settings", async () => {
    await GET();

    expect(requireAdminPageAccessMock).toHaveBeenCalled();
  });

  it("updates a single known toggleable tool", async () => {
    const response = await POST(new Request("http://localhost/api/admin/system/tools", {
      method: "POST",
      body: JSON.stringify({ action: "disable_tool", toolName: "calculator" }),
    }));

    expect(response.status).toBe(200);
    expect(updateToolMock).toHaveBeenCalledWith("calculator", false);
  });

  it("rejects protected tool disablement", async () => {
    const response = await POST(new Request("http://localhost/api/admin/system/tools", {
      method: "POST",
      body: JSON.stringify({ action: "disable_tool", toolName: "inspect_runtime_context" }),
    }));

    expect(response.status).toBe(400);
    expect(updateToolMock).not.toHaveBeenCalled();
  });

  it("rejects changes to statically locked tools", async () => {
    getEffectiveManifestFromSettingsMock.mockResolvedValueOnce({
      ...manifest,
      tools: [{
        name: "calculator",
        staticLocked: true,
      }],
    });

    const response = await POST(new Request("http://localhost/api/admin/system/tools", {
      method: "POST",
      body: JSON.stringify({ action: "enable_tool", toolName: "calculator" }),
    }));

    expect(response.status).toBe(409);
    expect(updateToolMock).not.toHaveBeenCalled();
  });

  it("updates a bundle while skipping protected tools on disable", async () => {
    getBundlesMock.mockReturnValueOnce([{
      id: "admin",
      displayName: "Admin Tools",
      toolNames: ["calculator", "inspect_runtime_context"],
    }]);

    const response = await POST(new Request("http://localhost/api/admin/system/tools", {
      method: "POST",
      body: JSON.stringify({ action: "disable_bundle", bundleId: "admin" }),
    }));

    expect(response.status).toBe(200);
    expect(updateToolsMock).toHaveBeenCalledWith(["calculator"], false);
  });
});
