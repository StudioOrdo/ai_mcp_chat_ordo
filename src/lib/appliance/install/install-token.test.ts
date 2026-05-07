import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveInstallStateMock } = vi.hoisted(() => ({
  resolveInstallStateMock: vi.fn(),
}));

vi.mock("./install-state", () => ({
  resolveInstallState: resolveInstallStateMock,
}));

import { guardInstallMutation, verifyHostedInstallToken } from "./install-token";

describe("install token guard", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resolveInstallStateMock.mockReset();
  });

  it("accepts the hosted install token from the request body", () => {
    vi.stubEnv("ORDO_INSTALL_TOKEN", "setup-secret");

    expect(verifyHostedInstallToken(
      new Request("https://tenant.example.com/api/install/setup"),
      { installToken: "setup-secret" },
    )).toBe(true);
  });

  it("rejects hosted setup without a valid token before side effects", () => {
    vi.stubEnv("ORDO_INSTALL_TOKEN", "setup-secret");
    resolveInstallStateMock.mockReturnValue({
      state: "token_required",
      ownerConfigured: false,
      installTokenRequired: true,
    });

    const result = guardInstallMutation(
      new Request("https://tenant.example.com/api/install/setup", {
        method: "POST",
        headers: { origin: "https://tenant.example.com" },
      }),
      { installToken: "wrong" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("rejects hosted setup from disallowed origins", () => {
    vi.stubEnv("ORDO_HOSTED_MODE", "reverse_proxy");
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "https://tenant.example.com");
    vi.stubEnv("ORDO_INSTALL_TOKEN", "setup-secret");
    resolveInstallStateMock.mockReturnValue({
      state: "token_required",
      ownerConfigured: false,
      installTokenRequired: true,
    });

    const result = guardInstallMutation(
      new Request("https://tenant.example.com/api/install/setup", {
        method: "POST",
        headers: { origin: "https://evil.example.com" },
      }),
      { installToken: "setup-secret" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });
});
