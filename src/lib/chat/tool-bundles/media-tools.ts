import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  getAssetCatalogReader,
  getJobQueueRepository,
} from "@/adapters/RepositoryFactory";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

interface MediaToolRegistrationDeps {
  readonly assetCatalogReader: ReturnType<typeof getAssetCatalogReader>;
  readonly jobQueueRepository: ReturnType<typeof getJobQueueRepository>;
}

export const MEDIA_BUNDLE: ToolBundleDescriptor = createCatalogBoundToolBundle(
  "media",
  "Media Tools",
);

export function registerMediaTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "media", {
    assetCatalogReader: getAssetCatalogReader(),
    jobQueueRepository: getJobQueueRepository(),
  }, (toolName, deps) => {
    if (toolName === "compose_media") {
      return { jobQueueRepository: deps.jobQueueRepository };
    }

    if (toolName === "list_conversation_media_assets") {
      return { assetCatalogReader: deps.assetCatalogReader };
    }

    return {};
  });
}
