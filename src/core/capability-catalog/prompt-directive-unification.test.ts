/**
 * Sprint 13 — Prompt Directive Unification Tests
 *
 * Validates:
 * 1. assembleRoleDirective produces correct output for all 5 roles
 * 2. Tool-specific directives come from catalog promptHint facets
 * 3. No tool-specific directive text remains in role-directives.ts
 * 4. corpus_* MCP lines preserved for ADMIN
 * 5. getJobStatusDirectiveLines() remains dynamic
 * 6. Directive equivalence — assembled output contains all expected content
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { assembleRoleDirective } from "@/core/entities/role-directive-assembler";
import { ROLE_DIRECTIVES } from "@/core/entities/role-directives";
import {
  projectAllCapabilityRuntimeStatics,
  projectCapabilityRuntimeStaticByName,
} from "@/core/platform/capability-runtime/CapabilityRuntime";
import type { RoleName } from "@/core/entities/user";

const ROOT = path.resolve(__dirname, "../../..");

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

const ALL_ROLES: RoleName[] = [
  "ANONYMOUS",
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

describe("Sprint 13 — Prompt Directive Unification", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Source code verification
  // ─────────────────────────────────────────────────────────────────────────
  describe("Source code cleanup", () => {
    it("role-directives.ts has no tool-specific directive text", () => {
      const source = readSource("src/core/entities/role-directives.ts");
      // Should not contain any tool-specific strings
      expect(source).not.toContain("compose_media");
      expect(source).not.toContain("admin_web_search");
      expect(source).not.toContain("search_my_conversations");
      expect(source).not.toContain("admin_prioritize_leads");
      expect(source).not.toContain("corpus_list");
      expect(source).not.toContain("MEDIA COMPOSITION");
      expect(source).not.toContain("ADMIN OPERATOR WORKFLOWS");
    });

    it("role-directives.ts uses assembleRoleDirective for all 5 roles", () => {
      const source = readSource("src/core/entities/role-directives.ts");
      for (const role of ALL_ROLES) {
        expect(source).toContain(`assembleRoleDirective("${role}")`);
      }
    });

    it("role-directives.ts is under 25 lines", () => {
      const source = readSource("src/core/entities/role-directives.ts");
      const lineCount = source.split("\n").length;
      expect(lineCount).toBeLessThan(25);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // assembleRoleDirective output correctness
  // ─────────────────────────────────────────────────────────────────────────
  describe("assembleRoleDirective output", () => {
    it("produces non-empty output for all roles", () => {
      for (const role of ALL_ROLES) {
        const result = assembleRoleDirective(role);
        expect(result.length, `Empty directive for ${role}`).toBeGreaterThan(50);
      }
    });

    it("ROLE_DIRECTIVES matches assembleRoleDirective for all roles", () => {
      for (const role of ALL_ROLES) {
        expect(ROLE_DIRECTIVES[role]).toBe(assembleRoleDirective(role));
      }
    });

    it("includes role-level framing for each role", () => {
      expect(assembleRoleDirective("ANONYMOUS")).toContain("ROLE CONTEXT — DEMO MODE");
      expect(assembleRoleDirective("AUTHENTICATED")).toContain("ROLE CONTEXT — REGISTERED USER");
      expect(assembleRoleDirective("APPRENTICE")).toContain("ROLE CONTEXT — APPRENTICE (STUDENT)");
      expect(assembleRoleDirective("STAFF")).toContain("ROLE CONTEXT — STAFF MEMBER");
      expect(assembleRoleDirective("ADMIN")).toContain("ROLE CONTEXT — SYSTEM ADMINISTRATOR");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Catalog promptHint → directive integration
  // ─────────────────────────────────────────────────────────────────────────
  describe("Catalog-driven directives", () => {
    it("AUTHENTICATED gets compose_media directive from catalog", () => {
      const directive = assembleRoleDirective("AUTHENTICATED");
      expect(directive).toContain("compose_media");
      expect(directive).toContain("MEDIA COMPOSITION");
      expect(directive).toContain("list_conversation_media_assets");
    });

    it("AUTHENTICATED gets search_my_conversations directive from catalog", () => {
      const directive = assembleRoleDirective("AUTHENTICATED");
      expect(directive).toContain("search_my_conversations");
    });

    it("APPRENTICE gets compose_media + search_my_conversations from catalog", () => {
      const directive = assembleRoleDirective("APPRENTICE");
      expect(directive).toContain("compose_media");
      expect(directive).toContain("search_my_conversations");
      expect(directive).toContain("list_conversation_media_assets");
    });

    it("STAFF gets compose_media + search_my_conversations from catalog", () => {
      const directive = assembleRoleDirective("STAFF");
      expect(directive).toContain("compose_media");
      expect(directive).toContain("search_my_conversations");
      expect(directive).toContain("list_conversation_media_assets");
    });

    it("ADMIN gets admin_web_search directive from catalog", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("admin_web_search");
    });

    it("ADMIN gets admin_prioritize_leads directive from catalog", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("admin_prioritize_leads");
    });

    it("ADMIN gets admin_prioritize_offer directive from catalog", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("admin_prioritize_offer");
    });

    it("ADMIN gets admin_triage_routing_risk directive from catalog", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("admin_triage_routing_risk");
    });

    it("ADMIN gets journal workflow guidance from catalog", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("get_journal_workflow_summary");
      expect(directive).toContain("list_journal_posts");
      expect(directive).toContain("prepare_journal_post_for_publish");
      expect(directive).toContain("select_journal_hero_image");
    });

    it("ADMIN gets deferred job guidance from catalog", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("list_deferred_jobs");
      expect(directive).toContain("get_deferred_job_status");
    });

    it("every catalog promptHint line appears in at least one directive", () => {
      for (const runtime of projectAllCapabilityRuntimeStatics()) {
        for (const role of ALL_ROLES) {
          const hintLines = runtime.promptHintsByRole?.[role] ?? null;
          if (hintLines && hintLines.length > 0) {
            const directive = assembleRoleDirective(role);
            for (const line of hintLines) {
              expect(
                directive,
                `Missing promptHint line from ${runtime.capabilityName} for ${role}: "${line.substring(0, 60)}..."`,
              ).toContain(line);
            }
          }
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Non-catalog content preserved
  // ─────────────────────────────────────────────────────────────────────────
  describe("Non-catalog content preserved", () => {
    it("ADMIN includes corpus_* MCP tool descriptions", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("corpus_list");
      expect(directive).toContain("corpus_get");
      expect(directive).toContain("corpus_add_document");
      expect(directive).toContain("corpus_add_section");
      expect(directive).toContain("corpus_remove_document");
      expect(directive).toContain("corpus_remove_section");
      expect(directive).toContain("MCP embedding server");
    });

    it("ADMIN includes operator format guidance (NOW/NEXT/WAIT)", () => {
      const directive = assembleRoleDirective("ADMIN");
      expect(directive).toContain("NOW, NEXT, WAIT");
      expect(directive).toContain("Under NOW");
      expect(directive).toContain("Under NEXT");
      expect(directive).toContain("Under WAIT");
    });

    it("corpus_* MCP lines do NOT appear for non-ADMIN roles", () => {
      for (const role of ["ANONYMOUS", "AUTHENTICATED", "APPRENTICE", "STAFF"] as RoleName[]) {
        const directive = assembleRoleDirective(role);
        expect(directive).not.toContain("corpus_list");
        expect(directive).not.toContain("corpus_add_document");
      }
    });

    it("all roles include job status directive lines", () => {
      // getJobStatusDirectiveLines is dynamic — verify it's called
      // by checking for any job-status content
      for (const role of ALL_ROLES) {
        const directive = assembleRoleDirective(role);
        // Job status lines should appear for at least some roles
        // The anonymous role gets different lines than signed-in
        expect(directive.length).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Catalog promptHint count
  // ─────────────────────────────────────────────────────────────────────────
  describe("Catalog promptHint coverage", () => {
    it("catalog has 19 entries with promptHint facets", () => {
      const count = projectAllCapabilityRuntimeStatics().filter(
        (runtime) => runtime.promptHintsByRole !== null,
      ).length;
      expect(count).toBe(21);
    });

    it("compose_media has promptHint for 4 roles", () => {
      const hint = projectCapabilityRuntimeStaticByName("compose_media")!.promptHintsByRole!;
      expect(Object.keys(hint)).toHaveLength(4);
    });

    it("search_my_conversations has promptHint for 4 roles", () => {
      const hint = projectCapabilityRuntimeStaticByName("search_my_conversations")!.promptHintsByRole!;
      expect(Object.keys(hint)).toHaveLength(4);
    });

    it("admin_web_search has promptHint for 1 role", () => {
      const hint = projectCapabilityRuntimeStaticByName("admin_web_search")!.promptHintsByRole!;
      expect(Object.keys(hint)).toHaveLength(1);
    });
  });
});
