import { describe, expect, it, vi } from "vitest";

import type {
  OperationAction,
  OperationEvent,
  OperationKind,
  OperationRiskLevel,
  OperationStatus,
  OperationVisibility,
} from "@/core/entities/operation";
import {
  OperationPromptGrounding,
  type OperationPromptGroundingToolEvidence,
} from "@/core/use-cases/operations/OperationPromptGrounding";
import type {
  OperationRepository,
  OperationSummary,
} from "@/core/use-cases/operations/OperationRepository";
import type { PromptGroundingOperationSummary } from "@/core/use-cases/operations/OperationReadModel";

const NOW = "2026-05-03T12:00:00.000Z";

function progress(percentComplete = 0) {
  return {
    totalSteps: 1,
    pendingSteps: 0,
    readySteps: 0,
    runningSteps: 0,
    blockedSteps: 0,
    succeededSteps: percentComplete === 100 ? 1 : 0,
    failedSteps: 0,
    skippedSteps: 0,
    cancelledSteps: 0,
    percentComplete,
  };
}

function event(overrides: Partial<OperationEvent> = {}): OperationEvent {
  return {
    id: overrides.id ?? `evt_${overrides.sequence ?? 1}`,
    operationId: overrides.operationId ?? "op_restore",
    stepId: overrides.stepId ?? null,
    sequence: overrides.sequence ?? 1,
    type: overrides.type ?? "operation_status_changed",
    actorType: overrides.actorType ?? "system",
    actorId: overrides.actorId ?? null,
    payload: overrides.payload ?? { status: "running" },
    createdAt: overrides.createdAt ?? NOW,
  };
}

function action(overrides: Partial<OperationAction> = {}): OperationAction {
  return {
    id: overrides.id ?? "act_execute",
    operationId: overrides.operationId ?? "op_restore",
    operationRevision: overrides.operationRevision ?? 1,
    actionType: overrides.actionType ?? "restore.execute",
    label: overrides.label ?? "Execute restore",
    riskLevel: overrides.riskLevel ?? "destructive",
    confirmPolicy: overrides.confirmPolicy ?? "phrase",
    allowedRoles: overrides.allowedRoles ?? ["ADMIN"],
    allowedStatuses: overrides.allowedStatuses ?? ["awaiting_confirmation"],
    enabled: overrides.enabled ?? true,
    disabledReason: overrides.disabledReason ?? null,
    idempotencyKey: overrides.idempotencyKey ?? "idem_restore",
    expiresAt: overrides.expiresAt ?? null,
    payload: overrides.payload ?? {},
    payloadSchemaKey: overrides.payloadSchemaKey ?? "restore.execute",
    confirmationText: overrides.confirmationText ?? null,
  };
}

function summary(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: overrides.id ?? "op_restore",
    kind: overrides.kind ?? "restore_execute",
    title: overrides.title ?? "Restore Appliance",
    status: overrides.status ?? "running",
    riskLevel: overrides.riskLevel ?? "destructive",
    revision: overrides.revision ?? 1,
    conversationId: overrides.conversationId ?? "conv_1",
    currentStepId: overrides.currentStepId ?? "restore.execute",
    summary: overrides.summary ?? "Restore in progress.",
    createdByUserId: overrides.createdByUserId ?? "usr_admin",
    createdByRole: overrides.createdByRole ?? "ADMIN",
    visibility: overrides.visibility ?? "conversation",
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    completedAt: overrides.completedAt ?? null,
    stepCount: overrides.stepCount ?? 1,
    actionCount: overrides.actionCount ?? 1,
    artifactCount: overrides.artifactCount ?? 0,
    eventCount: overrides.eventCount ?? 1,
    latestEventType: overrides.latestEventType ?? "operation_status_changed",
    latestEventAt: overrides.latestEventAt ?? NOW,
    progress: overrides.progress ?? progress(50),
  };
}

function grounding(
  operation: OperationSummary,
  overrides: Partial<PromptGroundingOperationSummary> = {},
): PromptGroundingOperationSummary {
  return {
    operationId: operation.id,
    kind: operation.kind,
    title: operation.title,
    status: operation.status,
    riskLevel: operation.riskLevel,
    revision: operation.revision,
    currentStepId: operation.currentStepId,
    summary: operation.summary,
    progress: operation.progress,
    latestEvents: overrides.latestEvents ?? [event({ operationId: operation.id })],
    availableActions: overrides.availableActions ?? [action({ operationId: operation.id })],
    artifacts: overrides.artifacts ?? [],
    error: overrides.error ?? null,
    updatedAt: operation.updatedAt,
    ...overrides,
  };
}

function createRepository(operations: OperationSummary[]): Pick<
  OperationRepository,
  "listOperationsByConversation" | "getPromptGroundingSummary"
> {
  const groundingById = new Map(operations.map((operation) => [operation.id, grounding(operation)]));
  return {
    listOperationsByConversation: vi.fn(async () => operations),
    getPromptGroundingSummary: vi.fn(async (operationId: string) => groundingById.get(operationId) ?? null),
  };
}

