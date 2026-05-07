"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

import {
  GovernanceSectionFrame,
  type GovernanceSectionModel,
  type GovernanceSelectorItem,
} from "@/components/governance/GovernanceSectionFrame";
import type { UserProfileViewModel } from "@/lib/profile/types";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationsRenderUnavailableReason,
  getPushNotificationsUnavailableReason,
} from "@/lib/push/browser-push";

export type ProfileAccountSection = "info" | "password" | "preferences";

interface ProfileSettingsPanelProps {
  initialProfile: UserProfileViewModel;
  initialSection?: ProfileAccountSection;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const PROFILE_ACCOUNT_SECTIONS: readonly {
  id: ProfileAccountSection;
  label: string;
  href: string;
  description: string;
  iconLabel: string;
}[] = [
  {
    id: "info",
    label: "User info",
    href: "/profile",
    description: "Name, email, and account role.",
    iconLabel: "U",
  },
  {
    id: "password",
    label: "Change password",
    href: "/profile?section=password",
    description: "Update account password.",
    iconLabel: "L",
  },
  {
    id: "preferences",
    label: "Preferences",
    href: "/profile?section=preferences",
    description: "Personal settings.",
    iconLabel: "P",
  },
] as const;

function getProfileNoticeClassName(kind: SaveState["kind"]): string {
  return kind === "error"
    ? "alert-error"
    : "profile-success-notice px-(--space-inset-default) py-(--space-inset-compact) text-sm";
}

function getActiveSectionMeta(section: ProfileAccountSection) {
  return PROFILE_ACCOUNT_SECTIONS.find((item) => item.id === section) ?? PROFILE_ACCOUNT_SECTIONS[0];
}

type ProfileAccountSectionMeta = typeof PROFILE_ACCOUNT_SECTIONS[number];

export function ProfileSettingsPanel({
  initialProfile,
  initialSection = "info",
}: ProfileSettingsPanelProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(initialProfile.name);
  const [email, setEmail] = useState(initialProfile.email);
  const [credential, setCredential] = useState(initialProfile.credential);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<SaveState>({ kind: "idle" });
  const [pushState, setPushState] = useState<SaveState>({ kind: "idle" });
  const [mobileDetailOpen, setMobileDetailOpen] = useState(initialSection !== "info");
  const pushUnavailableReason = useSyncExternalStore(
    () => () => undefined,
    getPushNotificationsUnavailableReason,
    getPushNotificationsRenderUnavailableReason,
  );
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [isPushPending, startPushTransition] = useTransition();
  const activeSection = getActiveSectionMeta(initialSection).id;
  const activeSectionMeta = getActiveSectionMeta(activeSection);

  useEffect(() => {
    setMobileDetailOpen(initialSection !== "info");
  }, [initialSection]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveState({ kind: "idle" });

    startTransition(async () => {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, credential }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { profile?: UserProfileViewModel; error?: string }
        | null;

      if (!response.ok || !payload?.profile) {
        setSaveState({
          kind: "error",
          message: payload?.error ?? "Unable to update your account info right now.",
        });
        return;
      }

      setProfile(payload.profile);
      setName(payload.profile.name);
      setEmail(payload.profile.email);
      setCredential(payload.profile.credential);
      setSaveState({ kind: "success", message: "Account updated." });
    });
  };

  const clearPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handlePasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordState({ kind: "idle" });

