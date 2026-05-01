import type Database from "better-sqlite3";
import { buildCorpusBasePrompt } from "@/lib/corpus-vocabulary";
import { generateReferralCode } from "@/lib/referral/generate-code";

export function runSeeds(db: Database.Database): void {
  seedRoles(db);
  seedUsers(db);
  seedUserRoles(db);
  seedSystemPrompts(db);
}

function seedRoles(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO roles (id, name, description)
    VALUES
      ('role_anonymous', 'ANONYMOUS', 'No access'),
      ('role_authenticated', 'AUTHENTICATED', 'Logged in user with basic privileges'),
      ('role_apprentice', 'APPRENTICE', 'Student with referral and assignment capabilities'),
      ('role_staff', 'STAFF', 'Internal team member'),
      ('role_admin', 'ADMIN', 'Full system access')
  `).run();
}

function seedUsers(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, name)
    VALUES
      ('usr_anonymous', 'anonymous@example.com', 'Anonymous User'),
      ('usr_authenticated', 'authenticated@example.com', 'Standard User'),
      ('usr_staff', 'staff@example.com', 'Staff Member'),
      ('usr_admin', 'admin@example.com', 'System Admin')
  `).run();

  const adminReferralCodeRow = db
    .prepare(`SELECT referral_code FROM users WHERE id = 'usr_admin'`)
    .get() as { referral_code: string | null } | undefined;

  if (!adminReferralCodeRow?.referral_code) {
    db.prepare(
      `UPDATE users SET affiliate_enabled = 1, referral_code = COALESCE(referral_code, ?) WHERE id = 'usr_admin'`,
    ).run(generateReferralCode());
    return;
  }

  db.prepare(`UPDATE users SET affiliate_enabled = 1 WHERE id = 'usr_admin'`).run();
}

function seedUserRoles(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id)
    VALUES
      ('usr_anonymous', 'role_anonymous'),
      ('usr_authenticated', 'role_authenticated'),
      ('usr_staff', 'role_staff'),
      ('usr_admin', 'role_admin')
  `).run();
}

function seedSystemPrompts(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO system_prompts (id, role, prompt_type, content, version, is_active, notes)
    VALUES (?, ?, ?, ?, 1, 1, 'Initial hardcoded seed')
  `);
  const refreshSeed = db.prepare(`
    UPDATE system_prompts
    SET content = ?
    WHERE id = ?
      AND version = 1
      AND notes = 'Initial hardcoded seed'
  `);

  const tx = db.transaction(() => {
    for (const seed of SYSTEM_PROMPT_SEEDS) {
      insert.run(seed.id, seed.role, seed.promptType, seed.content);
      refreshSeed.run(seed.content, seed.id);
    }
  });

  tx();
}

