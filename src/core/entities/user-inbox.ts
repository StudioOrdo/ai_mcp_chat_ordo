import type { SystemEventObjectRef, SystemEventSourceRef } from "@/core/entities/system-event";

export interface UserInboxViewer {
  userId?: string | null;
  role?: string | null;
}

export interface UserSectionCursor {
  userId: string;
  sectionId: string;
  lastReadSequence: number;
  updatedAt: string;
}

export interface UserInboxItem {
  id: string;
  userId: string;
  systemEventId: string;
  systemEventSequence: number;
  sectionId: string;
  itemKey: string;
  eventType: string;
  occurredAt: string;
  summary: string;
  objectRef: SystemEventObjectRef | null;
  sourceRefs: SystemEventSourceRef[];
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isDismissed: boolean;
}

export interface UserSectionUnreadCount {
  sectionId: string;
  unreadCount: number;
}
