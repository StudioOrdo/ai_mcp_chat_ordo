import { describe, expect, it, vi } from "vitest";

import {
  ChangeUserPasswordInteractor,
  type UserPasswordRepository,
} from "@/core/use-cases/ChangeUserPasswordInteractor";
import type { PasswordHasher } from "@/core/use-cases/PasswordHasher";

function buildHarness(overrides: {
  storedHash?: string | null;
  verifyResult?: boolean;
} = {}) {
  const storedHash = Object.prototype.hasOwnProperty.call(overrides, "storedHash")
    ? overrides.storedHash ?? null
    : "stored_hash";
  const repo: UserPasswordRepository = {
    findPasswordCredentialByUserId: vi.fn().mockResolvedValue({
      id: "usr_1",
      passwordHash: storedHash,
    }),
    updatePasswordHash: vi.fn().mockResolvedValue(undefined),
  };
  const hasher: PasswordHasher = {
    verify: vi.fn().mockResolvedValue(overrides.verifyResult ?? true),
    hash: vi.fn().mockResolvedValue("next_hash"),
  };
  const interactor = new ChangeUserPasswordInteractor(repo, hasher);

  return { interactor, repo, hasher };
}

describe("ChangeUserPasswordInteractor", () => {
  it("verifies the current password before storing a new hashed password", async () => {
    const { interactor, repo, hasher } = buildHarness();

    const result = await interactor.execute({
      userId: "usr_1",
      currentPassword: "OldPass123",
      newPassword: "NewPass123",
      confirmPassword: "NewPass123",
    });

    expect(result).toEqual({ message: "Password changed." });
    expect(hasher.verify).toHaveBeenCalledWith("OldPass123", "stored_hash");
    expect(hasher.hash).toHaveBeenCalledWith("NewPass123");
    expect(repo.updatePasswordHash).toHaveBeenCalledWith("usr_1", "next_hash");
  });

  it("rejects wrong current passwords without storing a new hash", async () => {
    const { interactor, repo } = buildHarness({ verifyResult: false });

    await expect(
      interactor.execute({
        userId: "usr_1",
        currentPassword: "WrongPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      }),
    ).rejects.toThrow("Current password is incorrect.");
    expect(repo.updatePasswordHash).not.toHaveBeenCalled();
  });

  it("rejects weak, mismatched, and unchanged passwords before verification", async () => {
    const { interactor, hasher } = buildHarness();

    await expect(
      interactor.execute({
        userId: "usr_1",
        currentPassword: "OldPass123",
        newPassword: "short",
        confirmPassword: "short",
      }),
    ).rejects.toThrow("New password must be between 8 and 72 characters.");

    await expect(
      interactor.execute({
        userId: "usr_1",
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "Different123",
      }),
    ).rejects.toThrow("New password confirmation does not match.");

    await expect(
      interactor.execute({
        userId: "usr_1",
        currentPassword: "SamePass123",
        newPassword: "SamePass123",
        confirmPassword: "SamePass123",
      }),
    ).rejects.toThrow("New password must be different from the current password.");

    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it("does not create a password when password login is not configured", async () => {
    const { interactor, repo } = buildHarness({ storedHash: null });

    await expect(
      interactor.execute({
        userId: "usr_1",
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      }),
    ).rejects.toThrow("Password login is not configured for this account.");
    expect(repo.updatePasswordHash).not.toHaveBeenCalled();
  });
});