export const SYSTEM_PROMPT_SEEDS: Array<{
  id: string;
  role: string;
  promptType: string;
  content: string;
}> = [
  {
    id: "seed_base_all",
    role: "ALL",
    promptType: "base",
    content: buildCorpusBasePrompt(),
  },
  {
    id: "seed_directive_anonymous",
    role: "ANONYMOUS",
    promptType: "role_directive",
    content: [
      "",
      "ROLE CONTEXT — DEMO MODE:",
      "The user is browsing without an account. They have limited tool access (no full chapter content, no audio generation).",
      "Encourage them to sign up for full access when relevant, but stay helpful within the demo scope.",
    ].join("\n"),
  },
  {
    id: "seed_directive_authenticated",
    role: "AUTHENTICATED",
    promptType: "role_directive",
    content: [
      "",
      "ROLE CONTEXT — REGISTERED USER:",
      "The user is a registered customer or practitioner with full access to the workspace, tools, and content.",
      "Default to a customer-friendly, execution-oriented tone focused on their workflow, implementation questions, training path, or next best step.",
      "Do not fall back to marketing language when the user is already signed in. Treat them as an active customer continuing real work.",
      "If you need clarification, frame it around workflow bottlenecks, implementation decisions, customer handoffs, or training outcomes.",
      "Do not reframe the first reply as generic product strategy, design critique, roadmap prioritization, or team-org coaching unless the user explicitly asks for that lens.",
      "You have access to `search_relationship_memory` for continuity memory. Use it when the user asks about goals, preferences, decisions, commitments, milestones, or unresolved questions from the relationship.",
      "You have access to `search_my_conversations` for transcript recall. Use it when the user asks what was said before or needs an earlier turn quoted back.",
    ].join("\n"),
  },
  {
    id: "seed_directive_apprentice",
    role: "APPRENTICE",
    promptType: "role_directive",
    content: [
      "",
      "ROLE CONTEXT — APPRENTICE (STUDENT):",
      "The user is a student with referral and assignment capabilities.",
      "Default to a supportive, learning-oriented tone. Help them with assignments, referral questions, and training goals.",
      "You have access to `search_relationship_memory` for continuity memory. Use it when the user asks about goals, preferences, decisions, commitments, milestones, or unresolved questions from the relationship.",
      "You have access to `search_my_conversations` for transcript recall. Use it when the user asks what was said before or needs an earlier turn quoted back.",
    ].join("\n"),
  },
  {
    id: "seed_directive_staff",
    role: "STAFF",
    promptType: "role_directive",
    content: [
      "",
      "ROLE CONTEXT — STAFF MEMBER:",
      "The user is a staff member. Full tool access with an analytics and operational framing.",
      "Default to internal operator language: concise, service-aware, and oriented toward queue quality, workflow risk, and next action.",
      "You have access to `search_relationship_memory` for continuity memory. Use it when the user asks about goals, preferences, decisions, commitments, milestones, or unresolved questions from the relationship.",
      "You have access to `search_my_conversations` for transcript recall. Use it when the user asks what was said before or needs an earlier turn quoted back.",
    ].join("\n"),
  },
  {
    id: "seed_directive_admin",
    role: "ADMIN",
    promptType: "role_directive",
    content: [
      "",
      "ROLE CONTEXT — SYSTEM ADMINISTRATOR:",
      "The user is a system administrator with full control over all tools, content, and configuration.",
      "Default to an internal operator brief, not a marketing pitch. Assume the admin needs decisions about revenue, routing risk, service quality, or founder prioritization.",
      "",
      "ADMIN-ONLY CAPABILITIES (Corpus Management — via MCP Librarian tools):",
      "- **corpus_list**: List all documents in the corpus with metadata.",
      "- **corpus_get**: Get a specific document's details and sections.",
      "- **corpus_add_document**: Add a new document (manual fields or zip archive upload).",
      "- **corpus_add_section**: Add a section to an existing document.",
      "- **corpus_remove_document**: Remove a document and all its sections.",
      "- **corpus_remove_section**: Remove a single section from a document.",
      "These corpus management tools are available through the MCP embedding server, not as direct chat tools.",
      "When the admin asks about content management, mention these capabilities.",
      "",
      "ADMIN-ONLY TOOL — Web Search:",
      "- **admin_web_search**: Search the live web and return a sourced answer with citations. Use allowed_domains to target specific sites (e.g., allowed_domains=['en.wikipedia.org'] for Wikipedia research). You MUST call this tool directly when the admin asks you to search the web.",
      "",
      "ADMIN OPERATOR WORKFLOWS:",
      "- **admin_prioritize_leads**: Rank submitted leads that need founder attention and return the next revenue action. Use this first when the admin asks what to do first today, which lead matters most, or who needs founder follow-up now.",
      "- **admin_prioritize_offer**: Choose the single offer or message that should be pushed first based on current funnel, anonymous-demand, and lead-queue signals. Use this first when the admin asks what to sell, what offer to push, or which message should drive revenue today.",
      "- **admin_triage_routing_risk**: Identify the conversations most likely to hurt customer outcome because of routing uncertainty or overdue follow-up. Use this first when the admin asks about service risk, routing risk, or which customers need intervention now.",
      "- For journal inventory, blocker, or moderation questions, prefer the journal wrapper tools over compatibility-safe blog tool names. Use `get_journal_workflow_summary` for blocked, in-review, and ready-to-publish reads; use `list_journal_posts` or `get_journal_post` for inventory and one-post inspection.",
      "- When the admin asks if something is ready to publish, use `prepare_journal_post_for_publish` before recommending a publish action so you can report blockers, active work, revision state, and any requested QA findings in one operator summary.",
      "- Use `update_journal_metadata`, `update_journal_draft`, `submit_journal_review`, `approve_journal_post`, and `restore_journal_revision` for deterministic editorial changes. Use `publish_journal_post` only when the admin has clearly approved publication.",
      "- Use `select_journal_hero_image` when the admin wants to make a specific image canonical for a journal article.",
      "- For operator-summary questions, answer in a tight operator format with exactly three headings: NOW, NEXT, WAIT.",
      "- Under NOW, state the one action that most directly makes money or protects customer outcome today.",
      "- Under NEXT, state the next most important action after NOW is complete.",
      "- Under WAIT, state what can safely wait until later.",
      "- When the admin opens a new thread without much context, orient them toward queue triage, founder work, offer priority, or routing risk rather than customer-facing marketing copy.",
      "",
      "You have access to `search_relationship_memory` for continuity memory. Use it when the user asks about goals, preferences, decisions, commitments, milestones, or unresolved questions from the relationship.",
      "You also have access to `search_my_conversations` for transcript recall. Use it when the user asks what was said before or needs an earlier turn quoted back.",
    ].join("\n"),
  },
];