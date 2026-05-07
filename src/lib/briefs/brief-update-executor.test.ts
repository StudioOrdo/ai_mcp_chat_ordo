import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { BriefReadModelDataMapper } from "@/adapters/BriefReadModelDataMapper";
import { BriefUpdateRequestDataMapper } from "@/adapters/BriefUpdateRequestDataMapper";
import {
  createBriefEvidenceManifest,
  type BriefEvidenceRef,
  type SectionBrief,
} from "@/core/entities/brief";
import type { BriefUpdateRequest } from "@/core/entities/brief-execution";
import { ensureSchema } from "@/lib/db/schema";

import {
  BriefUpdateExecutionError,
  BriefUpdateExecutor,
} from "./brief-update-executor";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run("usr_1", "owner@example.com", "Owner");
  return db;
}

function request(overrides: Partial<BriefUpdateRequest> = {}): BriefUpdateRequest {
  return {
    schemaVersion: "1",
    requestId: "brief_req_1",
    briefType: "today",
    scope: {
      sectionId: "today",
      ownerUserId: "usr_1",
    },
    evidenceWindow: {
      from: "2026-05-06T11:00:00.000Z",
      to: "2026-05-06T12:00:00.000Z",
    },
    visibilityPolicy: "owner",
    executorProfile: {
      kind: "deterministic",
    },
    ...overrides,
  };
}

function evidence(overrides: Partial<BriefEvidenceRef> = {}): BriefEvidenceRef {
  return {
    kind: "person",
    id: "person_1",
    label: "Keith Williams",
    href: "/people?person=person_1",
    visibility: "owner",
    ...overrides,
  };
}

function priorBrief(overrides: Partial<SectionBrief> = {}): SectionBrief {
  return {
    id: "brief_today_prior",
    sectionId: "today",
    asOf: "2026-05-06T10:00:00.000Z",
    status: "fresh",
    title: "Today Brief",
    summary: "Prior brief remains current unless reconciliation succeeds.",
    bullets: ["Review the prior source."],
    recommendedAction: { label: "Review prior", href: "/workspace" },
    evidenceRefs: [evidence({ id: "person_prior", label: "Prior relationship" })],
    limitations: [],
    version: 1,
    ...overrides,
  };
}

