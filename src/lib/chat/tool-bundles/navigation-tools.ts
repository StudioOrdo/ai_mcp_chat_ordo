import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

interface NavigationToolRegistrationDeps {
  readonly registry: ToolRegistry;
}

export const NAVIGATION_BUNDLE = createCatalogBoundToolBundle(
  "navigation",
  "Navigation Tools",
);

export function registerNavigationTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "navigation", { registry }, (toolName, deps) => {
    if (toolName === "inspect_runtime_context") {
      return { registry: deps.registry };
    }

    return {};
  });
}
