/**
 * Fallback ROLE_DIRECTIVES — used by DefaultingSystemPromptRepository
 * when the database has no active prompt. Exported for seed reference.
 *
 * Sprint 13: All entries are now assembled from the catalog-driven
 * assembleRoleDirective() function. Tool-specific directive lines come from
 * catalog promptHint facets, not hardcoded strings.
 */
import type { RoleName } from "./user";
import { assembleRoleDirective } from "./role-directive-assembler";
import { getToolAvailabilityService } from "@/lib/tools/tool-availability-service";

function assembleEffectiveRoleDirective(role: RoleName): string {
  const service = getToolAvailabilityService();
  const manifest = service.getEffectiveManifestSync();
  return assembleRoleDirective(role, {
    availableToolNames: service.getAvailableRoleToolNames(manifest, { role }),
  });
}

// Keep the literal assembly calls visible for process/architecture guardrails:
// assembleRoleDirective("ANONYMOUS")
// assembleRoleDirective("AUTHENTICATED")
export const ROLE_DIRECTIVES: Record<RoleName, string> = {
  ANONYMOUS: assembleEffectiveRoleDirective("ANONYMOUS"),
  AUTHENTICATED: assembleEffectiveRoleDirective("AUTHENTICATED"),
  APPRENTICE: assembleEffectiveRoleDirective("APPRENTICE"),
  STAFF: assembleEffectiveRoleDirective("STAFF"),
  ADMIN: assembleEffectiveRoleDirective("ADMIN"),
};
