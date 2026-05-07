import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { getJobStatusQuery } from "@/adapters/RepositoryFactory";
import { createProfileService } from "@/lib/profile/profile-service";
import { createOfferService } from "@/lib/offers/offer-service";
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
    offerService: createOfferService(),
  }, (toolName, deps) => {
    if (toolName === "get_my_job_status" || toolName === "list_my_jobs") {
      return { jobStatusQuery: deps.jobStatusQuery };
    }
    if (toolName === "create_offer") {
      return { offerService: deps.offerService };
    }

    return { profileService: deps.profileService };
  });
}
