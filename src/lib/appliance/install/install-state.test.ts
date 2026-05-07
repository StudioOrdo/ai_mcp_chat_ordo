import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureDbSchemaMock, hasCredentialedAdminOwnerMock } = vi.hoisted(() => ({
  ensureDbSchemaMock: vi.fn(),
  hasCredentialedAdminOwnerMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ensureDbSchema: ensureDbSchemaMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getUserDataMapper: () => ({
    hasCredentialedAdminOwner: hasCredentialedAdminOwnerMock,
  }),
}));

import { resolveInstallState } from "./install-state";

describe("resolveInstallState", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    ensureDbSchemaMock.mockReset();
    hasCredentialedAdminOwnerMock.mockReset();
    hasCredentialedAdminOwnerMock.mockReturnValue(false);
  });

  it("allows local setup when no credentialed admin owner exists", () => {
    expect(resolveInstallState()).toMatchObject({
      ready: true,
      state: "ready_for_setup",
      hostedMode: "local",
      ownerConfigured: false,
      setupAllowed: true,
      installTokenRequired: false,
    });
  });

  it("requires a token in hosted mode before an owner exists", () => {
    vi.stubEnv("ORDO_HOSTED_MODE", "reverse_proxy");
    vi.stubEnv("ORDO_PUBLIC_ORIGIN", "https://tenant.example.com");

    expect(resolveInstallState()).toMatchObject({
      ready: true,
      state: "token_required",
      hostedMode: "reverse_proxy",
      ownerConfigured: false,
      setupAllowed: false,
      installTokenRequired: true,
    });
  });

  it("locks setup when a credentialed admin owner exists even without provider keys", () => {
    hasCredentialedAdminOwnerMock.mockReturnValue(true);

    expect(resolveInstallState()).toMatchObject({
      ready: true,
      state: "initialized_locked",
      ownerConfigured: true,
      setupAllowed: false,
      installTokenRequired: false,
    });
  });

  it("reports blocked state when storage cannot be inspected", () => {
    ensureDbSchemaMock.mockImplementation(() => {
      throw new Error("database is read-only");
    });

    expect(resolveInstallState()).toMatchObject({
      ready: false,
      state: "blocked",
      setupAllowed: false,
      message: "database is read-only",
    });
  });
});
