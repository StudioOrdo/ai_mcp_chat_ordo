import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import { getJobStatusQuery } from "@/adapters/RepositoryFactory";
import { createProfileService } from "@/lib/profile/profile-service";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

interface ProfileToolRegistrationDeps {
  readonly profileService: ReturnType<typeof createProfileService>;
  readonly jobStatusQuery: JobStatusQuery;
}

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
