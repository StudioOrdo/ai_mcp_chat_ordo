import type { NextRequest } from "next/server";
import { getMediaWorkflowReadModel, getMediaWorkflowRepository, getOperationRepository, getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import type { OperationAction } from "@/core/entities/operation";
import { RevisionActionError } from "@/core/platform/facade/AgentPlatformFacade";
import { createConversationRouteServices } from "@/lib/chat/conversation-root";
import { resolveUserId } from "@/lib/chat/resolve-user";
import { errorJson, runRouteTemplate, successJson } from "@/lib/chat/http-facade";
import { createOperationActionDispatchService } from "@/lib/operations/operation-action-dispatch-root";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

function parseAction(value: unknown): "cancel" | "retry" | null {
  return value === "cancel" || value === "retry" ? value : null;
}

function readOperationId(request: Record<string, unknown>): string | null {
  const operation = request["operation"];
  if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
    return null;
  }
  const raw = operation as Record<string, unknown>;
  return typeof raw.operationId === "string" && raw.operationId.trim() ? raw.operationId.trim() : null;
}

function mediaActionTypeForJobAction(action: "cancel" | "retry"): string {
  return action === "cancel" ? "media.workflow.cancel" : "media.workflow.retry_step";
}

function findMediaWorkflowAction(actions: readonly OperationAction[], action: "cancel" | "retry"): OperationAction | null {
  const actionType = mediaActionTypeForJobAction(action);
  return actions.find((candidate) => candidate.actionType === actionType) ?? null;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/chat/jobs/[jobId]",
    request: _request,
    validationMessages: [],
    execute: async (context) => {
      const { jobId } = await params;
      const result = await getPlatformInteractionFacade().getJobInteraction(jobId);
      const snapshot = result?.snapshot;

      if (!snapshot) {
        return errorJson(context, "Job not found", 404);
      }

      if (!snapshot.conversationId) {
        return errorJson(context, "Job is missing conversation context", 500);
      }

      const { userId } = await resolveUserId();
      const { interactor } = createConversationRouteServices();
      await interactor.get(snapshot.conversationId, userId);

      return successJson(context, {
        ok: true,
        job: snapshot,
        timeline: result.timeline,
        revision: result.revision,
        interaction: result,
      });
    },
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return runRouteTemplate({
    route: "/api/chat/jobs/[jobId]",
    request,
    validationMessages: ["Invalid job action."],
    execute: async (context) => {
      const { jobId } = await params;
      const body = await request.json().catch(() => ({}));
      const action = parseAction((body as { action?: unknown }).action);

      if (!action) {
        throw new Error("Invalid job action.");
      }

      const interaction = await getPlatformInteractionFacade().getJobInteraction(jobId);
      const job = interaction?.job;
      if (!job) {
        return errorJson(context, "Job not found", 404);
      }

      const { userId } = await resolveUserId();
      const { interactor } = createConversationRouteServices();
      await interactor.get(job.conversationId, userId);

      const workflow = getMediaWorkflowRepository().findWorkflowByStepJobId(jobId);
      if (workflow) {
        const operationId = readOperationId(workflow.workflow.request);
        if (!operationId) {
          return errorJson(context, "Media workflow is missing operation metadata.", 409);
        }

        const operationRepository = getOperationRepository();
        const availableActions = await operationRepository.listAvailableActions(operationId);
        const operationAction = findMediaWorkflowAction(availableActions, action);
        if (!operationAction) {
          return errorJson(context, `No operation-backed ${action} action is currently available for this media workflow.`, 409);
        }

        const dispatch = createOperationActionDispatchService({ repository: operationRepository });
        const result = await dispatch.dispatch({
          operationId,
          actionId: operationAction.id,
          idempotencyKey: operationAction.idempotencyKey,
          clientOperationRevision: operationAction.operationRevision,
          actorUserId: userId,
          actorRole: "AUTHENTICATED",
          payload: operationAction.payload,
          confirmation: operationAction.confirmPolicy === "single_click" ? { confirmed: true } : undefined,
        });
        const nextWorkflow = getMediaWorkflowRepository().findWorkflowById(workflow.workflow.id);
        const workflowSnapshot = nextWorkflow
          ? await getMediaWorkflowReadModel().buildSnapshot(nextWorkflow)
          : null;

        return successJson(context, {
          ok: true,
          action,
          operation: result.snapshot.operation,
          snapshot: result.snapshot,
          availableActions: result.availableActions,
          workflow: workflowSnapshot,
        });
      }

      try {
        const result = await getAgentPlatformFacade().reviseExecution({
          executionKind: "job",
          executionId: jobId,
          action,
          role: "AUTHENTICATED",
          userId,
        });

        return successJson(context, {
          ok: true,
          action,
          ...(result.payload as Record<string, unknown> | undefined),
        });
      } catch (error) {
        if (error instanceof RevisionActionError) {
          return errorJson(context, error.message, error.status);
        }

        throw error;
      }
    },
  });
}
