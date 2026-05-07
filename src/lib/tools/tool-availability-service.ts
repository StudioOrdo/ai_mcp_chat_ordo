import { createHash } from "node:crypto";
import { CAPABILITY_CATALOG } from "@/core/capability-catalog/catalog";
import type { RoleName } from "@/core/entities/user";
import type { ToolBundleDescriptor } from "@/core/tool-registry/ToolBundleDescriptor";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { InstanceTools } from "@/lib/config/defaults";
import { getInstanceTools } from "@/lib/config/instance";
import type {
  ProviderCapabilityAvailabilitySnapshot,
} from "@/lib/ai/providers/provider-capability-availability";
import {
  getDefaultEnabledToolNames,
  getToolInstallGroup,
  isKnownToolName,
  isProtectedTool,
} from "./tool-default-profile";
import {
  getProviderCapabilityGate,
  getToolProviderCapabilityAvailability,
  getToolProviderCapabilityRequirement,
} from "./tool-provider-capability-policy";
import {
  getToolSettingsService,
  type ToolSettingsReadResult,
} from "./tool-settings-service";
import type {
  EffectiveToolAvailability,
  EffectiveToolManifest,
  RoleFilteredToolAvailability,
  ToolAvailabilityOverride,
  ToolAvailabilityWarning,
} from "./tool-policy-types";

export interface ToolAvailabilityInputs {
  staticConfig?: InstanceTools;
  adminOverrides?: ToolAvailabilityOverride;
  adminWarnings?: readonly ToolAvailabilityWarning[];
  providerCapabilitySnapshot?: ProviderCapabilityAvailabilitySnapshot;
}

export interface RoleToolManifestOptions {
  role: RoleName;
  allowedToolNames?: readonly string[];
}

function hasRole(roles: EffectiveToolAvailability["roles"], role: RoleName): boolean {
  return roles === "ALL" || roles.includes(role);
}

function uniqueKnownTools(
  values: readonly string[] | undefined,
  warnings: ToolAvailabilityWarning[],
  source: "static" | "admin",
): Set<string> {
  const known = new Set<string>();
  for (const value of values ?? []) {
    if (!isKnownToolName(value)) {
      warnings.push({
        code: "unknown_tool",
        toolName: value,
        message: `${source === "static" ? "Static config" : "Runtime setting"} references unknown tool "${value}".`,
      });
      continue;
    }
    known.add(value);
  }

  return known;
}

function createAvailabilityVersion(tools: EffectiveToolAvailability[]): string {
  return createHash("sha256").update(JSON.stringify(tools.map((tool) => [
    tool.name,
    tool.state,
    tool.reason,
    tool.layer,
  ]))).digest("hex").slice(0, 16);
}

