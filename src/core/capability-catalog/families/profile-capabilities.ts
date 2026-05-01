import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";
import { SIGNED_IN_ROLES } from "./shared";

export const PROFILE_CAPABILITIES = {
  get_my_profile: {
    core: {
      name: "get_my_profile",
      label: "Get My Profile",
      description: "Retrieve the authenticated user's profile including name, roles, and referral info.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.get_my_profile,
      outputHint: "Returns user profile with name, roles, and referral info",
    },
    runtime: {},
    executorBinding: {
      bundleId: "profile",
      executorId: "get_my_profile",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "get_my_profile",
      mode: "parse",
    },
    presentation: {
      family: "profile",
      cardKind: "profile_summary",
      executionMode: "inline",
    },
  },

  update_my_profile: {
    core: {
      name: "update_my_profile",
      label: "Update My Profile",
      description: "Update the authenticated user's profile fields (name, credential).",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.update_my_profile,
    },
    runtime: {},
    executorBinding: {
      bundleId: "profile",
      executorId: "update_my_profile",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "update_my_profile",
      mode: "parse",
    },
    presentation: {
      family: "profile",
      cardKind: "profile_summary",
      executionMode: "inline",
    },
  },

  get_my_referral_qr: {
    core: {
      name: "get_my_referral_qr",
      label: "Get My Referral QR",
      description:
        "Generate and return the authenticated user's referral QR code image URL and shareable link.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.get_my_referral_qr,
    },
    runtime: {},
    executorBinding: {
      bundleId: "profile",
      executorId: "get_my_referral_qr",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "get_my_referral_qr",
      mode: "parse",
    },
    presentation: {
      family: "profile",
      cardKind: "profile_summary",
      executionMode: "inline",
      artifactKinds: ["image"],
    },
  },

  get_my_job_status: {
    core: {
      name: "get_my_job_status",
      label: "Get My Job Status",
      description:
        "Get the status of a specific deferred job belonging to the current user.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.get_my_job_status,
    },
    runtime: {},
    executorBinding: {
      bundleId: "profile",
      executorId: "get_my_job_status",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "get_my_job_status",
      mode: "parse",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        AUTHENTICATED: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
        APPRENTICE: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
        STAFF: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
        ADMIN: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
      },
    },
  },

  list_my_jobs: {
    core: {
      name: "list_my_jobs",
      label: "List My Jobs",
      description:
        "List all deferred jobs belonging to the current user with status and progress.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.list_my_jobs,
    },
    runtime: {},
    executorBinding: {
      bundleId: "profile",
      executorId: "list_my_jobs",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "list_my_jobs",
      mode: "parse",
    },
    presentation: {
      family: "system",
      cardKind: "fallback",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        AUTHENTICATED: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
        APPRENTICE: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
        STAFF: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
        ADMIN: [
          "- Use job status tools for explicit inspection and diagnostics; do not repeatedly poll unchanged job status as a waiting loop. Active chat updates arrive through job events and reconciliation.",
        ],
      },
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;
