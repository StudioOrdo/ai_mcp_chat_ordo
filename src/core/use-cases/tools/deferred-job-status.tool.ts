import type { ToolDescriptor } from "@/core/tool-registry/ToolDescriptor";
import type { ToolCommand } from "@/core/tool-registry/ToolCommand";
import type { ToolExecutionContext } from "@/core/tool-registry/ToolExecutionContext";
import { buildJobStatusToolDescription } from "@/core/entities/job-status-response-strategy";
import type { JobStatusQuery } from "@/core/use-cases/JobStatusQuery";
import { type CanonicalJobSnapshot, getActiveJobStatuses } from "@/lib/jobs/job-read-model";
import {
  getGlobalJobOperatorRoles,
  getSignedInJobAudienceRoles,
} from "@/lib/jobs/job-capability-registry";

interface DeferredJobStatusInput {
  job_id: string;
}

interface ListDeferredJobsInput {
  active_only?: boolean;
  limit?: number;
}

interface DeferredJobStatusOutput {
  ok: true;
  job: CanonicalJobSnapshot;
}

interface ListDeferredJobsOutput {
  ok: true;
  jobs: CanonicalJobSnapshot[];
}

interface GetMyJobStatusInput {
  job_id: string;
}

interface ListMyJobsInput {
  active_only?: boolean;
  limit?: number;
}

interface GetMyJobStatusOutput {
  ok: true;
  job: CanonicalJobSnapshot;
  summary: string;
}

interface ListMyJobsOutput {
  ok: true;
  jobs: CanonicalJobSnapshot[];
  summary: string;
}

function requireSignedInContext(context?: ToolExecutionContext): ToolExecutionContext {
  if (!context || context.role === "ANONYMOUS") {
    throw new Error("Sign in is required to inspect your jobs.");
  }

  return context;
}

class GetDeferredJobStatusCommand implements ToolCommand<DeferredJobStatusInput, DeferredJobStatusOutput> {
  constructor(private readonly query: JobStatusQuery) {}

  async execute(input: DeferredJobStatusInput): Promise<DeferredJobStatusOutput> {
    if (!input.job_id?.trim()) {
      throw new Error("job_id is required.");
    }

    const job = await this.query.getJobSnapshot(input.job_id);
    if (!job) {
      throw new Error(`Deferred job not found: ${input.job_id}`);
    }

    return {
      ok: true,
      job,
    };
  }
}

class ListDeferredJobsCommand implements ToolCommand<ListDeferredJobsInput, ListDeferredJobsOutput> {
  constructor(private readonly query: JobStatusQuery) {}

  async execute(input: ListDeferredJobsInput, context?: ToolExecutionContext): Promise<ListDeferredJobsOutput> {
    if (!context?.conversationId) {
      throw new Error("Conversation context is required to list deferred jobs.");
    }

    const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
    const jobs = await this.query.listConversationJobSnapshots(context.conversationId, {
      statuses: input.active_only === false ? undefined : getActiveJobStatuses(),
      limit,
    });

    return {
      ok: true,
      jobs,
    };
  }
}

class GetMyJobStatusCommand implements ToolCommand<GetMyJobStatusInput, GetMyJobStatusOutput> {
  constructor(private readonly query: JobStatusQuery) {}

  async execute(input: GetMyJobStatusInput, context?: ToolExecutionContext): Promise<GetMyJobStatusOutput> {
    const signedInContext = requireSignedInContext(context);

    if (!input.job_id?.trim()) {
      throw new Error("job_id is required.");
    }

    const job = await this.query.getUserJobSnapshot(signedInContext.userId, input.job_id);

    if (!job) {
      throw new Error(`Job not found for this account: ${input.job_id}`);
    }

    return {
      ok: true,
      job,
      summary: job.summary ?? "Returned the current status for the requested job.",
    };
  }
}

class ListMyJobsCommand implements ToolCommand<ListMyJobsInput, ListMyJobsOutput> {
  constructor(private readonly query: JobStatusQuery) {}

  async execute(input: ListMyJobsInput, context?: ToolExecutionContext): Promise<ListMyJobsOutput> {
    const signedInContext = requireSignedInContext(context);
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
    const jobs = await this.query.listUserJobSnapshots(signedInContext.userId, {
      statuses: input.active_only === false ? undefined : getActiveJobStatuses(),
      limit,
    });

    const activeCount = jobs.filter((snapshot) => getActiveJobStatuses().includes(snapshot.status)).length;
    const terminalCount = jobs.length - activeCount;

    return {
      ok: true,
      jobs,
      summary: input.active_only === false
        ? `Returned ${jobs.length} jobs for this account (${activeCount} active, ${terminalCount} recent terminal).`
        : `Returned ${jobs.length} active jobs for this account.`,
    };
  }
}

export function createGetDeferredJobStatusTool(
  query: JobStatusQuery,
): ToolDescriptor<DeferredJobStatusInput, DeferredJobStatusOutput> {
  return {
    name: "get_deferred_job_status",
    schema: {
      description: buildJobStatusToolDescription({ audience: "admin", kind: "single", scope: "conversation" }),
      input_schema: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The deferred job ID to inspect." },
        },
        required: ["job_id"],
      },
    },
    command: new GetDeferredJobStatusCommand(query),
    roles: getGlobalJobOperatorRoles(),
    category: "content",
  };
}

export function createListDeferredJobsTool(
  query: JobStatusQuery,
): ToolDescriptor<ListDeferredJobsInput, ListDeferredJobsOutput> {
  return {
    name: "list_deferred_jobs",
    schema: {
      description: buildJobStatusToolDescription({ audience: "admin", kind: "list", scope: "conversation" }),
      input_schema: {
        type: "object",
        properties: {
          active_only: {
            type: "boolean",
            description: "When true or omitted, return only queued and running jobs. When false, include recent terminal jobs too.",
          },
          limit: {
            type: "number",
            description: "Maximum number of jobs to return, between 1 and 25.",
          },
        },
      },
    },
    command: new ListDeferredJobsCommand(query),
    roles: getGlobalJobOperatorRoles(),
    category: "content",
  };
}

export function createGetMyJobStatusTool(
  query: JobStatusQuery,
): ToolDescriptor<GetMyJobStatusInput, GetMyJobStatusOutput> {
  return {
    name: "get_my_job_status",
    schema: {
      description: buildJobStatusToolDescription({ audience: "signed-in", kind: "single", scope: "user" }),
      input_schema: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job ID to inspect for this signed-in account." },
        },
        required: ["job_id"],
      },
    },
    command: new GetMyJobStatusCommand(query),
    roles: getSignedInJobAudienceRoles(),
    category: "system",
  };
}

export function createListMyJobsTool(
  query: JobStatusQuery,
): ToolDescriptor<ListMyJobsInput, ListMyJobsOutput> {
  return {
    name: "list_my_jobs",
    schema: {
      description: buildJobStatusToolDescription({ audience: "signed-in", kind: "list", scope: "user" }),
      input_schema: {
        type: "object",
        properties: {
          active_only: {
            type: "boolean",
            description: "When true or omitted, return only queued and running jobs. When false, include recent terminal jobs too.",
          },
          limit: {
            type: "number",
            description: "Maximum number of jobs to return, between 1 and 25.",
          },
        },
      },
    },
    command: new ListMyJobsCommand(query),
    roles: getSignedInJobAudienceRoles(),
    category: "system",
  };
}