import type { MetadataRoute } from "next";
import { getInstanceIdentity } from "@/lib/config/instance";

export default function robots(): MetadataRoute.Robots {
  const identity = getInstanceIdentity();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/feed", "/offers", "/about"],
        disallow: [
          "/api/",
          "/login",
          "/register",
          "/profile",
          "/library",
          "/library/",
          "/journal",
          "/journal/",
          "/blog",
          "/blog/",
        ],
      },
    ],
    sitemap: `https://${identity.domain}/sitemap.xml`,
  };
}
