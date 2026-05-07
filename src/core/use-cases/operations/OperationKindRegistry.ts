import {
  isOperationKind,
  type OperationKind,
  type OperationKindDefinition,
  OperationKindNotRegisteredError,
  OperationActionRejectedError,
} from "@/core/entities/operation";
import type { RoleName } from "@/core/entities/user";

const ALL_ROLES: readonly RoleName[] = ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];
const AUTHENTICATED_ROLES: readonly RoleName[] = ["AUTHENTICATED", "APPRENTICE", "STAFF", "ADMIN"];
const STAFF_ROLES: readonly RoleName[] = ["STAFF", "ADMIN"];
const ADMIN_ROLES: readonly RoleName[] = ["ADMIN"];

export const DEFAULT_OPERATION_KIND_DEFINITIONS: readonly OperationKindDefinition[] = [
  {
    kind: "backup_create",
    label: "Create Backup",
    description: "Create a governed appliance backup snapshot.",
    defaultRiskLevel: "medium",
    defaultVisibility: "admin",
    allowedRoles: ADMIN_ROLES,
    supportsRetry: true,
    requiresConversation: false,
    handlerKey: "backup.create",
  },
  {
    kind: "restore_execute",
    label: "Restore Appliance",
    description: "Prepare, confirm, safety-backup, execute, and verify an appliance restore.",
    defaultRiskLevel: "destructive",
    defaultVisibility: "admin",
    allowedRoles: ADMIN_ROLES,
    supportsRetry: false,
    requiresConversation: false,
    handlerKey: "restore.execute",
  },
  {
    kind: "media_workflow",
    label: "Media Workflow",
    description: "Run a governed multi-step media workflow.",
    defaultRiskLevel: "medium",
    defaultVisibility: "user",
    allowedRoles: AUTHENTICATED_ROLES,
    supportsRetry: true,
    requiresConversation: true,
    handlerKey: "media.workflow",
  },
  {
    kind: "factory_work_order",
    label: "Factory Work Order",
    description: "Run a governed production work order through the software factory.",
    defaultRiskLevel: "medium",
    defaultVisibility: "staff",
    allowedRoles: STAFF_ROLES,
    supportsRetry: true,
    requiresConversation: true,
    handlerKey: "factory.work_order",
  },
  {
    kind: "system_diagnostic",
    label: "System Diagnostic",
    description: "Run a bounded diagnostic operation against the appliance.",
    defaultRiskLevel: "low",
    defaultVisibility: "staff",
    allowedRoles: STAFF_ROLES,
    supportsRetry: true,
    requiresConversation: false,
    handlerKey: "diagnostic.run",
  },
  {
    kind: "tool_task",
    label: "Tool Task",
    description: "Run a typed tool task under operation governance.",
    defaultRiskLevel: "medium",
    defaultVisibility: "conversation",
    allowedRoles: AUTHENTICATED_ROLES,
    supportsRetry: true,
    requiresConversation: true,
    handlerKey: "tool.task",
  },
  {
    kind: "content_publish",
    label: "Publish Content",
    description: "Publish governed content or release artifacts.",
    defaultRiskLevel: "high",
    defaultVisibility: "staff",
    allowedRoles: STAFF_ROLES,
    supportsRetry: true,
    requiresConversation: true,
    handlerKey: "content.publish",
  },
  {
    kind: "onboarding_flow",
    label: "Onboarding Flow",
    description: "Guide a user through role-appropriate onboarding.",
    defaultRiskLevel: "info",
    defaultVisibility: "conversation",
    allowedRoles: ALL_ROLES,
    supportsRetry: true,
    requiresConversation: true,
    handlerKey: "onboarding.flow",
  },
  {
    kind: "help_flow",
    label: "Help Flow",
    description: "Provide governed system help and documentation guidance.",
    defaultRiskLevel: "info",
    defaultVisibility: "conversation",
    allowedRoles: ALL_ROLES,
    supportsRetry: true,
    requiresConversation: true,
    handlerKey: "help.flow",
  },
];

export class OperationKindRegistry {
  private readonly definitions = new Map<OperationKind, OperationKindDefinition>();

  constructor(definitions: readonly OperationKindDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: OperationKindDefinition): void {
    if (!isOperationKind(definition.kind)) {
      throw new OperationKindNotRegisteredError(definition.kind);
    }

    if (this.definitions.has(definition.kind)) {
      throw new OperationActionRejectedError(`Operation kind is already registered: ${definition.kind}`, {
        kind: definition.kind,
      });
    }

    this.definitions.set(definition.kind, Object.freeze({
      ...definition,
      allowedRoles: [...definition.allowedRoles],
    }));
  }

  has(kind: string): kind is OperationKind {
    return isOperationKind(kind) && this.definitions.has(kind);
  }

  get(kind: OperationKind): OperationKindDefinition | null {
    return this.definitions.get(kind) ?? null;
  }

  require(kind: string): OperationKindDefinition {
    if (!isOperationKind(kind)) {
      throw new OperationKindNotRegisteredError(kind);
    }

    const definition = this.definitions.get(kind);
    if (!definition) {
      throw new OperationKindNotRegisteredError(kind);
    }

    return definition;
  }

  list(): OperationKindDefinition[] {
    return [...this.definitions.values()];
  }
}

export function createDefaultOperationKindRegistry(): OperationKindRegistry {
  return new OperationKindRegistry(DEFAULT_OPERATION_KIND_DEFINITIONS);
}