describe("BriefUpdateExecutor", () => {
  let db: Database.Database;
  let requests: BriefUpdateRequestDataMapper;
  let briefs: BriefReadModelDataMapper;
  const now = () => "2026-05-06T12:00:01.000Z";

  beforeEach(() => {
    db = createDb();
    requests = new BriefUpdateRequestDataMapper(db);
    briefs = new BriefReadModelDataMapper(db);
  });

  it("claims a valid request, stages a brief and manifest, and reconciles current section brief", async () => {
    const updateRequest = request();
    await requests.createRequest({
      request: updateRequest,
      now: "2026-05-06T12:00:00.000Z",
    });

    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence({
        kind: "offer",
        id: "offer_1",
        label: "Strategy offer",
        href: "/offers?offer=offer_1",
      })],
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });
    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(outcome?.reconciled).toBe(true);
    expect(outcome?.request.status).toBe("reconciled");
    expect(outcome?.result.status).toBe("succeeded");
    expect(outcome?.result.artifacts.map((artifact) => artifact.kind)).toEqual([
      "brief",
      "brief_manifest",
    ]);
    expect(current).toMatchObject({
      id: "brief_req_1_brief_v1",
      sectionId: "today",
      status: "fresh",
      isCurrent: true,
    });
    expect(current?.manifest.includedSourceRefs).toEqual([
      expect.objectContaining({ kind: "offer", id: "offer_1" }),
    ]);
  });

  it("reconciles an object-scoped brief so relationship trail events keep the object reference", async () => {
    const updateRequest = request({
      requestId: "brief_req_person",
      briefType: "relationship",
      scope: {
        sectionId: "people",
        objectKind: "person",
        objectId: "person_1",
        objectLabel: "Ava Thompson",
        ownerUserId: "usr_1",
      },
    });
    await requests.createRequest({ request: updateRequest });

    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence({ id: "person_1", label: "Ava Thompson" })],
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });
    const current = await briefs.findCurrentForScope({
      sectionId: "people",
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      objectRef: {
        kind: "person",
        id: "person_1",
        label: "Ava Thompson",
      },
    });
    const events = current ? await briefs.listEventsForBrief(current.id) : [];

    expect(outcome?.reconciled).toBe(true);
    expect(current?.objectRef).toEqual({
      kind: "person",
      id: "person_1",
      label: "Ava Thompson",
    });
    expect(events).toEqual([
      expect.objectContaining({
        eventType: "brief_created",
        objectRef: {
          kind: "person",
          id: "person_1",
          label: "Ava Thompson",
        },
      }),
    ]);
  });

  it("keeps Today Brief recommended actions linked to the evidence that drove the priority", async () => {
    await requests.createRequest({ request: request() });
    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence({
        kind: "operation",
        id: "operation_1",
        label: "Create Media Workflow",
        href: "/operations/operation_1",
      })],
    });

    await executor.runNext({ leaseOwner: "brief_worker" });
    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(current?.evidenceRefs[0]).toEqual(expect.objectContaining({
      kind: "operation",
      id: "operation_1",
      href: "/operations/operation_1",
    }));
    expect(current?.recommendedAction?.href).toBe("/operations/operation_1");
  });

  it("marks missing evidence as a limited brief instead of inventing a claim", async () => {
    await requests.createRequest({ request: request() });
    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [],
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });
    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(outcome?.result.status).toBe("limited");
    expect(current?.status).toBe("limited");
    expect(current?.limitations).toEqual(["No source evidence was available in the selected window."]);
    expect(current?.manifest.claims[0]).toMatchObject({
      evidenceRefIds: [],
      limitation: "No source evidence was available in the selected window.",
    });
  });

  it("fails and preserves the prior current brief when generated claims are not grounded", async () => {
    const prior = priorBrief();
    await briefs.saveSectionBrief({
      brief: prior,
      manifest: createBriefEvidenceManifest({
        brief: prior,
        generatedAt: prior.asOf ?? "2026-05-06T10:00:00.000Z",
        generatedBy: "deterministic:test",
        ownerUserId: "usr_1",
        visibilityPolicy: "owner",
      }),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
      now: "2026-05-06T10:00:01.000Z",
    });
    await requests.createRequest({
      request: request({
        requestId: "brief_req_bad_claim",
        priorBriefId: prior.id,
      }),
    });

    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence()],
      generateDraft: async ({ request: updateRequest }) => {
        const badBrief: SectionBrief = {
          id: "brief_bad_claim",
          sectionId: "today",
          asOf: updateRequest.evidenceWindow.to,
          status: "fresh",
          title: "Today Brief",
          summary: "Ungrounded revenue improvement.",
          bullets: ["Revenue improved without evidence."],
          recommendedAction: { label: "Review", href: "/workspace" },
          evidenceRefs: [],
          limitations: [],
          version: 2,
          priorBriefId: prior.id,
        };
        return {
          brief: badBrief,
          manifest: createBriefEvidenceManifest({
            brief: badBrief,
            generatedAt: now(),
            generatedBy: "brief-executor:deterministic",
            ownerUserId: updateRequest.scope.ownerUserId,
            visibilityPolicy: updateRequest.visibilityPolicy,
            claims: [{
              id: "claim_bad",
              text: "Revenue improved without evidence.",
              evidenceRefIds: [],
            }],
          }),
        };
      },
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });
    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(outcome?.reconciled).toBe(false);
    expect(outcome?.result.status).toBe("failed");
    expect(outcome?.result.error?.message).toContain("must have evidence refs or a limitation");
    expect(current?.id).toBe(prior.id);
  });

  it("fails public-safe updates when evidence is not public", async () => {
    const updateRequest = request({
      requestId: "brief_req_public",
      visibilityPolicy: "public-safe",
    });
    await requests.createRequest({ request: updateRequest });
    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence({ visibility: "private" })],
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });
    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "public-safe",
    });

    expect(outcome?.result.status).toBe("limited");
    expect(current?.status).toBe("limited");
    expect(current?.evidenceRefs).toEqual([]);
    expect(current?.manifest.excludedSourceRefs[0]).toEqual(expect.objectContaining({
      kind: "redacted",
      id: "non_public_1",
      label: "Non-public evidence",
      reason: "Evidence visibility is outside this brief visibility policy.",
    }));
  });

  it("preserves failure diagnostics for admin inspection without overwriting owner brief", async () => {
    const prior = priorBrief();
    await briefs.saveSectionBrief({
      brief: prior,
      manifest: createBriefEvidenceManifest({
        brief: prior,
        generatedAt: prior.asOf ?? "2026-05-06T10:00:00.000Z",
        generatedBy: "deterministic:test",
        ownerUserId: "usr_1",
        visibilityPolicy: "owner",
      }),
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });
    await requests.createRequest({
      request: request({
        requestId: "brief_req_failure",
        priorBriefId: prior.id,
      }),
    });
    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence()],
      generateDraft: async () => {
        throw new BriefUpdateExecutionError(
          "Executor returned a malformed draft.",
          "BRIEF_DRAFT_MALFORMED",
          { adminTrace: "raw executor stderr" },
        );
      },
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });
    const failedRequest = await requests.requireRequest("brief_req_failure");
    const current = await briefs.findCurrentSectionBrief("today", {
      ownerUserId: "usr_1",
      visibilityPolicy: "owner",
    });

    expect(outcome?.result.status).toBe("failed");
    expect(outcome?.result.error?.details).toEqual({ adminTrace: "raw executor stderr" });
    expect(failedRequest.diagnostics.error).toEqual(expect.objectContaining({
      code: "BRIEF_DRAFT_MALFORMED",
    }));
    expect(current?.id).toBe(prior.id);
    expect(current?.summary).not.toContain("stderr");
  });

  it("returns null when no pending brief request can be claimed", async () => {
    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      gatherEvidence: async () => [evidence()],
    });

    expect(await executor.runNext({ leaseOwner: "brief_worker" })).toBeNull();
  });

  it("recovers stale running requests before claiming the next durable brief request", async () => {
    await requests.createRequest({
      request: request({ requestId: "brief_req_stale" }),
      now: "2026-05-06T11:00:00.000Z",
    });
    await requests.claimNext({
      leaseOwner: "dead_worker",
      leaseDurationMs: 1_000,
      now: "2026-05-06T11:00:00.000Z",
    });
    await requests.createRequest({
      request: request({ requestId: "brief_req_next" }),
      now: "2026-05-06T11:30:00.000Z",
    });
    const executor = new BriefUpdateExecutor({
      requests,
      briefs,
      now,
      gatherEvidence: async () => [evidence()],
    });

    const outcome = await executor.runNext({ leaseOwner: "brief_worker" });

    expect((await requests.requireRequest("brief_req_stale")).status).toBe("stale");
    expect(outcome?.request.requestId).toBe("brief_req_next");
    expect(outcome?.request.status).toBe("reconciled");
  });
});
