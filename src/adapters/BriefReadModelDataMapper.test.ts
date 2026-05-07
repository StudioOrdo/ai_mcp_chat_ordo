import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import {
  createBriefEvidenceManifest,
  type BriefEvidenceManifest,
  type SectionBrief,
} from "@/core/entities/brief";
import { ensureSchema } from "@/lib/db/schema";

import { BriefReadModelDataMapper } from "./BriefReadModelDataMapper";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run("usr_1", "owner@example.com", "Owner");
  return db;
}

function sectionBrief(overrides: Partial<SectionBrief> = {}): SectionBrief {
  return {
    id: "brief_today_v1",
    sectionId: "today",
    asOf: "2026-05-06T12:00:00.000Z",
    status: "fresh",
    title: "Today Brief",
    summary: "One owner decision needs review.",
    bullets: ["Review the offer before publishing."],
    recommendedAction: { label: "Review offer", href: "/offers?offer=offer_1" },
    evidenceRefs: [{
      kind: "offer",
      id: "offer_1",
      label: "Strategy offer",
      href: "/offers?offer=offer_1",
      visibility: "owner",
    }],
    limitations: [],
    version: 1,
    ...overrides,
  };
}

function manifestFor(
  brief: SectionBrief,
  overrides: Partial<BriefEvidenceManifest> = {},
): BriefEvidenceManifest {
  return {
    ...createBriefEvidenceManifest({
      brief,
      generatedAt: brief.asOf ?? "2026-05-06T12:00:00.000Z",
      generatedBy: "deterministic:test",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    }),
    ...overrides,
  };
}

