import { describe, expect, it, vi } from "vitest";

import type {
  Operation,
  OperationAction,
  OperationArtifact,
  OperationEvent,
  OperationKind,
  OperationRiskLevel,
  OperationStep,
} from "@/core/entities/operation";
import { createConversationRoutingSnapshot } from "@/core/entities/conversation-routing";
import type {
  CreateOperationInput,
  OperationRepository,
  OperationSnapshot,
  OperationSummary,
  ReplaceActionsInput,
} from "@/core/use-cases/operations/OperationRepository";
import { OperationDraftFactory } from "@/core/use-cases/operations/OperationDraftFactory";
import { OperationIntentRouter } from "@/core/use-cases/operations/OperationIntentRouter";
import type {
  OperationGateFact,
  OperationIntentCompilerInput,
  OperationIntentOperationOutput,
} from "@/core/use-cases/operations/OperationIntent";

function createCompilerInput(overrides: Partial<OperationIntentCompilerInput> = {}): OperationIntentCompilerInput {
  return {
    conversationId: "conv_1",
    originMessageId: "msg_user_1",
    userId: "usr_admin",
    role: "ADMIN",
    latestUserText: "create a backup",
    latestUserContent: "create a backup",
    routingSnapshot: createConversationRoutingSnapshot(),
    attachments: [],
    taskOriginHandoff: null,
    mediaContinuityHandoff: null,
    effectiveToolManifestVersion: "manifest_1",
    availableToolNames: ["create_appliance_backup", "prepare_appliance_restore", "request_pre_restore_backup", "execute_appliance_restore"],
    providerCapabilitySummary: {},
    gateSnapshot: {
      generatedAt: "2026-05-03T00:00:00.000Z",
      gates: [],
    },
    now: "2026-05-03T00:00:00.000Z",
    ...overrides,
  };
}

function operationIntent(overrides: Partial<OperationIntentOperationOutput> = {}): OperationIntentOperationOutput {
  const operationKind = overrides.operationKind ?? "backup_create";
  return {
    kind: "operation_intent",
    intentKind: operationKind,
    operationKind,
    requiredRole: "ADMIN",
    riskLevel: operationKind === "restore_execute" ? "destructive" : "medium",
    confidence: 0.95,
    title: operationKind === "restore_execute" ? "Restore Appliance" : "Create Appliance Backup",
    summary: operationKind === "restore_execute" ? "Prepare restore." : "Create backup.",
    input: operationKind === "restore_execute" ? { snapshotId: "backup_123456789abc" } : {},
    requiredCapabilities: operationKind === "restore_execute"
      ? ["prepare_appliance_restore", "request_pre_restore_backup", "execute_appliance_restore"]
      : ["create_appliance_backup"],
    requiredProviderSlots: [],
    missingInputs: [],
    source: "deterministic",
    ...overrides,
  };
}

