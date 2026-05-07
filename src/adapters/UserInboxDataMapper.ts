import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  SystemEventObjectRef,
  SystemEventSourceRef,
} from "@/core/entities/system-event";
import type {
  UserInboxItem,
  UserInboxViewer,
  UserSectionCursor,
  UserSectionUnreadCount,
} from "@/core/entities/user-inbox";

interface InboxEventRow {
  id: string;
  sequence: number;
  event_type: string;
  owner_user_id: string | null;
  section_id: string;
}

interface UserInboxItemRow {
  id: string;
  user_id: string;
  system_event_id: string;
  system_event_sequence: number;
  section_id: string;
  item_key: string;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  event_type: string;
  occurred_at: string;
  object_kind: string | null;
  object_id: string | null;
  object_label: string | null;
  summary: string;
  source_refs_json: string;
  last_read_sequence: number | null;
}

interface UserSectionCursorRow {
  user_id: string;
  section_id: string;
  last_read_sequence: number;
  updated_at: string;
}

interface UserSectionUnreadCountRow {
  section_id: string;
  unread_count: number;
}

export interface MaterializeUserInboxInput {
  userId: string;
  role?: string | null;
  sectionId?: string | null;
  afterSequence?: number | null;
  limit?: number | null;
}

export interface ListUserInboxInput {
  userId: string;
  viewer: UserInboxViewer;
  sectionId?: string | null;
  includeDismissed?: boolean;
  limit?: number | null;
}

export interface SectionReadInput {
  userId: string;
  sectionId: string;
  throughSequence: number;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLimit(limit: number | null | undefined): number {
  return typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0
    ? Math.min(limit, 500)
    : 100;
}

function normalizeAfterSequence(sequence: number | null | undefined): number {
  return typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence >= 0
    ? sequence
    : 0;
}

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function isAdminViewer(viewer: UserInboxViewer | null | undefined): boolean {
  const role = viewer?.role?.toUpperCase();
  return role === "ADMIN" || role === "SYSTEM";
}

function assertCanReadUserInbox(userId: string, viewer: UserInboxViewer | null | undefined): void {
  if (!viewer?.userId) {
    throw new Error("Authenticated user is required to read inbox state.");
  }
  if (viewer.userId !== userId && !isAdminViewer(viewer)) {
    throw new Error("Viewer cannot read another user's inbox.");
  }
}

function normalizeObjectRef(row: UserInboxItemRow): SystemEventObjectRef | null {
  if (!row.object_kind || !row.object_id) return null;
  return {
    kind: row.object_kind,
    id: row.object_id,
    ...(row.object_label ? { label: row.object_label } : {}),
  };
}

function mapItem(row: UserInboxItemRow): UserInboxItem {
  const lastReadSequence = row.last_read_sequence ?? 0;
  const isRead = row.read_at !== null || row.system_event_sequence <= lastReadSequence;
  return {
    id: row.id,
    userId: row.user_id,
    systemEventId: row.system_event_id,
    systemEventSequence: row.system_event_sequence,
    sectionId: row.section_id,
    itemKey: row.item_key,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    summary: row.summary,
    objectRef: normalizeObjectRef(row),
    sourceRefs: parseJson<SystemEventSourceRef[]>(row.source_refs_json, []),
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isRead,
    isDismissed: row.dismissed_at !== null,
  };
}

function mapCursor(row: UserSectionCursorRow): UserSectionCursor {
  return {
    userId: row.user_id,
    sectionId: row.section_id,
    lastReadSequence: row.last_read_sequence,
    updatedAt: row.updated_at,
  };
}

export class UserInboxDataMapper {
  constructor(private readonly db: Database.Database) {}

  async materializeVisibleEventsForUser(input: MaterializeUserInboxInput): Promise<UserInboxItem[]> {
    const userId = nonEmpty(input.userId, "userId");
    const role = input.role?.toUpperCase() ?? "";
    const clauses = [
      "e.sequence > ?",
      "(e.visibility = 'public' OR (e.visibility = 'owner' AND e.owner_user_id = ?)",
    ];
    const params: unknown[] = [normalizeAfterSequence(input.afterSequence), userId];

    if (role === "ADMIN" || role === "SYSTEM") {
      clauses[1] += " OR e.visibility = 'admin'";
    }
    clauses[1] += ")";

    if (input.sectionId?.trim()) {
      clauses.push("section.value = ?");
      params.push(input.sectionId.trim());
    }

    const events = this.db.prepare(
      `SELECT e.id, e.sequence, e.event_type, e.owner_user_id, section.value AS section_id
       FROM system_events e, json_each(e.section_ids_json) AS section
       WHERE ${clauses.join(" AND ")}
       ORDER BY e.sequence ASC
       LIMIT ?`,
    ).all(...params, normalizeLimit(input.limit)) as InboxEventRow[];

    const insert = this.db.prepare(
      `INSERT INTO user_inbox_items (
         id, user_id, system_event_id, system_event_sequence, section_id,
         item_key, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, system_event_id, section_id) DO NOTHING`,
    );
    const now = new Date().toISOString();
    const transaction = this.db.transaction((rows: InboxEventRow[]) => {
      for (const event of rows) {
        insert.run(
          `uin_${randomUUID()}`,
          userId,
          event.id,
          event.sequence,
          event.section_id,
          `${event.section_id}:${event.id}`,
          now,
          now,
        );
      }
    });
    transaction(events);

    return this.listForUser({
      userId,
      viewer: { userId, role: input.role },
      sectionId: input.sectionId,
      limit: input.limit,
    });
  }