    startPasswordTransition(async () => {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      clearPasswordFields();

      if (!response.ok) {
        setPasswordState({
          kind: "error",
          message: payload?.error ?? "Unable to change your password right now.",
        });
        return;
      }

      setPasswordState({
        kind: "success",
        message: payload?.message ?? "Password changed.",
      });
    });
  };

  const handlePushNotificationsToggle = () => {
    setPushState({ kind: "idle" });

    startPushTransition(async () => {
      try {
        if (profile.pushNotificationsEnabled) {
          await disablePushNotifications();
          setProfile((current) => ({
            ...current,
            pushNotificationsEnabled: false,
          }));
          setPushState({
            kind: "success",
            message: "Push notifications disabled for your account.",
          });
          return;
        }

        await enablePushNotifications();
        setProfile((current) => ({
          ...current,
          pushNotificationsEnabled: true,
        }));
        setPushState({
          kind: "success",
          message: "Push notifications enabled for background work updates.",
        });
      } catch (error) {
        setPushState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to update push notification settings right now.",
        });
      }
    });
  };

  const renderUserInfo = () => (
    <section
      className="profile-panel-surface profile-primary-panel p-(--space-inset-default) sm:p-(--space-inset-panel)"
      data-profile-surface="details-panel"
      data-profile-primary-surface="true"
      data-profile-section="info"
    >
      <div className="profile-panel-header mb-(--space-4) flex items-center justify-between gap-(--space-3) sm:mb-(--space-6)">
        <div>
          <h2 className="theme-display text-xl font-semibold tracking-tight">User info</h2>
          <p className="mt-(--space-1) text-sm text-foreground/52">
            This information helps Ordo address you correctly and keep account tools in sync.
          </p>
        </div>
        <div className="profile-role-list flex flex-wrap gap-(--space-2)">
          {profile.roles.map((role) => (
            <span
              key={role}
              className="profile-role-pill rounded-full px-(--space-inset-compact) py-(--space-1) text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/48"
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="profile-form-grid space-y-(--space-4)" data-profile-form="true">
        <div className="space-y-(--space-2)">
          <label htmlFor="profile-name" className="form-label">Name</label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input-field"
            autoComplete="name"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-(--space-2)">
          <label htmlFor="profile-email" className="form-label">Email</label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input-field"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-(--space-2)">
          <label htmlFor="profile-credential" className="form-label">Credential</label>
          <input
            id="profile-credential"
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            className="input-field"
            placeholder="Enterprise AI practitioner"
            aria-describedby="credential-description"
          />
          <p id="credential-description" className="text-xs leading-5 text-foreground/45">
            This appears in account-aware greetings and owner context.
          </p>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={saveState.kind !== "idle" ? getProfileNoticeClassName(saveState.kind) : ""}
          data-profile-notice={saveState.kind !== "idle" ? saveState.kind : undefined}
        >
          {saveState.kind !== "idle" ? saveState.message : ""}
        </div>

        <div className="profile-form-actions profile-form-actions-compact flex items-center justify-end gap-(--space-3) pt-(--space-2)">
          <p className="text-xs text-foreground/42">Changes save to the same backend used by the chat tools.</p>
          <button type="submit" className="btn-primary profile-save-action" disabled={isPending}>
            {isPending ? "Saving..." : "Save account"}
          </button>
        </div>
      </form>
    </section>
  );

  const renderChangePassword = () => (
    <section
      className="profile-panel-surface profile-primary-panel p-(--space-inset-default) sm:p-(--space-inset-panel)"
      data-profile-surface="password-panel"
      data-profile-primary-surface="true"
      data-profile-section="password"
    >
      <div className="profile-panel-header mb-(--space-4) flex items-start justify-between gap-(--space-3) sm:mb-(--space-6)">
        <div>
          <h2 className="theme-display text-xl font-semibold tracking-tight">Change password</h2>
          <p className="mt-(--space-1) max-w-2xl text-sm leading-6 text-foreground/52">
            Update the password used to sign in to this account.
          </p>
        </div>
      </div>

      <form onSubmit={handlePasswordSubmit} className="profile-form-grid space-y-(--space-4)" data-profile-password-form="true">
        <div className="space-y-(--space-2)">
          <label htmlFor="profile-current-password" className="form-label">Current password</label>
          <input
            id="profile-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="input-field"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="space-y-(--space-2)">
          <label htmlFor="profile-new-password" className="form-label">New password</label>
          <input
            id="profile-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="input-field"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </div>

        <div className="space-y-(--space-2)">
          <label htmlFor="profile-confirm-password" className="form-label">Confirm new password</label>
          <input
            id="profile-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="input-field"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </div>

        <div
          role="status"
          aria-live="polite"
          className={passwordState.kind !== "idle" ? getProfileNoticeClassName(passwordState.kind) : ""}
          data-profile-password-notice={passwordState.kind !== "idle" ? passwordState.kind : undefined}
        >
          {passwordState.kind !== "idle" ? passwordState.message : ""}
        </div>

        <div className="profile-form-actions profile-form-actions-compact flex items-center justify-end gap-(--space-3) pt-(--space-2)">
          <p className="text-xs text-foreground/42">This updates sign-in access only.</p>
          <button type="submit" className="btn-primary profile-save-action" disabled={isPasswordPending}>
            {isPasswordPending ? "Changing..." : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );

  const renderPreferences = () => (
    <div className="grid gap-(--space-6)" data-profile-section="preferences">
      <section className="profile-feature-surface p-(--space-inset-default) sm:p-(--space-inset-panel)" data-profile-surface="preferences-placeholder">
        <div className="flex items-start justify-between gap-(--space-4)">
          <div>
            <p className="theme-label tier-micro uppercase text-foreground/42">Preferences</p>
            <h2 className="mt-(--space-2) theme-display text-xl font-semibold tracking-tight">
              User preferences
            </h2>
          </div>
          <span className="rounded-full border border-border/70 bg-background/80 px-(--space-inset-compact) py-(--space-1) text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/48">
            In development
          </span>
        </div>
        <p className="mt-(--space-3) max-w-2xl text-sm leading-6 text-foreground/56">
          This page will become the dedicated home for user preferences. For now, theme is controlled from the account menu header and existing notification controls remain below.
        </p>
      </section>

      <section className="profile-panel-surface p-(--space-inset-default) sm:p-(--space-inset-panel)" data-profile-surface="notifications-panel">
        <div className="flex items-start justify-between gap-(--space-4)">
          <div>
            <p className="theme-label tier-micro uppercase text-foreground/42">Notifications</p>
            <h2 className="theme-display text-xl font-semibold tracking-tight">Background work alerts</h2>
            <p className="mt-(--space-1) text-sm leading-6 text-foreground/56">
              Receive browser push alerts when governed work finishes after you leave the chat tab.
            </p>
          </div>
          <span className="rounded-full border border-border/70 bg-background/80 px-(--space-inset-compact) py-(--space-1) text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground/48">
            {profile.pushNotificationsEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="mt-(--space-6) space-y-(--space-4)">
          {pushUnavailableReason ? (
            <div className="profile-empty-state p-(--space-inset-default) text-sm leading-6 text-foreground/52" data-profile-surface="push-unavailable">
              {pushUnavailableReason}
            </div>
          ) : null}

          {pushState.kind !== "idle" ? (
            <div className={getProfileNoticeClassName(pushState.kind)} data-profile-notice={pushState.kind}>
              {pushState.message}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-(--space-3)">
            <p className="text-xs leading-5 text-foreground/45">
              This account-level setting controls whether background work completion alerts are delivered.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handlePushNotificationsToggle}
              disabled={isPushPending || Boolean(pushUnavailableReason)}
            >
              {isPushPending
                ? profile.pushNotificationsEnabled
                  ? "Disabling..."
                  : "Enabling..."
                : profile.pushNotificationsEnabled
                  ? "Disable notifications"
                  : "Enable notifications"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  const renderAccountSection = (section: ProfileAccountSectionMeta) => (
    <div className="profile-account-content" data-profile-account-detail={section.id}>
      <header className="profile-route-header mb-(--space-6) flex flex-col gap-(--space-3)" data-profile-header="true">
        <p className="theme-label tier-micro uppercase text-foreground/42">My account</p>
        <h1 className="theme-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {section.label}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-foreground/62 sm:text-base">
          Manage your user info, password, and personal settings.
        </p>
      </header>

      {section.id === "info" ? renderUserInfo() : null}
      {section.id === "password" ? renderChangePassword() : null}
      {section.id === "preferences" ? renderPreferences() : null}
    </div>
  );
  const accountModel: GovernanceSectionModel<ProfileAccountSectionMeta, { sectionCount: number }> = {
    sectionId: "account",
    sectionTitle: "Account",
    brief: null,
    summary: {
      sectionCount: PROFILE_ACCOUNT_SECTIONS.length,
    },
    objects: [...PROFILE_ACCOUNT_SECTIONS],
    selectedObject: activeSectionMeta,
    permissions: {
      canView: true,
      canSelect: true,
      canFilter: false,
      canMutate: true,
      canViewDiagnostics: false,
    },
  };
  const accountSelectorItems: GovernanceSelectorItem[] = PROFILE_ACCOUNT_SECTIONS.map((section) => ({
    id: section.id,
    href: section.href,
    title: section.label,
    summary: section.description,
    iconLabel: section.iconLabel,
    selected: section.id === activeSection,
    onSelect: () => setMobileDetailOpen(true),
    dataAttributes: {
      "data-profile-section-link": section.id,
      "data-profile-section-active": section.id === activeSection ? "true" : undefined,
    },
  }));

  return (
    <GovernanceSectionFrame
      model={accountModel}
      detailRequested={mobileDetailOpen}
      listHref="/profile"
      mobileBackLabel="Back to account sections"
      onMobileBack={() => setMobileDetailOpen(false)}
      rootDataAttributes={{
        "data-profile-page": "true",
        "data-profile-mobile-state": mobileDetailOpen ? "detail" : "list",
      }}
      selector={{
        ariaLabel: "Account sections",
        title: "Account",
        guidance: "Your identity, password, and personal settings live here. Chat remains the operating interface.",
        items: accountSelectorItems,
        emptyTitle: "No account sections are available.",
        emptySummary: "User info, password, and preferences will appear here when the account is loaded.",
        footer: <p>Showing {PROFILE_ACCOUNT_SECTIONS.length} of {PROFILE_ACCOUNT_SECTIONS.length} account sections.</p>,
        dataAttributes: {
          "data-profile-account-nav": "true",
        },
      }}
      main={{
        ariaLabel: "Account detail",
        renderBrief: () => renderAccountSection(activeSectionMeta),
        renderDetail: (section) => renderAccountSection(section),
        missingDetail: {
          title: "Account section was not found.",
          summary: "Return to account sections and choose User info, Change password, or Preferences.",
        },
        dataAttributes: {
          "data-profile-main": "true",
        },
      }}
    />
  );
}
