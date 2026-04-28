/**
 * Sprint 14 — End-to-End Catalog Flow Verification
 *
 * Proves that every catalog entry flows through all downstream registries:
 *   catalog entry → presentation descriptor → job capability → prompt directive
 *
 * Also verifies:
 * - Adding a new catalog entry propagates to all registries
 * - promptHint facets flow into assembled role directives
 * - Projection functions produce coherent, non-null results for all entries
 */
import { describe, it, expect } from "vitest";

import {
  CAPABILITY_CATALOG,
} from "@/core/capability-catalog/catalog";
import type { CapabilityDefinition } from "@/core/capability-catalog/capability-definition";
import { assembleRoleDirective } from "@/core/entities/role-directive-assembler";
import type { RoleName } from "@/core/entities/user";
import {
  projectAllCapabilityRuntimeStatics,
  projectCapabilityRuntimeStaticByName,
} from "@/core/platform/capability-runtime/CapabilityRuntime";

const ALL_ROLES: RoleName[] = [
  "ANONYMOUS",
  "AUTHENTICATED",
  "APPRENTICE",
  "STAFF",
  "ADMIN",
];

const catalogEntries = Object.entries(CAPABILITY_CATALOG);
const runtimeEntries = projectAllCapabilityRuntimeStatics().map((runtime) => [
  runtime.capabilityName,
  runtime,
] as const);

