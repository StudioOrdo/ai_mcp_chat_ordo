import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";

export const JOB_CAPABILITIES = {
  get_deferred_job_status: {
    core: {
      name: "get_deferred_job_status",
      label: "Get Deferred Job Status",
      description:
        "Get the status of a specific deferred job by conversation context. Admin only.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.get_deferred_job_status,
    },
    runtime: {},
    executorBinding: {
      bundleId: "job",
      executorId: "get_deferred_job_status",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "get_deferred_job_status",
      mode: "parse",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "- After using `list_deferred_jobs` or `get_deferred_job_status`, always summarize the current job state in plain language as queued, running, completed, failed, or canceled.",
          "- Do not rely on job cards alone for status reads. State clearly whether you reused the existing job or started a new one.",
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
      },
    },
  },

  list_deferred_jobs: {
    core: {
      name: "list_deferred_jobs",
      label: "List Deferred Jobs",
      description:
        "List all deferred jobs for the current conversation with status and progress. Admin only.",
      category: "system",
      roles: ["ADMIN"],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.list_deferred_jobs,
    },
    runtime: {},
    executorBinding: {
      bundleId: "job",
      executorId: "list_deferred_jobs",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "list_deferred_jobs",
      mode: "parse",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        ADMIN: [
          "- After using `list_deferred_jobs` or `get_deferred_job_status`, always summarize the current job state in plain language as queued, running, completed, failed, or canceled.",
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
      },
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;