function createRepository(): OperationRepository & {
  createOperation: ReturnType<typeof vi.fn>;
  replaceActions: ReturnType<typeof vi.fn>;
} {
  const snapshots = new Map<string, OperationSnapshot>();

  const repository = {
    createOperation: vi.fn(async (input: CreateOperationInput) => {
      const operation: Operation = {
        id: input.id,
        kind: input.kind,
        revision: 1,
        title: input.title,
        status: input.status ?? "draft",
        riskLevel: input.riskLevel ?? "medium",
        conversationId: input.conversationId ?? null,
        originMessageId: input.originMessageId ?? null,
        createdByUserId: input.createdByUserId ?? null,
        createdByRole: input.createdByRole,
        visibility: input.visibility ?? "conversation",
        currentStepId: input.currentStepId ?? null,
        summary: input.summary ?? null,
        input: input.input ?? {},
        result: input.result ?? null,
        error: input.error ?? null,
        createdAt: input.now ?? "2026-05-03T00:00:00.000Z",
        updatedAt: input.now ?? "2026-05-03T00:00:00.000Z",
        completedAt: null,
      };
      const snapshot: OperationSnapshot = {
        operation,
        steps: [] as OperationStep[],
        actions: [] as OperationAction[],
        events: [{
          id: "evt_1",
          operationId: operation.id,
          stepId: null,
          sequence: 1,
          type: "operation_created",
          actorType: "system",
          actorId: input.createdByUserId ?? null,
          payload: {},
          createdAt: operation.createdAt,
        }] as OperationEvent[],
        artifacts: [] as OperationArtifact[],
      };
      snapshots.set(operation.id, snapshot);
      return snapshot;
    }),
    replaceActions: vi.fn(async (input: ReplaceActionsInput) => {
      const snapshot = snapshots.get(input.operationId);
      if (!snapshot) {
        throw new Error("missing snapshot");
      }
      snapshot.actions = [...input.actions];
      return snapshot;
    }),
    findOperationById: vi.fn(async (id: string) => snapshots.get(id) ?? null),
    listOperationsByConversation: vi.fn(async (conversationId: string, options?: { kind?: OperationKind }) =>
      [...snapshots.values()]
        .filter((snapshot) => snapshot.operation.conversationId === conversationId)
        .filter((snapshot) => !options?.kind || snapshot.operation.kind === options.kind)
        .map(toSummary)),
    updateOperationStatus: vi.fn(),
    upsertStep: vi.fn(),
    transitionStep: vi.fn(),
    acceptAction: vi.fn(),
    appendEvent: vi.fn(),
    attachArtifact: vi.fn(),
    listOperationsForUser: vi.fn(),
    listOperationsForAdmin: vi.fn(),
    listEvents: vi.fn(),
    listArtifacts: vi.fn(),
    listAvailableActions: vi.fn(),
    getConversationSummary: vi.fn(),
    getAdminSummary: vi.fn(),
    getHealthAggregate: vi.fn(),
    getPromptGroundingSummary: vi.fn(),
  } as unknown as OperationRepository & {
    createOperation: ReturnType<typeof vi.fn>;
    replaceActions: ReturnType<typeof vi.fn>;
  };

  return repository;
}

function toSummary(snapshot: OperationSnapshot): OperationSummary {
  return {
    id: snapshot.operation.id,
    kind: snapshot.operation.kind,
    title: snapshot.operation.title,
    status: snapshot.operation.status,
    riskLevel: snapshot.operation.riskLevel,
    revision: snapshot.operation.revision,
    conversationId: snapshot.operation.conversationId,
    currentStepId: snapshot.operation.currentStepId,
    summary: snapshot.operation.summary,
    createdByUserId: snapshot.operation.createdByUserId,
    createdByRole: snapshot.operation.createdByRole,
    visibility: snapshot.operation.visibility,
    createdAt: snapshot.operation.createdAt,
    updatedAt: snapshot.operation.updatedAt,
    completedAt: snapshot.operation.completedAt,
    stepCount: snapshot.steps.length,
    actionCount: snapshot.actions.length,
    artifactCount: snapshot.artifacts.length,
    eventCount: snapshot.events.length,
    latestEventType: snapshot.events.at(-1)?.type ?? null,
    latestEventAt: snapshot.events.at(-1)?.createdAt ?? null,
    progress: {
      totalSteps: 0,
      pendingSteps: 0,
      readySteps: 0,
      runningSteps: 0,
      blockedSteps: 0,
      succeededSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percentComplete: 0,
    },
  };
}

function createRouter(repository = createRepository()) {
  let counter = 0;
  const router = new OperationIntentRouter({
    repository,
    draftFactory: new OperationDraftFactory((prefix) => `${prefix}_${++counter}`),
  });
  return { router, repository };
}

