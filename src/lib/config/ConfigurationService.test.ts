import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigurationService } from "./ConfigurationService";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";
import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";

const { resolveInstallStateMock } = vi.hoisted(() => ({
  resolveInstallStateMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    })
  };
});

vi.mock("@/lib/appliance/install/install-state", () => ({
  resolveInstallState: resolveInstallStateMock,
}));

describe("ConfigurationService", () => {
  let mockGetSync: ReturnType<typeof vi.fn<(key: string) => SystemSetting | null>>;
  let mockSetSync: ReturnType<typeof vi.fn<(key: string, valueJson: string) => void>>;
  let mockDelete: ReturnType<typeof vi.fn<(key: string) => Promise<void>>>;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockGetSync = vi.fn();
    mockSetSync = vi.fn();
    mockDelete = vi.fn(async () => undefined);
    resolveInstallStateMock.mockReturnValue({ ownerConfigured: false });
    vi.mocked(RepositoryFactory.getSystemSettingsDataMapper).mockReturnValue({
      getSync: mockGetSync,
      setSync: mockSetSync,
      delete: mockDelete,
    } as Pick<SystemSettingsDataMapper, "getSync" | "setSync" | "delete"> as SystemSettingsDataMapper);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("getString", () => {
    it("returns from process.env if present", () => {
      process.env.TEST_KEY = "env_value";
      const result = ConfigurationService.getString("TEST_KEY");
      expect(result).toBe("env_value");
      expect(mockGetSync).not.toHaveBeenCalled();
    });

    it("falls back to SystemSettingsDataMapper if not in env", () => {
      delete process.env.TEST_KEY;
      mockGetSync.mockReturnValue({
        key: "TEST_KEY",
        valueJson: JSON.stringify("db_value"),
        updatedAt: "2026-04-25T00:00:00.000Z",
      });

      const result = ConfigurationService.getString("TEST_KEY");
      expect(result).toBe("db_value");
      expect(mockGetSync).toHaveBeenCalledWith("TEST_KEY");
    });

    it("returns null if neither env nor DB has the value", () => {
      delete process.env.TEST_KEY;
      mockGetSync.mockReturnValue(null);

      const result = ConfigurationService.getString("TEST_KEY");
      expect(result).toBeNull();
    });

    it("returns null if DB throws an error", () => {
      delete process.env.TEST_KEY;
      mockGetSync.mockImplementation(() => {
        throw new Error("DB Error");
      });

      const result = ConfigurationService.getString("TEST_KEY");
      expect(result).toBeNull();
    });
  });

  describe("isSystemInitialized", () => {
    it("returns true when the install state has a credentialed owner", () => {
      resolveInstallStateMock.mockReturnValue({ ownerConfigured: true });
      expect(ConfigurationService.isSystemInitialized()).toBe(true);
    });

    it("returns false when no credentialed owner exists even if provider keys are present", () => {
      process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
      resolveInstallStateMock.mockReturnValue({ ownerConfigured: false });
      expect(ConfigurationService.isSystemInitialized()).toBe(false);
    });
  });

  describe("setString", () => {
    it("writes string values as JSON to the DB", () => {
      ConfigurationService.setString("TEST_KEY", "new_value");
      expect(mockSetSync).toHaveBeenCalledWith("TEST_KEY", JSON.stringify("new_value"));
    });

    it("deletes SQLite-backed settings", async () => {
      await ConfigurationService.deleteString("TEST_KEY");
      expect(mockDelete).toHaveBeenCalledWith("TEST_KEY");
    });
  });
});
