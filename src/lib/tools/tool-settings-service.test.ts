import { describe, expect, it } from "vitest";

import type { SystemSetting, SystemSettingsRepository } from "@/core/ports/SystemSettingsRepository";
import {
  TOOL_AVAILABILITY_OVERRIDES_KEY,
  ToolSettingsService,
} from "./tool-settings-service";

class MemorySystemSettingsRepository implements SystemSettingsRepository {
  readonly values = new Map<string, string>();

  async getAll(): Promise<SystemSetting[]> {
    return [...this.values.entries()].map(([key, valueJson]) => ({
      key,
      valueJson,
      updatedAt: "now",
    }));
  }

  async get(key: string): Promise<SystemSetting | null> {
    return this.getSync(key);
  }

  getSync(key: string): SystemSetting | null {
    const valueJson = this.values.get(key);
    return valueJson ? { key, valueJson, updatedAt: "now" } : null;
  }

  async set(key: string, valueJson: string): Promise<void> {
    this.values.set(key, valueJson);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe("ToolSettingsService", () => {
  it("persists validated runtime overrides as JSON", async () => {
    const repo = new MemorySystemSettingsRepository();
    const service = new ToolSettingsService(repo);

    const result = await service.updateTool("calculator", false);

    expect(result.overrides.disabled).toEqual(["calculator"]);
    expect(JSON.parse(repo.values.get(TOOL_AVAILABILITY_OVERRIDES_KEY) ?? "{}")).toEqual({
      enabled: [],
      disabled: ["calculator"],
    });
  });

  it("ignores unknown and protected disabled tools", async () => {
    const repo = new MemorySystemSettingsRepository();
    const service = new ToolSettingsService(repo);

    const result = await service.setOverrides({
      enabled: ["future_tool"],
      disabled: ["inspect_runtime_context"],
    });

    expect(result.overrides.disabled).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "unknown_tool",
      "protected_tool_not_disabled",
    ]);
  });
});
