import { redirect } from "next/navigation";

import { ProfileSettingsPanel } from "@/components/profile/ProfileSettingsPanel";
import { getSessionUser } from "@/lib/auth";
import { createProfileService } from "@/lib/profile/profile-service";

export const dynamic = "force-dynamic";

type ProfileSection = "info" | "password" | "preferences";

function normalizeProfileSection(value: string | string[] | undefined): ProfileSection {
  const section = Array.isArray(value) ? value[0] : value;

  if (section === "password" || section === "preferences") {
    return section;
  }

  return "info";
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const user = await getSessionUser();

  if (user.roles.includes("ANONYMOUS")) {
    redirect("/login");
  }

  const rawSearchParams = searchParams ? await searchParams : {};
  const requestedSection = Array.isArray(rawSearchParams.section)
    ? rawSearchParams.section[0]
    : rawSearchParams.section;

  if (requestedSection === "referrals") {
    redirect("/referrals");
  }

  const profile = await createProfileService().getProfile(user.id);

  return (
    <ProfileSettingsPanel
      initialProfile={profile}
      initialSection={normalizeProfileSection(requestedSection)}
    />
  );
}
