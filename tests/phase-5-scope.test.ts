/**
 * Phase 5 scope tests — beginner-solopreneur-refactor.
 *
 * Covers:
 *  - PromptSlotType widening to include "coach"
 *  - listAdminVisiblePromptSlots / listCoachPromptSlots / isPromptSlotType
 *  - canAccessStaffOrAdmin role gate
 *  - Training corpus availability (operators-handbook + architecture-reference)
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROMPT_SLOT_TYPES,
  isPromptSlotType,
  listAdminVisiblePromptSlots,
  listCoachPromptSlots,
  listRoleDirectiveSlots,
} from "@/lib/prompts/prompt-role-inventory";
import { canAccessStaffOrAdmin, canAccessAdminPage } from "@/lib/journal/admin-journal";

// ── PromptSlotType widening ────────────────────────────────────────────

describe("Phase 5 — PromptSlotType widening", () => {
  it("PROMPT_SLOT_TYPES contains base, role_directive, and coach", () => {
    expect(PROMPT_SLOT_TYPES).toEqual(["base", "role_directive", "coach"]);
  });

  it("isPromptSlotType accepts coach", () => {
    expect(isPromptSlotType("coach")).toBe(true);
    expect(isPromptSlotType("base")).toBe(true);
    expect(isPromptSlotType("role_directive")).toBe(true);
    expect(isPromptSlotType("nonsense")).toBe(false);
  });

  it("listCoachPromptSlots returns one slot per runtime role", () => {
    const slots = listCoachPromptSlots();
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.promptType === "coach")).toBe(true);
    const roles = slots.map((slot) => slot.role);
    expect(roles).toContain("STAFF");
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("AUTHENTICATED");
  });

  it("listAdminVisiblePromptSlots includes base, role_directive, and coach slots", () => {
    const all = listAdminVisiblePromptSlots();
    expect(all.some((s) => s.promptType === "base")).toBe(true);
    expect(all.some((s) => s.promptType === "role_directive")).toBe(true);
    expect(all.some((s) => s.promptType === "coach")).toBe(true);
    expect(all.length).toBe(1 + listRoleDirectiveSlots().length + listCoachPromptSlots().length);
  });
});

// ── Staff-or-admin auth gate ───────────────────────────────────────────

describe("Phase 5 — canAccessStaffOrAdmin gate", () => {
  it("allows STAFF", () => {
    expect(canAccessStaffOrAdmin(["STAFF"])).toBe(true);
  });

  it("allows ADMIN", () => {
    expect(canAccessStaffOrAdmin(["ADMIN"])).toBe(true);
  });

  it("rejects ANONYMOUS and AUTHENTICATED", () => {
    expect(canAccessStaffOrAdmin(["ANONYMOUS"])).toBe(false);
    expect(canAccessStaffOrAdmin(["AUTHENTICATED"])).toBe(false);
    expect(canAccessStaffOrAdmin(["APPRENTICE"])).toBe(false);
  });

  it("is strictly broader than canAccessAdminPage", () => {
    // ADMIN passes both; STAFF passes only the staff gate.
    expect(canAccessAdminPage(["STAFF"])).toBe(false);
    expect(canAccessStaffOrAdmin(["STAFF"])).toBe(true);
  });
});

// ── Training corpus backing files ──────────────────────────────────────

describe("Phase 5 — Training corpus backing content", () => {
  const corpusRoot = path.resolve(__dirname, "..", "docs", "_corpus", "_archive");

  it("operators-handbook has class:training frontmatter", () => {
    const bookPath = path.join(corpusRoot, "operators-handbook", "book.json");
    const book = JSON.parse(fs.readFileSync(bookPath, "utf8"));
    expect(book.class).toBe("training");
    expect(book.audience).toBe("staff");
    expect(book.rolePersona).toBe("operator");
  });

  it("operators-handbook has at least three chapters", () => {
    const chapters = fs.readdirSync(
      path.join(corpusRoot, "operators-handbook", "chapters"),
    );
    expect(chapters.length).toBeGreaterThanOrEqual(3);
  });

  it("architecture-reference has class:reference frontmatter", () => {
    const bookPath = path.join(corpusRoot, "architecture-reference", "book.json");
    const book = JSON.parse(fs.readFileSync(bookPath, "utf8"));
    expect(book.class).toBe("reference");
    expect(book.audience).toBe("staff");
  });

  it("architecture-reference has at least two chapters", () => {
    const chapters = fs.readdirSync(
      path.join(corpusRoot, "architecture-reference", "chapters"),
    );
    expect(chapters.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Admin training surface backing files ───────────────────────────────

describe("Phase 5 — Admin training surface", () => {
  const srcRoot = path.resolve(__dirname, "..", "src");

  it("training listing page uses requireStaffOrAdmin (not admin-only)", () => {
    const source = fs.readFileSync(
      path.join(srcRoot, "app", "admin", "training", "page.tsx"),
      "utf8",
    );
    expect(source).toContain("requireStaffOrAdmin");
    expect(source).not.toContain("permanentRedirect");
  });

  it("training book page filters by canUserAccessAudience", () => {
    const source = fs.readFileSync(
      path.join(srcRoot, "app", "admin", "training", "[bookSlug]", "page.tsx"),
      "utf8",
    );
    expect(source).toContain("requireStaffOrAdmin");
    expect(source).toContain("canUserAccessAudience");
  });

  it("training chapter page enforces audience on both book and section", () => {
    const source = fs.readFileSync(
      path.join(srcRoot, "app", "admin", "training", "[bookSlug]", "[chapterSlug]", "page.tsx"),
      "utf8",
    );
    expect(source).toContain("requireStaffOrAdmin");
    const audienceChecks = source.match(/canUserAccessAudience/g);
    expect(audienceChecks).not.toBeNull();
    expect(audienceChecks!.length).toBeGreaterThanOrEqual(2);
  });

  it("content-visibility page is admin-only and audits corpus", () => {
    const source = fs.readFileSync(
      path.join(srcRoot, "app", "admin", "content-visibility", "page.tsx"),
      "utf8",
    );
    expect(source).toContain("requireAdminPageAccess");
    expect(source).toContain("canAccessAudience");
    expect(source).toContain("getAllDocuments");
  });

  it("training nav route is visible to STAFF and ADMIN", () => {
    const source = fs.readFileSync(
      path.join(srcRoot, "lib", "shell", "shell-navigation.ts"),
      "utf8",
    );
    // Crude but sufficient: find the admin-training block and confirm both roles.
    const match = source.match(/id:\s*"admin-training"[\s\S]*?(?=\{\s*id:|\];)/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain("STAFF");
    expect(match![0]).toContain("ADMIN");
  });
});
