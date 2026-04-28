import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, consumeMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  consumeMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser: getSessionUserMock }));

vi.mock("@/lib/lifecycle/lifecycle-queue", () => ({
  consumePendingLifecycleEvents: consumeMock,
}));

import { GET } from "@/app/api/lifecycle/context/route";
import { createAnonymousUser, createApprenticeUser } from "@/__test-utils__";


describe("/api/lifecycle/context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list for anonymous users without draining the queue", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousUser({ id: "usr_anonymous" }));

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ items: [] });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("returns an empty list when there is no session user", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ items: [] });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("returns lifecycle+coach pairs for each drained event", async () => {
    getSessionUserMock.mockResolvedValue(createApprenticeUser({ id: "usr_42" }));
    consumeMock.mockResolvedValue([
      { variant: "installed", occurredAt: "2026-04-22T00:00:00.000Z" },
      { variant: "role_changed", occurredAt: "2026-04-22T00:01:00.000Z", actor: "Admin" },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(consumeMock).toHaveBeenCalledWith("usr_42");
    expect(body.items).toHaveLength(2);
    for (const item of body.items) {
      expect(item.lifecycle.family).toBe("system");
      expect(item.lifecycle.cardKind).toBe("lifecycle");
      expect(item.lifecycle.payload).toBeDefined();
    }
    expect(body.items[0].coach).not.toBeNull();
    expect(body.items[0].coach.payload.variant).toBe("installed");
    expect(body.items[1].coach.payload.variant).toBe("role_changed");
  });

  it("returns coach: null when the variant has no template (capability_unlocked)", async () => {
    getSessionUserMock.mockResolvedValue(createApprenticeUser({ id: "usr_42" }));
    consumeMock.mockResolvedValue([
      { variant: "capability_unlocked", occurredAt: "2026-04-22T00:00:00.000Z" },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].lifecycle.payload.variant).toBe("capability_unlocked");
    expect(body.items[0].coach).toBeNull();
  });
});
