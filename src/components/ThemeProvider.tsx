"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  prefersDarkColorScheme,
  supportsReducedMotion,
  supportsViewTransitions,
} from "@/lib/ui/browserSupport";
import {
  DEFAULT_THEME_STATE,
  THEME_STORAGE_KEYS,
  applyThemeStateToDocument,
  buildThemeState,
  mergeThemeStateSnapshots,
  normalizeAccessibilitySettings,
  parseStoredAccessibilitySettings,
  parseThemeStateFromPreferences,
  themeStateToCookieAssignments,
  themeStateToPreferenceEntries,
} from "@/lib/theme/theme-state";
import { getSupportedTheme } from "@/lib/theme/theme-manifest";

export type {
  AccessibilitySettings,
  ColorBlindMode,
  Density,
  FontSize,
  SpacingLevel,
  Theme,
  ThemeStateSnapshot,
  UIPreset,
} from "@/lib/theme/theme-state";
import type {
  AccessibilitySettings,
  PartialThemeStateSnapshot,
  Theme,
  ThemeStateSnapshot,
} from "@/lib/theme/theme-state";

export { UI_PRESETS } from "@/lib/theme/theme-state";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  accessibility: AccessibilitySettings;
  setAccessibility: (settings: AccessibilitySettings) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isTransitionAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: string }).name;
  return name === "AbortError" || name === "InvalidStateError";
}

function skipViewTransition(transition: ViewTransition | null): void {
  if (!transition) {
    return;
  }

  // Drain both promises so the skip doesn't surface as an unhandled rejection.
  // The `finished` and `ready` promises both reject with AbortError when
  // skipTransition() is called on a still-running transition.
  transition.finished?.catch(() => undefined);
  transition.ready?.catch(() => undefined);

  try {
    transition.skipTransition();
  } catch (error) {
    if (!isTransitionAbortError(error)) {
      throw error;
    }
  }
}

const THEME_TRANSITION_OVERLAY_DURATION_MS = 350;

