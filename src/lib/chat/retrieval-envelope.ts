/**
 * Phase 4 — retrieval envelope helpers.
 *
 * Small, composable helpers that resolve the retrieval envelope for a
 * viewer (their allowed audiences, and optionally a role persona they
 * have opted into) without introducing a new MessagePart, stream event,
 * presenter marker, or capability catalog entry. Call sites inject the
 * resolved values into `LibrarySearchInteractor` / `SearchCorpusCommand`
 * contexts.
 *
 * Scope fences:
 * - Does NOT touch `ToolDescriptor.roles` (role-only RBAC is Phase 2
 *   territory and remains unchanged).
 * - Does NOT author prompt directives or system messages. Persona
 *   activation is a retrieval-narrowing concern here; any
 *   persona-specific assistant voice changes live in the prompt
 *   composition layer (`src/lib/chat/prompt-runtime.ts`), not this
 *   module.
 * - Does NOT widen {@link ContentAudience} — it only mirrors the
 *   tier-aware `canUserAccessAudience` decision into a pre-rank filter.
 */

import {
  getAllowedAudiencesForUser,
  type ContentAudience,
} from "@/lib/access/content-access";
import type { RoleName, UserTier } from "@/core/entities/user";
import type { UserPreferencesRepository } from "@/core/ports/UserPreferencesRepository";

export type RolePersona = string;

const VALID_ROLE_PERSONAS = new Set([
  "sales",
  "scheduling",
  "front_desk",
  "teaching",
  "reference",
  "internal",
  "customer_service",
]);

function isRolePersona(value: string): value is RolePersona {
  return VALID_ROLE_PERSONAS.has(value);
}

/**
 * Phase 4 preference key for the viewer's opted-in role persona. Not in
 * `SUPPORTED_PREFERENCE_KEYS` for the `set_preference` tool — callers
 * write this through a dedicated server flow, not via the chat tool,
 * so the assistant cannot self-activate a persona.
 */
export const ROLE_PERSONA_PREFERENCE_KEY = "role_persona";

export interface RetrievalEnvelope {
  allowedAudiences: ContentAudience[];
  rolePersona?: RolePersona;
}

/**
 * Resolve the retrieval envelope for a given role + tier. Persona is
 * optional and, when present, must already be a validated
 * {@link RolePersona}.
 */
export function resolveRetrievalEnvelope(input: {
  role: RoleName;
  tier?: UserTier;
  rolePersona?: RolePersona;
}): RetrievalEnvelope {
  const allowedAudiences = getAllowedAudiencesForUser({
    role: input.role,
    tier: input.tier,
  });
  return input.rolePersona
    ? { allowedAudiences, rolePersona: input.rolePersona }
    : { allowedAudiences };
}

/**
 * Read the viewer's opted-in role persona from the preferences store.
 * Returns `undefined` when no persona is set or when the stored value is
 * not a valid {@link RolePersona} — corrupt values are treated as unset
 * rather than propagated.
 */
export async function readRolePersonaPreference(
  repo: UserPreferencesRepository,
  userId: string,
): Promise<RolePersona | undefined> {
  const pref = await repo.get(userId, ROLE_PERSONA_PREFERENCE_KEY);
  const raw = pref?.value;
  if (typeof raw !== "string" || raw.length === 0) {
    return undefined;
  }
  return isRolePersona(raw) ? raw : undefined;
}
