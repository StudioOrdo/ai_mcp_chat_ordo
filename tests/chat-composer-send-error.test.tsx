import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useChatComposerController } from "@/hooks/chat/useChatComposerController";

vi.mock("@/hooks/useMentions", () => ({
  useMentions: () => ({
    activeTrigger: null,
    query: "",
    suggestions: [],
    handleInput: vi.fn(),
    insertMention: vi.fn(() => ""),
  }),
}));

vi.mock("@/hooks/useCommandRegistry", () => ({
  useCommandRegistry: () => ({
    executeCommand: vi.fn(() => false),
    findCommands: vi.fn(() => []),
  }),
}));

describe("handleSend error handling", () => {
  it("CCH-T255: restores draft when onSendMessage rejects", async () => {
    const errorSpy = vi.fn();
    const sendMessage = vi.fn().mockRejectedValue(new Error("Network failure"));
    const textareaRef = { current: null };

    const { result } = renderHook(() =>
      useChatComposerController({
        isSending: false,
        onSendMessage: sendMessage,
        onSendError: errorSpy,
        textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
      }),
    );

    // Type a message
    act(() => { result.current.handleInputChange("Hello world", 11); });
    expect(result.current.input).toBe("Hello world");

    // Send — will reject
    await act(async () => { await result.current.handleSend(); });

    // Draft should be restored
    expect(result.current.input).toBe("Hello world");
    expect(errorSpy).toHaveBeenCalledWith("Network failure");
  });

  it("CCH-T257: handleSend is a no-op when canSend is false", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    const textareaRef = { current: null };

    const { result } = renderHook(() =>
      useChatComposerController({
        isSending: false,
        onSendMessage: sendMessage,
        textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
      }),
    );

    // Don't type anything — canSend is false with empty input
    await act(async () => { await result.current.handleSend(); });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("CCH-T260: handleSend is a no-op when isSending is true", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    const textareaRef = { current: null };

    const { result } = renderHook(() =>
      useChatComposerController({
        isSending: true,
        onSendMessage: sendMessage,
        textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
      }),
    );

    act(() => { result.current.handleInputChange("Message", 7); });
    await act(async () => { await result.current.handleSend(); });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("CCH-T262: synchronous throw is caught", async () => {
    const errorSpy = vi.fn();
    const sendMessage = vi.fn().mockImplementation(() => {
      throw new Error("Sync boom");
    });
    const textareaRef = { current: null };

    const { result } = renderHook(() =>
      useChatComposerController({
        isSending: false,
        onSendMessage: sendMessage,
        onSendError: errorSpy,
        textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
      }),
    );

    act(() => { result.current.handleInputChange("Will explode", 12); });
    await act(async () => { await result.current.handleSend(); });

    expect(result.current.input).toBe("Will explode");
    expect(errorSpy).toHaveBeenCalledWith("Sync boom");
  });

  it("calls onSendError when server returns { ok: false, error }", async () => {
    const errorSpy = vi.fn();
    const sendMessage = vi.fn().mockResolvedValue({ ok: false, error: "Rate limited" });
    const textareaRef = { current: null };

    const { result } = renderHook(() =>
      useChatComposerController({
        isSending: false,
        onSendMessage: sendMessage,
        onSendError: errorSpy,
        textareaRef: textareaRef as React.RefObject<HTMLTextAreaElement | null>,
      }),
    );

    act(() => { result.current.handleInputChange("Test message", 12); });
    await act(async () => { await result.current.handleSend(); });

    expect(result.current.input).toBe("Test message");
    expect(errorSpy).toHaveBeenCalledWith("Rate limited");
  });
});
