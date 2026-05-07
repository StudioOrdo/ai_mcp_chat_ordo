import { createHash, randomUUID } from "node:crypto";

import {
  getFactoryRepository,
  getOperationRepository,
} from "@/adapters/RepositoryFactory";
import type { RoleName } from "@/core/entities/user";
import {
  createFactoryWorkOrderCreateAction,
} from "@/core/use-cases/operations/FactoryWorkOrderOperationActions";
import type { OperationActionDispatchService } from "@/core/use-cases/operations/OperationActionDispatch";
import type { OperationActionDispatchResult } from "@/core/use-cases/operations/OperationActionDispatch";
import type { OperationRepository } from "@/core/use-cases/operations/OperationRepository";
import type { FactoryRepository } from "@/core/use-cases/FactoryRepository";
import type { ProduceProductOperationRequestPayload } from "@/core/use-cases/tools/factory-production.tool";
import { createOperationActionDispatchService } from "@/lib/operations/operation-action-dispatch-root";

export interface FactoryWorkOrderOperationLaunchInput {
  conversationId: string;
  userId: string;
  role: RoleName;
  request: ProduceProductOperationRequestPayload;
  sourceSurface?: string;
  operationRepository?: OperationRepository;
  factoryRepository?: Pick<FactoryRepository, "findWorkOrderByOperationId">;
  dispatchService?: Pick<OperationActionDispatchService, "dispatch">;
  idFactory?: (prefix: string) => string;
}

export interface FactoryWorkOrderOperationLaunchResult {
  operation: OperationActionDispatchResult["snapshot"]["operation"];
  snapshot: OperationActionDispatchResult["snapshot"];
  availableActions: OperationActionDispatchResult["availableActions"];
  workOrderId: string | null;
  exactReuse: false;
  deduplicated: false;
}

export type FactoryWorkOrderOperationLauncher = (
  input: FactoryWorkOrderOperationLaunchInput,
) => Promise<FactoryWorkOrderOperationLaunchResult>;

export function factoryWorkOrderOperationIdempotencyKey(
  conversationId: string,
  raw: Record<string, unknown>,
): string {
  const digest = createHash("sha1")
    .update(JSON.stringify({ conversationId, raw }))
    .digest("hex")
    .slice(0, 16);
  return `factory:produce_product:${conversationId}:${digest}`;
}

export function buildFactoryWorkOrderOperationPayload(
  raw: ProduceProductOperationRequestPayload,
  conversationId: string,
): Record<string, unknown> {
  return {
    brief: raw.brief,
    previousWorkOrderIds: raw.previousWorkOrderIds ?? [],
    conversationId,
    idempotencyKey: factoryWorkOrderOperationIdempotencyKey(conversationId, raw as unknown as Record<string, unknown>),
  };
}

export async function launchFactoryWorkOrderOperation(
  input: FactoryWorkOrderOperationLaunchInput,
): Promise<FactoryWorkOrderOperationLaunchResult> {
  assertStaffOrAdmin(input.role);

  const operationRepository = input.operationRepository ?? getOperationRepository();
  const factoryRepository = input.factoryRepository ?? getFactoryRepository();
  const idFactory = input.idFactory ?? ((prefix: string) => `${prefix}_${randomUUID()}`);
  const operationId = idFactory("op_factory");

  await operationRepository.createOperation({
    id: operationId,
    kind: "factory_work_order",
    title: `Produce ${input.request.brief.title}`,
    summary: "Software factory work order requested from a user-facing capability surface.",
    status: "draft",
    riskLevel: "medium",
    conversationId: input.conversationId,
    createdByUserId: input.userId,
    createdByRole: input.role,
    visibility: "staff",
    input: {
      request: input.request,
      migration: {
        sourceSurface: input.sourceSurface ?? "factory_work_order_operation_launcher",
        toolName: "produce_product",
      },
    },
    actorType: "user",
    actorId: input.userId,
  });

  const action = createFactoryWorkOrderCreateAction({
    operationId,
    operationRevision: 1,
    idFactory,
    payload: buildFactoryWorkOrderOperationPayload(input.request, input.conversationId),
  });
  await operationRepository.replaceActions({
    operationId,
    actions: [action],
    actorType: "system",
    actorId: input.userId,
  });

  const dispatch = input.dispatchService ?? createOperationActionDispatchService({ repository: operationRepository });
  const result = await dispatch.dispatch({
    operationId,
    actionId: action.id,
    idempotencyKey: action.idempotencyKey,
    clientOperationRevision: action.operationRevision,
    actorUserId: input.userId,
    actorRole: input.role,
    payload: action.payload,
    confirmation: { confirmed: true },
  });

  const workOrder = await factoryRepository.findWorkOrderByOperationId(operationId);
  return {
    operation: result.snapshot.operation,
    snapshot: result.snapshot,
    availableActions: result.availableActions,
    workOrderId: workOrder?.id ?? null,
    exactReuse: false,
    deduplicated: false,
  };
}

export function toFactoryWorkOrderOperationToolResult(
  result: FactoryWorkOrderOperationLaunchResult,
): Record<string, unknown> {
  return {
    action: "produce_product",
    outcome: "operation_created",
    operationId: result.operation.id,
    operation: result.operation,
    snapshot: result.snapshot,
    availableActions: result.availableActions,
    workOrderId: result.workOrderId,
    exactReuse: result.exactReuse,
    deduplicated: result.deduplicated,
  };
}

function assertStaffOrAdmin(role: RoleName): void {
  if (role !== "STAFF" && role !== "ADMIN") {
    throw new Error("produce_product requires STAFF or ADMIN role to create a factory work-order operation.");
  }
}
