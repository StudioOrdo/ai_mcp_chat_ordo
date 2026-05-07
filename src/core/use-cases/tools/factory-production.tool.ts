import { listProductBriefValidationErrors, type ProductBrief } from "@/core/entities/product-brief";
import type { JobRequest } from "@/core/entities/job";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type {
  ProduceProductDeferredJobHandler,
  ProduceProductDeferredJobResult,
  ProduceProductRequestPayload,
} from "@/lib/factory/produce-product-deferred-job";

export interface ProduceProductOperationRequestPayload {
  brief: ProductBrief;
  previousWorkOrderIds?: readonly string[];
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label} is required.`);
  }

  return value as Record<string, unknown>;
}

function requireExecutionContext(context?: ToolExecutionContext): ToolExecutionContext {
  if (!context) {
    throw new Error("Tool execution context is required.");
  }

  return context;
}

export function parseProduceProductInput(value: unknown): ProduceProductRequestPayload {
  const parsed = parseProduceProductOperationInput(value);
  const record = requireRecord(value, "input");
  const operationId = typeof record.operationId === "string" ? record.operationId.trim() : "";
  if (!operationId) {
    throw new Error("operationId is required.");
  }

  return {
    operationId,
    ...parsed,
  };
}

export function parseProduceProductOperationInput(value: unknown): ProduceProductOperationRequestPayload {
  const record = requireRecord(value, "input");
  const brief = requireRecord(record.brief, "brief") as unknown as ProductBrief;
  const validationErrors = listProductBriefValidationErrors(brief);
  if (validationErrors.length > 0) {
    throw new Error(`ProduceProduct brief is invalid: ${validationErrors.join(" ")}`);
  }

  return {
    brief,
    previousWorkOrderIds: Array.isArray(record.previousWorkOrderIds)
      ? record.previousWorkOrderIds.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : [],
  };
}

function buildJobRequest(
  input: ProduceProductRequestPayload,
  context: ToolExecutionContext,
): JobRequest {
  const now = new Date().toISOString();

  return {
    id: context.toolInvocationId ?? `job_${input.brief.id}`,
    conversationId: context.conversationId ?? input.brief.sourceConversationId ?? "factory_conversation",
    userId: context.userId,
    toolName: "produce_product",
    status: "running",
    priority: 100,
    dedupeKey: null,
    initiatorType: "user",
    requestPayload: {
      operationId: input.operationId,
      brief: input.brief,
      previousWorkOrderIds: input.previousWorkOrderIds,
    },
    resultPayload: null,
    errorMessage: null,
    progressPercent: null,
    progressLabel: null,
    attemptCount: 0,
    leaseExpiresAt: null,
    claimedBy: null,
    failureClass: null,
    nextRetryAt: null,
    recoveryMode: null,
    lastCheckpointId: null,
    replayedFromJobId: null,
    supersededByJobId: null,
    createdAt: now,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
  };
}

export async function executeProduceProduct(
  handler: ProduceProductDeferredJobHandler,
  input: ProduceProductRequestPayload,
  context: ToolExecutionContext,
): Promise<ProduceProductDeferredJobResult> {
  const abortSignal = context.abortSignal ?? new AbortController().signal;

  return handler.handle(buildJobRequest(input, context), {
    abortSignal,
    reportProgress: async (update) => {
      await context.reportProgress?.(update);
    },
  });
}

class ProduceProductCommand
implements ToolCommand<ProduceProductRequestPayload, ProduceProductDeferredJobResult> {
  constructor(private readonly handler: ProduceProductDeferredJobHandler) {}

  async execute(
    input: ProduceProductRequestPayload,
    context?: ToolExecutionContext,
  ): Promise<ProduceProductDeferredJobResult> {
    return executeProduceProduct(this.handler, input, requireExecutionContext(context));
  }
}

export function createProduceProductTool(
  handler: ProduceProductDeferredJobHandler,
): ToolDescriptor<ProduceProductRequestPayload, ProduceProductDeferredJobResult> {
  return {
    name: "produce_product",
    schema: {
      description:
        "Run the factory orchestration pipeline from validated brief through release persistence.",
      input_schema: {
        type: "object",
        properties: {
          brief: {
            type: "object",
            description: "Validated ProductBrief payload for the factory orchestration pipeline.",
            properties: {},
          },
          previousWorkOrderIds: {
            type: "array",
            description: "Optional prior work order ids that this execution supersedes or continues.",
            items: { type: "string" },
          },
        },
        required: ["brief"],
      },
    },
    command: new ProduceProductCommand(handler),
    roles: ["ADMIN"],
    category: "content",
    executionMode: "deferred",
    deferred: {
      dedupeStrategy: "per-conversation-payload",
      retryable: true,
      notificationPolicy: "completion-and-failure",
    },
  };
}
