/**
 * Catalog-driven role directive assembler.
 *
 * Sprint 13: Replaces the monolithic ROLE_DIRECTIVES object with a function
 * that assembles directives from three sources:
 *   1. Role-level framing (hardcoded per role)
 *   2. Tool-specific guidance from CapabilityRuntime prompt-hint facets
 *   3. Dynamic job-status directive lines
 *
 * Content that CANNOT move to the catalog stays hardcoded:
 *   - Role-level framing ("ROLE CONTEXT — ...")
 *   - corpus_* MCP tool descriptions (MCP-only, not in CAPABILITY_CATALOG)
 *   - Operator format guidance (NOW/NEXT/WAIT)
 *   - getJobStatusDirectiveLines() (dynamic, strategy-driven)
 */
import type { RoleName } from "./user";
import { getJobStatusDirectiveLines } from "./job-status-response-strategy";
import { projectAllCapabilityRuntimeStatics } from "@/core/platform/capability-runtime/CapabilityRuntime";

export interface RoleDirectiveAssemblyOptions {
  availableToolNames?: readonly string[];
}

// ---------------------------------------------------------------------------
// Role-level framing — NOT tool-specific, stays hardcoded
// ---------------------------------------------------------------------------

const ROLE_FRAMING: Record<RoleName, readonly string[]> = {
  ANONYMOUS: [
    "",
    "ROLE CONTEXT — DEMO MODE:",
    "The user is browsing without an account. They have limited tool access (no full chapter content, no audio generation).",
    "Encourage them to sign up for full access when relevant, but stay helpful within the demo scope.",
  ],
  AUTHENTICATED: [
    "",
    "ROLE CONTEXT — REGISTERED USER:",
    "The user is a registered customer or practitioner with full access to the workspace, tools, and content.",
    "Default to a customer-friendly, execution-oriented tone focused on their workflow, implementation questions, training path, or next best step.",
    "Do not fall back to marketing language when the user is already signed in. Treat them as an active customer continuing real work.",
    "If you need clarification, frame it around workflow bottlenecks, implementation decisions, customer handoffs, or training outcomes.",
    "Do not reframe the first reply as generic product strategy, design critique, roadmap prioritization, or team-org coaching unless the user explicitly asks for that lens.",
  ],
  APPRENTICE: [
    "",
    "ROLE CONTEXT — APPRENTICE (STUDENT):",
    "The user is a student with referral and assignment capabilities.",
    "Default to a supportive, learning-oriented tone. Help them with assignments, referral questions, and training goals.",
  ],
  STAFF: [
    "",
    "ROLE CONTEXT — STAFF MEMBER:",
    "The user is a staff member. Full tool access with an analytics and operational framing.",
    "Default to internal operator language: concise, service-aware, and oriented toward queue quality, workflow risk, and next action.",
  ],
  ADMIN: [
    "",
    "ROLE CONTEXT — SYSTEM ADMINISTRATOR:",
    "The user is a system administrator with full control over all tools, content, and configuration.",
    "Default to an internal operator brief, not a marketing pitch. Assume the admin needs decisions about revenue, routing risk, service quality, or founder prioritization.",
  ],
};

// ---------------------------------------------------------------------------
// ADMIN-only hardcoded blocks — content that cannot move to catalog
// ---------------------------------------------------------------------------

/**
 * corpus_* tools are MCP-only — they do NOT exist in CAPABILITY_CATALOG.
 * These directive lines describe tools exposed through the MCP embedding
 * server, not the chat registry.
 */
const ADMIN_CORPUS_MCP_LINES: readonly string[] = [
  "",
  "ADMIN-ONLY CAPABILITIES (Corpus Management — via MCP corpus tools):",
  "- **corpus_list**: List all documents in the corpus with metadata.",
  "- **corpus_get**: Get a specific document's details and sections.",
  "- **corpus_add_document**: Add a new document (manual fields or zip archive upload).",
  "- **corpus_add_section**: Add a section to an existing document.",
  "- **corpus_remove_document**: Remove a document and all its sections.",
  "- **corpus_remove_section**: Remove a single section from a document.",
  "These corpus management tools are available through the MCP embedding server, not as direct chat tools.",
  "When the admin asks about content management, mention these capabilities.",
];

/**
 * Operator format guidance — behavioral framing, not tool-specific.
 */
const ADMIN_OPERATOR_FORMAT_LINES: readonly string[] = [
  "- For operator-summary questions, answer in a tight operator format with exactly three headings: NOW, NEXT, WAIT.",
  "- Under NOW, state the one action that most directly makes money or protects customer outcome today.",
  "- Under NEXT, state the next most important action after NOW is complete.",
  "- Under WAIT, state what can safely wait until later.",
  "- When the admin opens a new thread without much context, orient them toward queue triage, founder work, offer priority, or routing risk rather than customer-facing marketing copy.",
];

// ---------------------------------------------------------------------------
// assembleRoleDirective — the Sprint 13 replacement for ROLE_DIRECTIVES[role]
// ---------------------------------------------------------------------------

/**
 * Assemble the complete role directive string for a given role.
 *
 * Sources:
 * 1. Role-level framing (hardcoded)
 * 2. CapabilityRuntime prompt-hint facets
 * 3. Admin-only corpus_* MCP lines (hardcoded — MCP-only)
 * 4. Admin operator format guidance (hardcoded — behavioral)
 * 5. Job status directive lines (dynamic — getJobStatusDirectiveLines())
 */
export function assembleRoleDirective(
  role: RoleName,
  options: RoleDirectiveAssemblyOptions = {},
): string {
  const lines: string[] = [];
  const availableToolNames = options.availableToolNames
    ? new Set(options.availableToolNames)
    : null;

  // 1. Role-level framing
  lines.push(...ROLE_FRAMING[role]);

  // 2. CapabilityRuntime prompt hints — collect tool-specific directives
  const toolDirectiveLines: string[] = [];
  for (const runtime of projectAllCapabilityRuntimeStatics()) {
    if (availableToolNames && !availableToolNames.has(runtime.capabilityName)) {
      continue;
    }

    const hintLines = runtime.promptHintsByRole?.[role] ?? null;
    if (hintLines && hintLines.length > 0) {
      toolDirectiveLines.push(...hintLines);
    }
  }

  if (toolDirectiveLines.length > 0) {
    lines.push("", ...toolDirectiveLines);
  }

  // 3. Admin-only corpus MCP lines (not in catalog — MCP-only tools)
  if (role === "ADMIN") {
    lines.push(...ADMIN_CORPUS_MCP_LINES);
  }

  // 4. Admin operator format guidance (behavioral framing)
  if (role === "ADMIN") {
    lines.push(...ADMIN_OPERATOR_FORMAT_LINES);
  }

  // 5. Dynamic job status directive lines
  const jobAudience = role === "ANONYMOUS" ? "anonymous" : "signed-in";
  lines.push(...getJobStatusDirectiveLines(jobAudience));

  return lines.join("\n");
}
