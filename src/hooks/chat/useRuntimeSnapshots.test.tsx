import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useRuntimeSnapshots } from "./useRuntimeSnapshots";
import { clearPersistedBrowserRuntimeEntries } from "@/lib/media/browser-runtime/browser-runtime-state";

describe("useRuntimeSnapshots", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearPersistedBrowserRuntimeEntries();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    clearPersistedBrowserRuntimeEntries();
  });

  it("persists and restores snapshots by jobId", () => {
    const { result } = renderHook(() => useRuntimeSnapshots("conv-1"));

    result.current.persist({
      jobId: "job-1",
      toolName: "compose_media",
      conversationId: "conv-1",
      status: "running",
      updatedAt: "2026-04-24T10:00:00.000Z",
    });

    expect(result.current.restore("job-1")).toEqual(expect.objectContaining({
      conversationId: "conv-1",
      status: "running",
    }));
  });

  it("keeps different jobs isolated", () => {
    const { result } = renderHook(() => useRuntimeSnapshots("conv-1"));

    result.current.persist({
      jobId: "job-1",
      toolName: "compose_media",
      conversationId: "conv-1",
      status: "queued",
      updatedAt: "2026-04-24T10:00:00.000Z",
    });
    result.current.persist({
      jobId: "job-2",
      toolName: "generate_audio",
      conversationId: "conv-1",
      status: "running",
      updatedAt: "2026-04-24T10:00:01.000Z",
    });

    expect(result.current.restore("job-1")?.toolName).toBe("compose_media");
    expect(result.current.restore("job-2")?.toolName).toBe("generate_audio");
  });

  it("purges the previous conversation snapshot set when conversationId changes", () => {
    const { result, rerender } = renderHook(
      ({ conversationId }) => useRuntimeSnapshots(conversationId),
      { initialProps: { conversationId: "conv-1" as string | null } },
    );

    result.current.persist({
      jobId: "job-1",
      toolName: "compose_media",
      conversationId: "conv-1",
      status: "running",
      updatedAt: "2026-04-24T10:00:00.000Z",
    });

    rerender({ conversationId: "conv-2" });

    expect(result.current.restore("job-1")).toBeNull();
    expect(result.current.list()).toEqual([]);
  });

  it("removes a single snapshot without touching others", () => {
    const { result } = renderHook(() => useRuntimeSnapshots("conv-1"));

    result.current.persist({
      jobId: "job-1",
      toolName: "compose_media",
      conversationId: "conv-1",
      status: "running",
      updatedAt: "2026-04-24T10:00:00.000Z",
    });
    result.current.persist({
      jobId: "job-2",
      toolName: "generate_chart",
      conversationId: "conv-1",
      status: "queued",
      updatedAt: "2026-04-24T10:00:01.000Z",
    });

    result.current.remove("job-1");

    expect(result.current.restore("job-1")).toBeNull();
    expect(result.current.restore("job-2")).not.toBeNull();
  });
});