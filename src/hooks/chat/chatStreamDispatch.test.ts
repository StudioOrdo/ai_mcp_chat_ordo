import { describe, expect, it, vi } from "vitest";

import { createChatStreamDispatcher } from "./chatStreamDispatch";

describe("chatStreamDispatch", () => {
  it("routes conversation-id updates through setConversationId and tracks the resolved id", () => {
    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const setStreamId = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: "conv_initial",
      dispatch,
      setConversationId,
      setStreamId,
    });

    streamDispatch.dispatchStreamAction({ type: "SET_CONVERSATION_ID", conversationId: "conv_new" });

    expect(setConversationId).toHaveBeenCalledWith("conv_new");
    expect(setStreamId).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(streamDispatch.getResolvedConversationId()).toBe("conv_new");
  });

  it("routes stream-id updates through setStreamId and tracks the resolved stream id", () => {
    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const setStreamId = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: "conv_initial",
      dispatch,
      setConversationId,
      setStreamId,
    });

    streamDispatch.dispatchStreamAction({ type: "SET_STREAM_ID", streamId: "stream_live_1" });

    expect(setStreamId).toHaveBeenCalledWith("stream_live_1");
    expect(setConversationId).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(streamDispatch.getResolvedStreamId()).toBe("stream_live_1");
  });

  it("forwards non-conversation actions to the reducer dispatch", () => {
    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const setStreamId = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: null,
      dispatch,
      setConversationId,
      setStreamId,
    });

    streamDispatch.dispatchStreamAction({ type: "APPEND_TEXT", index: 2, delta: "Hello" });

    expect(dispatch).toHaveBeenCalledWith({ type: "APPEND_TEXT", index: 2, delta: "Hello" });
    expect(setConversationId).not.toHaveBeenCalled();
    expect(setStreamId).not.toHaveBeenCalled();
    expect(streamDispatch.getResolvedConversationId()).toBeNull();
    expect(streamDispatch.getResolvedStreamId()).toBeNull();
  });

  it("drops duplicate APPEND_TOOL_RESULT actions with the same dedupe identity", () => {
    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const setStreamId = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: "conv_initial",
      dispatch,
      setConversationId,
      setStreamId,
    });

    const duplicateAction = {
      type: "APPEND_TOOL_RESULT" as const,
      index: 0,
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      sourceMessageId: "msg_1",
      contentHash: "hash_audio_1",
    };

    streamDispatch.dispatchStreamAction(duplicateAction);
    streamDispatch.dispatchStreamAction(duplicateAction);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(duplicateAction);
  });

  it("keeps APPEND_TOOL_RESULT actions when source message differs", () => {
    const dispatch = vi.fn();
    const setConversationId = vi.fn();
    const setStreamId = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: "conv_initial",
      dispatch,
      setConversationId,
      setStreamId,
    });

    streamDispatch.dispatchStreamAction({
      type: "APPEND_TOOL_RESULT",
      index: 0,
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      sourceMessageId: "msg_1",
      contentHash: "hash_audio_1",
    });

    streamDispatch.dispatchStreamAction({
      type: "APPEND_TOOL_RESULT",
      index: 0,
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      sourceMessageId: "msg_2",
      contentHash: "hash_audio_1",
    });

    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("uses toolInvocationId as the primary tool result dedupe identity", () => {
    const dispatch = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: "conv_initial",
      dispatch,
      setConversationId: vi.fn(),
      setStreamId: vi.fn(),
    });

    streamDispatch.dispatchStreamAction({
      type: "APPEND_TOOL_RESULT",
      index: 0,
      name: "generate_audio",
      result: { assetId: "uf_audio_1" },
      toolInvocationId: "toolu_audio_1",
      sourceMessageId: "msg_1",
      contentHash: "hash_1",
    });
    streamDispatch.dispatchStreamAction({
      type: "APPEND_TOOL_RESULT",
      index: 0,
      name: "generate_audio",
      result: { assetId: "uf_audio_2" },
      toolInvocationId: "toolu_audio_1",
      sourceMessageId: "msg_2",
      contentHash: "hash_2",
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("keeps identical tool results when invocation ids differ", () => {
    const dispatch = vi.fn();
    const streamDispatch = createChatStreamDispatcher({
      initialConversationId: "conv_initial",
      dispatch,
      setConversationId: vi.fn(),
      setStreamId: vi.fn(),
    });

    for (const toolInvocationId of ["toolu_audio_1", "toolu_audio_2"]) {
      streamDispatch.dispatchStreamAction({
        type: "APPEND_TOOL_RESULT",
        index: 0,
        name: "generate_audio",
        result: { assetId: "uf_audio_1" },
        toolInvocationId,
      });
    }

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});