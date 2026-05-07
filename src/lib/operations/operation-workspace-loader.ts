import { notFound } from "next/navigation";

import { getOperationRepository } from "@/adapters/RepositoryFactory";
import type { OperationArtifact, OperationEvent } from "@/core/entities/operation";
import type { OperationCardModel } from "@/core/entities/rich-content";
import type { OperationHealthAggregate } from "@/core/use-cases/operations/OperationReadModel";
import type { OperationSnapshot } from "@/core/use-cases/operations/OperationRepository";
import type { SessionUser } from "@/lib/auth";
import {
  canReadOperationSnapshot,
  createOperationReadContext,
  listReadableOperations,
  parseOperationListOptions,
} from "@/lib/operations/operation-read-api";
import {
  operationSourceToCardModel,
  operationSnapshotToCardModel,
} from "@/lib/operations/operation-presentation";

export interface OperationsWorkspaceModel {
  cards: OperationCardModel[];
  totalCount: number;
  health: OperationHealthAggregate;
  filters: Record<string, string>;
}

export interface OperationDetailWorkspaceModel {
  card: OperationCardModel;
  snapshot: OperationSnapshot;
  events: OperationEvent[];
  artifacts: OperationArtifact[];
}

function normalizeSearchParams(searchParams?: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

export async function loadOperationsWorkspace(
  user: SessionUser,
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<OperationsWorkspaceModel> {
  const repository = getOperationRepository();
  const context = createOperationReadContext(user);
  const params = normalizeSearchParams(searchParams);
  const options = parseOperationListOptions(params);
  const summaries = await listReadableOperations({ repository, context, options });
  const health = await repository.getHealthAggregate();

  return {
    cards: summaries.map(operationSourceToCardModel),
    totalCount: summaries.length,
    health,
    filters: Object.fromEntries(params.entries()),
  };
}

export async function loadOperationDetailWorkspace(
  user: SessionUser,
  operationId: string,
): Promise<OperationDetailWorkspaceModel> {
  const repository = getOperationRepository();
  const context = createOperationReadContext(user);
  const snapshot = await repository.findOperationById(operationId);
  if (!snapshot || !canReadOperationSnapshot(snapshot, context)) {
    notFound();
  }

  const [events, artifacts, availableActions] = await Promise.all([
    repository.listEvents(operationId, { limit: 200 }),
    repository.listArtifacts(operationId, { limit: 100 }),
    repository.listAvailableActions(operationId),
  ]);

  return {
    snapshot: { ...snapshot, actions: availableActions },
    card: operationSnapshotToCardModel({ ...snapshot, actions: availableActions }),
    events,
    artifacts,
  };
}

export async function loadAdminSystemOperations(user: SessionUser): Promise<OperationsWorkspaceModel> {
  return loadOperationsWorkspace(user, { limit: "100" });
}
