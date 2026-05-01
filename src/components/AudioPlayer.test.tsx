// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AudioPlayer } from "./AudioPlayer";
import React from "react";

describe("AudioPlayer", () => {
  let mockPlay: Mock;
  let audioInstances: Array<{
    emit: (event: string) => void;
  }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    audioInstances = [];

    mockPlay = vi.fn().mockResolvedValue(undefined);
    // Mock Audio
    class MockAudio {
      play = mockPlay;
      pause = vi.fn();
      currentTime = 0;
      duration = 100;
      private listeners = new Map<string, Array<() => void>>();

      constructor() {
        audioInstances.push(this);
      }

      addEventListener = vi.fn((event: string, handler: () => void) => {
        const handlers = this.listeners.get(event) ?? [];
        handlers.push(handler);
        this.listeners.set(event, handlers);
      });

      removeEventListener = vi.fn((event: string, handler: () => void) => {
        const handlers = this.listeners.get(event) ?? [];
        this.listeners.set(
          event,
          handlers.filter((candidate) => candidate !== handler),
        );
      });

      emit(event: string) {
        for (const handler of this.listeners.get(event) ?? []) {
          handler();
        }
      }
    }
    vi.stubGlobal("Audio", MockAudio);

    // Mock URL
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:test"),
      revokeObjectURL: vi.fn(),
    });

    // Mock IntersectionObserver
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor(
        _cb: IntersectionObserverCallback,
        _opts?: IntersectionObserverInit,
      ) {}
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("auto-fetches and plays audio on mount", async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([1, 2, 3]),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "Content-Length": "3" }),
        body: { getReader: () => mockReader },
      }),
    );

    render(<AudioPlayer title="Test Audio" text="Hello world" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tts", expect.any(Object));
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  it("handles fetch errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Failed to stream audio" }),
      }),
    );

    render(<AudioPlayer title="Test Audio" text="Hello world" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to stream audio/i)).toBeInTheDocument();
    });
    consoleErrorSpy.mockRestore();
  });

  it("shows estimated duration in subtitle while loading", () => {
    // Use a slow-resolving fetch to keep loading state active
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})),
    );

    render(<AudioPlayer title="Test Audio" text="Hello world this is a test of the audio player" />);

    expect(screen.getByText(/to generate/i)).toBeInTheDocument();
    expect(screen.getByText(/s audio/i)).toBeInTheDocument();
  });

  it("loads and plays on demand when autoPlay is disabled", async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([1, 2, 3]),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "Content-Length": "3" }),
        body: { getReader: () => mockReader },
      }),
    );

    render(<AudioPlayer title="Deferred Audio" text="Hello world" autoPlay={false} />);

    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tts", expect.any(Object));
      expect(mockPlay).toHaveBeenCalledTimes(1);
    });
  });

  it("falls back to blob loading when a stream reader is unavailable", async () => {
    const blobMock = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: null,
        blob: vi.fn().mockResolvedValue(blobMock),
      }),
    );

    render(<AudioPlayer title="Fallback Audio" text="Hello world" />);

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledWith(blobMock);
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  it("does not auto-play cached audio when autoPlay is disabled", async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([1, 2, 3]),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: { getReader: () => mockReader },
      }),
    );

    render(
      <AudioPlayer
        title="Cached Audio"
        text="Hello world"
        assetId="uf_audio"
        autoPlay={false}
      />,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/user-files/uf_audio");
    });

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("safely skips the off-screen observer when IntersectionObserver is unavailable", async () => {
    vi.unstubAllGlobals();

    mockPlay = vi.fn().mockResolvedValue(undefined);
    class MockAudioWithoutObserver {
      play = mockPlay;
      pause = vi.fn();
      currentTime = 0;
      duration = 100;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
    vi.stubGlobal("Audio", MockAudioWithoutObserver);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:test"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "Content-Length": "3" }),
        body: {
          getReader: () => ({
            read: vi
              .fn()
              .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      }),
    );

    render(<AudioPlayer title="Observerless Audio" text="Hello world" />);

    await waitFor(() => {
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  it("surfaces playback failures after audio generation", async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([1, 2, 3]),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "Content-Length": "3" }),
        body: { getReader: () => mockReader },
      }),
    );

    render(<AudioPlayer title="Blocked Audio" text="Hello world" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/tts", expect.any(Object));
      expect(audioInstances).toHaveLength(1);
    });

    await act(async () => {
      audioInstances[0]?.emit("error");
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Audio generated, but the browser could not load it/i),
      ).toBeInTheDocument();
    });
  });
});
