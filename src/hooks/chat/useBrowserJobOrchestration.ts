import { useMemo } from "react";

import {
  abortAllBrowserRuntimeJobs,
  clearBrowserRuntimeJobCompleted,
  getActiveBrowserRuntimeJobIds,
  hasBrowserRuntimeJobController,
  isBrowserRuntimeJobCompleted,
  markBrowserRuntimeJobCompleted,
  registerBrowserRuntimeJobController,
  resetBrowserRuntimeJobStoreForTests,
  unregisterBrowserRuntimeJobController,
} from "./browserRuntimeJobStore";

export interface BrowserJobOrchestration {
  register: (jobId: string, controller: AbortController) => void;
  unregister: (jobId: string) => void;
  hasController: (jobId: string) => boolean;
  getActiveJobIds: () => Set<string>;
  markCompleted: (jobId: string) => void;
  clearCompleted: (jobId: string) => void;
  isCompleted: (jobId: string) => boolean;
  abortAll: () => void;
}

export function resetBrowserJobOrchestrationForTests(): void {
  resetBrowserRuntimeJobStoreForTests();
}

export function useBrowserJobOrchestration(): BrowserJobOrchestration {
  return useMemo(() => ({
    register: registerBrowserRuntimeJobController,
    unregister: unregisterBrowserRuntimeJobController,
    hasController: hasBrowserRuntimeJobController,
    getActiveJobIds: getActiveBrowserRuntimeJobIds,
    markCompleted: markBrowserRuntimeJobCompleted,
    clearCompleted: clearBrowserRuntimeJobCompleted,
    isCompleted: isBrowserRuntimeJobCompleted,
    abortAll: abortAllBrowserRuntimeJobs,
  }), []);
}