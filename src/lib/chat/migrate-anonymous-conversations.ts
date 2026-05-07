import { cookies } from "next/headers";
import { clearAnonSession } from "@/lib/chat/resolve-user";
import { getTrackedLinkService } from "@/lib/tracked-links/tracked-link-service";
import { createIdentityMigrationService } from "./identity-migration-root";

export async function migrateAnonymousConversationsToUser(
  userId: string,
  source: "login" | "registration",
): Promise<{ migratedConversationIds: string[] }> {
  const cookieStore = await cookies();
  const anonCookie = cookieStore.get("lms_anon_session")?.value;

  if (!anonCookie) {
    return { migratedConversationIds: [] };
  }

  const anonUserId = `anon_${anonCookie}`;
  const migration = await createIdentityMigrationService().execute({
    sourceUserId: anonUserId,
    targetUserId: userId,
    source,
  });

  await clearAnonSession();
  if (source === "registration" && migration.migratedConversationIds.length > 0) {
    await getTrackedLinkService().recordSignupForConversations({
      conversationIds: migration.migratedConversationIds,
      userId,
    });
  }

  return { migratedConversationIds: [...migration.migratedConversationIds] };
}
