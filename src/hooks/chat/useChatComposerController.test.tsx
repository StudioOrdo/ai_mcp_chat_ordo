import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useChatComposerController } from "@/hooks/chat/useChatComposerController";

const { handleInputMock, insertMentionMock } = vi.hoisted(() => ({
  handleInputMock: vi.fn(),
  insertMentionMock: vi.fn(() => ""),
}));

vi.mock("@/hooks/useCommandRegistry", () => ({
  useCommandRegistry: () => ({
    executeCommand: vi.fn(() => false),
    findCommands: vi.fn(() => []),
  }),
}));

vi.mock("@/hooks/useMentions", () => ({
  useMentions: () => ({
    activeTrigger: null,
    suggestions: [],
    handleInput: handleInputMock,
    insertMention: insertMentionMock,
  }),
}));

function Harness({
  isSending = false,
  onSendMessage,
}: {
  isSending?: boolean;
  onSendMessage: (
    messageText: string,
    pendingFiles: File[],
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const controller = useChatComposerController({
    isSending,
    onSendMessage,
    textareaRef,
  });

  return (
    <div>
      <div data-testid="input">{controller.input}</div>
      <div data-testid="file-count">{controller.pendingFiles.length}</div>
      <div data-testid="can-send">{String(controller.canSend)}</div>
      <input
        aria-label="draft"
        value={controller.input}
        onChange={(event) => controller.handleInputChange(event.target.value, event.target.value.length)}
      />
      <input
        aria-label="files"
        type="file"
        multiple
        onChange={controller.handleFileSelect}
      />
      <button type="button" onClick={() => void controller.handleSend()}>
        send
      </button>
    </div>
  );
}

describe("useChatComposerController", () => {
  it("clears the composer only after a successful send", async () => {
    const onSendMessage = vi.fn().mockResolvedValue({ ok: true });

    render(<Harness onSendMessage={onSendMessage} />);

    fireEvent.change(screen.getByLabelText("draft"), {
      target: { value: "Ship the plan" },
    });
    fireEvent.change(screen.getByLabelText("files"), {
      target: { files: [new File(["brief"], "brief.txt", { type: "text/plain" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith(
        "Ship the plan",
        [expect.objectContaining({ name: "brief.txt" })],
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("input")).toHaveTextContent("");
      expect(screen.getByTestId("file-count")).toHaveTextContent("0");
    });
  });

  it("preserves draft and files when the send fails", async () => {
    const onSendMessage = vi.fn().mockResolvedValue({ ok: false, error: "Upload failed" });

    render(<Harness onSendMessage={onSendMessage} />);

    fireEvent.change(screen.getByLabelText("draft"), {
      target: { value: "Keep this draft" },
    });
    fireEvent.change(screen.getByLabelText("files"), {
      target: { files: [new File(["brief"], "brief.txt", { type: "text/plain" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith(
        "Keep this draft",
        [expect.objectContaining({ name: "brief.txt" })],
      );
    });

    expect(screen.getByTestId("input")).toHaveTextContent("Keep this draft");
    expect(screen.getByTestId("file-count")).toHaveTextContent("1");
  });

  it("keeps the composer cleared when the message was accepted but streaming was interrupted", async () => {
    const onSendMessage = vi.fn().mockResolvedValue({ ok: true });

    render(<Harness onSendMessage={onSendMessage} />);

    fireEvent.change(screen.getByLabelText("draft"), {
      target: { value: "Make an image about the LLM lament" },
    });

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith(
        "Make an image about the LLM lament",
        [],
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("input")).toHaveTextContent("");
      expect(screen.getByTestId("file-count")).toHaveTextContent("0");
    });
  });
});