describe("OperationIntentRouter", () => {
  it("routes admin backup requests to backup_create operation drafts", async () => {
    const { router, repository } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent(),
    });

    expect(result.kind).toBe("created_operation");
    if (result.kind !== "created_operation") throw new Error("expected created operation");
    expect(result.snapshot.operation).toMatchObject({
      kind: "backup_create",
      originMessageId: "msg_user_1",
      conversationId: "conv_1",
      createdByUserId: "usr_admin",
      createdByRole: "ADMIN",
    });
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      actionType: "backup.create",
      enabled: true,
      disabledReason: null,
    });
    expect(repository.createOperation).toHaveBeenCalledTimes(1);
  });

  it("routes restore requests with full backup ids to restore_execute", async () => {
    const { router } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput({ latestUserText: "restore from backup_123456789abc" }),
      compilerOutput: operationIntent({ operationKind: "restore_execute", intentKind: "restore_execute" }),
    });

    expect(result.kind).toBe("created_operation");
    if (result.kind !== "created_operation") throw new Error("expected created operation");
    expect(result.snapshot.operation.kind).toBe("restore_execute");
    expect(result.actions[0]).toMatchObject({
      actionType: "restore.prepare",
      payload: { snapshotId: "backup_123456789abc" },
      enabled: true,
      disabledReason: null,
    });
  });

  it("clarifies missing restore backup ids before creating an operation", async () => {
    const { router, repository } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent({
        operationKind: "restore_execute",
        intentKind: "restore_execute",
        missingInputs: ["snapshotId"],
        input: {},
      }),
    });

    expect(result.kind).toBe("clarification_response");
    expect(repository.createOperation).not.toHaveBeenCalled();
  });

  it("rejects non-admin backup requests before operation creation", async () => {
    const { router, repository } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput({
        role: "AUTHENTICATED",
        userId: "usr_member",
      }),
      compilerOutput: operationIntent(),
    });

    expect(result.kind).toBe("rejected_response");
    expect(repository.createOperation).not.toHaveBeenCalled();
  });

  it("creates blocked operations for missing executor gates", async () => {
    const gate: OperationGateFact = {
      id: "executor:ordo-backup",
      state: "blocked",
      summary: "Backup executor binary is unavailable.",
      affectedOperationKinds: ["backup_create"],
    };
    const { router } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput({
        gateSnapshot: {
          generatedAt: "2026-05-03T00:00:00.000Z",
          gates: [gate],
        },
      }),
      compilerOutput: operationIntent(),
    });

    expect(result.kind).toBe("blocked_operation");
    if (result.kind !== "blocked_operation") throw new Error("expected blocked operation");
    expect(result.snapshot.operation.status).toBe("blocked");
    expect(result.snapshot.operation.error).toMatchObject({
      code: "OPERATION_GATED",
    });
    expect(result.actions.every((action) => action.enabled === false)).toBe(true);
  });

  it("creates blocked operation state when an operation-backed tool is disabled", async () => {
    const { router } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput({ availableToolNames: [] }),
      compilerOutput: operationIntent(),
    });

    expect(result.kind).toBe("blocked_operation");
    if (result.kind !== "blocked_operation") throw new Error("expected blocked operation");
    expect(result.blockingGates.map((gate) => gate.id)).toContain("tool:create_appliance_backup");
    expect(result.actions.filter((action) => action.enabled)).toHaveLength(0);
  });

  it("creates blocked media workflow operations when required provider slots are unavailable", async () => {
    const { router } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput({
        role: "AUTHENTICATED",
        userId: "usr_member",
        availableToolNames: ["compose_media"],
        providerCapabilitySummary: {
          providerBackedTools: [
            {
              name: "generate_audio",
              slot: "tts",
              state: "missing_key",
              provider: "openai",
            },
          ],
        },
      }),
      compilerOutput: operationIntent({
        operationKind: "media_workflow",
        intentKind: "media_workflow",
        requiredRole: "AUTHENTICATED",
        title: "Create Media Workflow",
        summary: "Create governed media.",
        input: { requestedText: "make a narration video" },
        requiredCapabilities: ["compose_media"],
        requiredProviderSlots: ["tts"],
      }),
    });

    expect(result.kind).toBe("blocked_operation");
    if (result.kind !== "blocked_operation") throw new Error("expected blocked operation");
    expect(result.blockingGates.map((gate) => gate.id)).toEqual(["provider:tts"]);
    expect(result.snapshot.operation.kind).toBe("media_workflow");
    expect(result.actions.filter((action) => action.enabled)).toHaveLength(0);
    expect(result.actions[0]).toMatchObject({
      actionType: "media.workflow.create",
      disabledReason: expect.stringContaining("provider capability"),
    });
  });

  it("does not reuse a blocked media workflow for a different media request", async () => {
    const { router, repository } = createRouter();

    const first = await router.route({
      compilerInput: createCompilerInput({
        role: "AUTHENTICATED",
        userId: "usr_member",
        availableToolNames: ["compose_media"],
        providerCapabilitySummary: {
          providerBackedTools: [{
            name: "generate_audio",
            slot: "tts",
            state: "missing_key",
            provider: "openai",
          }],
        },
      }),
      compilerOutput: operationIntent({
        operationKind: "media_workflow",
        intentKind: "media_workflow",
        requiredRole: "AUTHENTICATED",
        title: "Create Media Workflow",
        summary: "Create governed media.",
        input: { requestedText: "make a narration video" },
        requiredCapabilities: ["compose_media"],
        requiredProviderSlots: ["tts"],
      }),
    });

    expect(first.kind).toBe("blocked_operation");

    const second = await router.route({
      compilerInput: createCompilerInput({
        role: "AUTHENTICATED",
        userId: "usr_member",
        latestUserText: "generate audio narration about backups",
        availableToolNames: ["generate_audio"],
      }),
      compilerOutput: operationIntent({
        operationKind: "media_workflow",
        intentKind: "media_workflow",
        requiredRole: "AUTHENTICATED",
        title: "Generate Audio",
        summary: "Create governed audio.",
        input: {
          requestedText: "generate audio narration about backups",
          requestedDeliverable: "audio",
          template: "generated_audio",
          audio: { title: "Generated audio", text: "generate audio narration about backups" },
        },
        requiredCapabilities: ["generate_audio"],
        requiredProviderSlots: [],
      }),
    });

    expect(second.kind).toBe("created_operation");
    expect(repository.createOperation).toHaveBeenCalledTimes(2);
  });

  it("creates blocked operation state for resource pressure", async () => {
    const { router } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput({
        gateSnapshot: {
          generatedAt: "2026-05-03T00:00:00.000Z",
          gates: [{
            id: "resource:data-volume",
            state: "blocked",
            summary: "Writable data volume free space is below the appliance safety floor.",
            affectedOperationKinds: ["backup_create"],
          }],
        },
      }),
      compilerOutput: operationIntent(),
    });

    expect(result.kind).toBe("blocked_operation");
    if (result.kind !== "blocked_operation") throw new Error("expected blocked operation");
    expect(result.blockingGates.map((gate) => gate.id)).toEqual(["resource:data-volume"]);
    expect(result.actions.filter((action) => action.enabled)).toHaveLength(0);
  });

  it("rejects invalid compiler output safely", async () => {
    const { router, repository } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: { kind: "operation_intent", operationKind: "unknown_kind" },
    });

    expect(result.kind).toBe("rejected_response");
    expect(repository.createOperation).not.toHaveBeenCalled();
  });

  it("passes through low-confidence non-dangerous intents", async () => {
    const { router, repository } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent({ confidence: 0.4 }),
    });

    expect(result).toMatchObject({
      kind: "pass_through",
      reason: "low_confidence_non_destructive",
    });
    expect(repository.createOperation).not.toHaveBeenCalled();
  });

  it("clarifies low-confidence destructive intents", async () => {
    const { router, repository } = createRouter();

    const result = await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent({
        operationKind: "restore_execute",
        intentKind: "restore_execute",
        confidence: 0.7,
        riskLevel: "destructive" as OperationRiskLevel,
      }),
    });

    expect(result.kind).toBe("clarification_response");
    expect(repository.createOperation).not.toHaveBeenCalled();
  });

  it("projects active operations instead of creating duplicates", async () => {
    const { router, repository } = createRouter();

    await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent(),
    });
    const duplicate = await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent(),
    });

    expect(duplicate.kind).toBe("existing_operation");
    expect(repository.createOperation).toHaveBeenCalledTimes(1);
  });

  it("does not depend on or call a tool executor", async () => {
    const toolExecutor = vi.fn();
    const { router } = createRouter();

    await router.route({
      compilerInput: createCompilerInput(),
      compilerOutput: operationIntent(),
    });

    expect(toolExecutor).not.toHaveBeenCalled();
  });
});
