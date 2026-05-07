import type { RoleName } from "@/core/entities/user";
import type { PromptToolProjectionMode, ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import {
  getToolAvailabilityService,
  type ToolAvailabilityService,
} from "@/lib/tools/tool-availability-service";
import type {
  EffectiveToolAvailability,
  RoleFilteredToolAvailability,
} from "@/lib/tools/tool-policy-types";

export interface RuntimeToolManifestEntry {
  name: string;
  description: string;
  category: string;
  state?: EffectiveToolAvailability["state"];
  reason?: EffectiveToolAvailability["reason"];
  bundleId?: string | null;
  protected?: boolean;
  toggleable?: boolean;
}

export const RUNTIME_MANIFEST_ROLE_ORDER: readonly RoleName[] = [
  "ANONYMOUS",
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

export function getRuntimeToolManifestForRole(
  registry: ToolRegistry,
  role: RoleName,
  options?: { allowedToolNames?: readonly string[] },
): RuntimeToolManifestEntry[] {
  const allowedToolNames = options?.allowedToolNames
    ? new Set(options.allowedToolNames)
    : null;

  const availabilityByName = new Map(
    getToolAvailabilityService()
      .getEffectiveManifestSync()
      .tools
      .map((tool) => [tool.name, tool]),
  );

  return registry.getSchemasForRole(role)
    .filter((schema) => !allowedToolNames || allowedToolNames.has(schema.name))
    .map((schema) => {
      const availability = availabilityByName.get(schema.name);
      return {
        name: schema.name,
        description: schema.description,
        category: registry.getDescriptor(schema.name)?.category ?? "uncategorized",
        state: availability?.state ?? "enabled",
        reason: availability?.reason ?? "catalog_declared",
        bundleId: availability?.bundleId ?? registry.getBundleForTool(schema.name)?.id ?? null,
        protected: availability?.protected ?? false,
        toggleable: availability?.toggleable ?? true,
      };
    });
}

export function getPromptVisibleRuntimeToolManifestForRole(
  registry: ToolRegistry,
  role: RoleName,
  options?: {
    allowedToolNames?: readonly string[];
    mode?: PromptToolProjectionMode;
    intentToolNames?: readonly string[];
  },
): RuntimeToolManifestEntry[] {
  const availabilityByName = new Map(
    getToolAvailabilityService()
      .getEffectiveManifestSync()
      .tools
      .map((tool) => [tool.name, tool]),
  );

  return registry.getPromptVisibleSchemasForRole(role, {
    mode: options?.mode ?? (role === "ADMIN" ? "operator_chat" : "default_chat"),
    allowedToolNames: options?.allowedToolNames,
    intentToolNames: options?.intentToolNames,
  }).map((schema) => {
    const availability = availabilityByName.get(schema.name);
    return {
      name: schema.name,
      description: schema.description,
      category: registry.getDescriptor(schema.name)?.category ?? "uncategorized",
      state: availability?.state ?? "enabled",
      reason: availability?.reason ?? "catalog_declared",
      bundleId: availability?.bundleId ?? registry.getBundleForTool(schema.name)?.id ?? null,
      protected: availability?.protected ?? false,
      toggleable: availability?.toggleable ?? true,
    };
  });
}

export function getEffectiveToolAvailabilityForRole(
  role: RoleName,
  options?: {
    allowedToolNames?: readonly string[];
    availabilityService?: ToolAvailabilityService;
  },
): RoleFilteredToolAvailability[] {
  const availabilityService = options?.availabilityService ?? getToolAvailabilityService();
  return availabilityService.getRoleFilteredManifest(
    availabilityService.getEffectiveManifestSync(),
    {
      role,
      allowedToolNames: options?.allowedToolNames,
    },
  );
}

export function getRuntimeToolCountsByRole(registry: ToolRegistry): Record<RoleName, number> {
  return RUNTIME_MANIFEST_ROLE_ORDER.reduce<Record<RoleName, number>>((counts, role) => {
    counts[role] = getRuntimeToolManifestForRole(registry, role).length;
    return counts;
  }, {
    ANONYMOUS: 0,
    AUTHENTICATED: 0,
    APPRENTICE: 0,
    STAFF: 0,
    ADMIN: 0,
  });
}
