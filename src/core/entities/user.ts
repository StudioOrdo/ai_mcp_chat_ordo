export type RoleName = "ANONYMOUS" | "AUTHENTICATED" | "APPRENTICE" | "STAFF" | "ADMIN";
export type UserTier = "account" | "premium";

export interface User {
  id: string;
  email: string;
  name: string;
  roles: RoleName[];
  tier?: UserTier;
}
