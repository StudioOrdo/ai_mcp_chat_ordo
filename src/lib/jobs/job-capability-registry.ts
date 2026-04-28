/**
 * Job Capability Registry
 *
 * Sprint 12: All 10 deferred job entries are now derived from CAPABILITY_CATALOG
 * via projectJobCapability(). The defineEditorialCapability() helper and its
 * associated policy constants have been removed.
 *
 * The catalog is the single source of truth for job metadata (family, label,
 * description, retryPolicy, recoveryMode, roles, etc.).
 */
import type { RoleName } from "@/core/entities/user";
import {
  CAPABILITY_CATALOG,
  projectJobCapability,
} from "@/core/capability-catalog/catalog";
import type {
  JobCapabilityDefinition,
  JobCapabilityPresentation,
} from "@/lib/jobs/job-capability-types";

export type {
  JobArtifactPolicy,
  JobCapabilityDefinition,
  JobCapabilityPresentation,
  JobFamily,
  JobRetryPolicy,
  JobSurface,
} from "@/lib/jobs/job-capability-types";

type CatalogJobCapabilityName = Extract<{
  [K in keyof typeof CAPABILITY_CATALOG]: (typeof CAPABILITY_CATALOG)[K] extends { job: object } ? K : never;
}[keyof typeof CAPABILITY_CATALOG], string>;

export type JobCapabilityName = CatalogJobCapabilityName;

export const CURRENT_SIGNED_IN_JOB_AUDIENCE_ROLES = [
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
] as const satisfies readonly RoleName[];

export const CURRENT_GLOBAL_JOB_OPERATOR_ROLES = ["ADMIN"] as const satisfies readonly RoleName[];

// ---------------------------------------------------------------------------
// Sprint 12: All deferred-job entries derive from CAPABILITY_CATALOG
// ---------------------------------------------------------------------------

const JOB_CAPABILITY_ENTRIES = Object.entries(CAPABILITY_CATALOG).flatMap(([toolName, definition]) => {
  const projected = projectJobCapability(definition);
  return projected ? [[toolName as JobCapabilityName, projected] as const] : [];
});

export const JOB_CAPABILITY_REGISTRY = Object.freeze(
  Object.fromEntries(JOB_CAPABILITY_ENTRIES) as Readonly<
    Record<JobCapabilityName, JobCapabilityDefinition<JobCapabilityName>>
  >,
);

export const JOB_CAPABILITY_TOOL_NAMES = Object.freeze(
  JOB_CAPABILITY_ENTRIES.map(([toolName]) => toolName),
);

export function isRegisteredJobCapability(toolName: string): toolName is JobCapabilityName {
  return Object.prototype.hasOwnProperty.call(JOB_CAPABILITY_REGISTRY, toolName);
}

export function getJobCapability(toolName: string): JobCapabilityDefinition<JobCapabilityName> | null {
  return isRegisteredJobCapability(toolName) ? JOB_CAPABILITY_REGISTRY[toolName] : null;
}

export function listJobCapabilities(): readonly JobCapabilityDefinition<JobCapabilityName>[] {
  return Object.values(JOB_CAPABILITY_REGISTRY);
}

export function listGlobalJobCapabilitiesForRole(role: RoleName): JobCapabilityDefinition<JobCapabilityName>[] {
  return listJobCapabilities().filter((capability) => capability.globalViewerRoles.includes(role));
}

export function listGlobalJobCapabilitiesForRoles(
  roles: readonly RoleName[],
): JobCapabilityDefinition<JobCapabilityName>[] {
  const seen = new Set<JobCapabilityName>();
  const capabilities: JobCapabilityDefinition<JobCapabilityName>[] = [];

  for (const role of roles) {
    for (const capability of listGlobalJobCapabilitiesForRole(role)) {
      if (seen.has(capability.toolName)) {
        continue;
      }

      seen.add(capability.toolName);
      capabilities.push(capability);
    }
  }

  return capabilities;
}

export function canRoleViewGlobalJob(toolName: string, role: RoleName): boolean {
  const capability = getJobCapability(toolName);
  return capability ? capability.globalViewerRoles.includes(role) : false;
}

export function canRolesViewGlobalJob(
  toolName: string,
  roles: readonly RoleName[],
): boolean {
  return roles.some((role) => canRoleViewGlobalJob(toolName, role));
}

export function canRoleManageGlobalJob(toolName: string, role: RoleName): boolean {
  const capability = getJobCapability(toolName);
  return capability ? capability.globalActionRoles.includes(role) : false;
}

export function canRolesManageGlobalJob(
  toolName: string,
  roles: readonly RoleName[],
): boolean {
  return roles.some((role) => canRoleManageGlobalJob(toolName, role));
}

export function getJobCapabilityPresentation(toolName: string): JobCapabilityPresentation<JobCapabilityName> | null {
  const capability = getJobCapability(toolName);
  if (!capability) {
    return null;
  }

  return {
    toolName: capability.toolName,
    label: capability.label,
    family: capability.family,
    defaultSurface: capability.defaultSurface,
  };
}

export function getSignedInJobAudienceRoles(): RoleName[] {
  return [...CURRENT_SIGNED_IN_JOB_AUDIENCE_ROLES];
}

export function getGlobalJobOperatorRoles(): RoleName[] {
  return [...CURRENT_GLOBAL_JOB_OPERATOR_ROLES];
}