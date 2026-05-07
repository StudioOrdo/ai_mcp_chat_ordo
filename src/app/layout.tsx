import type { Metadata } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

import { ThemeProvider } from "@/components/ThemeProvider";
import { UserPreferencesDataMapper } from "@/adapters/UserPreferencesDataMapper";
import { AppShell } from "@/components/AppShell";
import { ChatSurface } from "@/frameworks/ui/ChatSurface";
import { getSessionUser } from "@/lib/auth";
import { resolvePublicOrigin } from "@/lib/appliance/network/public-origin";
import { getInstanceIdentity, getInstancePrompts } from "@/lib/config/instance";
import { InstanceConfigProvider } from "@/lib/config/InstanceConfigContext";
import { getDb } from "@/lib/db";
import { REFERRAL_VISIT_COOKIE_NAME } from "@/lib/referrals/referral-visit";
import { ShellNavigationProvider } from "@/lib/shell/ShellNavigationContextProvider";
import { loadPublicShellNavigationContext } from "@/lib/shell/public-shell-state";
import {
  DEFAULT_THEME_STATE,
  THEME_COOKIE_KEYS,
  buildThemeBootstrapScript,
  getThemeDocumentState,
  mergeThemeStateSnapshots,
  parseThemeStateFromCookies,
  parseThemeStateFromPreferences,
} from "@/lib/theme/theme-state";

export async function generateMetadata(): Promise<Metadata> {
  const identity = getInstanceIdentity();
  const publicOrigin = resolvePublicOrigin({ instanceDomain: identity.domain });
  const canonicalUrl = publicOrigin.origin ?? `https://${identity.domain}`;

  return {
    metadataBase: new URL(canonicalUrl),
    applicationName: identity.name,
    title: `${identity.name} | ${identity.tagline}`,
    description: identity.description,
    keywords: [
      identity.name,
      "solopreneur AI workspace",
      "all-in-one AI operator system",
      "governed AI workflows",
      "SQLite AI app",
      "deferred AI jobs",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      title: `${identity.name} | ${identity.tagline}`,
      description: identity.description,
      url: canonicalUrl,
      siteName: identity.name,
      type: "website",
      images: [{ url: identity.logoPath }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${identity.name} | ${identity.tagline}`,
      description: identity.description,
      images: [identity.logoPath],
    },
  };
}

import { ChatProvider } from "@/hooks/useGlobalChat";
import { Suspense } from "react";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const identity = getInstanceIdentity();
  const prompts = getInstancePrompts();
  const user = await getSessionUser();
  const navigationContext = await loadPublicShellNavigationContext();
  const isAnonymousUser = user.roles.includes("ANONYMOUS");
  const hasPublicMobileNav = user.roles.every((role) => role === "ANONYMOUS");
  const respectSystemDarkMode = !user.roles.includes("ANONYMOUS");
  const cookieStore = await cookies();
  const canResolveReferralVisit = Boolean(cookieStore.get(REFERRAL_VISIT_COOKIE_NAME)?.value);

  const cookieThemeState = parseThemeStateFromCookies({
    theme: cookieStore.get(THEME_COOKIE_KEYS.theme)?.value,
    dark: cookieStore.get(THEME_COOKIE_KEYS.dark)?.value,
    fontSize: cookieStore.get(THEME_COOKIE_KEYS.fontSize)?.value,
    lineHeight: cookieStore.get(THEME_COOKIE_KEYS.lineHeight)?.value,
    letterSpacing: cookieStore.get(THEME_COOKIE_KEYS.letterSpacing)?.value,
    density: cookieStore.get(THEME_COOKIE_KEYS.density)?.value,
    colorBlindMode: cookieStore.get(THEME_COOKIE_KEYS.colorBlindMode)?.value,
  });

  const preferenceThemeState = isAnonymousUser
    ? null
    : parseThemeStateFromPreferences(
        await new UserPreferencesDataMapper(getDb()).getAll(user.id),
      );

  const initialThemeState = mergeThemeStateSnapshots(
    DEFAULT_THEME_STATE,
    preferenceThemeState,
    cookieThemeState,
  );
  const themeDocumentState = getThemeDocumentState(initialThemeState);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={themeDocumentState.className}
      data-theme={themeDocumentState.attributes["data-theme"]}
      data-theme-mode={themeDocumentState.attributes["data-theme-mode"]}
      data-theme-transition={themeDocumentState.attributes["data-theme-transition"]}
      data-density={themeDocumentState.attributes["data-density"]}
      data-color-blind={themeDocumentState.attributes["data-color-blind"]}
      style={themeDocumentState.style}
    >
      <body
        className="antialiased"
        data-shell-public-mobile-nav={hasPublicMobileNav ? "true" : undefined}
      >
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {buildThemeBootstrapScript({ respectSystemDarkMode })}
        </Script>
        <ThemeProvider
          respectSystemDarkMode={respectSystemDarkMode}
          initialThemeState={initialThemeState}
          enableServerPreferencesSync={!isAnonymousUser}
        >
          <InstanceConfigProvider identity={identity} prompts={prompts}>
            <ChatProvider initialRole={user.roles[0]} canResolveReferralVisit={canResolveReferralVisit}>
              <ShellNavigationProvider value={navigationContext}>
                <AppShell user={user} navigationContext={navigationContext}>{children}</AppShell>
                <Suspense fallback={null}>
                  <ChatSurface mode="floating" />
                </Suspense>
              </ShellNavigationProvider>

            </ChatProvider>
          </InstanceConfigProvider>
        </ThemeProvider>
        {identity.analytics?.plausibleDomain && (
          <Script
            defer
            data-domain={identity.analytics.plausibleDomain}
            src={identity.analytics.plausibleSrc ?? "https://plausible.io/js/script.js"}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
