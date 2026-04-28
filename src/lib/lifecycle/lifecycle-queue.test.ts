import { describe, expect, it, beforeEach, vi } from "vitest";

import type { UserPreference } from "@/core/ports/UserPreferencesRepository";

interface StubRecord {
  value: string;
}

const store = new Map<string, StubRecord>();

function key(userId: string, k: string): string {
  return `${userId}::${k}`;
}

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getUserPreferencesDataMapper: () => ({
        async get(userId: string, k: string): Promise<UserPreference | null> {
          const record = store.get(key(userId, k));
          if (!record) return null;
          return { key: k, value: record.value, updatedAt: new Date().toISOString() };
        },
        async set(userId: string, k: string, value: string): Promise<void> {
          store.set(key(userId, k), { value });
        },
        async delete(userId: string, k: string): Promise<void> {
          store.delete(key(userId, k));
        },
        async getAll(userId: string): Promise<UserPreference[]> {
          const rows: UserPreference[] = [];
          for (const [storageKey, record] of store.entries()) {
            const [uid, k] = storageKey.split("::");
            if (uid === userId && k) {
              rows.push({ key: k, value: record.value, updatedAt: new Date().toISOString() });
            }
          }
          return rows;
        },
      }),
    })
  };
});

import {
  consumePendingLifecycleEvents,
  peekPendingLifecycleEvents,
  queuePendingLifecycleEvent,
} from "./lifecycle-queue";

describe("lifecycle-queue (Phase 1)", () => {
  beforeEach(() => {
    store.clear();
  });

  it("queues and peeks pending events for a user", async () => {
    await queuePendingLifecycleEvent("user_1", {
      variant: "role_changed",
      occurredAt: "2025-01-01T00:00:00Z",
      actor: "Admin",
      detail: "Role updated to Apprentice.",
    });
    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.variant).toBe("role_changed");
  });

  it("drains events on consume", async () => {
    await queuePendingLifecycleEvent("user_2", {
      variant: "tier_upgraded",
      occurredAt: "2025-01-02T00:00:00Z",
    });
    const drained = await consumePendingLifecycleEvents("user_2");
    expect(drained).toHaveLength(1);
    expect(drained[0]?.variant).toBe("tier_upgraded");
    const after = await peekPendingLifecycleEvents("user_2");
    expect(after).toHaveLength(0);
  });

  it("ignores anonymous user ids", async () => {
    await queuePendingLifecycleEvent("usr_anonymous", {
      variant: "installed",
      occurredAt: "2025-01-03T00:00:00Z",
    });
    expect(await peekPendingLifecycleEvents("usr_anonymous")).toHaveLength(0);
  });

  it("trims the queue to the most recent 8 events", async () => {
    for (let i = 0; i < 12; i += 1) {
      await queuePendingLifecycleEvent("user_3", {
        variant: "capability_unlocked",
        occurredAt: `2025-01-04T00:00:${String(i).padStart(2, "0")}Z`,
        detail: `Event ${i}`,
      });
    }
    const pending = await peekPendingLifecycleEvents("user_3");
    expect(pending).toHaveLength(8);
    expect(pending[0]?.detail).toBe("Event 4");
    expect(pending[7]?.detail).toBe("Event 11");
  });
});
