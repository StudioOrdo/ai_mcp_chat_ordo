import type {
  OperationAction,
  OperationConfirmPolicy,
  OperationKind,
  OperationRiskLevel,
  OperationStatus,
} from "@/core/entities/operation";
import {
  createBackupCreateAction,
  createRestorePrepareAction,
} from "@/core/use-cases/operations/BackupRestoreOperationActions";
import {
  createMediaWorkflowCreateAction,
} from "@/core/use-cases/operations/MediaWorkflowOperationActions";
import {
  createFactoryWorkOrderCreateAction,
  listFactoryWorkOrderCreatePayloadErrors,
} from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import {
  createDefaultHelpFlowActions,
} from "@/core/use-cases/operations/HelpFlowOperationActions";
import {
  createDefaultOnboardingFlowActions,
} from "@/core/use-cases/operations/OnboardingFlowOperationActions";
import type {
  CreateOperationInput,
} from "@/core/use-cases/operations/OperationRepository";
import {
  createDefaultOperationKindRegistry,
  type OperationKindRegistry,
} from "@/core/use-cases/operations/OperationKindRegistry";
import type {
  OperationGateFact,
  OperationIntentCompilerInput,
  OperationIntentOperationOutput,
} from "@/core/use-cases/operations/OperationIntent";

export interface OperationDraftBuildResult {
  operation: CreateOperationInput;
  actions: readonly OperationAction[];
}

export type OperationIntentIdFactory = (prefix: string) => string;

export class OperationDraftFactory {
  constructor(
    private readonly idFactory: OperationIntentIdFactory,
    private readonly kindRegistry: OperationKindRegistry = createDefaultOperationKindRegistry(),
  ) {}

  build(input: {
    compilerInput: OperationIntentCompilerInput;
    intent: OperationIntentOperationOutput;
    blockingGates: readonly OperationGateFact[];
  }): OperationDraftBuildResult {
    const definition = this.kindRegistry.require(input.intent.operationKind);
    const operationId = this.idFactory("op");
    const factoryBriefDisabledReason = this.factoryBriefDisabledReason(input.intent);
    const status = this.initialStatus(input.intent.operationKind, input.blockingGates, factoryBriefDisabledReason);
    const gateError = input.blockingGates.length > 0
      ? {
          code: "OPERATION_GATED",
          message: "Operation is blocked by current appliance capability gates.",
          details: { gates: input.blockingGates },
        }
      : factoryBriefDisabledReason
        ? {
            code: "FACTORY_PRODUCT_BRIEF_REQUIRED",
            message: factoryBriefDisabledReason,
            details: { operationKind: input.intent.operationKind },
          }
      : null;

    const operation: CreateOperationInput = {
      id: operationId,
      kind: input.intent.operationKind,
      title: input.intent.title,
      summary: input.intent.summary,
      status,
      riskLevel: input.intent.riskLevel,
      conversationId: input.compilerInput.conversationId,
      originMessageId: input.compilerInput.originMessageId,
      createdByUserId: input.compilerInput.userId,
      createdByRole: input.compilerInput.role,
      visibility: definition.defaultVisibility,
      input: {
        request: input.intent.input,
        intent: {
          source: input.intent.source,
          confidence: input.intent.confidence,
          operationKind: input.intent.operationKind,
          requiredCapabilities: input.intent.requiredCapabilities,
          requiredProviderSlots: input.intent.requiredProviderSlots,
          missingInputs: input.intent.missingInputs,
        },
        gates: input.blockingGates,
      },
      error: gateError,
      actorType: "system",
      actorId: input.compilerInput.userId,
      now: input.compilerInput.now,
    };

    return {
      operation,
      actions: this.buildActions({
        operationId,
        revision: 1,
        intent: input.intent,
        blockingGates: input.blockingGates,
      }),
    };
  }

