import { getPlatformInteractionFacade } from "@/adapters/RepositoryFactory";
import { getSessionUser } from "@/lib/auth";
import { RevisionActionError } from "@/core/platform/facade/AgentPlatformFacade";
import { listProductBriefValidationErrors, type ProductBrief } from "@/core/entities/product-brief";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";

type RouteParams = {
  params: Promise<{ workOrderId: string }>;
};

type RevisionAction = "pause" | "refine" | "resume";
type RefineMode = "regenerate" | "replace_with_upload" | "metadata_fix";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAction(value: unknown): RevisionAction | null {
  return value === "pause" || value === "refine" || value === "resume" ? value : null;
}

function parseRefineMode(value: unknown): RefineMode | null {
  return value === "regenerate" || value === "replace_with_upload" || value === "metadata_fix"
    ? value
    : null;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalBrief(value: unknown): ProductBrief | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return value as unknown as ProductBrief;
}

function validateBrief(brief: ProductBrief | undefined): string | null {
  if (!brief) {
    return "brief is required.";
  }

  const errors = listProductBriefValidationErrors(brief);
  return errors.length > 0 ? errors.join(" ") : null;
}

async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user.roles.includes("ADMIN")) {
    return null;
  }
  return user;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Factory revision controls are restricted to administrators.", 403);
  }

  const { workOrderId } = await params;
  if (!workOrderId) {
    return jsonError("workOrderId is required.", 400);
  }

  const result = await getPlatformInteractionFacade().getWorkOrderInteraction(workOrderId);
  if (!result) {
    return jsonError("Factory work order not found.", 404);
  }

  return Response.json({
    ok: true,
    workOrder: result.workOrder,
    activeCheckpoint: result.activeCheckpoint,
    stageRuns: result.stageRuns,
    outputs: result.outputs,
    events: result.events,
    timeline: result.timeline,
    revision: result.revision,
    interaction: result,
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await requireAdminUser();
  if (!user) {
    return jsonError("Factory revision controls are restricted to administrators.", 403);
  }

  const { workOrderId } = await params;
  if (!workOrderId) {
    return jsonError("workOrderId is required.", 400);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = parseAction(body?.action);
  if (!action) {
    return jsonError("action must be one of pause, refine, or resume.", 400);
  }

  try {
    if (action === "refine") {
      const mode = parseRefineMode(body?.mode);
      if (!mode) {
        return jsonError("mode must be one of regenerate, replace_with_upload, or metadata_fix.", 400);
      }

      const assetId = parseOptionalString(body?.assetId);
      if (!assetId) {
        return jsonError("assetId is required for refine.", 400);
      }

      const brief = parseOptionalBrief(body?.brief);
      if (mode === "regenerate") {
        const briefError = validateBrief(brief);
        if (briefError) {
          return jsonError(`Invalid brief for regenerate: ${briefError}`, 400);
        }
      }
    }

    if (action === "resume") {
      const brief = parseOptionalBrief(body?.brief);
      const briefError = validateBrief(brief);
      if (briefError) {
        return jsonError(`Invalid brief for resume: ${briefError}`, 400);
      }
    }

    const result = await getAgentPlatformFacade().reviseExecution({
      executionKind: "work_order",
      executionId: workOrderId,
      action,
      role: "ADMIN",
      userId: user.id,
      payload: body ?? undefined,
    });

    return Response.json({ ok: true, action, ...(result.payload as Record<string, unknown> | undefined) });
  } catch (error) {
    if (error instanceof RevisionActionError) {
      return jsonError(error.message, error.status);
    }

    const message = error instanceof Error ? error.message : "Unexpected factory revision error.";
    const status = /not found/i.test(message)
      ? 404
      : /must be paused|terminal|required|invalid|later than the safe frontier|does not match asset kind/i.test(message)
        ? 400
        : 500;

    return jsonError(message, status);
  }
}
