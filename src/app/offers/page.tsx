import type { Metadata } from "next";

import {
  OwnerOffersWorkspace,
  PublicOffersSurface,
} from "@/components/offers/OfferSurfaces";
import { getSessionUser } from "@/lib/auth";
import {
  loadOwnerOffersWorkspace,
  loadPublicOffersPageData,
} from "@/lib/offers/load-offers-workspace";

export const metadata: Metadata = {
  title: "Offers | Studio Ordo",
  description:
    "Current public offers for this Ordo instance.",
};

export const dynamic = "force-dynamic";

export default async function OffersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (!user.roles.includes("ANONYMOUS")) {
    const workspace = await loadOwnerOffersWorkspace(user, await searchParams);
    return <OwnerOffersWorkspace userName={user.name} workspace={workspace} />;
  }

  const data = await loadPublicOffersPageData();
  return <PublicOffersSurface data={data} />;
}