describe("BriefReadModelDataMapper", () => {
  let db: Database.Database;
  let mapper: BriefReadModelDataMapper;

  beforeEach(() => {
    db = createDb();
    mapper = new BriefReadModelDataMapper(db);
  });

  it("creates durable brief schema with current-scope and event indexes", () => {
    const briefColumns = db.pragma("table_info(brief_read_models)") as Array<{ name: string }>;
    const eventColumns = db.pragma("table_info(brief_events)") as Array<{ name: string }>;
    const indexes = db.pragma("index_list(brief_read_models)") as Array<{ name: string; unique: number }>;

    expect(briefColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "id",
      "scope_key",
      "section_id",
      "owner_user_id",
      "visibility_policy",
      "status",
      "version",
      "prior_brief_id",
      "manifest_json",
      "is_current",
    ]));
    expect(eventColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      "brief_id",
      "section_id",
      "event_type",
      "payload_json",
    ]));
    expect(indexes).toContainEqual(expect.objectContaining({
      name: "idx_brief_read_models_current_scope",
      unique: 1,
    }));
  });

  it("stores and reads a current section brief with as-of timestamp, evidence refs, and manifest", async () => {
    const brief = sectionBrief();
    const stored = await mapper.saveSectionBrief({
      brief,
      manifest: manifestFor(brief),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T12:00:01.000Z",
    });

    expect(stored).toMatchObject({
      id: "brief_today_v1",
      sectionId: "today",
      asOf: "2026-05-06T12:00:00.000Z",
      status: "fresh",
      version: 1,
      isCurrent: true,
    });
    expect(stored.evidenceRefs).toEqual([
      expect.objectContaining({ kind: "offer", id: "offer_1", label: "Strategy offer" }),
    ]);
    expect(stored.manifest.claims[0]).toMatchObject({
      text: "Review the offer before publishing.",
      evidenceRefIds: ["offer:offer_1"],
    });

    const current = await mapper.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    expect(current?.id).toBe("brief_today_v1");
  });

  it("updates brief history, marks prior brief superseded, and reflects changed evidence", async () => {
    const first = sectionBrief();
    await mapper.saveSectionBrief({
      brief: first,
      manifest: manifestFor(first),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T12:00:01.000Z",
    });

    const second = sectionBrief({
      id: "brief_today_v2",
      version: 2,
      priorBriefId: first.id,
      asOf: "2026-05-06T13:00:00.000Z",
      bullets: ["Review the new relationship signal before follow-up."],
      evidenceRefs: [{
        kind: "person",
        id: "person_1",
        label: "Avery relationship",
        href: "/business?person=person_1",
        visibility: "owner",
      }],
    });
    await mapper.saveSectionBrief({
      brief: second,
      manifest: manifestFor(second),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T13:00:01.000Z",
    });

    const current = await mapper.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    expect(current?.id).toBe(second.id);
    expect(current?.evidenceRefs).toEqual([
      expect.objectContaining({ kind: "person", id: "person_1" }),
    ]);

    const firstEvents = await mapper.listEventsForBrief(first.id);
    const secondEvents = await mapper.listEventsForBrief(second.id);
    expect(firstEvents.map((event) => event.eventType)).toContain("brief_superseded");
    expect(secondEvents.map((event) => event.eventType)).toContain("brief_updated");
  });

  it("keeps the prior current brief when a new update fails", async () => {
    const currentBrief = sectionBrief();
    await mapper.saveSectionBrief({
      brief: currentBrief,
      manifest: manifestFor(currentBrief),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T12:00:01.000Z",
    });

    const failedBrief = sectionBrief({
      id: "brief_today_failed",
      status: "failed",
      version: 2,
      priorBriefId: currentBrief.id,
      asOf: "2026-05-06T13:00:00.000Z",
      title: "Today Brief failed",
      summary: "The brief update failed, so the previous brief remains current.",
      bullets: [],
      evidenceRefs: [],
      recommendedAction: { label: "Retry brief update", href: "/workspace" },
      limitations: ["The new brief could not be grounded."],
    });
    await mapper.saveSectionBrief({
      brief: failedBrief,
      manifest: manifestFor(failedBrief),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T13:00:01.000Z",
    });

    const current = await mapper.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    const failed = await mapper.findById(failedBrief.id);
    const failedEvents = await mapper.listEventsForBrief(failedBrief.id);

    expect(current?.id).toBe(currentBrief.id);
    expect(failed?.isCurrent).toBe(false);
    expect(failedEvents.map((event) => event.eventType)).toContain("brief_update_failed");
  });

  it("renders missing source evidence as a limited stored brief", async () => {
    const limitedBrief = sectionBrief({
      id: "brief_today_limited",
      status: "limited",
      evidenceRefs: [],
      limitations: ["No source evidence was available in the selected window."],
    });

    const stored = await mapper.saveSectionBrief({
      brief: limitedBrief,
      manifest: manifestFor(limitedBrief),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T12:00:01.000Z",
    });

    expect(stored.status).toBe("limited");
    expect(stored.limitations).toEqual(["No source evidence was available in the selected window."]);
  });

  it("rejects ungrounded claims before storage", async () => {
    const sourceBrief = sectionBrief({ id: "brief_fake", version: 1 });
    await expect(mapper.saveSectionBrief({
      brief: sourceBrief,
      manifest: manifestFor(sourceBrief, {
        claims: [{
          id: "claim_fake",
          text: "Revenue improved 40%.",
          evidenceRefIds: [],
        }],
      }),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    })).rejects.toThrow("must have evidence refs or a limitation");
  });

  it("rejects raw diagnostic copy in owner briefs", async () => {
    const sourceBrief = sectionBrief({
      id: "brief_raw",
      summary: "job_123 failed because provider logs changed.",
    });

    await expect(mapper.saveSectionBrief({
      brief: sourceBrief,
      manifest: manifestFor(sourceBrief),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    })).rejects.toThrow("cannot expose raw job, provider, log, or payload details");
  });

  it("rejects private evidence in public-safe briefs", async () => {
    const publicBrief = sectionBrief({
      id: "brief_public",
      evidenceRefs: [{
        kind: "conversation",
        id: "conv_private",
        label: "Private conversation",
        visibility: "private",
      }],
    });
    const publicManifest = createBriefEvidenceManifest({
      brief: publicBrief,
      generatedAt: "2026-05-06T12:00:00.000Z",
      generatedBy: "deterministic:test",
      ownerUserId: "usr_1",
      visibilityPolicy: "public-safe",
    });

    await expect(mapper.saveSectionBrief({
      brief: publicBrief,
      manifest: publicManifest,
      ownerUserId: "usr_1",
      visibilityPolicy: "public-safe",
    })).rejects.toThrow("Public-safe briefs cannot include private");
  });
});
