import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import {
  resetBrowserJobOrchestrationForTests,
  useBrowserJobOrchestration,
} from "./useBrowserJobOrchestration";

describe("useBrowserJobOrchestration", () => {
  beforeEach(() => {
    resetBrowserJobOrchestrationForTests();
  });

  afterEach(() => {
    resetBrowserJobOrchestrationForTests();
  });

  it("registers and unregisters controllers", () => {
    const { result } = renderHook(() => useBrowserJobOrchestration());
    const controller = new AbortController();

    result.current.register("job-1", controller);
    expect(result.current.hasController("job-1")).toBe(true);

    result.current.unregister("job-1");
    expect(result.current.hasController("job-1")).toBe(false);
  });

  it("tracks completion markers independently from active controllers", () => {
    const { result } = renderHook(() => useBrowserJobOrchestration());

    result.current.markCompleted("job-2");
    expect(result.current.isCompleted("job-2")).toBe(true);

    result.current.clearCompleted("job-2");
    expect(result.current.isCompleted("job-2")).toBe(false);
  });

  it("survives a transient remount without aborting active jobs", () => {
    const first = renderHook(() => useBrowserJobOrchestration());
    const controller = new AbortController();

    first.result.current.register("job-3", controller);
    first.unmount();

    const second = renderHook(() => useBrowserJobOrchestration());
    expect(controller.signal.aborted).toBe(false);
    expect(second.result.current.hasController("job-3")).toBe(true);
  });

  it("aborts the previous controller when the same job is re-registered", () => {
    const { result } = renderHook(() => useBrowserJobOrchestration());
    const first = new AbortController();
    const second = new AbortController();

    result.current.register("job-4", first);
    result.current.register("job-4", second);

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
  });

  it("aborts all controllers and remains reusable afterward", () => {
    const { result } = renderHook(() => useBrowserJobOrchestration());
    const first = new AbortController();
    const second = new AbortController();

    result.current.register("job-5", first);
    result.current.register("job-6", second);
    result.current.abortAll();

    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    expect(result.current.getActiveJobIds()).toEqual(new Set());

    const replacement = new AbortController();
    result.current.register("job-7", replacement);
    expect(result.current.hasController("job-7")).toBe(true);
  });
});