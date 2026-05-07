import type { Metadata } from "next";

import {
  OwnerAboutWorkspace,
  PublicAboutSurface,
} from "@/components/about/AboutSurfaces";
import { getSessionUser } from "@/lib/auth";
import {
  loadAboutWorkspace,
  loadPublicAboutPageData,
} from "@/lib/about/load-about-workspace";

export const metadata: Metadata = {
  title: "About | Studio Ordo",
  description:
    "Studio Ordo is an open-source AI operator platform for solopreneurs. Self-hosted, GPL-3 licensed, and built to grow with your business.",
};

export const dynamic = "force-dynamic";

export default async function AboutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (!user.roles.includes("ANONYMOUS")) {
    const rawSearchParams = searchParams ? await searchParams : {};
    const workspace = await loadAboutWorkspace(rawSearchParams);
    return <OwnerAboutWorkspace userName={user.name} workspace={workspace} />;
  }

  const data = loadPublicAboutPageData();
  return <PublicAboutSurface data={data} />;
}
