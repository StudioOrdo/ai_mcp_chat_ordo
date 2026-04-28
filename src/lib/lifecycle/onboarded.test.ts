import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { peekPendingLifecycleEvents } from "./lifecycle-queue";
import {
  ensureOnboardedEmission,
  markOnboardedWithoutEmission,
  ONBOARDED_AT_PREFERENCE_KEY,
} from "./onboarded";

describe("onboarded emission (Phase 2)", () => {
  beforeEach(() => {
    store.clear();
  });

  it("queues an `onboarded` lifecycle event and stamps the preference on first call", async () => {
    await ensureOnboardedEmission("user_1");

    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending).toHaveLength(1);
    expect(pending[0].variant).toBe("onboarded");
    expect(pending[0].actor).toBe("System");

    const stamped = store.get(key("user_1", ONBOARDED_AT_PREFERENCE_KEY));
    expect(stamped?.value).toBeTruthy();
  });

  it("is idempotent: subsequent calls do not re-queue", async () => {
    await ensureOnboardedEmission("user_1");
    await ensureOnboardedEmission("user_1");
    await ensureOnboardedEmission("user_1");

    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending).toHaveLength(1);
  });

  it("skips anonymous user ids without touching storage", async () => {
    await ensureOnboardedEmission("usr_anonymous");
    await ensureOnboardedEmission("");

    expect(store.size).toBe(0);
  });

  it("markOnboardedWithoutEmission stamps the preference but does NOT queue", async () => {
    await markOnboardedWithoutEmission("admin_1");

    const pending = await peekPendingLifecycleEvents("admin_1");
    expect(pending).toHaveLength(0);

    const stamped = store.get(key("admin_1", ONBOARDED_AT_PREFERENCE_KEY));
    expect(stamped?.value).toBeTruthy();
  });

  it("ensureOnboardedEmission after markOnboardedWithoutEmission is a no-op (install admin suppression)", async () => {
    await markOnboardedWithoutEmission("admin_1");
    await ensureOnboardedEmission("admin_1");

    const pending = await peekPendingLifecycleEvents("admin_1");
    expect(pending).toHaveLength(0);
  });
});
