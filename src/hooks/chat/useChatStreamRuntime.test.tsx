import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatStreamRuntime } from "@/hooks/chat/useChatStreamRuntime";

const { fetchStreamMock } = vi.hoisted(() => ({
  fetchStreamMock: vi.fn(),
}));

vi.mock("@/adapters/StreamProviderFactory", () => ({
  getChatStreamProvider: () => ({
    fetchStream: fetchStreamMock,
  }),
}));

describe("useChatStreamRuntime", () => {
  afterEach(() => {
    fetchStreamMock.mockReset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("batches contiguous text deltas and flushes before a tool event", async () => {
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "text", delta: "Hel" };
        yield { type: "text", delta: "lo" };
        yield { type: "tool_call", name: "search", args: { q: "plan" } };
        yield { type: "done" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_1",
      currentPathname: "/register",
      dispatch,
      setConversationId,
    }));

    const resolved = await result.current.runStream([], 2, []);

    expect(fetchStreamMock).toHaveBeenCalledWith([], {
      conversationId: "conv_1",
      currentPathname: "/register",
      attachments: [],
      taskOriginHandoff: undefined,
      mediaContinuityHandoff: undefined,
    });

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "APPEND_TEXT",
      index: 2,
      delta: "Hello",
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "APPEND_TOOL_CALL",
      index: 2,
      name: "search",
      args: { q: "plan" },
    });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(setConversationId).not.toHaveBeenCalled();
    expect(result.current.activeStreamId).toBeNull();
    expect(resolved.didReceiveTextDelta).toBe(true);
  });

  it("flushes pending text at stream completion and preserves conversation id updates", async () => {
    vi.useFakeTimers();

    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "conversation_id", id: "conv_new" };
        yield { type: "text", delta: "Hi" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: null,
      currentPathname: "/library",
      dispatch,
      setConversationId,
    }));

    const runPromise = result.current.runStream([], 0, []);
    await vi.runAllTimersAsync();
    const resolvedStream = await runPromise;

    expect(setConversationId).toHaveBeenCalledWith("conv_new");
    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TEXT",
      index: 0,
      delta: "Hi",
    });
    expect(resolvedStream.conversationId).toBe("conv_new");
    expect(resolvedStream.didReceiveTextDelta).toBe(true);
  });

  it("reports when a completed stream produced no live text deltas", async () => {
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "tool_call", name: "calculator", args: { expression: "3+3" } };
        yield { type: "tool_result", name: "calculator", result: 6 };
        yield { type: "done" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_3",
      currentPathname: "/",
      dispatch,
      setConversationId,
    }));

    const resolved = await result.current.runStream([], 1, []);

    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TOOL_CALL",
      index: 1,
      name: "calculator",
      args: { expression: "3+3" },
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TOOL_RESULT",
      index: 1,
      name: "calculator",
      result: 6,
    });
    expect(resolved.didReceiveTextDelta).toBe(false);
  });

  it("does not dispatch half-finished action-link syntax during streaming", async () => {
    vi.useFakeTimers();

    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "text", delta: "Primary: [The Magi" };
        yield { type: "text", delta: "cian](?corpus=ch06-the-magician)" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_stream",
      currentPathname: "/library",
      dispatch,
      setConversationId,
    }));

    const runPromise = result.current.runStream([], 1, []);
    await vi.runAllTimersAsync();
    await runPromise;

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "APPEND_TEXT",
      index: 1,
      delta: "Primary: [The Magician](?corpus=ch06-the-magician)",
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "APPEND_TEXT",
      index: 1,
      delta: "Primary: [The Magi",
    });
  });

  it("forwards a provided current page snapshot to the stream adapter", async () => {
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "done" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_2",
      currentPathname: "/library",
      dispatch,
      setConversationId,
    }));

    await result.current.runStream(
      [{ role: "user", content: "What page am I on?" }],
      1,
      [],
      undefined,
      {
        pathname: "/library",
        title: "Library — 10 Books, 104 Chapters | Studio Ordo",
        mainHeading: "Structured reference for the operator system.",
        sectionHeadings: [],
        selectedText: null,
        contentExcerpt: "The library packages system docs, books, and reusable reference material into chapter-level routes.",
      },
    );

    expect(fetchStreamMock).toHaveBeenCalledWith(
      [{ role: "user", content: "What page am I on?" }],
      {
        conversationId: "conv_2",
        currentPathname: "/library",
        currentPageSnapshot: {
          pathname: "/library",
          title: "Library — 10 Books, 104 Chapters | Studio Ordo",
          mainHeading: "Structured reference for the operator system.",
          sectionHeadings: [],
          selectedText: null,
          contentExcerpt: "The library packages system docs, books, and reusable reference material into chapter-level routes.",
        },
        attachments: [],
        taskOriginHandoff: undefined,
        mediaContinuityHandoff: undefined,
      },
    );
  });

  it("forwards media continuity handoff payloads to the stream adapter", async () => {
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "done" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_media",
      currentPathname: "/chat",
      dispatch,
      setConversationId,
    }));

    await result.current.runStream(
      [{ role: "user", content: "combine them into a video" }],
      1,
      [],
      undefined,
      undefined,
      {
        assets: [
          { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
          { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
        ],
      },
    );

    expect(fetchStreamMock).toHaveBeenCalledWith(
      [{ role: "user", content: "combine them into a video" }],
      {
        conversationId: "conv_media",
        currentPathname: "/chat",
        attachments: [],
        taskOriginHandoff: undefined,
        mediaContinuityHandoff: {
          assets: [
            { assetId: "uf_chart_1", kind: "chart", aliases: ["growth chart"] },
            { assetId: "uf_audio_1", kind: "audio", aliases: ["growth narration"] },
          ],
        },
      },
    );
  });

  it("tracks the active stream id from the handshake and clears it when the stream settles", async () => {
    let releaseStream: (() => void) | null = null;
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "stream_id", id: "stream_live_42" };
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
        yield { type: "done" };
      },
    });

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_2",
      currentPathname: "/library",
      dispatch,
      setConversationId,
    }));

    let runPromise: Promise<{ conversationId: string | null }>;
    await act(async () => {
      runPromise = result.current.runStream([], 0, []);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeStreamId).toBe("stream_live_42");
    });

    await act(async () => {
      releaseStream?.();
      await runPromise;
    });

    await waitFor(() => {
      expect(result.current.activeStreamId).toBeNull();
    });
  });

  it("posts stop requests for the active stream id", async () => {
    let releaseStream: (() => void) | null = null;
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "stream_id", id: "stream_stop_7" };
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
        yield { type: "done" };
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_2",
      currentPathname: "/library",
      dispatch,
      setConversationId,
    }));

    let runPromise: Promise<{ conversationId: string | null }>;
    await act(async () => {
      runPromise = result.current.runStream([], 0, []);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeStreamId).toBe("stream_stop_7");
    });

    await expect(result.current.stopStream()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/chat/streams/stream_stop_7/stop", {
      method: "POST",
    });

    await act(async () => {
      releaseStream?.();
      await runPromise;
    });
  });

  it("returns a structured error when the stop request fails", async () => {
    let releaseStream: (() => void) | null = null;
    fetchStreamMock.mockResolvedValue({
      async *events() {
        yield { type: "stream_id", id: "stream_stop_8" };
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
        yield { type: "done" };
      },
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const { result } = renderHook(() => useChatStreamRuntime({
      conversationId: "conv_2",
      currentPathname: "/library",
      dispatch,
      setConversationId,
    }));

    let runPromise: Promise<{ conversationId: string | null }>;
    await act(async () => {
      runPromise = result.current.runStream([], 0, []);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeStreamId).toBe("stream_stop_8");
    });

    await expect(result.current.stopStream()).resolves.toEqual({
      ok: false,
      error: "network down",
    });

    await act(async () => {
      releaseStream?.();
      await runPromise;
    });
  });
});