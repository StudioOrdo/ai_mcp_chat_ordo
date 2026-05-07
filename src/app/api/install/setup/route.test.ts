import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isSystemInitializedMock,
  ensureDbSchemaMock,
  getUserDataMapperMock,
  hashMock,
  findByEmailMock,
  createUserMock,
  updateRoleMock,
  parseLegacyProviderSettingsInputMock,
  parseProviderSettingsUpdateInputMock,
  applyInstallSettingsMock,
  loginMock,
  cookiesMock,
  cookieSetMock,
  markOnboardedWithoutEmissionMock,
  queuePendingLifecycleEventMock,
  guardInstallMutationMock,
} = vi.hoisted(() => ({
  isSystemInitializedMock: vi.fn(),
  ensureDbSchemaMock: vi.fn(),
  getUserDataMapperMock: vi.fn(),
  hashMock: vi.fn(),
  findByEmailMock: vi.fn(),
  createUserMock: vi.fn(),
  updateRoleMock: vi.fn(),
  parseLegacyProviderSettingsInputMock: vi.fn(),
  parseProviderSettingsUpdateInputMock: vi.fn(),
  applyInstallSettingsMock: vi.fn(),
  loginMock: vi.fn(),
  cookiesMock: vi.fn(),
  cookieSetMock: vi.fn(),
  markOnboardedWithoutEmissionMock: vi.fn(),
  queuePendingLifecycleEventMock: vi.fn(),
  guardInstallMutationMock: vi.fn(),
}));

vi.mock("@/lib/config/ConfigurationService", () => ({
  ConfigurationService: {
    isSystemInitialized: isSystemInitializedMock,
  },
}));

vi.mock("@/lib/appliance/install/install-token", () => ({
  guardInstallMutation: guardInstallMutationMock,
}));

vi.mock("@/lib/db", () => ({
  ensureDbSchema: ensureDbSchemaMock,
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getUserDataMapper: getUserDataMapperMock,
}));

vi.mock("@/adapters/BcryptHasher", () => ({
  BcryptHasher: class {
    hash = hashMock;
  },
}));

vi.mock("@/lib/ai/providers/provider-settings-service", () => ({
  parseLegacyProviderSettingsInput: parseLegacyProviderSettingsInputMock,
  parseProviderSettingsUpdateInput: parseProviderSettingsUpdateInputMock,
  isProviderSettingsFailure: (value: unknown) =>
    typeof value === "object"
    && value !== null
    && "ok" in value
    && value.ok === false,
  providerSettingsService: {
    applyInstallSettings: applyInstallSettingsMock,
  },
}));

vi.mock("@/lib/auth", () => ({
  login: loginMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/lifecycle/onboarded", () => ({
  markOnboardedWithoutEmission: markOnboardedWithoutEmissionMock,
}));

vi.mock("@/lib/lifecycle/lifecycle-queue", () => ({
  queuePendingLifecycleEvent: queuePendingLifecycleEventMock,
}));

import { POST } from "./route";

const parsedSettings = {
  intelligence: {
    provider: "deepseek",
    apiKey: "submitted-deepseek-key",
    model: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com/anthropic",
  },
  openAiKey: null,
  capabilities: {
    image: { provider: "disabled", model: null },
    tts: { provider: "disabled", model: null },
    stt: { provider: "local_whisper", model: null },
    web_search: { provider: "disabled", model: null },
  },
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/install/setup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/install/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSystemInitializedMock.mockReturnValue(false);
    guardInstallMutationMock.mockReturnValue({ ok: true });
    parseLegacyProviderSettingsInputMock.mockReturnValue(null);
    parseProviderSettingsUpdateInputMock.mockReturnValue(parsedSettings);
    applyInstallSettingsMock.mockResolvedValue({
      ok: true,
      snapshot: {},
      warnings: [],
    });
    hashMock.mockResolvedValue("hashed-password");
    findByEmailMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "admin-user", email: "admin@example.com" });
    createUserMock.mockResolvedValue({ id: "admin-user", email: "admin@example.com" });
    updateRoleMock.mockResolvedValue(undefined);
    getUserDataMapperMock.mockReturnValue({
      findByEmail: findByEmailMock,
      create: createUserMock,
      updateRole: updateRoleMock,
      updatePasswordHash: vi.fn(),
    });
    loginMock.mockResolvedValue({
      user: { id: "admin-user" },
      sessionToken: "session-token",
    });
    cookieSetMock.mockReturnValue(undefined);
    cookiesMock.mockResolvedValue({
      set: cookieSetMock,
    });
    markOnboardedWithoutEmissionMock.mockResolvedValue(undefined);
    queuePendingLifecycleEventMock.mockResolvedValue(undefined);
  });

  it("applies provider settings before creating the first admin user", async () => {
    const body = {
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
      adminEmail: "admin@example.com",
      adminPassword: "password123",
    };

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(ensureDbSchemaMock).toHaveBeenCalled();
    expect(parseProviderSettingsUpdateInputMock).toHaveBeenCalledWith(body);
    expect(applyInstallSettingsMock).toHaveBeenCalledWith(parsedSettings);
    expect(applyInstallSettingsMock.mock.invocationCallOrder[0]).toBeLessThan(
      createUserMock.mock.invocationCallOrder[0],
    );
    expect(createUserMock).toHaveBeenCalledWith({
      email: "admin@example.com",
      name: "Admin",
      passwordHash: "hashed-password",
    });
    expect(updateRoleMock).toHaveBeenCalledWith("admin-user", "role_admin");
    expect(cookieSetMock).toHaveBeenCalledWith(
      "lms_session_token",
      "session-token",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(queuePendingLifecycleEventMock).toHaveBeenCalledWith(
      "admin-user",
      expect.objectContaining({ variant: "installed" }),
    );
  });

  it("does not create an admin user when provider settings validation fails", async () => {
    applyInstallSettingsMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "validation_failed",
        message: "deepseek Error: invalid key",
        status: 400,
      },
    });

    const response = await POST(request({
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
      adminEmail: "admin@example.com",
      adminPassword: "password123",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("deepseek Error: invalid key");
    expect(createUserMock).not.toHaveBeenCalled();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("rejects setup after initialization", async () => {
    guardInstallMutationMock.mockReturnValueOnce({
      ok: false,
      response: Response.json({ error: "System is already initialized." }, { status: 400 }),
    });

    const response = await POST(request({
      intelligence: parsedSettings.intelligence,
      capabilities: parsedSettings.capabilities,
      adminEmail: "admin@example.com",
      adminPassword: "password123",
    }));

    expect(response.status).toBe(400);
    expect(applyInstallSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects malformed provider settings before applying setup side effects", async () => {
    parseProviderSettingsUpdateInputMock.mockReturnValueOnce({
      ok: false,
      error: {
        code: "invalid_provider",
        message: "Unsupported intelligence provider.",
        status: 400,
      },
    });

    const response = await POST(request({
      intelligence: { provider: "mystery" },
      adminEmail: "admin@example.com",
      adminPassword: "password123",
    }));

    expect(response.status).toBe(400);
    expect(ensureDbSchemaMock).not.toHaveBeenCalled();
    expect(applyInstallSettingsMock).not.toHaveBeenCalled();
  });
});
