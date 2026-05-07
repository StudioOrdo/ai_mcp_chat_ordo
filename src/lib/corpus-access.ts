import { notFound, redirect } from "next/navigation";

import type { RoleName } from "@/core/entities/user";
import { ContentAccessDeniedError } from "@/core/entities/errors";

import { getSessionUser, resolveSessionAuthorizationRole } from "./auth";

export interface CorpusAccessOptions {
  role?: RoleName;
  publicOnly?: boolean;
}

export function resolveCorpusRole(options?: CorpusAccessOptions): RoleName | undefined {
  if (options?.publicOnly) {
    return "ANONYMOUS";
  }

  return options?.role;
}

export async function getViewerRole(): Promise<RoleName> {
  const user = await getSessionUser();
  return resolveSessionAuthorizationRole(user);
}

export function handleLibraryAccessDenied(role: RoleName): never {
  if (role === "ANONYMOUS") {
    redirect("/login");
  }

  notFound();
}

export function rethrowLibraryAccessDenied(error: unknown, role: RoleName): never {
  if (error instanceof ContentAccessDeniedError) {
    return handleLibraryAccessDenied(role);
  }

  throw error;
}
