import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";

import { SystemPromptDataMapper } from "@/adapters/SystemPromptDataMapper";
import { ConfigIdentitySource } from "@/adapters/ConfigIdentitySource";
import { ROLE_DIRECTIVES } from "@/core/entities/role-directives";
import type { PromptVersionChangedEvent } from "@/core/use-cases/PromptControlPlaneService";
import { buildPromptControlPlaneService } from "@/lib/prompts/prompt-control-plane-service";
import { ensureSchema } from "@/lib/db/schema";
import { promptRollback, promptSet } from "@/lib/capabilities/shared/prompt-tool";

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

describe("prompt control-plane equivalence", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
  });

  it("drives the same slot-version semantics through service and MCP adapters", async () => {
    const recordPromptVersionChanged = vi.fn(async () => undefined);
    const revalidatePaths = vi.fn();
    const service = createService(db, {
      recordPromptVersionChanged,
      revalidatePaths,
    });

    const adminCreate = await service.createVersion({
      role: "ALL",
      promptType: "base",
      content: "Admin-created version",
      createdBy: "admin_1",
      notes: "admin path",
    });

    const adminActivate = await service.activateVersion({
      role: "ALL",
      promptType: "base",
      version: adminCreate.created.version,
    });

    expect(adminActivate.sideEffects.promptVersionChanged).toEqual({
      type: "prompt_version_changed",
      semantics: "slot_version",
      role: "ALL",
      promptType: "base",
      oldVersion: 1,
      newVersion: 2,
    });

    recordPromptVersionChanged.mockClear();
    revalidatePaths.mockClear();

    const mcpSet = await promptSet(
      { service },
      {
        role: "ALL",
        prompt_type: "base",
        content: "MCP-created version",
        notes: "mcp path",
      },
    ) as { version: number; activated: boolean };

    expect(mcpSet).toEqual({ version: 3, activated: true });
    expect(recordPromptVersionChanged).toHaveBeenCalledWith({
      type: "prompt_version_changed",
      semantics: "slot_version",
      role: "ALL",
      promptType: "base",
      oldVersion: 2,
      newVersion: 3,
    });
    expect(revalidatePaths).toHaveBeenCalledWith([
      "/admin/prompts",
      "/admin/prompts/ALL/base",
    ]);
  });

  it("shares version-existence validation between direct service calls and MCP rollback", async () => {
    const service = createService(db);

    await expect(
      service.activateVersion({
        role: "ALL",
        promptType: "base",
        version: 99,
      }),
    ).rejects.toThrow("Version 99 not found for role=ALL, type=base");

    const rollback = await promptRollback(
      { service },
      { role: "ALL", prompt_type: "base", version: 99 },
    ) as { error: string };

    expect(rollback.error).toBe("Version 99 not found for role=ALL, type=base");
  });
});
