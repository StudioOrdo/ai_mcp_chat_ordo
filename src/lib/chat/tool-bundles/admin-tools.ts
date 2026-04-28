import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";

interface AdminToolRegistrationDeps {
  readonly userFileRepository?: ReturnType<typeof getUserFileDataMapper>;
}

export const ADMIN_BUNDLE = createCatalogBoundToolBundle(
  "admin",
  "Admin Tools",
);

export function registerAdminTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "admin", {
    userFileRepository: getUserFileDataMapper(),
  }, (toolName, deps) => {
    if (toolName === "admin_web_search") {
      return { userFileRepository: deps.userFileRepository };
    }

    return {};
  });
}
