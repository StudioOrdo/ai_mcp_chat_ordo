import { getSystemSettingsDataMapper } from "@/adapters/RepositoryFactory";
import type { SystemSettingsRepository } from "@/core/ports/SystemSettingsRepository";
import {
  isKnownToolName,
  isProtectedTool,
} from "./tool-default-profile";
import type {
  ToolAvailabilityOverride,
  ToolAvailabilityWarning,
} from "./tool-policy-types";

export const TOOL_AVAILABILITY_OVERRIDES_KEY = "TOOL_AVAILABILITY_OVERRIDES";
export const TOOL_AVAILABILITY_PROFILE_KEY = "TOOL_AVAILABILITY_PROFILE";

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0))];
}

function parseOverridePayload(value: string): ToolAvailabilityOverride {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  return {
    enabled: uniqueStrings(record.enabled),
    disabled: uniqueStrings(record.disabled),
  };
}

export interface ToolSettingsReadResult {
  overrides: ToolAvailabilityOverride;
  warnings: ToolAvailabilityWarning[];
}

export class ToolSettingsService {
  constructor(private readonly repo?: SystemSettingsRepository) {}

  private getRepo(): SystemSettingsRepository {
    return this.repo ?? getSystemSettingsDataMapper();
  }

  getOverridesSync(): ToolSettingsReadResult {
    try {
      const syncRepo = this.getRepo() as SystemSettingsRepository & {
        getSync?: (key: string) => { valueJson: string } | null;
      };
      const row = syncRepo.getSync?.(TOOL_AVAILABILITY_OVERRIDES_KEY);
      if (!row?.valueJson) {
        return { overrides: {}, warnings: [] };
      }

      return this.validateOverrides(parseOverridePayload(row.valueJson));
    } catch (error) {
      return {
        overrides: {},
        warnings: [{
          code: "settings_unavailable",
          message: error instanceof SyntaxError
            ? "Runtime tool settings are invalid JSON and were ignored."
            : "Runtime tool settings are unavailable and were ignored.",
        }],
      };
    }
  }

  async getOverrides(): Promise<ToolSettingsReadResult> {
    try {
      const row = await this.getRepo().get(TOOL_AVAILABILITY_OVERRIDES_KEY);
      if (!row?.valueJson) {
        return { overrides: {}, warnings: [] };
      }

      return this.validateOverrides(parseOverridePayload(row.valueJson));
    } catch (error) {
      return {
        overrides: {},
        warnings: [{
          code: "settings_unavailable",
          message: error instanceof SyntaxError
            ? "Runtime tool settings are invalid JSON and were ignored."
            : "Runtime tool settings are unavailable and were ignored.",
        }],
      };
    }
  }

  async setOverrides(overrides: ToolAvailabilityOverride): Promise<ToolSettingsReadResult> {
    const validated = this.validateOverrides(overrides);
    await this.getRepo().set(TOOL_AVAILABILITY_OVERRIDES_KEY, JSON.stringify(validated.overrides));
    return validated;
  }

  async updateTool(toolName: string, enabled: boolean): Promise<ToolSettingsReadResult> {
    const current = await this.getOverrides();
    const enabledSet = new Set(current.overrides.enabled ?? []);
    const disabledSet = new Set(current.overrides.disabled ?? []);

    if (enabled) {
      disabledSet.delete(toolName);
      enabledSet.add(toolName);
    } else {
      enabledSet.delete(toolName);
      disabledSet.add(toolName);
    }

    return this.setOverrides({
      enabled: [...enabledSet].sort(),
      disabled: [...disabledSet].sort(),
    });
  }

  async updateTools(toolNames: readonly string[], enabled: boolean): Promise<ToolSettingsReadResult> {
    const current = await this.getOverrides();
    const enabledSet = new Set(current.overrides.enabled ?? []);
    const disabledSet = new Set(current.overrides.disabled ?? []);

    for (const toolName of toolNames) {
      if (enabled) {
        disabledSet.delete(toolName);
        enabledSet.add(toolName);
      } else {
        enabledSet.delete(toolName);
        disabledSet.add(toolName);
      }
    }

    return this.setOverrides({
      enabled: [...enabledSet].sort(),
      disabled: [...disabledSet].sort(),
    });
  }

  private validateOverrides(overrides: ToolAvailabilityOverride): ToolSettingsReadResult {
    const warnings: ToolAvailabilityWarning[] = [];
    const enabled = new Set<string>();
    const disabled = new Set<string>();

    for (const toolName of overrides.enabled ?? []) {
      if (!isKnownToolName(toolName)) {
        warnings.push({
          code: "unknown_tool",
          toolName,
          message: `Unknown tool "${toolName}" was ignored.`,
        });
        continue;
      }
      enabled.add(toolName);
    }

    for (const toolName of overrides.disabled ?? []) {
      if (!isKnownToolName(toolName)) {
        warnings.push({
          code: "unknown_tool",
          toolName,
          message: `Unknown tool "${toolName}" was ignored.`,
        });
        continue;
      }

      if (isProtectedTool(toolName)) {
        warnings.push({
          code: "protected_tool_not_disabled",
          toolName,
          message: `Protected tool "${toolName}" cannot be disabled through normal runtime controls.`,
        });
        enabled.add(toolName);
        continue;
      }

      disabled.add(toolName);
      enabled.delete(toolName);
    }

    return {
      overrides: {
        enabled: [...enabled].sort(),
        disabled: [...disabled].sort(),
      },
      warnings,
    };
  }
}

let defaultToolSettingsService: ToolSettingsService | null = null;

export function getToolSettingsService(): ToolSettingsService {
  if (!defaultToolSettingsService) {
    defaultToolSettingsService = new ToolSettingsService();
  }

  return defaultToolSettingsService;
}

export function _resetToolSettingsService(): void {
  defaultToolSettingsService = null;
}
