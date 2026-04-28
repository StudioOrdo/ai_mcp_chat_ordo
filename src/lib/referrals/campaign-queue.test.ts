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
    })
  };
});

import {
  buildCampaignPresetCoachPayload,
  CAMPAIGN_PRESETS,
} from "./campaign-presets";
import {
  consumePendingCampaignCoach,
  peekPendingCampaignCoach,
  queuePendingCampaignCoach,
} from "./campaign-queue";

describe("campaign-queue (Phase 3)", () => {
  beforeEach(() => {
    store.clear();
  });

  it("queues a campaign coach payload and returns it on peek", async () => {
    const payload = buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[0]);
    await queuePendingCampaignCoach("user_1", payload);

    const pending = await peekPendingCampaignCoach("user_1");
    expect(pending).toHaveLength(1);
    expect(pending[0].variant).toBe("campaign_picked");
    expect(pending[0].title).toBe(CAMPAIGN_PRESETS[0].title);
  });

  it("consume drains the queue and subsequent reads are empty", async () => {
    await queuePendingCampaignCoach(
      "user_1",
      buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[0]),
    );

    const drained = await consumePendingCampaignCoach("user_1");
    expect(drained).toHaveLength(1);

    const next = await peekPendingCampaignCoach("user_1");
    expect(next).toHaveLength(0);
  });

  it("skips anonymous user ids", async () => {
    await queuePendingCampaignCoach(
      "usr_anonymous",
      buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[0]),
    );
    await queuePendingCampaignCoach(
      "",
      buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[0]),
    );

    expect(store.size).toBe(0);
  });

  it("refuses to queue a lifecycle-variant coach payload", async () => {
    const lifecycleShape = {
      ...buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[0]),
      variant: "installed" as const,
    };
    // Cast required because queue contract accepts CoachPayload; the
    // runtime `isCampaignVariant` guard is what rejects it.
    await queuePendingCampaignCoach(
      "user_1",
      lifecycleShape as unknown as Parameters<typeof queuePendingCampaignCoach>[1],
    );

    expect(store.size).toBe(0);
  });

  it("trims the queue to the max length when many coach payloads pile up", async () => {
    for (let i = 0; i < 10; i += 1) {
      await queuePendingCampaignCoach(
        "user_1",
        buildCampaignPresetCoachPayload(CAMPAIGN_PRESETS[i % CAMPAIGN_PRESETS.length]),
      );
    }
    const pending = await peekPendingCampaignCoach("user_1");
    expect(pending.length).toBeLessThanOrEqual(4);
  });
});
