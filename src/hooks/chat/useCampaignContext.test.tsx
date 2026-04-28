import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatAction } from "@/hooks/chat/chatState";
import { useCampaignContext } from "./useCampaignContext";

const fetchMock = vi.fn();

function makeCoachItem() {
  return {
    coach: {
      schemaVersion: 1,
      toolName: "coach_sequence",
      family: "system",
      cardKind: "lifecycle",
      executionMode: "inline",
      inputSnapshot: {},
      summary: { title: "Friends and family" },
      payload: {
        variant: "campaign_picked",
        title: "Friends and family",
        steps: [{ key: "copy-link", label: "Copy your link", status: "active" }],
        currentStep: 0,
        actions: [
          {
            key: "open-referrals",
            kind: "navigate",
            label: "Open referrals",
            href: "/referrals",
          },
        ],
      },
    },
  };
}

describe("useCampaignContext (Phase 3)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("does not fetch for ANONYMOUS role", () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    renderHook(() => useCampaignContext("ANONYMOUS", dispatch));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not fetch when canResolve is false", () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    renderHook(() => useCampaignContext("AUTHENTICATED", dispatch, false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fetches once and appends a system coach message per item", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [makeCoachItem(), makeCoachItem()] }),
    });

    renderHook(() => useCampaignContext("AUTHENTICATED", dispatch));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/campaign/context");
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    const call = dispatch.mock.calls[0]?.[0];
    expect(call?.type).toBe("APPEND_MESSAGES");
    if (call?.type === "APPEND_MESSAGES") {
      expect(call.messages).toHaveLength(2);
      for (const message of call.messages) {
        expect(message.role).toBe("system");
        expect(message.metadata?.coach).toBeDefined();
      }
    }
  });

  it("does not dispatch when items is empty", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    renderHook(() => useCampaignContext("AUTHENTICATED", dispatch));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("swallows network errors without dispatching", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockRejectedValue(new Error("network down"));
    renderHook(() => useCampaignContext("AUTHENTICATED", dispatch));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("only fetches once across re-renders", async () => {
    const dispatch = vi.fn<(action: ChatAction) => void>();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    const { rerender } = renderHook(() =>
      useCampaignContext("AUTHENTICATED", dispatch),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    rerender();
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