  async listForUser(input: ListUserInboxInput): Promise<UserInboxItem[]> {
    const userId = nonEmpty(input.userId, "userId");
    assertCanReadUserInbox(userId, input.viewer);

    const clauses = ["i.user_id = ?"];
    const params: unknown[] = [userId];
    if (input.sectionId?.trim()) {
      clauses.push("i.section_id = ?");
      params.push(input.sectionId.trim());
    }
    if (!input.includeDismissed) {
      clauses.push("i.dismissed_at IS NULL");
    }

    const rows = this.db.prepare(
      `SELECT
         i.*,
         e.event_type,
         e.occurred_at,
         e.object_kind,
         e.object_id,
         e.object_label,
         e.summary,
         e.source_refs_json,
         c.last_read_sequence
       FROM user_inbox_items i
       INNER JOIN system_events e ON e.id = i.system_event_id
       LEFT JOIN user_section_cursors c
         ON c.user_id = i.user_id
        AND c.section_id = i.section_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY i.system_event_sequence ASC
       LIMIT ?`,
    ).all(...params, normalizeLimit(input.limit)) as UserInboxItemRow[];

    return rows.map(mapItem);
  }

  async getUnreadCounts(userId: string, viewer: UserInboxViewer): Promise<UserSectionUnreadCount[]> {
    const normalizedUserId = nonEmpty(userId, "userId");
    assertCanReadUserInbox(normalizedUserId, viewer);
    const rows = this.db.prepare(
      `SELECT i.section_id, COUNT(*) AS unread_count
       FROM user_inbox_items i
       LEFT JOIN user_section_cursors c
         ON c.user_id = i.user_id
        AND c.section_id = i.section_id
       WHERE i.user_id = ?
         AND i.dismissed_at IS NULL
         AND i.read_at IS NULL
         AND i.system_event_sequence > COALESCE(c.last_read_sequence, 0)
       GROUP BY i.section_id
       ORDER BY i.section_id ASC`,
    ).all(normalizedUserId) as UserSectionUnreadCountRow[];

    return rows.map((row) => ({
      sectionId: row.section_id,
      unreadCount: row.unread_count,
    }));
  }

  async markSectionRead(input: SectionReadInput, now = new Date().toISOString()): Promise<UserSectionCursor> {
    const userId = nonEmpty(input.userId, "userId");
    const sectionId = nonEmpty(input.sectionId, "sectionId");
    const throughSequence = normalizeAfterSequence(input.throughSequence);

    this.db.prepare(
      `INSERT INTO user_section_cursors (user_id, section_id, last_read_sequence, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, section_id) DO UPDATE SET
         last_read_sequence = MAX(user_section_cursors.last_read_sequence, excluded.last_read_sequence),
         updated_at = excluded.updated_at`,
    ).run(userId, sectionId, throughSequence, now);

    const cursor = await this.findSectionCursor(userId, sectionId);
    if (!cursor) {
      throw new Error("Failed to read updated section cursor.");
    }
    return cursor;
  }

  async markItemRead(userId: string, inboxItemId: string, now = new Date().toISOString()): Promise<UserInboxItem> {
    const normalizedUserId = nonEmpty(userId, "userId");
    const normalizedInboxItemId = nonEmpty(inboxItemId, "inboxItemId");
    const result = this.db.prepare(
      `UPDATE user_inbox_items
       SET read_at = COALESCE(read_at, ?),
           updated_at = ?
       WHERE user_id = ?
         AND id = ?`,
    ).run(now, now, normalizedUserId, normalizedInboxItemId);
    if (result.changes === 0) {
      throw new Error("Inbox item was not found for this user.");
    }
    const item = await this.findItemForUser(normalizedUserId, normalizedInboxItemId);
    if (!item) {
      throw new Error("Failed to read updated inbox item.");
    }
    return item;
  }

  async dismissItem(userId: string, inboxItemId: string, now = new Date().toISOString()): Promise<UserInboxItem> {
    const normalizedUserId = nonEmpty(userId, "userId");
    const normalizedInboxItemId = nonEmpty(inboxItemId, "inboxItemId");
    const result = this.db.prepare(
      `UPDATE user_inbox_items
       SET dismissed_at = COALESCE(dismissed_at, ?),
           updated_at = ?
       WHERE user_id = ?
         AND id = ?`,
    ).run(now, now, normalizedUserId, normalizedInboxItemId);
    if (result.changes === 0) {
      throw new Error("Inbox item was not found for this user.");
    }
    const item = await this.findItemForUser(normalizedUserId, normalizedInboxItemId, true);
    if (!item) {
      throw new Error("Failed to read dismissed inbox item.");
    }
    return item;
  }

  async findSectionCursor(userId: string, sectionId: string): Promise<UserSectionCursor | null> {
    const row = this.db.prepare(
      `SELECT *
       FROM user_section_cursors
       WHERE user_id = ?
         AND section_id = ?`,
    ).get(userId, sectionId) as UserSectionCursorRow | undefined;
    return row ? mapCursor(row) : null;
  }

  private async findItemForUser(
    userId: string,
    inboxItemId: string,
    includeDismissed = false,
  ): Promise<UserInboxItem | null> {
    const items = await this.listForUser({
      userId,
      viewer: { userId },
      includeDismissed,
      limit: 500,
    });
    return items.find((item) => item.id === inboxItemId) ?? null;
  }
}
