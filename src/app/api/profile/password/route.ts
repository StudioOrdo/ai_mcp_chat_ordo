import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { mapErrorToResponse } from "@/core/common/errors";
import { getSessionUser } from "@/lib/auth";
import { createProfilePasswordService } from "@/lib/profile/profile-password-service";

function unauthorized() {
  return NextResponse.json(
    { error: "Authentication required", errorCode: "AUTH_ERROR" },
    { status: 401 },
  );
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (user.roles.includes("ANONYMOUS")) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body.", errorCode: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const result = await createProfilePasswordService().changePassword(user.id, {
      currentPassword: body.currentPassword ?? "",
      newPassword: body.newPassword ?? "",
      confirmPassword: body.confirmPassword ?? "",
    });
    return NextResponse.json(result);
  } catch (error) {
    const { status, body: errorBody } = mapErrorToResponse(error);
    return NextResponse.json(errorBody, { status });
  }
}
