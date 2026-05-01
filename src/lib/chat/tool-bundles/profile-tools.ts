import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { getJobStatusQuery } from "@/adapters/RepositoryFactory";
import { createProfileService } from "@/lib/profile/profile-service";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const PROFILE_BUNDLE: ToolBundleDescriptor = createCatalogBoundToolBundle(
  "profile",
  "Profile Tools",
);

export function registerProfileTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "profile", {
    profileService: createProfileService(),
    jobStatusQuery: getJobStatusQuery(),
  }, (toolName, deps) => {
    if (toolName === "get_my_job_status" || toolName === "list_my_jobs") {
      return { jobStatusQuery: deps.jobStatusQuery };
    }

    return { profileService: deps.profileService };
  });
}