describe("Sprint 14 — End-to-End Catalog Flow", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Full pipeline: every catalog entry → all projections
  // ─────────────────────────────────────────────────────────────────────────
  describe("Full pipeline projection", () => {
    it("every catalog entry produces a valid presentation descriptor", () => {
      expect(runtimeEntries).toHaveLength(catalogEntries.length);

      for (const [name, runtime] of runtimeEntries) {
        const desc = runtime.presentation;
        expect(desc, `Missing presentation for ${name}`).toBeDefined();
        expect(desc.toolName).toBe(name);
        expect(desc.family).toBeTruthy();
        expect(desc.cardKind).toBeTruthy();
      }
    });

    it("deferred entries produce valid job capabilities", () => {
      const catalogDeferredEntries = catalogEntries.filter(
        ([, def]) => (def as CapabilityDefinition).job !== undefined,
      );
      const deferredEntries = runtimeEntries.filter(
        ([, runtime]) => runtime.job !== null,
      );
      expect(deferredEntries.length).toBe(catalogDeferredEntries.length);

      for (const [name, runtime] of deferredEntries) {
        const job = runtime.job;
        expect(job, `Missing job for deferred entry ${name}`).not.toBeNull();
        expect(job!.toolName).toBe(name);
        expect(job!.family).toBeTruthy();
        expect(job!.executionPrincipal).toBeTruthy();
      }
    });

    it("non-deferred entries produce null job capabilities", () => {
      const catalogInlineEntries = catalogEntries.filter(
        ([, def]) => (def as CapabilityDefinition).job === undefined,
      );
      const inlineEntries = runtimeEntries.filter(
        ([, runtime]) => runtime.job === null,
      );
      expect(inlineEntries.length).toBe(catalogInlineEntries.length);

      for (const [name, runtime] of inlineEntries) {
        const job = runtime.job;
        expect(job, `Non-null job for inline entry ${name}`).toBeNull();
      }
    });

    it("browser entries produce valid browser capabilities", () => {
      const catalogBrowserEntries = catalogEntries.filter(
        ([, def]) => (def as CapabilityDefinition).browser !== undefined,
      );
      const browserEntries = runtimeEntries.filter(
        ([, runtime]) => runtime.browser !== null,
      );
      expect(browserEntries.length).toBe(catalogBrowserEntries.length);

      for (const [name, runtime] of browserEntries) {
        const browser = runtime.browser;
        expect(
          browser,
          `Missing browser for browser entry ${name}`,
        ).not.toBeNull();
        expect(browser!.capabilityId).toBe(name);
      }
    });

    it("promptHint entries produce role-specific directive lines", () => {
      const catalogHintEntries = catalogEntries.filter(
        ([, def]) =>
          (def as { promptHint?: unknown }).promptHint !== undefined,
      );
      const hintEntries = runtimeEntries.filter(
        ([, runtime]) => runtime.promptHintsByRole !== null,
      );
      expect(hintEntries.length).toBe(catalogHintEntries.length);

      for (const [name, runtime] of hintEntries) {
        let hasAtLeastOneRole = false;
        for (const role of ALL_ROLES) {
          const lines = runtime.promptHintsByRole?.[role] ?? null;
          if (lines && lines.length > 0) {
            hasAtLeastOneRole = true;
            for (const line of lines) {
              expect(line.length, `Empty hint line in ${name}`).toBeGreaterThan(0);
            }
          }
        }
        expect(
          hasAtLeastOneRole,
          `No role directives found for ${name} despite having promptHint`,
        ).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Pipeline coherence: assembled directives contain catalog content
  // ─────────────────────────────────────────────────────────────────────────
  describe("Assembled directive coherence", () => {
    it("compose_media flows from catalog → ADMIN assembled directive", () => {
      const directive = assembleRoleDirective("ADMIN");
      const adminHints = projectCapabilityRuntimeStaticByName("compose_media")
        ?.promptHintsByRole?.ADMIN ?? null;
      expect(adminHints).not.toBeNull();
      for (const line of adminHints!) {
        expect(directive).toContain(line);
      }
    });

    it("admin_web_search flows from catalog → ADMIN assembled directive", () => {
      const directive = assembleRoleDirective("ADMIN");
      const hints = projectCapabilityRuntimeStaticByName("admin_web_search")
        ?.promptHintsByRole?.ADMIN ?? null;
      expect(hints).not.toBeNull();
      for (const line of hints!) {
        expect(directive).toContain(line);
      }
    });

    it("search_my_conversations flows for all signed-in roles", () => {
      for (const role of [
        "AUTHENTICATED",
        "APPRENTICE",
        "STAFF",
        "ADMIN",
      ] as RoleName[]) {
        const directive = assembleRoleDirective(role);
        const hints = projectCapabilityRuntimeStaticByName("search_my_conversations")
          ?.promptHintsByRole?.[role] ?? null;
        expect(hints, `No hints for ${role}`).not.toBeNull();
        for (const line of hints!) {
          expect(directive).toContain(line);
        }
      }
    });

    it("ANONYMOUS gets no tool-specific promptHints from catalog", () => {
      let hintCount = 0;
      for (const [, runtime] of runtimeEntries) {
        const hints = runtime.promptHintsByRole?.ANONYMOUS ?? null;
        if (hints && hints.length > 0) hintCount += hints.length;
      }
      expect(hintCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Registry coverage consistency
  // ─────────────────────────────────────────────────────────────────────────
  describe("Registry coverage", () => {
    it("catalog has 55+ entries", () => {
      expect(catalogEntries.length).toBeGreaterThanOrEqual(55);
    });

    it("every catalog entry has core, runtime, and presentation facets", () => {
      for (const [name, def] of catalogEntries) {
        expect(def.core, `Missing core for ${name}`).toBeDefined();
        expect(def.core.name, `core.name mismatch for ${name}`).toBe(name);
        expect(def.runtime, `Missing runtime for ${name}`).toBeDefined();
        expect(
          def.presentation,
          `Missing presentation for ${name}`,
        ).toBeDefined();
      }
    });

    it("catalog key matches core.name for every entry", () => {
      for (const [key, def] of catalogEntries) {
        expect(def.core.name).toBe(key);
      }
    });

    it("presentation projections have unique toolNames", () => {
      const toolNames = runtimeEntries.map(([, runtime]) =>
        runtime.presentation.toolName,
      );
      const unique = new Set(toolNames);
      expect(unique.size).toBe(toolNames.length);
    });
  });
});
