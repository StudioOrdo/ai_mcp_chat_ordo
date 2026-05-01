import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { getJobStatusQuery } from "@/adapters/RepositoryFactory";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const JOB_BUNDLE: ToolBundleDescriptor = createCatalogBoundToolBundle(
  "job",
  "Job Tools",
);

export function registerJobTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "job", {
    jobStatusQuery: getJobStatusQuery(),
  }, (_toolName, deps) => ({ jobStatusQuery: deps.jobStatusQuery }));
}
