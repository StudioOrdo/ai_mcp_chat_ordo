import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import type { IdentityMigrationEvent } from "@/core/entities/identity-migration";
import { ensureSchema } from "@/lib/db/schema";

import { IdentityMigrationDataMapper } from "./IdentityMigrationDataMapper";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function event(overrides: Partial<IdentityMigrationEvent> = {}): IdentityMigrationEvent {
  return {
    id: "idmig_1",
    sourceUserId: "anon_seed_1",
    targetUserId: "usr_1",
    migratedConversationIds: ["conv_1"],
    migratedJobIds: [],
    migratedAssetIds: [],
    repairedMemoryRefs: [],
    repairedSearchSourceIds: [],
    objectCounts: [{ kind: "conversation", attempted: 1, migrated: 1, failed: 0 }],
    repairRefs: [],
    status: "started",
    currentStage: "conversation_transfer",
    failureMessage: null,
    createdAt: "2026-04-30T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("IdentityMigrationDataMapper", () => {
  let mapper: IdentityMigrationDataMapper;

  beforeEach(() => {
    const db = createDb();
    db.prepare(`INSERT INTO users (id, email, name) VALUES ('anon_seed_1', 'anon@example.com', 'Anon')`).run();
    db.prepare(`INSERT INTO users (id, email, name) VALUES ('usr_1', 'user@example.com', 'User')`).run();
    mapper = new IdentityMigrationDataMapper(db);
  });

  it("records, updates, and reads identity migration events", async () => {
    await mapper.record(event());

    const completed = event({
      status: "completed",
      currentStage: "completed",
      migratedJobIds: ["job_1"],
      repairedSearchSourceIds: ["anon_seed_1/conv_1"],
      objectCounts: [
        { kind: "conversation", attempted: 1, migrated: 1, failed: 0 },
        { kind: "job", attempted: 1, migrated: 1, failed: 0 },
      ],
      repairRefs: [
        {
          kind: "search_source",
          id: "anon_seed_1/conv_1",
          status: "repaired",
          evidenceRefs: [],
        },
      ],
      completedAt: "2026-04-30T10:01:00.000Z",
    });
    await mapper.update(completed);

    await expect(mapper.findById("idmig_1")).resolves.toEqual(completed);
  });

  it("returns the newest event by source and target identity", async () => {
    await mapper.record(event({ id: "idmig_old", createdAt: "2026-04-30T10:00:00.000Z" }));
    await mapper.record(event({ id: "idmig_new", createdAt: "2026-04-30T10:05:00.000Z" }));

    await expect(mapper.findLatestForSourceIdentity("anon_seed_1")).resolves.toEqual(
      expect.objectContaining({ id: "idmig_new" }),
    );
    await expect(mapper.findLatestForTargetIdentity("usr_1")).resolves.toEqual(
      expect.objectContaining({ id: "idmig_new" }),
    );
  });
});
