import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";

export const ADMIN_BUNDLE = createCatalogBoundToolBundle(
  "admin",
  "Admin Tools",
);

export function registerAdminTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "admin", {
    registry,
    userFileRepository: getUserFileDataMapper(),
  }, (toolName, deps) => {
    if (toolName === "admin_web_search") {
      return { registry: deps.registry, userFileRepository: deps.userFileRepository };
    }

    return { registry: deps.registry };
  });
}
