import type {
  OperationAction,
  OperationConfirmPolicy,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

export const ONBOARDING_FLOW_OPERATION_ACTION_TYPES = [
  "onboarding.start",
  "onboarding.complete_step",
  "onboarding.skip_step",
  "onboarding.open_help",
  "onboarding.finish",
] as const;

export type OnboardingFlowOperationActionType = typeof ONBOARDING_FLOW_OPERATION_ACTION_TYPES[number];

export type OnboardingFlowOperationIdFactory = (prefix: string) => string;

export interface OnboardingFlowActionFactoryBase {
  operationId: string;
  operationRevision: number;
  idFactory: OnboardingFlowOperationIdFactory;
  role: RoleName;
  enabled?: boolean;
  disabledReason?: string | null;
  expiresAt?: string | null;
}

const ALL_ROLES: readonly RoleName[] = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];
const ACTIVE_ONBOARDING_STATUSES: readonly OperationStatus[] = ["draft", "running", "blocked"];

export function isOnboardingFlowOperationActionType(value: string): value is OnboardingFlowOperationActionType {
  return (ONBOARDING_FLOW_OPERATION_ACTION_TYPES as readonly string[]).includes(value);
}

export function createOnboardingStartAction(input: OnboardingFlowActionFactoryBase): OperationAction {
  return createOnboardingAction(input, {
    actionType: "onboarding.start",
    label: "Start Onboarding",
    payloadSchemaKey: "onboarding.start",
    payload: {
      role: input.role,
      pathId: onboardingPathForRole(input.role),
    },
  });
}

export function createOnboardingCompleteStepAction(input: OnboardingFlowActionFactoryBase & {
  stepId?: string | null;
}): OperationAction {
  return createOnboardingAction(input, {
    actionType: "onboarding.complete_step",
    label: "Mark Onboarding Step Done",
    payloadSchemaKey: "onboarding.complete_step",
    payload: {
      role: input.role,
      stepId: input.stepId?.trim() || onboardingFirstStepForRole(input.role),
    },
  });
}

export function createOnboardingSkipStepAction(input: OnboardingFlowActionFactoryBase & {
  stepId?: string | null;
  reason?: string | null;
}): OperationAction {
  return createOnboardingAction(input, {
    actionType: "onboarding.skip_step",
    label: "Skip Onboarding Step",
    payloadSchemaKey: "onboarding.skip_step",
    payload: {
      role: input.role,
      stepId: input.stepId?.trim() || onboardingFirstStepForRole(input.role),
      reason: input.reason?.trim() || "User skipped this onboarding step.",
    },
  });
}

export function createOnboardingOpenHelpAction(input: OnboardingFlowActionFactoryBase & {
  topic?: string | null;
}): OperationAction {
  return createOnboardingAction(input, {
    actionType: "onboarding.open_help",
    label: "Open Onboarding Help",
    payloadSchemaKey: "onboarding.open_help",
    payload: {
      role: input.role,
      topic: input.topic?.trim() || onboardingHelpTopicForRole(input.role),
    },
  });
}

export function createOnboardingFinishAction(input: OnboardingFlowActionFactoryBase): OperationAction {
  return createOnboardingAction(input, {
    actionType: "onboarding.finish",
    label: "Finish Onboarding",
    payloadSchemaKey: "onboarding.finish",
    payload: {
      role: input.role,
      pathId: onboardingPathForRole(input.role),
    },
  });
}

export function createDefaultOnboardingFlowActions(input: OnboardingFlowActionFactoryBase): OperationAction[] {
  return [
    createOnboardingStartAction(input),
    createOnboardingCompleteStepAction(input),
    createOnboardingSkipStepAction(input),
    createOnboardingOpenHelpAction(input),
    createOnboardingFinishAction(input),
  ];
}

export function onboardingPathForRole(role: RoleName): string {
  switch (role) {
    case "ADMIN":
      return "admin-appliance-owner";
    case "STAFF":
      return "staff-operator";
    case "APPRENTICE":
      return "apprentice-learning";
    case "AUTHENTICATED":
      return "member-workspace";
    case "ANONYMOUS":
      return "public-chief-of-staff";
  }
}

export function onboardingFirstStepForRole(role: RoleName): string {
  switch (role) {
    case "ADMIN":
      return "verify-provider-tools-backups";
    case "STAFF":
      return "open-operations-workspace";
    case "APPRENTICE":
      return "start-guided-practice";
    case "AUTHENTICATED":
      return "start-first-conversation";
    case "ANONYMOUS":
      return "understand-public-help";
  }
}

export function onboardingHelpTopicForRole(role: RoleName): string {
  switch (role) {
    case "ADMIN":
      return "admin appliance operations";
    case "STAFF":
      return "staff operations workspace";
    case "APPRENTICE":
      return "guided practice";
    case "AUTHENTICATED":
      return "member workspace basics";
    case "ANONYMOUS":
      return "public chief of staff";
  }
}

function createOnboardingAction(
  input: OnboardingFlowActionFactoryBase,
  definition: {
    actionType: OnboardingFlowOperationActionType;
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
    allowedStatuses: definition.allowedStatuses ?? ACTIVE_ONBOARDING_STATUSES,
    enabled,
    disabledReason: enabled ? null : input.disabledReason ?? "Action is not currently available.",
    idempotencyKey: input.idFactory("idem"),
    expiresAt: input.expiresAt ?? null,
    payload: definition.payload,
    payloadSchemaKey: definition.payloadSchemaKey,
    confirmationText: null,
  };
}
