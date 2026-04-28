import { describe, expect, it } from "vitest";

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

describe("browserRuntimeJobStore", () => {
  it("registers and unregisters controllers", () => {
    const controller = new AbortController();

    registerBrowserRuntimeJobController("job-1", controller);
    expect(hasBrowserRuntimeJobController("job-1")).toBe(true);

    unregisterBrowserRuntimeJobController("job-1");
    expect(hasBrowserRuntimeJobController("job-1")).toBe(false);
  });

  it("marks jobs completed independently from active controllers", () => {
    markBrowserRuntimeJobCompleted("job-2");
    expect(isBrowserRuntimeJobCompleted("job-2")).toBe(true);

    clearBrowserRuntimeJobCompleted("job-2");
    expect(isBrowserRuntimeJobCompleted("job-2")).toBe(false);
  });

  it("aborts a prior controller when the same job is re-registered", () => {
    const first = new AbortController();
    const second = new AbortController();

    registerBrowserRuntimeJobController("job-3", first);
    registerBrowserRuntimeJobController("job-3", second);

    expect(first.signal.aborted).toBe(true);
    expect(hasBrowserRuntimeJobController("job-3")).toBe(true);
  });

  it("aborts all controllers without dropping completed markers", () => {
    const first = new AbortController();
    const second = new AbortController();

    registerBrowserRuntimeJobController("job-4", first);
    registerBrowserRuntimeJobController("job-5", second);
    markBrowserRuntimeJobCompleted("job-4");

    abortAllBrowserRuntimeJobs();

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(getActiveBrowserRuntimeJobIds()).toEqual(new Set());
    expect(isBrowserRuntimeJobCompleted("job-4")).toBe(true);
  });

  it("resets controllers and completion state for tests", () => {
    registerBrowserRuntimeJobController("job-6", new AbortController());
    markBrowserRuntimeJobCompleted("job-6");

    resetBrowserRuntimeJobStoreForTests();

    expect(getActiveBrowserRuntimeJobIds()).toEqual(new Set());
    expect(isBrowserRuntimeJobCompleted("job-6")).toBe(false);
  });
});