import { describe, expect, it, vi } from "vitest";

import {
  ROLE_PERSONA_PREFERENCE_KEY,
  readRolePersonaPreference,
  resolveRetrievalEnvelope,
} from "@/lib/chat/retrieval-envelope";
import type {
  UserPreference,
  UserPreferencesRepository,
} from "@/core/ports/UserPreferencesRepository";

function makePrefRepo(stored: UserPreference | null): UserPreferencesRepository {
  return {
    getAll: vi.fn().mockResolvedValue(stored ? [stored] : []),
    get: vi.fn().mockResolvedValue(stored),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("resolveRetrievalEnvelope (Phase 4)", () => {
  it("resolves public-only for anonymous, no persona", () => {
    const env = resolveRetrievalEnvelope({ role: "ANONYMOUS" });
    expect(env.allowedAudiences).toEqual(["public"]);
    expect(env.rolePersona).toBeUndefined();
  });

  it("widens premium for authenticated premium-tier viewer", () => {
    const env = resolveRetrievalEnvelope({
      role: "AUTHENTICATED",
      tier: "premium",
    });
    expect(env.allowedAudiences).toEqual(["public", "account", "premium"]);
  });

  it("passes through a provided persona unchanged", () => {
    const env = resolveRetrievalEnvelope({
      role: "AUTHENTICATED",
      tier: "account",
      rolePersona: "sales",
    });
    expect(env.rolePersona).toBe("sales");
    expect(env.allowedAudiences).toEqual(["public", "account"]);
  });

  it("omits rolePersona when none is provided", () => {
    const env = resolveRetrievalEnvelope({ role: "AUTHENTICATED" });
    expect("rolePersona" in env).toBe(false);
  });
});

describe("readRolePersonaPreference (Phase 4)", () => {
  it("uses the canonical preference key", () => {
    expect(ROLE_PERSONA_PREFERENCE_KEY).toBe("role_persona");
  });

  it("returns a validated persona when stored", async () => {
    const repo = makePrefRepo({
      key: ROLE_PERSONA_PREFERENCE_KEY,
      value: "sales",
      updatedAt: new Date().toISOString(),
    });
    const result = await readRolePersonaPreference(repo, "usr_42");
    expect(result).toBe("sales");
    expect(repo.get).toHaveBeenCalledWith("usr_42", ROLE_PERSONA_PREFERENCE_KEY);
  });

  it("returns undefined when no preference is stored", async () => {
    const repo = makePrefRepo(null);
    const result = await readRolePersonaPreference(repo, "usr_42");
    expect(result).toBeUndefined();
  });

  it("returns undefined when the stored value is corrupt", async () => {
    const repo = makePrefRepo({
      key: ROLE_PERSONA_PREFERENCE_KEY,
      value: "not-a-real-persona",
      updatedAt: new Date().toISOString(),
    });
    const result = await readRolePersonaPreference(repo, "usr_42");
    expect(result).toBeUndefined();
  });

  it("returns undefined when the stored value is empty", async () => {
    const repo = makePrefRepo({
      key: ROLE_PERSONA_PREFERENCE_KEY,
      value: "",
      updatedAt: new Date().toISOString(),
    });
    const result = await readRolePersonaPreference(repo, "usr_42");
    expect(result).toBeUndefined();
  });
});
