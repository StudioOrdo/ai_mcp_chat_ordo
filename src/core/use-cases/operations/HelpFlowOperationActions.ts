import type {
  OperationAction,
  OperationConfirmPolicy,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export const HELP_FLOW_OPERATION_ACTION_TYPES = [
  "help.search",
  "help.open_section",
  "help.start_checklist",
  "help.complete_checklist_item",
  "help.finish",
] as const;

export type HelpFlowOperationActionType = typeof HELP_FLOW_OPERATION_ACTION_TYPES[number];

export type HelpFlowOperationIdFactory = (prefix: string) => string;

export interface HelpFlowActionFactoryBase {
  operationId: string;
  operationRevision: number;
  idFactory: HelpFlowOperationIdFactory;
  role: RoleName;
  query?: string | null;
  enabled?: boolean;
  disabledReason?: string | null;
  expiresAt?: string | null;
}

const ALL_ROLES: readonly RoleName[] = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];
const ACTIVE_HELP_STATUSES: readonly OperationStatus[] = ["draft", "running", "blocked"];

export function isHelpFlowOperationActionType(value: string): value is HelpFlowOperationActionType {
  return (HELP_FLOW_OPERATION_ACTION_TYPES as readonly string[]).includes(value);
}

export function createHelpSearchAction(input: HelpFlowActionFactoryBase): OperationAction {
  return createHelpAction(input, {
    actionType: "help.search",
    label: "Search Help",
    payloadSchemaKey: "help.search",
    payload: {
      query: input.query?.trim() || "getting started",
      role: input.role,
    },
  });
}

export function createHelpOpenSectionAction(input: HelpFlowActionFactoryBase & {
  documentSlug?: string | null;
  sectionSlug?: string | null;
}): OperationAction {
  return createHelpAction(input, {
    actionType: "help.open_section",
    label: "Open Help Section",
    payloadSchemaKey: "help.open_section",
    payload: {
      documentSlug: input.documentSlug?.trim() || "system-docs",
      sectionSlug: input.sectionSlug?.trim() || helpDefaultSectionForRole(input.role),
      role: input.role,
    },
  });
}

export function createHelpStartChecklistAction(input: HelpFlowActionFactoryBase & {
  checklistId?: string | null;
}): OperationAction {
  return createHelpAction(input, {
    actionType: "help.start_checklist",
    label: "Start Help Checklist",
    payloadSchemaKey: "help.start_checklist",
    payload: {
      checklistId: input.checklistId?.trim() || `system-help-${input.role.toLowerCase()}`,
      role: input.role,
    },
  });
}

export function createHelpCompleteChecklistItemAction(input: HelpFlowActionFactoryBase & {
  itemId?: string | null;
}): OperationAction {
  return createHelpAction(input, {
    actionType: "help.complete_checklist_item",
    label: "Mark Help Step Done",
    payloadSchemaKey: "help.complete_checklist_item",
    payload: {
      itemId: input.itemId?.trim() || `read-${helpDefaultSectionForRole(input.role)}`,
      role: input.role,
    },
  });
}

export function createHelpFinishAction(input: HelpFlowActionFactoryBase): OperationAction {
  return createHelpAction(input, {
    actionType: "help.finish",
    label: "Finish Help Flow",
    payloadSchemaKey: "help.finish",
    payload: {
      role: input.role,
    },
  });
}

export function createDefaultHelpFlowActions(input: HelpFlowActionFactoryBase): OperationAction[] {
  return [
    createHelpSearchAction(input),
    createHelpOpenSectionAction(input),
    createHelpStartChecklistAction(input),
    createHelpCompleteChecklistItemAction(input),
    createHelpFinishAction(input),
  ];
}

export function helpDefaultSectionForRole(role: RoleName): string {
  switch (role) {
    case "ADMIN":
      return "admin-appliance-operations";
    case "STAFF":
      return "staff-operations-workspace";
    case "APPRENTICE":
      return "apprentice-guided-practice";
    case "AUTHENTICATED":
      return "member-workspace-basics";
    case "ANONYMOUS":
      return "public-chief-of-staff";
  }
}

function createHelpAction(
  input: HelpFlowActionFactoryBase,
  definition: {
    actionType: HelpFlowOperationActionType;
    label: string;
    payloadSchemaKey: string;
    payload: Record<string, unknown>;
    riskLevel?: OperationRiskLevel;
    confirmPolicy?: OperationConfirmPolicy;
    allowedStatuses?: readonly OperationStatus[];
  },
): OperationAction {
  const enabled = input.enabled ?? input.disabledReason == null;
  return {
    id: input.idFactory("act"),
    operationId: input.operationId,
    operationRevision: input.operationRevision,
    actionType: definition.actionType,
    label: definition.label,
    riskLevel: definition.riskLevel ?? "info",
    confirmPolicy: definition.confirmPolicy ?? "none",
    allowedRoles: ALL_ROLES,
    allowedStatuses: definition.allowedStatuses ?? ACTIVE_HELP_STATUSES,
    enabled,
    disabledReason: enabled ? null : input.disabledReason ?? "Action is not currently available.",
    idempotencyKey: input.idFactory("idem"),
    expiresAt: input.expiresAt ?? null,
    payload: definition.payload,
    payloadSchemaKey: definition.payloadSchemaKey,
    confirmationText: null,
  };
}
