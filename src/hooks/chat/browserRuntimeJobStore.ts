const ACTIVE_BROWSER_RUNTIME_CONTROLLERS = new Map<string, AbortController>();
const COMPLETED_BROWSER_RUNTIME_JOBS = new Set<string>();

export function registerBrowserRuntimeJobController(jobId: string, controller: AbortController): void {
  const existing = ACTIVE_BROWSER_RUNTIME_CONTROLLERS.get(jobId);
  if (existing && existing !== controller) {
    existing.abort(new Error(`Browser runtime job ${jobId} was replaced by a newer controller.`));
  }

  ACTIVE_BROWSER_RUNTIME_CONTROLLERS.set(jobId, controller);
}

export function unregisterBrowserRuntimeJobController(jobId: string): void {
  ACTIVE_BROWSER_RUNTIME_CONTROLLERS.delete(jobId);
}

export function hasBrowserRuntimeJobController(jobId: string): boolean {
  return ACTIVE_BROWSER_RUNTIME_CONTROLLERS.has(jobId);
}

export function getActiveBrowserRuntimeJobIds(): Set<string> {
  return new Set(ACTIVE_BROWSER_RUNTIME_CONTROLLERS.keys());
}

export function markBrowserRuntimeJobCompleted(jobId: string): void {
  COMPLETED_BROWSER_RUNTIME_JOBS.add(jobId);
}

export function clearBrowserRuntimeJobCompleted(jobId: string): void {
  COMPLETED_BROWSER_RUNTIME_JOBS.delete(jobId);
}

export function isBrowserRuntimeJobCompleted(jobId: string): boolean {
  return COMPLETED_BROWSER_RUNTIME_JOBS.has(jobId);
}

export function abortAllBrowserRuntimeJobs(): void {
  for (const controller of ACTIVE_BROWSER_RUNTIME_CONTROLLERS.values()) {
    controller.abort();
  }
  ACTIVE_BROWSER_RUNTIME_CONTROLLERS.clear();
}

export function resetBrowserRuntimeJobStoreForTests(): void {
  abortAllBrowserRuntimeJobs();
  COMPLETED_BROWSER_RUNTIME_JOBS.clear();
}