function getThemeStorage(): Storage | null {
  const globalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (
    globalStorageDescriptor &&
    "value" in globalStorageDescriptor &&
    globalStorageDescriptor.value &&
    typeof globalStorageDescriptor.value.getItem === "function"
  ) {
    return globalStorageDescriptor.value as Storage;
  }

  if (process.env.VITEST) {
    return null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function ThemeProvider({
  children,
  respectSystemDarkMode = true,
  initialThemeState = DEFAULT_THEME_STATE,
  enableServerPreferencesSync = true,
}: {
  children: React.ReactNode;
  respectSystemDarkMode?: boolean;
  initialThemeState?: ThemeStateSnapshot;
  enableServerPreferencesSync?: boolean;
}) {
  const resolvedInitialThemeState = mergeThemeStateSnapshots(initialThemeState);
  const [theme, setThemeState] = useState<Theme>(resolvedInitialThemeState.theme);
  const [isDark, setIsDarkState] = useState(resolvedInitialThemeState.isDark);
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(
    resolvedInitialThemeState.accessibility,
  );
  const [mounted, setMounted] = useState(false);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [isTransitionOverlayVisible, setTransitionOverlayVisible] = useState(false);
  const transitionRef = useRef<ViewTransition | null>(null);
  const transitionOverlayFrameRef = useRef<number | null>(null);
  const transitionOverlayTimeoutRef = useRef<number | null>(null);
  const lastServerSyncRef = useRef<string | null>(null);

  const prevTheme = useRef<Theme>(resolvedInitialThemeState.theme);
  const [transitionKey, setTransitionKey] = useState(0);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  const setIsDark = useCallback((dark: boolean) => {
    setIsDarkState(dark);
  }, []);

  const setAccessibilityState = useCallback((settings: AccessibilitySettings) => {
    setAccessibility((current) => normalizeAccessibilitySettings(settings, current));
  }, []);

  const showTransitionOverlay = useCallback(() => {
    if (transitionOverlayTimeoutRef.current !== null) {
      window.clearTimeout(transitionOverlayTimeoutRef.current);
    }

    setTransitionOverlayVisible(true);
    setTransitionKey((key) => key + 1);
    transitionOverlayTimeoutRef.current = window.setTimeout(() => {
      setTransitionOverlayVisible(false);
      transitionOverlayTimeoutRef.current = null;
    }, THEME_TRANSITION_OVERLAY_DURATION_MS);
  }, []);

  const applyThemeStateOverrides = useCallback((overrides: PartialThemeStateSnapshot) => {
    const nextTheme = getSupportedTheme(overrides.theme);
    if (nextTheme) {
      setThemeState(nextTheme);
    }

    if (typeof overrides.isDark === "boolean") {
      setIsDarkState(overrides.isDark);
    }

    if (overrides.accessibility) {
      setAccessibility((current) =>
        normalizeAccessibilitySettings(overrides.accessibility, current),
      );
    }
  }, []);

  // Server hydration: fetch preferences for authenticated users (server wins)
  const hydrateFromServer = useCallback(() => {
    if (!enableServerPreferencesSync) {
      return Promise.resolve();
    }

    fetch("/api/preferences")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const prefs = data.preferences ?? [];
        applyThemeStateOverrides(
          parseThemeStateFromPreferences(
            prefs as Array<{ key: string; value: string }>,
          ),
        );
      })
      .catch(() => {
        /* Server unavailable — localStorage values remain */
      });
  }, [applyThemeStateOverrides, enableServerPreferencesSync]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const storage = getThemeStorage();
    const storedTheme = getSupportedTheme(storage?.getItem(THEME_STORAGE_KEYS.theme) ?? null);
    const storedDark = storage?.getItem(THEME_STORAGE_KEYS.dark) ?? null;
    const storedAccessibility = parseStoredAccessibilitySettings(
      storage?.getItem(THEME_STORAGE_KEYS.accessibility) ?? null,
    );

    applyThemeStateOverrides({
      theme: storedTheme ?? undefined,
      isDark:
        storedDark === null
          ? respectSystemDarkMode && prefersDarkColorScheme()
            ? true
            : undefined
          : storedDark === "true",
      accessibility: storedAccessibility ?? undefined,
    });

    Promise.resolve(hydrateFromServer()).finally(() => {
      setHydrationComplete(true);
    });
  }, [applyThemeStateOverrides, respectSystemDarkMode, hydrateFromServer]);

  useEffect(() => () => {
    if (transitionOverlayFrameRef.current !== null) {
      window.cancelAnimationFrame(transitionOverlayFrameRef.current);
      transitionOverlayFrameRef.current = null;
    }

    if (transitionOverlayTimeoutRef.current !== null) {
      window.clearTimeout(transitionOverlayTimeoutRef.current);
      transitionOverlayTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const snapshot = buildThemeState(DEFAULT_THEME_STATE, {
      theme,
      isDark,
      accessibility,
    });

    const updateState = () => {
      applyThemeStateToDocument(document.documentElement, snapshot);
    };

    if (
      supportsViewTransitions() &&
      !supportsReducedMotion() &&
      document.visibilityState === "visible"
    ) {
      const activeTransition = transitionRef.current;
      transitionRef.current = null;
      skipViewTransition(activeTransition);

      const nextTransition = document.startViewTransition(updateState);
      transitionRef.current = nextTransition;
      void nextTransition.finished.catch(() => undefined).finally(() => {
        if (transitionRef.current === nextTransition) {
          transitionRef.current = null;
        }
      });
    } else {
      updateState();
    }

    // Trigger overlay animation
    if (prevTheme.current !== theme) {
      if (transitionOverlayFrameRef.current !== null) {
        window.cancelAnimationFrame(transitionOverlayFrameRef.current);
      }

      transitionOverlayFrameRef.current = window.requestAnimationFrame(() => {
        transitionOverlayFrameRef.current = null;
        showTransitionOverlay();
      });
      prevTheme.current = theme;
    }
  }, [theme, isDark, accessibility, mounted, showTransitionOverlay]);

  useEffect(() => {
    if (!mounted || !hydrationComplete || !enableServerPreferencesSync) {
      return;
    }

    const snapshot = buildThemeState(DEFAULT_THEME_STATE, {
      theme,
      isDark,
      accessibility,
    });
    const serializedAccessibility = JSON.stringify(snapshot.accessibility);
    const storage = getThemeStorage();

    if (storage && typeof storage.setItem === "function") {
      if (storage.getItem(THEME_STORAGE_KEYS.theme) !== snapshot.theme) {
        storage.setItem(THEME_STORAGE_KEYS.theme, snapshot.theme);
      }

      if (storage.getItem(THEME_STORAGE_KEYS.dark) !== String(snapshot.isDark)) {
        storage.setItem(THEME_STORAGE_KEYS.dark, String(snapshot.isDark));
      }

      if (storage.getItem(THEME_STORAGE_KEYS.accessibility) !== serializedAccessibility) {
        storage.setItem(
          THEME_STORAGE_KEYS.accessibility,
          serializedAccessibility,
        );
      }
    }

    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    for (const cookie of themeStateToCookieAssignments(snapshot, { secure })) {
      document.cookie = cookie;
    }

    const payload = JSON.stringify(themeStateToPreferenceEntries(snapshot));
    if (payload === lastServerSyncRef.current) {
      return;
    }

    lastServerSyncRef.current = payload;
    fetch("/api/preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ preferences: JSON.parse(payload) }),
    })
      .then((response) => {
        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`Theme preference persistence failed with status ${response.status}`);
        }

        return response.json();
      })
      .catch(() => {
        // Keep local and cookie persistence even when the authenticated endpoint is unavailable.
      });
  }, [accessibility, enableServerPreferencesSync, hydrationComplete, isDark, mounted, theme]);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      isDark,
      setIsDark,
      accessibility,
      setAccessibility: setAccessibilityState,
    }),
    [theme, setTheme, isDark, setIsDark, accessibility, setAccessibilityState],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
      {isTransitionOverlayVisible && mounted && (
        <div
          key={transitionKey}
          data-testid="theme-transition-overlay"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-9999 animate-[theme-fade-out_350ms_ease-in-out_forwards]"
          style={{ backgroundColor: "var(--background)" }}
        />
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      ...DEFAULT_THEME_STATE,
      setTheme: () => {},
      setIsDark: () => {},
      setAccessibility: () => {},
    };
  }
  return context;
}