async function buildGrounding(
  operations: OperationSummary[],
  overrides: {
    latestUserText?: string;
    role?: "ANONYMOUS" | "AUTHENTICATED" | "APPRENTICE" | "STAFF" | "ADMIN";
    userId?: string;
    toolEvidence?: OperationPromptGroundingToolEvidence[];
    repository?: Pick<OperationRepository, "listOperationsByConversation" | "getPromptGroundingSummary">;
  } = {},
) {
  const repository = overrides.repository ?? createRepository(operations);
  return new OperationPromptGrounding(repository).build({
    conversationId: "conv_1",
    userId: overrides.userId ?? "usr_admin",
    role: overrides.role ?? "ADMIN",
    latestUserText: overrides.latestUserText ?? "what happened with that restore?",
    toolEvidence: overrides.toolEvidence,
    now: NOW,
  });
}

describe("OperationPromptGrounding", () => {
  it("includes active restore operation state in the grounding snapshot", async () => {
    const snapshot = await buildGrounding([
      summary({ id: "op_restore_active", kind: "restore_execute", status: "running" }),
    ], { latestUserText: "what is the current operation state?" });

    expect(snapshot.status).toBe("available");
    expect(snapshot.includeInPrompt).toBe(true);
    expect(snapshot.operations[0]).toMatchObject({
      operationId: "op_restore_active",
      kind: "restore_execute",
      status: "running",
      groundingReason: "active",
    });
  });

  it("selects active backup, media, factory, and publish operations before old completed operations", async () => {
    const oldCompleted = summary({
      id: "op_old",
      status: "succeeded",
      kind: "backup_create",
      updatedAt: "2026-04-01T00:00:00.000Z",
      completedAt: "2026-04-01T00:00:00.000Z",
    });
    const activeKinds: OperationKind[] = [
      "backup_create",
      "media_workflow",
      "factory_work_order",
      "content_publish",
    ];
    const operations = [
      oldCompleted,
      ...activeKinds.map((kind, index) =>
        summary({
          id: `op_active_${index}`,
          kind,
          status: "queued",
          updatedAt: `2026-05-03T11:0${index}:00.000Z`,
        }),
      ),
    ];

    const snapshot = await buildGrounding(operations, { latestUserText: "check current operations" });

    expect(snapshot.operations.map((operation) => operation.operationId)).not.toContain("op_old");
    expect(snapshot.operations.map((operation) => operation.kind)).toEqual(
      expect.arrayContaining(activeKinds),
    );
  });

  it("summarizes a completed operation when it is recent or mentioned", async () => {
    const recent = summary({
      id: "op_recent_done",
      status: "succeeded",
      updatedAt: "2026-05-03T11:30:00.000Z",
      completedAt: "2026-05-03T11:30:00.000Z",
      artifactCount: 1,
    });
    const mentioned = summary({
      id: "op_mentioned_done",
      title: "Weekly Snapshot",
      status: "succeeded",
      updatedAt: "2026-04-01T00:00:00.000Z",
      completedAt: "2026-04-01T00:00:00.000Z",
    });

    const snapshot = await buildGrounding([recent, mentioned], {
      latestUserText: "tell me about op_mentioned",
    });

    expect(snapshot.operations.map((operation) => operation.operationId)).toEqual(
      expect.arrayContaining(["op_recent_done", "op_mentioned_done"]),
    );
  });

  it("excludes irrelevant old completed operations", async () => {
    const snapshot = await buildGrounding([
      summary({
        id: "op_old_done",
        status: "succeeded",
        updatedAt: "2026-04-01T00:00:00.000Z",
        completedAt: "2026-04-01T00:00:00.000Z",
      }),
    ], { latestUserText: "hello" });

    expect(snapshot.status).toBe("empty");
    expect(snapshot.includeInPrompt).toBe(false);
    expect(snapshot.operations).toEqual([]);
  });

  it("includes failed and blocked operation errors and latest events", async () => {
    const failed = summary({ id: "op_failed", status: "failed", riskLevel: "medium" });
    const repository = createRepository([failed]);
    vi.mocked(repository.getPromptGroundingSummary).mockResolvedValueOnce(
      grounding(failed, {
        error: { code: "BACKUP_EXECUTOR_MISSING", message: "Executor missing." },
        latestEvents: [event({
          operationId: "op_failed",
          sequence: 7,
          payload: { status: "failed", errorCode: "BACKUP_EXECUTOR_MISSING" },
        })],
      }),
    );

    const snapshot = await buildGrounding([failed], { repository });

    expect(snapshot.operations[0].error).toEqual({
      code: "BACKUP_EXECUTOR_MISSING",
      message: "Executor missing.",
    });
    expect(snapshot.operations[0].latestEvents[0]).toMatchObject({
      sequence: 7,
      payloadSummary: expect.stringContaining("BACKUP_EXECUTOR_MISSING"),
    });
  });

  it("bounds actions and carries disabled metadata when exposed by the read model", async () => {
    const active = summary({ id: "op_restore" });
    const repository = createRepository([active]);
    vi.mocked(repository.getPromptGroundingSummary).mockResolvedValueOnce(
      grounding(active, {
        availableActions: [
          action({ id: "act_disabled", enabled: false, disabledReason: "safety backup required" }),
          action({ id: "act_enabled", enabled: true, disabledReason: null }),
          action({ id: "act_extra", enabled: true, disabledReason: null }),
        ],
      }),
    );

    const snapshot = await new OperationPromptGrounding(repository).build({
      conversationId: "conv_1",
      userId: "usr_admin",
      role: "ADMIN",
      latestUserText: "check restore",
      now: NOW,
      budget: { maxAvailableActionsPerOperation: 2 },
    });

    expect(snapshot.operations[0].availableActions).toHaveLength(2);
    expect(snapshot.operations[0].availableActions[0]).toMatchObject({
      id: "act_disabled",
      enabled: false,
      disabledReason: "safety backup required",
      riskLevel: "destructive",
      confirmPolicy: "phrase",
    });
    expect(snapshot.budget.actionsDropped).toBe(1);
  });

  it("records event and artifact drops when per-operation budgets truncate read models", async () => {
    const active = summary({ id: "op_restore" });
    const repository = createRepository([active]);
    vi.mocked(repository.getPromptGroundingSummary).mockResolvedValueOnce(
      grounding(active, {
        latestEvents: [
          event({ operationId: "op_restore", sequence: 1 }),
          event({ operationId: "op_restore", sequence: 2 }),
          event({ operationId: "op_restore", sequence: 3 }),
        ],
        artifacts: [
          { label: "Backup 1", uri: "backup://1", kind: "backup", createdAt: NOW },
          { label: "Backup 2", uri: "backup://2", kind: "backup", createdAt: NOW },
        ],
      }),
    );

    const snapshot = await new OperationPromptGrounding(repository).build({
      conversationId: "conv_1",
      userId: "usr_admin",
      role: "ADMIN",
      latestUserText: "check restore",
      now: NOW,
      budget: {
        maxLatestEventsPerOperation: 2,
        maxArtifactsPerOperation: 1,
      },
    });

    expect(snapshot.operations[0].latestEvents.map((entry) => entry.sequence)).toEqual([2, 3]);
    expect(snapshot.operations[0].artifacts).toHaveLength(1);
    expect(snapshot.budget.eventsDropped).toBe(1);
    expect(snapshot.budget.artifactsDropped).toBe(1);
  });

  it("drops least relevant operations and tool evidence when budgets are exceeded", async () => {
    const operations = Array.from({ length: 8 }, (_, index) =>
      summary({
        id: `op_running_${index}`,
        status: "running",
        updatedAt: `2026-05-03T11:0${index}:00.000Z`,
      }),
    );
    const toolEvidence = Array.from({ length: 10 }, (_, index) => ({
      messageId: `msg_${index}`,
      toolInvocationId: `toolu_${index}`,
      toolName: "example_tool",
      evidenceKind: "result" as const,
      summary: "ok",
      error: null,
      relatedOperationId: null,
      createdAt: NOW,
    }));

    const snapshot = await new OperationPromptGrounding(createRepository(operations)).build({
      conversationId: "conv_1",
      userId: "usr_admin",
      role: "ADMIN",
      latestUserText: "check operations",
      toolEvidence,
      now: NOW,
      budget: { maxOperations: 3, maxActiveOperations: 3, maxToolEvidenceEntries: 4 },
    });

    expect(snapshot.operations).toHaveLength(3);
    expect(snapshot.toolEvidence).toHaveLength(4);
    expect(snapshot.budget.operationsDropped).toBeGreaterThan(0);
    expect(snapshot.budget.toolEvidenceDropped).toBe(6);
  });

  it("returns unavailable grounding when the repository read fails", async () => {
    const repository = {
      listOperationsByConversation: vi.fn(async () => {
        throw new Error("db offline");
      }),
      getPromptGroundingSummary: vi.fn(),
    };

    const snapshot = await buildGrounding([], { repository });

    expect(snapshot.status).toBe("unavailable");
    expect(snapshot.includeInPrompt).toBe(true);
    expect(snapshot.warnings[0]).toContain("db offline");
  });

  it("excludes operation state hidden from the current role", async () => {
    const hidden = summary({
      id: "op_admin_only",
      visibility: "admin" as OperationVisibility,
      status: "running" as OperationStatus,
      riskLevel: "high" as OperationRiskLevel,
    });

    const snapshot = await buildGrounding([hidden], {
      role: "AUTHENTICATED",
      latestUserText: "what is the operation status?",
    });

    expect(snapshot.status).toBe("empty");
    expect(snapshot.operations).toEqual([]);
    expect(snapshot.warnings).toContain("no_current_operation_state_found_for_conversation");
  });
});
