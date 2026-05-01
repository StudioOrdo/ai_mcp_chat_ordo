import type { CapabilityDefinition } from "../capability-definition";
import { CATALOG_INPUT_SCHEMAS } from "../catalog-input-schemas";
import { SIGNED_IN_ROLES } from "./shared";

const SEARCH_MY_CONVERSATIONS_PROMPT_LINE =
  "You have access to `search_my_conversations` for transcript recall. Use it when the user asks what was said before, wants an earlier phrasing, or needs a past turn quoted back.";

const SEARCH_RELATIONSHIP_MEMORY_PROMPT_LINE =
  "You have access to `search_relationship_memory` for continuity memory. Use it when the user asks about goals, preferences, decisions, commitments, milestones, or unresolved questions from the relationship so you do not rely on transcript recall for continuity.";

export const CONVERSATION_CAPABILITIES = {
  search_relationship_memory: {
    core: {
      name: "search_relationship_memory",
      label: "Relationship Memory",
      description: "Search active relationship memory to recall goals, preferences, decisions, commitments, milestones, and unresolved questions.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.search_relationship_memory,
      outputHint: "Returns matching continuity-memory summaries",
    },
    runtime: {},
    executorBinding: {
      bundleId: "conversation",
      executorId: "search_relationship_memory",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "search_relationship_memory",
      mode: "parse",
    },
    presentation: {
      family: "search",
      cardKind: "search_result",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        AUTHENTICATED: [SEARCH_RELATIONSHIP_MEMORY_PROMPT_LINE],
        APPRENTICE: [SEARCH_RELATIONSHIP_MEMORY_PROMPT_LINE],
        STAFF: [SEARCH_RELATIONSHIP_MEMORY_PROMPT_LINE],
        ADMIN: [SEARCH_RELATIONSHIP_MEMORY_PROMPT_LINE],
      },
    },
  },
  search_my_conversations: {
    core: {
      name: "search_my_conversations",
      label: "Transcript Recall",
      description: "Search your own conversation transcript history to recall past discussion turns.",
      category: "system",
      roles: [...SIGNED_IN_ROLES],
    },
    schema: {
      inputSchema: CATALOG_INPUT_SCHEMAS.search_my_conversations,
      outputHint: "Returns matching transcript excerpts",
    },
    runtime: {},
    executorBinding: {
      bundleId: "conversation",
      executorId: "search_my_conversations",
      executionSurface: "internal",
    },
    validationBinding: {
      validatorId: "search_my_conversations",
      mode: "parse",
    },
    presentation: {
      family: "search",
      cardKind: "search_result",
      executionMode: "inline",
    },
    promptHint: {
      roleDirectiveLines: {
        AUTHENTICATED: [SEARCH_MY_CONVERSATIONS_PROMPT_LINE],
        APPRENTICE: [SEARCH_MY_CONVERSATIONS_PROMPT_LINE],
        STAFF: [SEARCH_MY_CONVERSATIONS_PROMPT_LINE],
        ADMIN: [SEARCH_MY_CONVERSATIONS_PROMPT_LINE],
      },
    },
  },
} as const satisfies Record<string, CapabilityDefinition>;