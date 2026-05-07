import { describe, expect, it, vi } from "vitest";

const { resolveInstallStateMock } = vi.hoisted(() => ({
  resolveInstallStateMock: vi.fn(),
}));

vi.mock("@/lib/appliance/install/install-state", () => ({
  resolveInstallState: resolveInstallStateMock,
}));

import { GET } from "./route";

describe("/api/install/check", () => {
  it("returns the safe install state DTO", async () => {
    resolveInstallStateMock.mockReturnValue({
      ready: true,
      state: "token_required",
      hostedMode: "reverse_proxy",
      ownerConfigured: false,
      setupAllowed: false,
      installTokenRequired: true,
      message: "Hosted setup requires an install token.",
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ready: true,
      state: "token_required",
      installTokenRequired: true,
    });
  });

  it("uses 500 for blocked install state", async () => {
    resolveInstallStateMock.mockReturnValue({
      ready: false,
      state: "blocked",
      hostedMode: "local",
      ownerConfigured: false,
      setupAllowed: false,
      installTokenRequired: false,
      message: "database is read-only",
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
