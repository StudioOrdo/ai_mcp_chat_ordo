import type { MetadataRoute } from "next";

import { getInstanceIdentity } from "@/lib/config/instance";
import { loadPublicShellNavigationContext } from "@/lib/shell/public-shell-state";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const identity = getInstanceIdentity();
  const navigationContext = await loadPublicShellNavigationContext();
  const base = `https://${identity.domain}`;
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    ...(navigationContext.hasPublicFeedItems
      ? [{ url: `${base}/feed`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 }]
      : []),
    { url: `${base}/offers`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
