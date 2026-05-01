import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { SystemPromptDataMapper } from "@/adapters/SystemPromptDataMapper";
import { ConfigIdentitySource } from "@/adapters/ConfigIdentitySource";
import { ROLE_DIRECTIVES } from "@/core/entities/role-directives";
import type { PromptVersionChangedEvent } from "@/core/use-cases/PromptControlPlaneService";
import { buildPromptControlPlaneService } from "@/lib/prompts/prompt-control-plane-service";
import { ensureSchema } from "@/lib/db/schema";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  ensureSchema(db);
  return db;
}

function createService(
  db: Database.Database,
  hooks?: {
    recordPromptVersionChanged?: (event: PromptVersionChangedEvent) => Promise<void>;
    revalidatePaths?: (paths: string[]) => Promise<void> | void;
  },
) {
  return buildPromptControlPlaneService({
    promptRepo: new SystemPromptDataMapper(db),
    getFallbackBase: () => new ConfigIdentitySource().getIdentity(),
    getFallbackDirective: (role) => ROLE_DIRECTIVES[role as keyof typeof ROLE_DIRECTIVES] ?? null,
    hooks,
  });
}

describe("PromptControlPlaneService", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
  });

  it("includes APPRENTICE in the default slot inventory", async () => {
    const service = createService(db);

    const slots = await service.listSlots();
    expect(slots.map((slot) => `${slot.role}:${slot.promptType}`)).toEqual([
      "ALL:base",
      "ANONYMOUS:role_directive",
      "AUTHENTICATED:role_directive",
      "APPRENTICE:role_directive",
      "STAFF:role_directive",
      "ADMIN:role_directive",
    ]);
    const apprenticeDirective = slots.find(
      (slot) => slot.role === "APPRENTICE" && slot.promptType === "role_directive",
    );

    expect(apprenticeDirective).toBeDefined();
    expect(apprenticeDirective?.activeVersion).toBe(1);
    expect(apprenticeDirective?.runtimeCoverage).toBe("db");
  });

  it("distinguishes fallback-backed slots from missing slots", async () => {
    db.prepare(
      `UPDATE system_prompts SET is_active = 0 WHERE role = 'APPRENTICE' AND prompt_type = 'role_directive'`,
    ).run();

    const service = createService(db);
    const detail = await service.getSlotDetail({
      role: "APPRENTICE",
      promptType: "role_directive",
    });

    expect(detail.slot.activeVersion).toBeNull();
    expect(detail.slot.totalVersions).toBe(1);
    expect(detail.slot.runtimeCoverage).toBe("fallback");
    expect(detail.activeContent).toContain("APPRENTICE (STUDENT)");
    expect(detail.fallbackContent).toContain("APPRENTICE (STUDENT)");
  });

  it("rejects unsupported slot mutations for intentionally absent slot combinations", async () => {
    const service = createService(db);

    await expect(
      service.createVersion({
        role: "ALL",
        promptType: "role_directive",
        content: "Unused slot content",
        createdBy: "admin_1",
        notes: "should fail",
      }),
    ).rejects.toThrow("Unsupported prompt slot: role=ALL, type=role_directive");
  });

  it("rejects empty prompt content before creating a version", async () => {
    const service = createService(db);

    await expect(
      service.createVersion({
        role: "ALL",
        promptType: "base",
        content: "   ",
        createdBy: "admin_1",
        notes: "empty",
      }),
    ).rejects.toThrow("Prompt content must not be empty.");
  });

  it("emits slot-version side effects on activation", async () => {
    const recordPromptVersionChanged = vi.fn(async () => undefined);
    const revalidatePaths = vi.fn();
    const service = createService(db, {
      recordPromptVersionChanged,
      revalidatePaths,
    });

    const created = await service.createVersion({
      role: "ALL",
      promptType: "base",
      content: "Sprint 1 base prompt",
      createdBy: "admin_1",
      notes: "service activation",
    });

    revalidatePaths.mockClear();

    const result = await service.activateVersion({
      role: "ALL",
      promptType: "base",
      version: created.created.version,
    });

    expect(result.activatedVersion).toBe(2);
    expect(result.deactivatedVersion).toBe(1);
    expect(result.slot.activeVersion).toBe(2);
    expect(result.sideEffects.promptVersionChanged).toEqual({
      type: "prompt_version_changed",
      semantics: "slot_version",
      role: "ALL",
      promptType: "base",
      oldVersion: 1,
      newVersion: 2,
    });
    expect(recordPromptVersionChanged).toHaveBeenCalledWith({
      type: "prompt_version_changed",
      semantics: "slot_version",
      role: "ALL",
      promptType: "base",
      oldVersion: 1,
      newVersion: 2,
    });
    expect(revalidatePaths).toHaveBeenCalledWith([
      "/admin/prompts",
      "/admin/prompts/ALL/base",
    ]);
  });
});
