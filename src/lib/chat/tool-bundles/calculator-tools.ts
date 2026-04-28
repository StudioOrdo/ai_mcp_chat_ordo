import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const CALCULATOR_BUNDLE = createCatalogBoundToolBundle(
  "calculator",
  "Calculator Tools",
);

export function registerCalculatorTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "calculator", {});
}