  private initialStatus(
    kind: OperationKind,
    blockingGates: readonly OperationGateFact[],
    factoryBriefDisabledReason: string | null,
  ): OperationStatus {
    if (blockingGates.length > 0) {
      return "blocked";
    }

    if (kind === "factory_work_order" && factoryBriefDisabledReason) {
      return "blocked";
    }

    if (kind === "restore_execute" || kind === "content_publish") {
      return "draft";
    }

    return "draft";
  }

  private buildActions(input: {
    operationId: string;
    revision: number;
    intent: OperationIntentOperationOutput;
    blockingGates: readonly OperationGateFact[];
  }): OperationAction[] {
    const disabledReason = this.disabledReason(input.intent.operationKind, input.blockingGates, input.intent);
    switch (input.intent.operationKind) {
      case "backup_create":
        return [createBackupCreateAction({
          operationId: input.operationId,
          operationRevision: input.revision,
          idFactory: this.idFactory,
          disabledReason,
        })];
      case "restore_execute":
        return [createRestorePrepareAction({
          operationId: input.operationId,
          operationRevision: input.revision,
          idFactory: this.idFactory,
          snapshotId: this.restoreSnapshotId(input.intent),
          disabledReason,
        })];
      case "media_workflow":
        return [createMediaWorkflowCreateAction({
          operationId: input.operationId,
          operationRevision: input.revision,
          idFactory: this.idFactory,
          payload: this.mediaWorkflowCreatePayload(input.intent),
          disabledReason,
        })];
      case "factory_work_order":
        return [createFactoryWorkOrderCreateAction({
          operationId: input.operationId,
          operationRevision: input.revision,
          idFactory: this.idFactory,
          payload: this.factoryWorkOrderCreatePayload(input.intent),
          disabledReason,
        })];
      case "content_publish":
        return [this.action({
          operationId: input.operationId,
          revision: input.revision,
          actionType: "content.publish",
          label: "Review Publish Plan",
          riskLevel: "high",
          confirmPolicy: "single_click",
          allowedStatuses: ["draft", "blocked"],
          payloadSchemaKey: "none",
          payload: input.intent.input,
          disabledReason,
        })];
      case "onboarding_flow":
        return createDefaultOnboardingFlowActions({
          operationId: input.operationId,
          operationRevision: input.revision,
          idFactory: this.idFactory,
          role: this.intentRole(input.intent),
          disabledReason,
        });
      case "help_flow":
        return createDefaultHelpFlowActions({
          operationId: input.operationId,
          operationRevision: input.revision,
          idFactory: this.idFactory,
          role: this.intentRole(input.intent),
          query: this.requestedText(input.intent),
          disabledReason,
        });
      case "system_diagnostic":
      case "tool_task":
        return [];
    }
  }

  private action(input: {
    operationId: string;
    revision: number;
    actionType: string;
    label: string;
    riskLevel: OperationRiskLevel;
    confirmPolicy: OperationConfirmPolicy;
    allowedStatuses: readonly OperationStatus[];
    payloadSchemaKey: string;
    payload: Record<string, unknown>;
    disabledReason: string | null;
    confirmationText?: string | null;
  }): OperationAction {
    return {
      id: this.idFactory("act"),
      operationId: input.operationId,
      operationRevision: input.revision,
      actionType: input.actionType,
      label: input.label,
      riskLevel: input.riskLevel,
      confirmPolicy: input.confirmPolicy,
      allowedRoles: this.kindRegistry.require(this.operationKindForAction(input.actionType)).allowedRoles,
      allowedStatuses: input.allowedStatuses,
      enabled: input.disabledReason == null,
      disabledReason: input.disabledReason,
      idempotencyKey: this.idFactory("idem"),
      expiresAt: null,
      payload: input.payload,
      payloadSchemaKey: input.payloadSchemaKey,
      confirmationText: input.confirmationText ?? null,
    };
  }

