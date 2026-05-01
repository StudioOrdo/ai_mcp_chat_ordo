import { describe, expect, it, vi } from "vitest";

const {
  assetCatalogReader,
  jobQueueRepository,
  registerCatalogBoundToolsForBundleWithDepsResolverMock,
} = vi.hoisted(() => ({
  assetCatalogReader: { listReusableMediaAssets: vi.fn() },
  jobQueueRepository: { appendEvent: vi.fn() },
  registerCatalogBoundToolsForBundleWithDepsResolverMock: vi.fn(),
}));

vi.mock("@/core/capability-catalog/runtime-tool-binding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/capability-catalog/runtime-tool-binding")>();
  return {
    ...actual,
    registerCatalogBoundToolsForBundleWithDepsResolver: registerCatalogBoundToolsForBundleWithDepsResolverMock,
  };
});

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getAssetCatalogReader: () => assetCatalogReader,
      getJobQueueRepository: () => jobQueueRepository,
    })
  };
});

import { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { registerMediaTools } from "./media-tools";

describe("registerMediaTools", () => {
  it("wires compose_media and media discovery through the expected catalog deps", () => {
    const registry = new ToolRegistry();

    registerMediaTools(registry);

    expect(registerCatalogBoundToolsForBundleWithDepsResolverMock).toHaveBeenCalledWith(
      registry,
      "media",
      expect.any(Function),
    );

    const resolveDeps = registerCatalogBoundToolsForBundleWithDepsResolverMock.mock.calls[0]?.[2];
    expect(resolveDeps("compose_media")).toEqual({
      jobQueueRepository,
    });
    expect(resolveDeps("list_conversation_media_assets")).toEqual({
      assetCatalogReader,
    });
  });
});
