import { NextResponse } from "next/server";

import { getActivityReadModel } from "@/adapters/RepositoryFactory";
import { getSessionUser } from "@/lib/auth";
import type { ActivityItem } from "@/lib/activity";
import type { FeedNotification } from "@/lib/notifications/feed-notification";

function unauthorized() {
  return NextResponse.json({ error: "Authentication required", errorCode: "AUTH_ERROR" }, { status: 401 });
}

function toFeedNotification(item: ActivityItem): FeedNotification {
  return {
    id: item.id,
    title: item.title,
    body: item.summary,
    href: item.href,
    scope: item.roleVisibility.includes("ADMIN") && !item.roleVisibility.includes("AUTHENTICATED")
      ? "admin"
      : "user",
    unread: !item.receipt.readAt,
    createdAt: item.updatedAt,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    return unauthorized();
  }

  const inbox = await getActivityReadModel().listUserInboxActivity(user.id, { limit: 20 });
  const notifications = inbox.items.map(toFeedNotification);
  return NextResponse.json({ notifications, unreadCount: inbox.unreadCount });
}
