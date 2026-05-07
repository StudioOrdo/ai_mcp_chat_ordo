import { BcryptHasher } from "@/adapters/BcryptHasher";
import { getUserDataMapper } from "@/adapters/RepositoryFactory";
import {
  ChangeUserPasswordInteractor,
  type ChangeUserPasswordResult,
} from "@/core/use-cases/ChangeUserPasswordInteractor";

export interface ChangeProfilePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function createProfilePasswordService() {
  const changePassword = new ChangeUserPasswordInteractor(
    getUserDataMapper(),
    new BcryptHasher(),
  );

  return {
    async changePassword(
      userId: string,
      input: ChangeProfilePasswordInput,
    ): Promise<ChangeUserPasswordResult> {
      return changePassword.execute({
        userId,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        confirmPassword: input.confirmPassword,
      });
    },
  };
}
