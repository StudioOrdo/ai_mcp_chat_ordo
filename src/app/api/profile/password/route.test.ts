import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserMock, changePasswordMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  changePasswordMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/profile/profile-password-service", () => ({
  createProfilePasswordService: () => ({
    changePassword: changePasswordMock,
  }),
}));

import { ValidationError } from "@/core/common/errors";
import { PATCH } from "@/app/api/profile/password/route";
import {
  createAnonymousSessionUser,
  createAuthenticatedSessionUser,
  createRouteRequest,
} from "../../../../../tests/helpers/workflow-route-fixture";

describe("/api/profile/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects anonymous password changes", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await PATCH(
      createRouteRequest("/api/profile/password", "PATCH", {
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      }),
    );

    expect(response.status).toBe(401);
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("changes only the signed-in account password", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    changePasswordMock.mockResolvedValue({ message: "Password changed." });

    const response = await PATCH(
      createRouteRequest("/api/profile/password", "PATCH", {
        userId: "usr_other",
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ message: "Password changed." });
    expect(changePasswordMock).toHaveBeenCalledWith("usr_owner", {
      currentPassword: "OldPass123",
      newPassword: "NewPass123",
      confirmPassword: "NewPass123",
    });
  });

  it("maps validation errors without returning secret fields", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    changePasswordMock.mockRejectedValue(new ValidationError("New password confirmation does not match."));

    const response = await PATCH(
      createRouteRequest("/api/profile/password", "PATCH", {
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "Different123",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: "New password confirmation does not match.",
      errorCode: "VALIDATION_ERROR",
    });
    expect(JSON.stringify(payload)).not.toContain("OldPass123");
    expect(JSON.stringify(payload)).not.toContain("NewPass123");
  });
});