export class ToolAvailabilityService {
  getEffectiveManifest(inputs: ToolAvailabilityInputs = {}): EffectiveToolManifest {
    const warnings = [...(inputs.adminWarnings ?? [])];
    const defaultEnabled = new Set(getDefaultEnabledToolNames());
    const staticConfig = inputs.staticConfig ?? getInstanceTools();
    const staticEnabled = uniqueKnownTools(staticConfig.enabled, warnings, "static");
    const staticDisabled = uniqueKnownTools(staticConfig.disabled, warnings, "static");
    const adminEnabled = uniqueKnownTools(inputs.adminOverrides?.enabled, warnings, "admin");
    const adminDisabled = uniqueKnownTools(inputs.adminOverrides?.disabled, warnings, "admin");

    const tools = Object.values(CAPABILITY_CATALOG)
      .map((def): EffectiveToolAvailability => {
        const name = def.core.name;
        const protectedTool = isProtectedTool(name);
        const providerRequirement = getToolProviderCapabilityRequirement(name);
        const providerAvailability = getToolProviderCapabilityAvailability(
          name,
          inputs.providerCapabilitySnapshot,
        );
        const staticLocked = staticEnabled.size > 0 || staticDisabled.has(name);
        const base: EffectiveToolAvailability = {
          name,
          label: def.core.label,
          description: def.core.description,
          category: def.core.category,
          bundleId: def.executorBinding?.bundleId ?? null,
          roles: def.core.roles,
          installGroup: getToolInstallGroup(name),
          protected: protectedTool,
          state: "enabled",
          reason: protectedTool ? "protected_recovery_tool" : "catalog_declared",
          layer: protectedTool ? "protected" : "catalog",
          providerCapabilitySlot: providerRequirement?.slot ?? null,
          providerCapabilityState: providerAvailability?.state ?? null,
          providerCapabilityProvider: providerAvailability?.provider ?? null,
          toggleable: !protectedTool,
          staticLocked,
        };

        if (!protectedTool && !defaultEnabled.has(name)) {
          base.state = "disabled_by_install_profile";
          base.reason = "install_profile_disabled";
          base.layer = "install_profile";
        }

        if (!protectedTool && staticEnabled.size > 0 && !staticEnabled.has(name)) {
          base.state = "disabled_by_static_config";
          base.reason = "static_enabled_whitelist";
          base.layer = "static_config";
        }

        if (!protectedTool && staticDisabled.has(name)) {
          base.state = "disabled_by_static_config";
          base.reason = "static_disabled";
          base.layer = "static_config";
        }

        if (protectedTool && staticDisabled.has(name)) {
          warnings.push({
            code: "protected_tool_not_disabled",
            toolName: name,
            message: `Protected tool "${name}" was kept available despite static config disablement.`,
          });
        }

        if (!protectedTool && base.state !== "disabled_by_static_config" && adminEnabled.has(name)) {
          base.state = "enabled";
          base.reason = "admin_enabled";
          base.layer = "admin_runtime";
        }

        if (!protectedTool && base.state !== "disabled_by_static_config" && adminDisabled.has(name)) {
          base.state = "disabled_by_admin";
          base.reason = "admin_disabled";
          base.layer = "admin_runtime";
        }

        const providerGate = getProviderCapabilityGate(providerAvailability);
        if (providerGate && base.state === "enabled") {
          base.state = providerGate.state;
          base.reason = providerGate.reason;
          base.layer = "provider_capability";
        }

        return base;
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      tools,
      warnings,
      version: createAvailabilityVersion(tools),
    };
  }

  getEffectiveManifestSync(inputs: Omit<ToolAvailabilityInputs, "adminOverrides" | "adminWarnings"> = {}): EffectiveToolManifest {
    const settings = getToolSettingsService().getOverridesSync();
    return this.getEffectiveManifest({
      ...inputs,
      adminOverrides: settings.overrides,
      adminWarnings: settings.warnings,
    });
  }

  async getEffectiveManifestFromSettings(inputs: Omit<ToolAvailabilityInputs, "adminOverrides" | "adminWarnings"> = {}): Promise<EffectiveToolManifest> {
    const settings = await getToolSettingsService().getOverrides();
    return this.getEffectiveManifest({
      ...inputs,
      adminOverrides: settings.overrides,
      adminWarnings: settings.warnings,
    });
  }

  getEnabledToolNames(manifest: EffectiveToolManifest): string[] {
    return manifest.tools
      .filter((tool) => tool.state === "enabled")
      .map((tool) => tool.name);
  }

  getRoleFilteredManifest(
    manifest: EffectiveToolManifest,
    options: RoleToolManifestOptions,
  ): RoleFilteredToolAvailability[] {
    const allowedSet = options.allowedToolNames
      ? new Set(options.allowedToolNames)
      : null;

    return manifest.tools.map((tool): RoleFilteredToolAvailability => {
      if (tool.state !== "enabled") {
        return {
          ...tool,
          roleState: tool.state,
          roleReason: tool.reason,
        };
      }

      if (!hasRole(tool.roles, options.role)) {
        return {
          ...tool,
          roleState: "role_denied",
          roleReason: "role_not_allowed",
        };
      }

      if (allowedSet && !allowedSet.has(tool.name)) {
        return {
          ...tool,
          roleState: "request_filtered",
          roleReason: "request_allowed_tool_filter",
        };
      }

      return {
        ...tool,
        roleState: "enabled",
        roleReason: tool.reason,
      };
    });
  }

  getAvailableRoleToolNames(
    manifest: EffectiveToolManifest,
    options: RoleToolManifestOptions,
  ): string[] {
    return this.getRoleFilteredManifest(manifest, options)
      .filter((tool) => tool.roleState === "enabled")
      .map((tool) => tool.name);
  }

  summarizeByState(manifest: EffectiveToolManifest): Record<string, number> {
    return manifest.tools.reduce<Record<string, number>>((counts, tool) => {
      counts[tool.state] = (counts[tool.state] ?? 0) + 1;
      return counts;
    }, {});
  }

  expandBundle(
    bundles: readonly ToolBundleDescriptor[],
    ref: string,
    manifest: EffectiveToolManifest,
  ): readonly string[] {
    if (!ref.startsWith("bundle:")) {
      return [ref];
    }

    const enabled = new Set(this.getEnabledToolNames(manifest));
    const bundleId = ref.slice(7);
    const bundle = bundles.find((candidate) => candidate.id === bundleId);
    return bundle ? bundle.toolNames.filter((toolName) => enabled.has(toolName)) : [];
  }

  createRegistryAvailability(registry: ToolRegistry, manifest: EffectiveToolManifest): void {
    const enabled = new Set(this.getEnabledToolNames(manifest));
    for (const toolName of registry.getToolNames()) {
      if (!enabled.has(toolName)) {
        registry.unregister(toolName);
      }
    }
  }
}

export function getToolAvailabilityService(): ToolAvailabilityService {
  return new ToolAvailabilityService();
}

export function loadToolSettingsSync(): ToolSettingsReadResult {
  return getToolSettingsService().getOverridesSync();
}
