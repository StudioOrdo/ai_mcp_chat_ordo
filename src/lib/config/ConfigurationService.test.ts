import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigurationService } from "./ConfigurationService";
import * as RepositoryFactory from "@/adapters/RepositoryFactory";
import type { SystemSettingsDataMapper } from "@/adapters/SystemSettingsDataMapper";
import type { SystemSetting } from "@/core/ports/SystemSettingsRepository";

vi.mock("@/adapters/RepositoryFactory", async () => {
  const { createMockRepositoryFactory } = await import("@/__test-utils__");
  return {
    ...createMockRepositoryFactory({
      getSystemSettingsDataMapper: vi.fn(),
    })
  };
});

describe("ConfigurationService", () => {
  let mockGetSync: ReturnType<typeof vi.fn<(key: string) => SystemSetting | null>>;
  let mockSetSync: ReturnType<typeof vi.fn<(key: string, valueJson: string) => void>>;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockGetSync = vi.fn();
    mockSetSync = vi.fn();
    vi.mocked(RepositoryFactory.getSystemSettingsDataMapper).mockReturnValue({
      getSync: mockGetSync,
      setSync: mockSetSync,
    } as Pick<SystemSettingsDataMapper, "getSync" | "setSync"> as SystemSettingsDataMapper);
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
    it("returns true if ANTHROPIC_API_KEY is present", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      expect(ConfigurationService.isSystemInitialized()).toBe(true);
    });

    it("returns false if ANTHROPIC_API_KEY is absent", () => {
      delete process.env.ANTHROPIC_API_KEY;
      mockGetSync.mockReturnValue(null);
      expect(ConfigurationService.isSystemInitialized()).toBe(false);
    });
  });

  describe("setString", () => {
    it("writes string values as JSON to the DB", () => {
      ConfigurationService.setString("TEST_KEY", "new_value");
      expect(mockSetSync).toHaveBeenCalledWith("TEST_KEY", JSON.stringify("new_value"));
    });
  });
});
