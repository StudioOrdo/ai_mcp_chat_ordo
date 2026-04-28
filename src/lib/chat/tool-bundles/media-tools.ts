import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  getJobQueueRepository,
  getUserFileDataMapper,
} from "@/adapters/RepositoryFactory";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

interface MediaToolRegistrationDeps {
  readonly jobQueueRepository: ReturnType<typeof getJobQueueRepository>;
  readonly userFileRepository: ReturnType<typeof getUserFileDataMapper>;
}

export const MEDIA_BUNDLE: ToolBundleDescriptor = createCatalogBoundToolBundle(
  "media",
  "Media Tools",
);

export function registerMediaTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "media", {
    jobQueueRepository: getJobQueueRepository(),
    userFileRepository: getUserFileDataMapper(),
  }, (toolName, deps) => {
    if (toolName === "compose_media") {
      return { jobQueueRepository: deps.jobQueueRepository };
    }

    if (toolName === "list_conversation_media_assets") {
      return { userFileRepository: deps.userFileRepository };
    }

    return {};
  });
}
