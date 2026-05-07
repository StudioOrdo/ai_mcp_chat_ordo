import { describe, expect, it, vi, beforeEach } from "vitest";

const { getSessionUserMock, getProfileMock, updateProfileMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getProfileMock: vi.fn(),
  updateProfileMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/profile/profile-service", () => ({
  createProfileService: () => ({
    getProfile: getProfileMock,
    updateProfile: updateProfileMock,
  }),
}));

import { GET, PATCH } from "@/app/api/profile/route";
import { createRouteRequest, createAnonymousSessionUser, createAuthenticatedSessionUser } from "../../../../tests/helpers/workflow-route-fixture";

describe("/api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for anonymous GET requests", async () => {
    getSessionUserMock.mockResolvedValue(createAnonymousSessionUser());

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns the current profile for authenticated users", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_1" }));
    getProfileMock.mockResolvedValue({ id: "usr_1", name: "Morgan", email: "morgan@example.com", credential: "AI practitioner", pushNotificationsEnabled: true, affiliateEnabled: true, referralCode: "mentor-42", referralUrl: "https://studioordo.com/r/mentor-42", qrCodeUrl: "/api/qr/mentor-42", roles: ["AUTHENTICATED"] });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile.referralCode).toBe("mentor-42");
    expect(getProfileMock).toHaveBeenCalledWith("usr_1");
  });

  it("updates the profile for authenticated users", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_1" }));
    updateProfileMock.mockResolvedValue({ id: "usr_1", name: "Morgan Lee", email: "morgan@example.com", credential: "AI strategist", pushNotificationsEnabled: true, affiliateEnabled: false, referralCode: null, referralUrl: null, qrCodeUrl: null, roles: ["AUTHENTICATED"] });

    const response = await PATCH(
      createRouteRequest("/api/profile", "PATCH", {
        name: "Morgan Lee",
        credential: "AI strategist",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateProfileMock).toHaveBeenCalledWith("usr_1", {
      name: "Morgan Lee",
      email: undefined,
      credential: "AI strategist",
    });
    expect(payload.profile.credential).toBe("AI strategist");
  });

  it("ignores client-supplied user ids and updates only the signed-in account", async () => {
    getSessionUserMock.mockResolvedValue(createAuthenticatedSessionUser({ id: "usr_owner" }));
    updateProfileMock.mockResolvedValue({
      id: "usr_owner",
      name: "Owner Name",
      email: "owner@example.com",
      credential: "Operator",
      pushNotificationsEnabled: false,
      affiliateEnabled: false,
      referralCode: null,
      referralUrl: null,
      qrCodeUrl: null,
      roles: ["AUTHENTICATED"],
    });

    const response = await PATCH(
      createRouteRequest("/api/profile", "PATCH", {
        userId: "usr_someone_else",
        name: "Owner Name",
      }),
    );

    expect(response.status).toBe(200);
    expect(updateProfileMock).toHaveBeenCalledWith("usr_owner", {
      name: "Owner Name",
      email: undefined,
      credential: undefined,
    });
  });
});
