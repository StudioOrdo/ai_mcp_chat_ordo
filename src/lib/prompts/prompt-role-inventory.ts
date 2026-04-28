import type { RoleName } from "@/core/entities/user";
import type { PromptSlotRef, PromptSlotType } from "@/core/use-cases/PromptControlPlaneService";

export const PROMPT_RUNTIME_ROLES: RoleName[] = [
  "ANONYMOUS",
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

export const PROMPT_CONTROL_PLANE_ROLES: Array<"ALL" | RoleName> = [
  "ALL",
  ...PROMPT_RUNTIME_ROLES,
];

export const PROMPT_SLOT_TYPES: PromptSlotType[] = ["base", "role_directive", "coach"];

export function isPromptRuntimeRole(value: string): value is RoleName {
  return PROMPT_RUNTIME_ROLES.includes(value as RoleName);
}

export function isPromptControlPlaneRole(value: string): value is "ALL" | RoleName {
  return value === "ALL" || isPromptRuntimeRole(value);
}

export function isPromptSlotType(value: string): value is PromptSlotType {
  return PROMPT_SLOT_TYPES.includes(value as PromptSlotType);
}

export function listRoleDirectiveSlots(): PromptSlotRef[] {
  return PROMPT_RUNTIME_ROLES.map((role) => ({
    role,
    promptType: "role_directive",
  }));
}

export function listCoachPromptSlots(): PromptSlotRef[] {
  return PROMPT_RUNTIME_ROLES.map((role) => ({
    role,
    promptType: "coach",
  }));
}

function cloneSlot(slot: PromptSlotRef): PromptSlotRef {
  return {
    role: slot.role,
    promptType: slot.promptType,
  };
}

export function listAdminVisiblePromptSlots(): PromptSlotRef[] {
  return [
    { role: "ALL", promptType: "base" },
    ...listRoleDirectiveSlots(),
    ...listCoachPromptSlots(),
  ];
}

export function listAllPromptSlots(): PromptSlotRef[] {
  return listAdminVisiblePromptSlots().map(cloneSlot);
}

export function isPromptGovernedSlot(slot: PromptSlotRef): boolean {
  return listAllPromptSlots().some(
    (candidate) => candidate.role === slot.role && candidate.promptType === slot.promptType,
  );
}

export function isRuntimeFallbackBackedSlot(slot: PromptSlotRef): boolean {
  return isPromptGovernedSlot(slot);
}