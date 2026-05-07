import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SystemEvent } from "@/core/entities/system-event";

const { getSessionUserMock, listVisibleMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  listVisibleMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  resolveSessionAuthorizationRole: (user: { roles: string[] }) => user.roles[0] ?? "ANONYMOUS",
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getSystemEventDataMapper: () => ({
    listVisible: listVisibleMock,
  }),
}));

import { GET } from "@/app/api/changes/route";

function request(path = "/api/changes"): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function event(overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    id: "sysevt_1",
    sequence: 1,
    type: "today.decision.created",
    occurredAt: "2026-05-07T10:00:00.000Z",
    actorUserId: "usr_owner",
    ownerUserId: "usr_owner",
    objectRef: { kind: "person", id: "person_1", label: "Ava Thompson" },
    sectionIds: ["today"],
    visibility: "owner",
    summary: "Decision created.",
    sourceRefs: [{ sourceKind: "conversation", sourceId: "conv_1", label: "Conversation" }],
    payload: {
      password: "never-return",
      provider: "internal",
      rawLog: "secret",
    },
    createdAt: "2026-05-07T10:00:01.000Z",
    ...overrides,
  };
}

describe("GET /api/changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({
      id: "usr_anonymous",
      email: "anonymous@example.com",
      name: "Anonymous",
      roles: ["ANONYMOUS"],
    });
    listVisibleMock.mockResolvedValue([]);
  });

  it("returns a stable empty response when there are no changes", async () => {
    const response = await GET(request("/api/changes?after=12"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listVisibleMock).toHaveBeenCalledWith({
      viewer: null,
      afterSequence: 12,
      sectionId: null,
      limit: 100,
    });
    expect(payload).toEqual({
      cursor: 12,
      hasMore: false,
      changes: [],
    });
  });

  it("rejects invalid cursors", async () => {
    const response = await GET(request("/api/changes?after=not-a-number"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      errorCode: "VALIDATION_ERROR",
    });
    expect(listVisibleMock).not.toHaveBeenCalled();
  });

  it("returns public changes for anonymous callers without raw payload data", async () => {
    listVisibleMock.mockResolvedValue([
      event({
        id: "sysevt_public",
        sequence: 4,
        type: "offer.public.updated",
        ownerUserId: null,
        visibility: "public",
        sectionIds: ["offers"],
        summary: "Public offer updated.",
      }),
    ]);

    const response = await GET(request("/api/changes?after=3&section=offers&limit=1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listVisibleMock).toHaveBeenCalledWith({
      viewer: null,
      afterSequence: 3,
      sectionId: "offers",
      limit: 1,
    });
    expect(payload).toEqual({
      cursor: 4,
      hasMore: true,
      changes: [
        {
          id: "sysevt_public",
          sequence: 4,
          type: "offer.public.updated",
          occurredAt: "2026-05-07T10:00:00.000Z",
          sectionIds: ["offers"],
          objectRef: { kind: "person", id: "person_1", label: "Ava Thompson" },
          summary: "Public offer updated.",
          sourceRefs: [{ sourceKind: "conversation", sourceId: "conv_1", label: "Conversation" }],
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("never-return");
    expect(JSON.stringify(payload)).not.toContain("rawLog");
    expect(JSON.stringify(payload)).not.toContain("provider");
  });

  it("passes owner identity to the mapper so owner visibility is enforced there", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_owner",
      email: "owner@example.com",
      name: "Owner",
      roles: ["AUTHENTICATED"],
    });
    listVisibleMock.mockResolvedValue([
      event({ sequence: 8 }),
      event({ id: "sysevt_9", sequence: 9, sectionIds: ["studio"] }),
    ]);

    const response = await GET(request("/api/changes?after=7&limit=2"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listVisibleMock).toHaveBeenCalledWith({
      viewer: { userId: "usr_owner", role: "AUTHENTICATED" },
      afterSequence: 7,
      sectionId: null,
      limit: 2,
    });
    expect(payload.cursor).toBe(9);
    expect(payload.hasMore).toBe(true);
    expect(payload.changes.map((change: { sequence: number }) => change.sequence)).toEqual([8, 9]);
  });

  it("passes admin role to the mapper for admin-gated changes", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "usr_admin",
      email: "admin@example.com",
      name: "Admin",
      roles: ["ADMIN"],
    });

    const response = await GET(request("/api/changes?after=0&section=system"));

    expect(response.status).toBe(200);
    expect(listVisibleMock).toHaveBeenCalledWith({
      viewer: { userId: "usr_admin", role: "ADMIN" },
      afterSequence: 0,
      sectionId: "system",
      limit: 100,
    });
  });
});
