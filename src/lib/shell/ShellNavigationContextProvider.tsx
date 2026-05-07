"use client";

import React, { createContext, useContext } from "react";

import {
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
  type ShellNavigationContext,
} from "@/lib/shell/shell-navigation";

const ShellNavigationContextValue = createContext<ShellNavigationContext>(
  DEFAULT_SHELL_NAVIGATION_CONTEXT,
);

export function ShellNavigationProvider({
  value,
  children,
}: {
  value: ShellNavigationContext;
  children: React.ReactNode;
}) {
  return (
    <ShellNavigationContextValue.Provider value={value}>
      {children}
    </ShellNavigationContextValue.Provider>
  );
}

export function useShellNavigationContext(): ShellNavigationContext {
  return useContext(ShellNavigationContextValue);
}
