import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { getUserPreferencesDataMapper } from "@/adapters/RepositoryFactory";

import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const THEME_BUNDLE: ToolBundleDescriptor = createCatalogBoundToolBundle(
  "theme",
  "Theme Tools",
);

export function registerThemeTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "theme", {
    prefsRepo: getUserPreferencesDataMapper(),
  }, (toolName, deps) => {
    if (toolName === "adjust_ui" || toolName === "set_preference") {
      return { userPreferencesRepo: deps.prefsRepo };
    }

    return {};
  });
}
