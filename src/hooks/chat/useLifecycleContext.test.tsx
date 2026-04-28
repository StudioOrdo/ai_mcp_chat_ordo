import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatAction } from "@/hooks/chat/chatState";
import { useLifecycleContext } from "./useLifecycleContext";

const fetchMock = vi.fn();

describe("useLifecycleContext", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("does not fetch for ANONYMOUS role", () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    renderHook(() => useLifecycleContext("ANONYMOUS", dispatch));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not fetch when canResolve is false", () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    renderHook(() => useLifecycleContext("APPRENTICE", dispatch, false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fetches once and appends system messages for each pending event", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            lifecycle: {
              schemaVersion: 1,
              toolName: "lifecycle_event",
              family: "system",
              cardKind: "lifecycle",
              executionMode: "inline",
              inputSnapshot: {},
              summary: { title: "Install complete" },
              payload: { variant: "installed", occurredAt: "2026-04-22T00:00:00Z" },
            },
            coach: {
              schemaVersion: 1,
              toolName: "coach_sequence",
              family: "system",
              cardKind: "lifecycle",
              executionMode: "inline",
              inputSnapshot: {},
              summary: { title: "Finish setup" },
              payload: {
                variant: "installed",
                title: "Finish setup",
                steps: [{ key: "one", label: "Step one", status: "active" }],
                currentStep: 0,
                actions: [],
              },
            },
          },
        ],
      }),
    });

    renderHook(() => useLifecycleContext("APPRENTICE", dispatch));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/lifecycle/context");
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    const call = dispatch.mock.calls[0]?.[0];
    expect(call?.type).toBe("APPEND_MESSAGES");
    if (call?.type === "APPEND_MESSAGES") {
      expect(call.messages).toHaveLength(2);
      expect(call.messages[0]?.role).toBe("system");
      expect(call.messages[0]?.metadata?.lifecycle).toBeDefined();
      expect(call.messages[1]?.role).toBe("system");
      expect(call.messages[1]?.metadata?.coach).toBeDefined();
    }
  });

  it("does not dispatch when items is empty", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    renderHook(() => useLifecycleContext("APPRENTICE", dispatch));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("skips the coach message when coach is null", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            lifecycle: {
              schemaVersion: 1,
              toolName: "lifecycle_event",
              family: "system",
              cardKind: "lifecycle",
              executionMode: "inline",
              inputSnapshot: {},
              summary: {},
              payload: { variant: "capability_unlocked", occurredAt: "2026-04-22T00:00:00Z" },
            },
            coach: null,
          },
        ],
      }),
    });
    renderHook(() => useLifecycleContext("APPRENTICE", dispatch));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled();
    });
    const call = dispatch.mock.calls[0]?.[0];
    if (call?.type === "APPEND_MESSAGES") {
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0]?.metadata?.coach).toBeUndefined();
    }
  });

  it("swallows fetch failures silently", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockRejectedValue(new Error("network down"));
    renderHook(() => useLifecycleContext("APPRENTICE", dispatch));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("only fetches once across re-renders", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    const { rerender } = renderHook(() => useLifecycleContext("APPRENTICE", dispatch));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    rerender();
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
