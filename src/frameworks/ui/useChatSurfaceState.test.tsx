import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { useChatSurfaceState } from "@/frameworks/ui/useChatSurfaceState";

const { pushMock, openMock, chatState, setComposerTextMock, setConversationIdMock, refreshConversationMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  openMock: vi.fn(),
  chatState: {
    activeStreamId: null as string | null,
    messages: [],
    isSending: false,
    retryFailedMessage: vi.fn(),
    sendMessage: vi.fn(),
    stopStream: vi.fn(),
    conversationId: null as string | null,
    isLoadingMessages: false,
    setConversationId: vi.fn(),
    refreshConversation: vi.fn(),
  },
  setComposerTextMock: vi.fn(),
  setConversationIdMock: vi.fn(),
  refreshConversationMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/useGlobalChat", () => ({
  useGlobalChat: () => ({
    ...chatState,
    setConversationId: setConversationIdMock,
    refreshConversation: refreshConversationMock,
  }),
}));

vi.mock("@/hooks/useChatScroll", () => ({
  useChatScroll: () => ({
    scrollRef: { current: null },
    isAtBottom: true,
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
    resetPin: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMentions", () => ({
  useMentions: () => ({
    activeTrigger: null,
    suggestions: [],
    handleInput: vi.fn(),
    insertMention: vi.fn(() => ""),
  }),
}));

vi.mock("@/hooks/useUICommands", () => ({
  useUICommands: vi.fn(),
}));

vi.mock("@/hooks/useCommandRegistry", () => ({
  useCommandRegistry: () => ({
    executeCommand: vi.fn(() => false),
    findCommands: vi.fn(() => []),
  }),
}));

vi.mock("@/hooks/usePresentedChatMessages", () => ({
  usePresentedChatMessages: () => ({
    presentedMessages: [],
    dynamicSuggestions: [],
    scrollDependency: 0,
  }),
}));

vi.mock("@/hooks/chat/useChatComposerController", () => ({
  useChatComposerController: () => ({
    activeTrigger: null,
    canSend: false,
    handleFileDrop: vi.fn(),
    handleFileRemove: vi.fn(),
    handleFileSelect: vi.fn(),
    handleInputChange: vi.fn(),
    handleSend: vi.fn(),
    handleSuggestionSelect: vi.fn(),
    input: "",
    setComposerText: setComposerTextMock,
    mentionIndex: 0,
    pendingFiles: [],
    setMentionIndex: vi.fn(),
    suggestions: [],
  }),
}));

describe("handleActionClick", () => {
  beforeEach(() => {
    pushMock.mockReset();
    openMock.mockReset();
    setComposerTextMock.mockReset();
    setConversationIdMock.mockReset();
    refreshConversationMock.mockReset();
    chatState.activeStreamId = null;
    chatState.conversationId = null;
    vi.stubGlobal("open", openMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches route action via router.push for valid paths", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("route", "/library");
    });
    expect(pushMock).toHaveBeenCalledWith("/library");
  });

  it("rejects route action for external URLs (security)", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("route", "https://evil.com");
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("pre-fills composer text on send action without sending", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("send", "Draft advisory offer");
    });
    expect(setComposerTextMock).toHaveBeenCalledWith("Draft advisory offer");
    expect(chatState.sendMessage).not.toHaveBeenCalled();
  });

  it("falls back to params.text on send action when value is empty", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("send", "", { text: "Fallback text" });
    });
    expect(setComposerTextMock).toHaveBeenCalledWith("Fallback text");
  });

  it("navigates to library section on corpus action", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("corpus", "audit-to-sprint");
    });
    expect(pushMock).toHaveBeenCalledWith("/library/section/audit-to-sprint");
  });

  it("opens absolute external URLs in a new tab", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("external", "https://studioordo.com/r/mentor-42");
    });
    expect(openMock).toHaveBeenCalledWith(
      "https://studioordo.com/r/mentor-42",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("opens same-origin relative external URLs in a new tab", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("external", "/api/qr/mentor-42");
    });
    expect(openMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/qr/mentor-42",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("calls setConversationId and refreshConversation on conversation action", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("conversation", "conv_001");
    });
    expect(setConversationIdMock).toHaveBeenCalledWith("conv_001");
    expect(refreshConversationMock).toHaveBeenCalledWith("conv_001");
  });

  it("shows confirmation dialog when switching from an active conversation", () => {
    chatState.conversationId = "conv_existing";
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("conversation", "conv_new");
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(setConversationIdMock).toHaveBeenCalledWith("conv_new");
    expect(refreshConversationMock).toHaveBeenCalledWith("conv_new");
    confirmSpy.mockRestore();
  });

  it("does not switch conversation when user declines confirmation", () => {
    chatState.conversationId = "conv_existing";
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("conversation", "conv_new");
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(setConversationIdMock).not.toHaveBeenCalled();
    expect(refreshConversationMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("is a no-op when conversation action has empty ID", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
    act(() => {
      result.current.handleActionClick("conversation", "");
    });
    expect(setConversationIdMock).not.toHaveBeenCalled();
    expect(refreshConversationMock).not.toHaveBeenCalled();
  });

  it("posts job actions and refreshes the conversation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job: { conversationId: "conv_jobs" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));

    await act(async () => {
      result.current.handleActionClick("job", "job_123", { operation: "retry" });
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/chat/jobs/job_123", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "retry" }),
    });
    expect(refreshConversationMock).toHaveBeenCalledWith("conv_jobs");
  });

  it("ignores synthetic browser job actions without hitting the deferred-job endpoint", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));

    await act(async () => {
      result.current.handleActionClick("job", "browser:msg_327c35df-7bb6-48e5-94a8-ef0cd3f2f927:compose_media:18", { operation: "retry" });
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshConversationMock).not.toHaveBeenCalled();
  });

  it("surfaces stop controls while a stream is active", () => {
    chatState.activeStreamId = "stream_live_1";

    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));

    expect(result.current.canStopStream).toBe(true);
    expect(result.current.contentProps.canStopStream).toBe(true);
    expect(result.current.contentProps.onStopStream).toBe(chatState.stopStream);
  });

  it("splits conversation data actions into header props and keeps strip data in content props", () => {
    const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));

    expect(result.current.headerProps.canCopyTranscript).toBe(false);
    expect(result.current.headerProps.canExportConversation).toBe(false);
    expect(result.current.headerProps.canImportConversation).toBe(true);
    expect(result.current.headerProps.onCopyTranscript).toBeTypeOf("function");
    expect("onCopyTranscript" in result.current.contentProps).toBe(false);
    expect("onExportConversation" in result.current.contentProps).toBe(false);
    expect("onImportConversationFile" in result.current.contentProps).toBe(false);
    expect(result.current.contentProps.progressStripItems).toEqual([]);
  });

  describe("action dispatch security", () => {
    it("ignores route action with protocol-relative URL", () => {
      const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
      act(() => {
        result.current.handleActionClick("route", "//evil.com");
      });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("rejects external action with javascript URL", () => {
      const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
      act(() => {
        result.current.handleActionClick("external", "javascript:alert(1)");
      });
      expect(openMock).not.toHaveBeenCalled();
    });

    it("rejects external action with protocol-relative URL", () => {
      const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
      act(() => {
        result.current.handleActionClick("external", "//evil.com/attack");
      });
      expect(openMock).not.toHaveBeenCalled();
    });

    it("ignores conversation action with undefined params", () => {
      const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
      act(() => {
        result.current.handleActionClick("conversation", "", undefined);
      });
      expect(setConversationIdMock).not.toHaveBeenCalled();
      expect(refreshConversationMock).not.toHaveBeenCalled();
    });

    it("sets empty string on send action with empty value and no params.text", () => {
      const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
      act(() => {
        result.current.handleActionClick("send", "", {});
      });
      expect(setComposerTextMock).toHaveBeenCalledWith("");
    });

    it("does not crash on unknown action type", () => {
      const { result } = renderHook(() => useChatSurfaceState({ isEmbedded: false }));
      expect(() => {
        act(() => {
          result.current.handleActionClick("unknown" as never, "value");
        });
      }).not.toThrow();
      expect(pushMock).not.toHaveBeenCalled();
      expect(setComposerTextMock).not.toHaveBeenCalled();
      expect(setConversationIdMock).not.toHaveBeenCalled();
    });
  });
});
