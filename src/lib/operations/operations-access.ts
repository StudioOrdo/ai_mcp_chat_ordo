import { notFound, redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/auth";
import { resolveSessionAuthorizationRole, sessionHasRole } from "@/lib/auth";
import type { RoleName } from "@/core/entities/user";

export const OPERATIONS_WORKSPACE_ROLES: readonly RoleName[] = ["STAFF", "ADMIN"];

export function canAccessOperationsWorkspace(userRoles: readonly RoleName[]): boolean {
  return userRoles.some((role) => OPERATIONS_WORKSPACE_ROLES.includes(role));
}

export function canSessionAccessOperationsWorkspace(user: Pick<SessionUser, "roles" | "realRoles">): boolean {
  return sessionHasRole(user, [...OPERATIONS_WORKSPACE_ROLES]);
}

export async function requireOperationsWorkspaceAccess(): Promise<SessionUser> {
  const user = await getSessionUser();
  const role = resolveSessionAuthorizationRole(user);

  if (role === "ANONYMOUS") {
    redirect("/login");
  }

  if (!canSessionAccessOperationsWorkspace(user)) {
    notFound();
  }

  return user;
}
