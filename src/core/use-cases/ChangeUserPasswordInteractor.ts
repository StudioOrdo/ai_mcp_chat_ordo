import type { UseCase } from "@/core/common/UseCase";
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@/core/common/errors";
import type { PasswordHasher } from "@/core/use-cases/PasswordHasher";

export interface UserPasswordCredential {
  id: string;
  passwordHash: string | null;
}

export interface UserPasswordRepository {
  findPasswordCredentialByUserId(userId: string): Promise<UserPasswordCredential | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

export interface ChangeUserPasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangeUserPasswordResult {
  message: string;
}

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

function normalizePassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export class ChangeUserPasswordInteractor
  implements UseCase<ChangeUserPasswordRequest, ChangeUserPasswordResult>
{
  constructor(
    private readonly userRepo: UserPasswordRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(request: ChangeUserPasswordRequest): Promise<ChangeUserPasswordResult> {
    const userId = request.userId.trim();
    const currentPassword = normalizePassword(request.currentPassword);
    const newPassword = normalizePassword(request.newPassword);
    const confirmPassword = normalizePassword(request.confirmPassword);

    if (!userId) {
      throw new AuthorizationError("Authentication required");
    }

    if (!currentPassword) {
      throw new ValidationError("Current password is required.");
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
      throw new ValidationError("New password must be between 8 and 72 characters.");
    }

    if (newPassword !== confirmPassword) {
      throw new ValidationError("New password confirmation does not match.");
    }

    if (newPassword === currentPassword) {
      throw new ValidationError("New password must be different from the current password.");
    }

    const credential = await this.userRepo.findPasswordCredentialByUserId(userId);
    if (!credential) {
      throw new NotFoundError("Account was not found.");
    }

    if (!credential.passwordHash) {
      throw new ValidationError("Password login is not configured for this account.");
    }

    const currentPasswordMatches = await this.hasher.verify(currentPassword, credential.passwordHash);
    if (!currentPasswordMatches) {
      throw new AuthorizationError("Current password is incorrect.");
    }

    const nextPasswordHash = await this.hasher.hash(newPassword);
    await this.userRepo.updatePasswordHash(userId, nextPasswordHash);

    return { message: "Password changed." };
  }
}
