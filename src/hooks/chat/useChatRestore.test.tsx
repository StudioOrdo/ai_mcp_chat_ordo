// @vitest-environment jsdom

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatRestore } from "./useChatRestore";
import type { ChatAction } from "./chatState";

const {
  restoreActiveWorkspaceMock,
  restoreWorkspaceByConversationIdMock,
} = vi.hoisted(() => ({
  restoreActiveWorkspaceMock: vi.fn(),
  restoreWorkspaceByConversationIdMock: vi.fn(),
}));

vi.mock("./workspaceRestoreApi", () => ({
  restoreActiveWorkspace: restoreActiveWorkspaceMock,
  restoreWorkspaceByConversationId: restoreWorkspaceByConversationIdMock,
  isTransientWorkspaceRestoreStatus: (status: string) => status === "network-error" || status === "aborted",
}));

function Harness(props: {
  dispatch: React.Dispatch<ChatAction>;
  setCurrentConversation: (value: unknown) => void;
  setConversationId: (value: string | null) => void;
  setIsLoadingMessages: (value: boolean) => void;
  setWorkspaceRestore: (value: unknown) => void;
}) {
  useChatRestore(props);
  return null;
}

describe("useChatRestore", () => {
  const dispatchMock = vi.fn();
  const setCurrentConversationMock = vi.fn();
  const setConversationIdMock = vi.fn();
  const setIsLoadingMessagesMock = vi.fn();
  const setWorkspaceRestoreMock = vi.fn();

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    dispatchMock.mockReset();
    setCurrentConversationMock.mockReset();
    setConversationIdMock.mockReset();
    setIsLoadingMessagesMock.mockReset();
    setWorkspaceRestoreMock.mockReset();
    restoreActiveWorkspaceMock.mockReset();
    restoreWorkspaceByConversationIdMock.mockReset();
  });

  it("keeps the selected conversation query param on transient restore failure", async () => {
    window.history.replaceState({}, "", "/?conversationId=conv_selected");
    restoreWorkspaceByConversationIdMock.mockResolvedValue({ status: "network-error" });

    render(
      <Harness
        dispatch={dispatchMock}
        setCurrentConversation={setCurrentConversationMock}
        setConversationId={setConversationIdMock}
        setIsLoadingMessages={setIsLoadingMessagesMock}
        setWorkspaceRestore={setWorkspaceRestoreMock}
      />,
    );

    await waitFor(() => {
      expect(setIsLoadingMessagesMock).toHaveBeenCalledWith(false);
    });

    expect(restoreWorkspaceByConversationIdMock).toHaveBeenCalledWith("conv_selected");
    expect(window.location.search).toBe("?conversationId=conv_selected");
    expect(setConversationIdMock).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});