import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import { createProfileService } from "@/lib/profile/profile-service";
import { createAdminReferralAnalyticsService } from "@/lib/referrals/admin-referral-analytics";
import { createReferralAnalyticsService } from "@/lib/referrals/referral-analytics";
import {
  createCatalogBoundToolBundle,
  registerCatalogBoundToolBundle,
} from "./bundle-registration";

export const AFFILIATE_BUNDLE: ToolBundleDescriptor = createCatalogBoundToolBundle(
  "affiliate",
  "Affiliate Tools",
);

export function registerAffiliateAnalyticsTools(registry: ToolRegistry): void {
  registerCatalogBoundToolBundle(registry, "affiliate", {
    profileService: createProfileService(),
    analyticsService: createReferralAnalyticsService(),
    adminAnalyticsService: createAdminReferralAnalyticsService(),
  }, (toolName, deps) => {
    if (toolName === "get_my_affiliate_summary" || toolName === "list_my_referral_activity") {
      return {
        profileService: deps.profileService,
        analyticsService: deps.analyticsService,
      };
    }

    if (toolName === "get_admin_affiliate_summary" || toolName === "list_admin_referral_exceptions") {
      return { adminAnalyticsService: deps.adminAnalyticsService };
    }

    return {};
  });
}