  private operationKindForAction(actionType: string): OperationKind {
    if (actionType.startsWith("backup.")) return "backup_create";
    if (actionType.startsWith("restore.")) return "restore_execute";
    if (actionType.startsWith("media.")) return "media_workflow";
    if (actionType.startsWith("factory.")) return "factory_work_order";
    if (actionType.startsWith("help.")) return "help_flow";
    if (actionType.startsWith("onboarding.")) return "onboarding_flow";
    if (actionType.startsWith("content.")) return "content_publish";
    return "tool_task";
  }

  private disabledReason(
    kind: OperationKind,
    gates: readonly OperationGateFact[],
    intent: OperationIntentOperationOutput,
  ): string | null {
    if (gates.length > 0) {
      return gates.map((gate) => gate.summary).join(" ");
    }

    switch (kind) {
      case "backup_create":
      case "restore_execute":
        return null;
      case "media_workflow":
        return null;
      case "factory_work_order":
        return this.factoryBriefDisabledReason(intent);
      case "content_publish":
        return "Content publish operation execution is not registered in Phase 04.";
      case "system_diagnostic":
      case "tool_task":
        return "No executable action is exposed for this operation in Phase 04.";
      case "onboarding_flow":
      case "help_flow":
        return null;
    }
  }

  private requestedText(intent: OperationIntentOperationOutput): string {
    const requestedText = intent.input.requestedText;
    return typeof requestedText === "string" && requestedText.trim()
      ? requestedText.trim()
      : intent.summary;
  }

  private intentRole(intent: OperationIntentOperationOutput) {
    return intent.requiredRole;
  }

  private restoreSnapshotId(intent: OperationIntentOperationOutput): string {
    const snapshotId = intent.input.snapshotId;
    return typeof snapshotId === "string" ? snapshotId.trim() : "";
  }

  private mediaWorkflowCreatePayload(intent: OperationIntentOperationOutput): Record<string, unknown> {
    const requestedText = typeof intent.input.requestedText === "string"
      ? intent.input.requestedText.trim()
      : typeof intent.input.prompt === "string"
        ? intent.input.prompt.trim()
        : typeof intent.input.request === "string"
          ? intent.input.request.trim()
          : "";
    const template = typeof intent.input.template === "string" && intent.input.template.trim()
      ? intent.input.template.trim()
      : inferMediaWorkflowTemplate(intent.input);
    const requestedDeliverable = typeof intent.input.requestedDeliverable === "string" && intent.input.requestedDeliverable.trim()
      ? intent.input.requestedDeliverable.trim()
      : "video";

    return {
      ...intent.input,
      requestedDeliverable,
      template,
      requestedText,
      idempotencyKey: this.idFactory("media_create"),
    };
  }

  private factoryWorkOrderCreatePayload(intent: OperationIntentOperationOutput): Record<string, unknown> {
    const brief = intent.input.brief;
    const previousWorkOrderIds = Array.isArray(intent.input.previousWorkOrderIds)
      ? intent.input.previousWorkOrderIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];

    return {
      brief,
      previousWorkOrderIds,
    };
  }

  private factoryBriefDisabledReason(intent: OperationIntentOperationOutput): string | null {
    if (intent.operationKind !== "factory_work_order") {
      return null;
    }

    const errors = listFactoryWorkOrderCreatePayloadErrors(this.factoryWorkOrderCreatePayload(intent));
    if (errors.length === 0) {
      return null;
    }

    return `Factory work-order execution requires a valid ProductBrief. ${errors.join(" ")}`;
  }
}

function inferMediaWorkflowTemplate(input: Record<string, unknown>): string {
  if (input.compose || input.plan) {
    return "compose_media";
  }
  if (input.visual && input.audio) {
    return "visual_audio_video";
  }
  if (input.chart && input.audio) {
    return "chart_audio_video";
  }
  if (input.audio) {
    return "generated_audio";
  }

  return "compose_media";
}
