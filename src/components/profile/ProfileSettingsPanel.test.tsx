import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfileViewModel } from "@/lib/profile/types";

import { ProfileSettingsPanel } from "@/components/profile/ProfileSettingsPanel";

const registerMock = vi.fn();
const getSubscriptionMock = vi.fn();
const subscribeMock = vi.fn();
const unsubscribeMock = vi.fn();

function buildProfile(overrides: Partial<UserProfileViewModel> = {}): UserProfileViewModel {
  return {
    id: "usr_1",
    name: "Morgan Lee",
    email: "morgan@example.com",
    credential: "Enterprise AI practitioner",
    pushNotificationsEnabled: true,
    affiliateEnabled: true,
    referralCode: "mentor-42",
    referralUrl: "https://studioordo.com/r/mentor-42",
    qrCodeUrl: "/api/qr/mentor-42",
    roles: ["APPRENTICE"],
    ...overrides,
  };
}

describe("ProfileSettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY", "BEl6bnlQdWJsaWNLZXlGb3JUZXN0aW5nMTIzNDU2Nzg");
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class PushManager {},
    });
    getSubscriptionMock.mockResolvedValue(null);
    subscribeMock.mockResolvedValue({
      endpoint: "https://push.example/sub_1",
      toJSON: () => ({
        endpoint: "https://push.example/sub_1",
        expirationTime: null,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      }),
    });
    unsubscribeMock.mockResolvedValue(true);
    registerMock.mockResolvedValue({
      pushManager: {
        getSubscription: getSubscriptionMock,
        subscribe: subscribeMock,
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: registerMock,
      },
    });
  });

  it("renders account section navigation and the user info panel by default", () => {
    const { container } = render(
      <ProfileSettingsPanel
        initialProfile={buildProfile()}
      />,
    );

    expect(screen.getByRole("link", { name: /User info/i })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: /Change password/i })).toHaveAttribute("href", "/profile?section=password");
    expect(screen.getByRole("link", { name: /^Preferences/i })).toHaveAttribute("href", "/profile?section=preferences");
    expect(container.querySelector('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "list");
    expect(container.querySelector('[data-governance-section="account"]')).not.toBeNull();
    expect(container.querySelector('[data-profile-account-nav="true"]')).toHaveAttribute("data-governance-selector-column", "true");
    expect(container.querySelector('[data-profile-main="true"]')).toHaveAttribute("data-governance-main-column", "true");
    expect(container.querySelector('[data-profile-surface="details-panel"]')?.className).toContain("profile-panel-surface");
    expect(container.querySelector('[data-profile-surface="details-panel"]')).toHaveAttribute("data-profile-section", "info");
    expect(screen.queryByRole("button", { name: "Download QR" })).not.toBeInTheDocument();
    expect(screen.queryByText("Affiliate Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Referral code")).not.toBeInTheDocument();
    expect(screen.queryByText("Referral link")).not.toBeInTheDocument();
    expect(screen.queryByText("My Referrals")).not.toBeInTheDocument();
    expect(screen.queryByText("https://studioordo.com/r/mentor-42")).not.toBeInTheDocument();
    expect(screen.queryByText("/api/qr/mentor-42")).not.toBeInTheDocument();
  });

  it("opens account detail from the mobile second-column selection state", () => {
    const { container } = render(
      <ProfileSettingsPanel
        initialProfile={buildProfile()}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: /Change password/i }));

    expect(container.querySelector('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "detail");
    expect(screen.getByRole("link", { name: "Back to account sections" })).toHaveAttribute("href", "/profile");
  });

  it("shows direct section routes as mobile details and lets users return to section selection", () => {
    const { container } = render(
      <ProfileSettingsPanel
        initialProfile={buildProfile()}
        initialSection="password"
      />,
    );

    expect(container.querySelector('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "detail");

    fireEvent.click(screen.getByRole("link", { name: "Back to account sections" }));

    expect(container.querySelector('[data-profile-page="true"]')).toHaveAttribute("data-profile-mobile-state", "list");
  });

  it("changes the password through the account use-case API and clears secret fields", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ message: "Password changed." }) } as Response);

    render(
      <ProfileSettingsPanel
        initialProfile={buildProfile()}
        initialSection="password"
      />,
    );

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPass123" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profile/password",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("shows a safe password error and clears secret fields when the API rejects the change", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Current password is incorrect." }),
    } as Response);

    render(
      <ProfileSettingsPanel
        initialProfile={buildProfile()}
        initialSection="password"
      />,
    );

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "WrongPass123" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPass123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("enables push notifications from the profile panel", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ subscription: {} }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ preferences: [] }) } as Response);

    render(
      <ProfileSettingsPanel
        initialProfile={buildProfile({ pushNotificationsEnabled: false })}
        initialSection="preferences"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enable notifications" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("/push-worker.js");
    });
    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/push",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/preferences",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    expect(await screen.findByText("Push notifications enabled for background work updates.")).toBeInTheDocument();
  });

  it("disables push notifications from the profile panel", async () => {
    const fetchMock = vi.mocked(fetch);
    getSubscriptionMock.mockResolvedValueOnce({
      endpoint: "https://push.example/sub_1",
      unsubscribe: unsubscribeMock,
    });
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ preferences: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) } as Response);

    render(<ProfileSettingsPanel initialProfile={buildProfile()} initialSection="preferences" />);

    fireEvent.click(screen.getByRole("button", { name: "Disable notifications" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/preferences",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    await waitFor(() => {
      expect(unsubscribeMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/push",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Push notifications disabled for your account.")).toBeInTheDocument();
  });

  it("renders the deployment-level push configuration message deterministically", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY", "");

    render(
      <ProfileSettingsPanel
        initialProfile={buildProfile({ pushNotificationsEnabled: false })}
        initialSection="preferences"
      />,
    );

    expect(
      screen.getByText("Push notifications are not configured for this deployment yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable notifications" })).toBeDisabled();
  });
});
