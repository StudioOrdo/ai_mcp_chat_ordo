import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/core/entities/chat-message";
import type { ChatAction } from "@/hooks/chat/chatState";
import { useChatSend, type FailedSendPayload } from "@/hooks/chat/useChatSend";
import type { CurrentPageMemento } from "@/lib/chat/CurrentPageMemento";
import type { AttachmentPart } from "@/lib/chat/message-attachments";

const {
  runStreamMock,
  uploadChatAttachmentsMock,
  cleanupChatAttachmentsMock,
} = vi.hoisted(() => ({
  runStreamMock: vi.fn(),
  uploadChatAttachmentsMock: vi.fn(),
  cleanupChatAttachmentsMock: vi.fn(),
}));

vi.mock("@/hooks/chat/useChatStreamRuntime", () => ({
  useChatStreamRuntime: () => ({
    activeStreamId: null,
    runStream: runStreamMock,
    stopStream: vi.fn(),
  }),
}));

vi.mock("@/hooks/chat/chatAttachmentApi", () => ({
  uploadChatAttachments: uploadChatAttachmentsMock,
  cleanupChatAttachments: cleanupChatAttachmentsMock,
}));

const mementoMock: CurrentPageMemento = {
  getSnapshot: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  setPathname: vi.fn(),
};

function Harness({
  conversationId = null,
  failedSendPayloads = [],
  messages = [],
  refreshConversation = vi.fn(),
  dispatchSpy = vi.fn() as unknown as React.Dispatch<ChatAction>,
  registerFailedSendSpy = vi.fn() as unknown as ((payload: FailedSendPayload) => void),
}: {
  conversationId?: string | null;
  failedSendPayloads?: Array<{
    retryKey: string;
    failedUserMessageId: string;
    messageText: string;
    attachments: AttachmentPart[];
  }>;
  messages?: ChatMessage[];
  refreshConversation?: (conversationIdOverride?: string | null) => Promise<void>;
  dispatchSpy?: React.Dispatch<ChatAction>;
  registerFailedSendSpy?: (payload: FailedSendPayload) => void;
}) {
  const setConversationId = vi.fn();
  const setIsSending = vi.fn();
  const failedSends = new Map(
    failedSendPayloads.map((payload) => [payload.retryKey, payload]),
  );

  const { sendMessage, retryFailedMessage } = useChatSend({
    conversationId,
    currentPathname: "/",
    memento: mementoMock,
    refreshConversation,
    dispatch: dispatchSpy,
    getFailedSend: (retryKey) => failedSends.get(retryKey),
    messages,
    registerFailedSend: (payload) => {
      registerFailedSendSpy(payload);
      failedSends.set(payload.retryKey, payload);
    },
    setConversationId,
    setIsSending,
    clearFailedSend: (retryKey) => {
      failedSends.delete(retryKey);
    },
  });

  return (
    <div>
      <button type="button" onClick={() => void sendMessage("Audit this workflow")}>send</button>
      <button type="button" onClick={() => void retryFailedMessage("user-1")}>retry</button>
    </div>
  );
}

