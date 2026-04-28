import type { RoleName } from "@/core/entities/user";
import type { ToolExecuteFn } from "@/core/tool-registry/ToolMiddleware";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import type { ToolRegistry } from "@/core/tool-registry/ToolRegistry";
import type { KnowledgeAccessResponse, SearchKnowledgeInput } from "@/core/platform/knowledge-access/KnowledgeAccessService";
import type { ReadExecutionTimelineRequest } from "@/core/platform/execution/ExecutionTimeline";
import type { ExecutionTimelineReader } from "@/core/platform/execution/ExecutionTimelineReader";
import type {
  CapabilityRuntime,
  CapabilityRuntimeName,
} from "@/core/platform/capability-runtime/CapabilityRuntime";
import {
  projectAllCapabilityRuntimes,
  projectCapabilityRuntimeByName,
} from "@/core/platform/capability-runtime/CapabilityRuntime";
import type {
  RevisionOperationKind,
} from "@/core/platform/revision/RevisionContract";
import type { ExecutionPlanningContext } from "@/core/platform/execution/ExecutionPlanner";

export interface KnowledgeAccessLike {
  searchKnowledge(
    input: SearchKnowledgeInput,
    context?: Pick<ToolExecutionContext, "role">,
  ): Promise<KnowledgeAccessResponse>;
}

export interface AgentExecutionSurface {
  registry: ToolRegistry;
  executor: ToolExecuteFn;
}

export interface AgentExecutionSurfaceProvider {
  getExecutionSurface(): AgentExecutionSurface;
}

export interface RevisionActionRequest {
  executionKind: "job" | "work_order";
  executionId: string;
  action: RevisionOperationKind;
  role: RoleName;
  userId: string;
  payload?: Record<string, unknown>;
}

export interface RevisionActionResult {
  accepted: boolean;
  status: "completed" | "queued" | "rejected";
  message: string;
  nextExecutionId?: string;
  timelineRef?: string;
  payload?: unknown;
}

export interface RevisionActionRuntime {
  reviseExecution(request: RevisionActionRequest): Promise<RevisionActionResult>;
}

export class RevisionActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RevisionActionError";
  }
}

export interface AgentCapabilityDiscoveryRequest {
  role: RoleName;
  query?: string;
  maxResults?: number;
  capabilityNames?: readonly string[];
  planningByCapabilityName?: Partial<Record<CapabilityRuntimeName, ExecutionPlanningContext>>;
}

export interface AgentCapabilityDiscoveryResponse {
  query: string;
  results: CapabilityRuntime[];
}

export interface AgentCapabilityExecutionRequest {
  capabilityName: string;
  input: Record<string, unknown>;
  context: ToolExecutionContext;
}

export interface AgentCapabilityExecutionResponse {
  capabilityName: string;
  executionMode: CapabilityRuntime["descriptor"]["executionMode"];
  result: unknown;
}

export type AgentExecutionInspectionRequest = ReadExecutionTimelineRequest;

export interface AgentPlatformFacadeDeps {
  knowledgeAccess: KnowledgeAccessLike;
  executionTimelineReader: ExecutionTimelineReader;
  revisionRuntime: RevisionActionRuntime;
  executionSurfaceProvider: AgentExecutionSurfaceProvider;
}

function includesQuery(runtime: CapabilityRuntime, loweredQuery: string): boolean {
  if (loweredQuery.length === 0) {
    return true;
  }

  return runtime.capabilityName.toLowerCase().includes(loweredQuery)
    || runtime.descriptor.label.toLowerCase().includes(loweredQuery)
    || runtime.descriptor.description.toLowerCase().includes(loweredQuery)
    || runtime.executionExplanation.summary.toLowerCase().includes(loweredQuery);
}

function canRoleDiscover(runtime: CapabilityRuntime, role: RoleName): boolean {
  return runtime.descriptor.roles === "ALL" || runtime.descriptor.roles.includes(role);
}

export class AgentPlatformFacade {
  constructor(private readonly deps: AgentPlatformFacadeDeps) {}

  getExecutionSurface(): AgentExecutionSurface {
    return this.deps.executionSurfaceProvider.getExecutionSurface();
  }

  async discoverCapabilities(
    request: AgentCapabilityDiscoveryRequest,
  ): Promise<AgentCapabilityDiscoveryResponse> {
    const loweredQuery = request.query?.trim().toLowerCase() ?? "";
    const allowedCapabilityNames = request.capabilityNames
      ? new Set(request.capabilityNames)
      : null;

    const results = projectAllCapabilityRuntimes(request.planningByCapabilityName)
      .filter((runtime) => canRoleDiscover(runtime, request.role))
      .filter((runtime) => !allowedCapabilityNames || allowedCapabilityNames.has(runtime.capabilityName))
      .filter((runtime) => includesQuery(runtime, loweredQuery))
      .slice(0, request.maxResults ?? 25);

    return {
      query: request.query?.trim() ?? "",
      results,
    };
  }

  async searchKnowledge(
    input: SearchKnowledgeInput,
    context: Pick<ToolExecutionContext, "role">,
  ): Promise<KnowledgeAccessResponse> {
    return this.deps.knowledgeAccess.searchKnowledge(input, context);
  }

  async executeCapability(
    request: AgentCapabilityExecutionRequest,
  ): Promise<AgentCapabilityExecutionResponse> {
    const runtime = projectCapabilityRuntimeByName(
      request.capabilityName,
      request.context.executionPlanning,
    );
    if (!runtime) {
      throw new Error(`Unknown capability runtime: ${request.capabilityName}`);
    }

    const result = await this.getExecutionSurface().executor(
      request.capabilityName,
      request.input,
      request.context,
    );

    return {
      capabilityName: request.capabilityName,
      executionMode: runtime.descriptor.executionMode,
      result,
    };
  }

  async inspectExecution(request: AgentExecutionInspectionRequest) {
    return this.deps.executionTimelineReader.readExecutionTimeline(request);
  }

  async reviseExecution(request: RevisionActionRequest): Promise<RevisionActionResult> {
    return this.deps.revisionRuntime.reviseExecution(request);
  }
}