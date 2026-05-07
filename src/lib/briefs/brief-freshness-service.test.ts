import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { BriefReadModelDataMapper } from "@/adapters/BriefReadModelDataMapper";
import { BriefUpdateRequestDataMapper } from "@/adapters/BriefUpdateRequestDataMapper";
import { SystemEventDataMapper } from "@/adapters/SystemEventDataMapper";
import {
  createBriefEvidenceManifest,
  type BriefEvidenceManifest,
  type BriefVisibilityPolicy,
  type SectionBrief,
} from "@/core/entities/brief";
import { ensureSchema } from "@/lib/db/schema";
import { BriefFreshnessService, type BriefFreshnessScope } from "./brief-freshness-service";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`).run("usr_owner", "owner@example.test", "Owner");
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`).run("usr_other", "other@example.test", "Other");
  db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`).run("usr_admin", "admin@example.test", "Admin");
  return db;
}

function brief(overrides: Partial<SectionBrief> = {}): SectionBrief {
  return {
    id: "brief_today_v1",
    sectionId: "today",
    asOf: "2026-05-07T10:00:00.000Z",
    status: "fresh",
    title: "Today Brief",
    summary: "One durable signal is covered.",
    bullets: ["Review the current relationship signal."],
    recommendedAction: { label: "Open person", href: "/business?person=person_1" },
    evidenceRefs: [{
      kind: "person",
      id: "person_1",
      label: "Avery relationship",
      href: "/business?person=person_1",
      visibility: "owner",
    }],
    limitations: [],
    version: 1,
    ...overrides,
  };
}

function manifestFor(
  sourceBrief: SectionBrief,
  input: {
    ownerUserId?: string | null;
    visibilityPolicy?: BriefVisibilityPolicy;
  } = {},
): BriefEvidenceManifest {
  return createBriefEvidenceManifest({
    brief: sourceBrief,
    generatedAt: sourceBrief.asOf ?? "2026-05-07T10:00:00.000Z",
    generatedBy: "deterministic:test",
    ownerUserId: input.ownerUserId ?? "usr_owner",
    visibilityPolicy: input.visibilityPolicy ?? "owner",
  });
}

describe("BriefFreshnessService", () => {
  let briefMapper: BriefReadModelDataMapper;
  let eventMapper: SystemEventDataMapper;
  let requestMapper: BriefUpdateRequestDataMapper;
  let service: BriefFreshnessService;

  const ownerViewer = { userId: "usr_owner", role: "OWNER" };
  const ownerScope: BriefFreshnessScope = {
    sectionId: "today",
    ownerUserId: "usr_owner",
    visibilityPolicy: "owner",
  };

  beforeEach(() => {
    const db = createDb();
    briefMapper = new BriefReadModelDataMapper(db);
    eventMapper = new SystemEventDataMapper(db);
    requestMapper = new BriefUpdateRequestDataMapper(db);
    service = new BriefFreshnessService({
      briefs: briefMapper,
      events: eventMapper,
      updateRequests: requestMapper,
    });
  });

  it("marks a missing owner brief stale when visible durable evidence exists and enqueues a deterministic request", async () => {
    await eventMapper.append({
      id: "evt_today_1",
      type: "today.decision.created",
      occurredAt: "2026-05-07T10:01:00.000Z",
      ownerUserId: "usr_owner",
      objectRef: { kind: "person", id: "person_1", label: "Avery" },
      sectionIds: ["today"],
      visibility: "owner",
      summary: "Owner-safe decision evidence.",
      sourceRefs: [{ sourceKind: "person", sourceId: "person_1", label: "Avery" }],
      payload: { internal: "not returned by freshness" },
    });

    const result = await service.ensureUpdateRequestForStaleBrief({
      scope: ownerScope,
      viewer: ownerViewer,
      requestedFrom: "test",
      now: "2026-05-07T10:02:00.000Z",
    });

    expect(result.freshness).toMatchObject({
      sectionId: "today",
      briefId: null,
      briefAsOfSequence: 0,
      latestEventSequence: 1,
      missingBrief: true,
      isStale: true,
      reason: "No current brief covers the latest durable evidence.",
    });
    expect(result.request).toMatchObject({
      briefType: "today",
      status: "pending",
      requestedByUserId: "usr_owner",
      requestedFrom: "test",
      visibilityPolicy: "owner",
      executorProfile: { kind: "deterministic" },
    });
    expect(result.request?.diagnostics).toEqual({});
  });

  it("marks a brief fresh when its as-of sequence covers the latest visible event", async () => {
    await eventMapper.append({
      id: "evt_today_1",
      type: "today.decision.created",
      occurredAt: "2026-05-07T10:01:00.000Z",
      ownerUserId: "usr_owner",
      sectionIds: ["today"],
      visibility: "owner",
      summary: "Owner-safe decision evidence.",
    });
    const currentBrief = brief();
    await briefMapper.saveSectionBrief({
      brief: currentBrief,
      manifest: manifestFor(currentBrief),
      ownerUserId: "usr_owner",
      visibilityPolicy: "owner",
      asOfSequence: 1,
      now: "2026-05-07T10:02:00.000Z",
    });

    const result = await service.ensureUpdateRequestForStaleBrief({
      scope: ownerScope,
      viewer: ownerViewer,
      now: "2026-05-07T10:03:00.000Z",
    });

    expect(result.freshness).toMatchObject({
      briefId: "brief_today_v1",
      briefAsOfSequence: 1,
      latestEventSequence: 1,
      missingBrief: false,
      isStale: false,
      reason: "Current brief covers visible durable evidence.",
    });
    expect(result.request).toBeNull();
  });

  it("marks a brief stale when a later visible event arrives for the same section", async () => {
    await eventMapper.append({
      id: "evt_today_1",
      type: "today.decision.created",
      occurredAt: "2026-05-07T10:01:00.000Z",
      ownerUserId: "usr_owner",
      sectionIds: ["today"],
      visibility: "owner",
      summary: "First signal.",
    });
    const currentBrief = brief();
    await briefMapper.saveSectionBrief({
      brief: currentBrief,
      manifest: manifestFor(currentBrief),
      ownerUserId: "usr_owner",
      visibilityPolicy: "owner",
      asOfSequence: 1,
    });
    await eventMapper.append({
      id: "evt_today_2",
      type: "today.decision.updated",
      occurredAt: "2026-05-07T10:04:00.000Z",
      ownerUserId: "usr_owner",
      sectionIds: ["today"],
      visibility: "owner",
      summary: "Second signal.",
    });

    const freshness = await service.getBriefFreshness({
      scope: ownerScope,
      viewer: ownerViewer,
    });

    expect(freshness).toMatchObject({
      briefId: "brief_today_v1",
      briefAsOfSequence: 1,
      latestEventSequence: 2,
      isStale: true,
      reason: "Durable evidence is newer than the current brief.",
    });
  });

  it("uses object refs so object briefs are not invalidated by unrelated objects", async () => {
    await eventMapper.append({
      id: "evt_person_1",
      type: "person.updated",
      occurredAt: "2026-05-07T10:01:00.000Z",
      ownerUserId: "usr_owner",
      objectRef: { kind: "person", id: "person_1", label: "Avery" },
      sectionIds: ["people"],
      visibility: "owner",
      summary: "Avery changed.",
    });
    await eventMapper.append({
      id: "evt_person_2",
      type: "person.updated",
      occurredAt: "2026-05-07T10:02:00.000Z",
      ownerUserId: "usr_owner",
      objectRef: { kind: "person", id: "person_2", label: "Morgan" },
      sectionIds: ["people"],
      visibility: "owner",
      summary: "Morgan changed.",
    });
    const objectRef = { kind: "person", id: "person_1", label: "Avery" };
    const personBrief = brief({
      id: "brief_person_1",
      sectionId: "people",
      objectRef,
    });
    await briefMapper.saveSectionBrief({
      brief: personBrief,
      manifest: manifestFor(personBrief),
      ownerUserId: "usr_owner",
      visibilityPolicy: "owner",
      asOfSequence: 1,
    });

    const freshness = await service.getBriefFreshness({
      scope: {
        sectionId: "people",
        ownerUserId: "usr_owner",
        visibilityPolicy: "owner",
        objectRef,
      },
      viewer: ownerViewer,
    });

    expect(freshness).toMatchObject({
      objectRef,
      latestEventSequence: 1,
      isStale: false,
    });
  });

  it("enforces owner, public, and admin freshness visibility without leaking private evidence", async () => {
    await eventMapper.append({
      id: "evt_owner",
      type: "today.created",
      ownerUserId: "usr_owner",
      sectionIds: ["today"],
      visibility: "owner",
      summary: "Owner signal.",
    });
    await expect(service.getBriefFreshness({
      scope: ownerScope,
      viewer: null,
    })).rejects.toThrow("not visible");
    await expect(service.getBriefFreshness({
      scope: ownerScope,
      viewer: { userId: "usr_other", role: "OWNER" },
    })).rejects.toThrow("not visible");

    await eventMapper.append({
      id: "evt_public",
      type: "offer.public.updated",
      sectionIds: ["offers"],
      visibility: "public",
      summary: "Public offer signal.",
    });
    await expect(service.getBriefFreshness({
      scope: {
        sectionId: "offers",
        visibilityPolicy: "public-safe",
      },
      viewer: null,
    })).resolves.toMatchObject({
      latestEventSequence: 2,
      isStale: true,
    });

    await eventMapper.append({
      id: "evt_admin",
      type: "system.backup.completed",
      sectionIds: ["system"],
      visibility: "admin",
      summary: "Backup completed.",
    });
    await expect(service.getBriefFreshness({
      scope: {
        sectionId: "system",
        ownerUserId: "usr_admin",
        visibilityPolicy: "admin",
      },
      viewer: ownerViewer,
    })).rejects.toThrow("not visible");
    await expect(service.getBriefFreshness({
      scope: {
        sectionId: "system",
        ownerUserId: "usr_admin",
        visibilityPolicy: "admin",
      },
      viewer: { userId: "usr_admin", role: "ADMIN" },
    })).resolves.toMatchObject({
      latestEventSequence: 3,
      isStale: true,
    });
  });
});
