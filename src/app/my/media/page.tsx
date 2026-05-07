import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Media",
  robots: { index: false, follow: false },
};

function firstSearchValue(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : null;
}

function buildStudioMediaRedirectHref(
  rawSearchParams: Record<string, string | string[] | undefined>,
): string {
  const searchParams = new URLSearchParams();
  const query = firstSearchValue(rawSearchParams.q);
  const objectId = firstSearchValue(rawSearchParams.object)
    ?? firstSearchValue(rawSearchParams.assetId)
    ?? firstSearchValue(rawSearchParams.id);

  searchParams.set("kind", "media_asset");

  if (query) {
    searchParams.set("q", query);
  }

  if (objectId) {
    searchParams.set("object", objectId.startsWith("media_asset:")
      ? objectId
      : `media_asset:${objectId}`);
  }

  return `/studio?${searchParams.toString()}`;
}

export default async function MyMediaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  redirect(buildStudioMediaRedirectHref(rawSearchParams));
}
