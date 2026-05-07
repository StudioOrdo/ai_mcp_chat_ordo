import { NextResponse } from "next/server";
import {
  clearMockSession,
  getSessionUser,
  resolveSessionAuthorizationRole,
  switchSessionUserRole,
  type RoleName,
} from "@/lib/auth";
import { AuthSwitchRequestSchema } from "./schema";
import { logEvent, logFailure } from "@/lib/observability/logger";
import { REASON_CODES } from "@/lib/observability/reason-codes";
import { getEnvConfig } from "@/lib/config/env-config";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

    if (user.roles.includes("ANONYMOUS")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // ADMIN or development mode may mutate the signed-in test account role.
    const isAdmin = resolveSessionAuthorizationRole(user) === "ADMIN";
    const env = getEnvConfig();
    const isDevMode = env.NODE_ENV === "development";

    if (!isAdmin && !isDevMode) {
      return NextResponse.json(
        { error: "Forbidden — ADMIN role required" },
        { status: 403 },
      );
    }

    const raw = await req.json();
    const parseResult = AuthSwitchRequestSchema.safeParse(raw);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid role provided." },
        { status: 400 },
      );
    }
    const { role } = parseResult.data;

    await switchSessionUserRole(user.id, role as RoleName);
    await clearMockSession();

    logEvent("warn", "ROLE_SWITCH", {
      userId: user.id,
      previousRole: user.roles,
      targetRole: role,
      persisted: true,
      isAdmin,
      isDevMode,
    });

    return NextResponse.json({ success: true, activeRole: role, roles: [role], persisted: true });
  } catch (error) {
    logFailure(REASON_CODES.UNKNOWN_ROUTE_ERROR, "Role switch failed", {}, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
