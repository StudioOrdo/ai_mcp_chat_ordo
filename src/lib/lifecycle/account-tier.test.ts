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
        async getAll(): Promise<UserPreference[]> {
          return [];
        },
      }),
    }),
  };
});

import { ACCOUNT_TIER_PREFERENCE_KEY } from "@/lib/access/content-access";
import { setAccountTier } from "./account-tier";
import { peekPendingLifecycleEvents } from "./lifecycle-queue";

describe("setAccountTier (Phase 2)", () => {
  beforeEach(() => {
    store.clear();
  });

  it("persists the tier and queues a tier_upgraded event on first write", async () => {
    const changed = await setAccountTier("user_1", "premium");

    expect(changed).toBe(true);
    expect(store.get(key("user_1", ACCOUNT_TIER_PREFERENCE_KEY))?.value).toBe(
      "premium",
    );

    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending).toHaveLength(1);
    expect(pending[0].variant).toBe("tier_upgraded");
    expect(pending[0].actor).toBe("Admin");
    expect(pending[0].detail).toContain("premium");
  });

  it("is a no-op when the tier matches the existing value", async () => {
    await setAccountTier("user_1", "premium");
    const changed = await setAccountTier("user_1", "premium");

    expect(changed).toBe(false);
    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending).toHaveLength(1); // only the first write queued
  });

  it("queues an event on transition from premium back to account", async () => {
    await setAccountTier("user_1", "premium");
    const changed = await setAccountTier("user_1", "account");

    expect(changed).toBe(true);
    expect(store.get(key("user_1", ACCOUNT_TIER_PREFERENCE_KEY))?.value).toBe(
      "account",
    );
    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending).toHaveLength(2);
    expect(pending[1].variant).toBe("tier_upgraded");
  });

  it("refuses to write for anonymous user ids", async () => {
    const changed = await setAccountTier("usr_anonymous", "premium");
    expect(changed).toBe(false);
    expect(store.size).toBe(0);
  });

  it("honors actor and detail overrides", async () => {
    await setAccountTier("user_1", "premium", {
      actor: "Billing System",
      detail: "Upgrade via Stripe checkout.",
    });
    const pending = await peekPendingLifecycleEvents("user_1");
    expect(pending[0].actor).toBe("Billing System");
    expect(pending[0].detail).toBe("Upgrade via Stripe checkout.");
  });
});
