"use client";

import { createContext, useContext } from "react";

import { DEFAULT_THEME_STATE } from "@/lib/theme/theme-state";

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
import type { AccessibilitySettings, Theme } from "@/lib/theme/theme-state";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  accessibility: AccessibilitySettings;
  setAccessibility: (settings: AccessibilitySettings) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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