describe("useChatSend", () => {
  beforeEach(() => {
    runStreamMock.mockReset();
    uploadChatAttachmentsMock.mockReset();
    cleanupChatAttachmentsMock.mockReset();
    (mementoMock.getSnapshot as ReturnType<typeof vi.fn>).mockReset();
    uploadChatAttachmentsMock.mockResolvedValue([]);
    cleanupChatAttachmentsMock.mockResolvedValue(undefined);
    (mementoMock.getSnapshot as ReturnType<typeof vi.fn>).mockReturnValue({
      pathname: "/",
      title: "Studio Ordo | All-in-One AI Operator System",
      mainHeading: null,
      sectionHeadings: [],
      selectedText: null,
      contentExcerpt: "Homepage content",
    });
  });

  it("does not refresh when streaming completes on the current conversation", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({ conversationId: "conv_existing" });

    render(
      <Harness
        conversationId="conv_existing"
        messages={[
          {
            id: "msg_1",
            role: "assistant",
            content: "Welcome",
            parts: [{ type: "text", text: "Welcome" }],
            timestamp: new Date("2026-03-23T10:00:00.000Z"),
          },
        ]}
        failedSendPayloads={[
          {
            retryKey: "user-1",
            failedUserMessageId: "user-1",
            messageText: "Audit this workflow",
            attachments: [],
          },
        ]}
        refreshConversation={refreshConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(runStreamMock).toHaveBeenCalledTimes(1);
    });

    expect(refreshConversation).not.toHaveBeenCalled();
  });

  it("refreshes the current conversation when the stream completed without live text deltas", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({ conversationId: "conv_existing", didReceiveTextDelta: false });

    render(
      <Harness
        conversationId="conv_existing"
        messages={[
          {
            id: "msg_1",
            role: "assistant",
            content: "Welcome",
            parts: [{ type: "text", text: "Welcome" }],
            timestamp: new Date("2026-03-23T10:00:00.000Z"),
          },
        ]}
        refreshConversation={refreshConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(refreshConversation).toHaveBeenCalledWith("conv_existing");
    });
  });

  it("refreshes when streaming creates or resolves a different conversation id", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({ conversationId: "conv_new" });

    render(<Harness refreshConversation={refreshConversation} />);

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(refreshConversation).toHaveBeenCalledWith("conv_new");
    });
  });

  it("retries a failed message in place instead of appending a duplicate user turn", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({ conversationId: "conv_existing" });

    render(
      <Harness
        conversationId="conv_existing"
        messages={[
          {
            id: "msg_0",
      mediaContinuityHandoff: null,
            role: "assistant",
            content: "Welcome",
            parts: [{ type: "text", text: "Welcome" }],
            timestamp: new Date("2026-03-24T10:00:00.000Z"),
          },
          {
            id: "user-1",
            role: "user",
            content: "Audit this workflow",
            parts: [{ type: "text", text: "Audit this workflow" }],
            timestamp: new Date("2026-03-24T10:01:00.000Z"),
          },
          {
            id: "assistant-failure",
            role: "assistant",
            content: "Provider unavailable",
            parts: [],
            metadata: {
              failedSend: {
                retryKey: "user-1",
                failedUserMessageId: "user-1",
              },
            },
            timestamp: new Date("2026-03-24T10:01:01.000Z"),
          },
        ]}
        failedSendPayloads={[
          {
            retryKey: "user-1",
            failedUserMessageId: "user-1",
            messageText: "Audit this workflow",
            attachments: [],
          },
        ]}
        refreshConversation={refreshConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => {
      expect(runStreamMock).toHaveBeenCalledTimes(1);
    });

    expect(runStreamMock).toHaveBeenCalledWith(
      [
        { role: "assistant", content: "Welcome" },
        { role: "user", content: "Audit this workflow" },
      ],
      2,
      [],
      undefined,
      {
        pathname: "/",
        title: "Studio Ordo | All-in-One AI Operator System",
        mainHeading: null,
        sectionHeadings: [],
        selectedText: null,
        contentExcerpt: "Homepage content",
      },
      null,
    );
    expect(refreshConversation).not.toHaveBeenCalled();
  });

  it("marks interrupted streams as retryable without replacing the assistant turn", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    const dispatchRecorder = vi.fn();
    const registerFailedSendRecorder = vi.fn();
    const dispatchSpy: React.Dispatch<ChatAction> = (action) => {
      dispatchRecorder(action);
    };
    const registerFailedSendSpy = (payload: FailedSendPayload) => {
      registerFailedSendRecorder(payload);
    };
    runStreamMock.mockResolvedValue({
      conversationId: "conv_new",
      lifecycle: {
        status: "interrupted",
        actor: "system",
        reason: "Connection lost during streaming.",
        recordedAt: "2026-03-25T10:00:00.000Z",
      },
    });

    render(
      <Harness
        refreshConversation={refreshConversation}
        dispatchSpy={dispatchSpy}
        registerFailedSendSpy={registerFailedSendSpy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(registerFailedSendRecorder).toHaveBeenCalledTimes(1);
    });

    const replaceAllCalls = dispatchRecorder.mock.calls
      .map(([action]) => action)
      .filter((action) => action.type === "REPLACE_ALL");
    expect(replaceAllCalls).toHaveLength(1);

    const optimisticMessages = replaceAllCalls[0]?.messages as ChatMessage[];
    const failedUserMessageId = optimisticMessages[0]?.id;

    expect(registerFailedSendRecorder).toHaveBeenCalledWith({
      retryKey: failedUserMessageId,
      failedUserMessageId,
      messageText: "Audit this workflow",
      attachments: [],
      taskOriginHandoff: undefined,
      mediaContinuityHandoff: null,
    });
    expect(dispatchRecorder).toHaveBeenCalledWith({
      type: "SET_FAILED_SEND",
      index: 1,
      failedSend: {
        retryKey: failedUserMessageId,
        failedUserMessageId,
      },
    });
    expect(refreshConversation).toHaveBeenCalledWith("conv_new");
  });

  it("refreshes the current conversation when an interrupted stream produced no live text delta", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({
      conversationId: "conv_existing",
      didReceiveTextDelta: false,
      lifecycle: {
        status: "interrupted",
        actor: "system",
        reason: "Connection lost during streaming.",
        recordedAt: "2026-03-25T10:00:00.000Z",
      },
    });

    render(
      <Harness
        conversationId="conv_existing"
        messages={[
          {
            id: "msg_1",
            role: "assistant",
            content: "Welcome",
            parts: [{ type: "text", text: "Welcome" }],
            timestamp: new Date("2026-03-23T10:00:00.000Z"),
          },
        ]}
        refreshConversation={refreshConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => {
      expect(refreshConversation).toHaveBeenCalledWith("conv_existing");
    });
  });

  it("retries restored interrupted sends with persisted attachments and no reupload", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({ conversationId: "conv_existing" });

    const persistedAttachment: AttachmentPart = {
      type: "attachment",
      assetId: "asset_1",
      fileName: "brief.txt",
      mimeType: "text/plain",
      fileSize: 128,
    };

    render(
      <Harness
        conversationId="conv_existing"
        messages={[
          {
            id: "msg_0",
            role: "assistant",
            content: "Welcome",
            parts: [{ type: "text", text: "Welcome" }],
            timestamp: new Date("2026-03-24T10:00:00.000Z"),
          },
          {
            id: "user-1",
            role: "user",
            content: "Audit this workflow",
            parts: [
              { type: "text", text: "Audit this workflow" },
              persistedAttachment,
            ],
            timestamp: new Date("2026-03-24T10:01:00.000Z"),
          },
          {
            id: "assistant-failure",
            role: "assistant",
            content: "Partial answer",
            parts: [
              { type: "text", text: "Partial answer" },
              {
                type: "generation_status",
                status: "interrupted",
                actor: "system",
                reason: "Connection lost during streaming.",
                partialContentRetained: true,
              },
            ],
            metadata: {
              failedSend: {
                retryKey: "user-1",
                failedUserMessageId: "user-1",
              },
            },
            timestamp: new Date("2026-03-24T10:01:01.000Z"),
          },
        ]}
        failedSendPayloads={[
          {
            retryKey: "user-1",
            failedUserMessageId: "user-1",
            messageText: "Audit this workflow",
            attachments: [persistedAttachment],
          },
        ]}
        refreshConversation={refreshConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => {
      expect(runStreamMock).toHaveBeenCalledTimes(1);
    });

    expect(uploadChatAttachmentsMock).not.toHaveBeenCalled();
    expect(runStreamMock).toHaveBeenCalledWith(
      [
        { role: "assistant", content: "Welcome" },
        { role: "user", content: "Audit this workflow" },
      ],
      2,
      [persistedAttachment],
      undefined,
      {
        pathname: "/",
        title: "Studio Ordo | All-in-One AI Operator System",
        mainHeading: null,
        sectionHeadings: [],
        selectedText: null,
        contentExcerpt: "Homepage content",
      },
      null,
    );
    expect(refreshConversation).not.toHaveBeenCalled();
  });

  it("reconstructs retry payloads from restored messages when the registry is cold", async () => {
    const refreshConversation = vi.fn().mockResolvedValue(undefined);
    runStreamMock.mockResolvedValue({ conversationId: "conv_existing" });

    render(
      <Harness
        conversationId="conv_existing"
        messages={[
          {
            id: "msg_0",
            role: "assistant",
            content: "Welcome",
            parts: [{ type: "text", text: "Welcome" }],
            timestamp: new Date("2026-03-24T10:00:00.000Z"),
          },
          {
            id: "user-1",
            role: "user",
            content: "Recover this after interruption.",
            parts: [{ type: "text", text: "Recover this after interruption." }],
            timestamp: new Date("2026-03-24T10:01:00.000Z"),
          },
          {
            id: "assistant-failure",
            role: "assistant",
            content: "Partial interrupted answer.",
            parts: [
              { type: "text", text: "Partial interrupted answer." },
              {
                type: "generation_status",
                status: "interrupted",
                actor: "system",
                reason: "Connection lost.",
                partialContentRetained: true,
              },
            ],
            metadata: {
              failedSend: {
                retryKey: "user-1",
                failedUserMessageId: "user-1",
              },
            },
            timestamp: new Date("2026-03-24T10:01:01.000Z"),
          },
        ]}
        refreshConversation={refreshConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => {
      expect(runStreamMock).toHaveBeenCalledTimes(1);
    });

    expect(runStreamMock).toHaveBeenCalledWith(
      [
        { role: "assistant", content: "Welcome" },
        { role: "user", content: "Recover this after interruption." },
      ],
      2,
      [],
      undefined,
      {
        pathname: "/",
        title: "Studio Ordo | All-in-One AI Operator System",
        mainHeading: null,
        sectionHeadings: [],
        selectedText: null,
        contentExcerpt: "Homepage content",
      },
      null,
    );
    expect(refreshConversation).not.toHaveBeenCalled();
  });
});