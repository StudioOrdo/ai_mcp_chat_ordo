import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserMock,
  getOpenaiApiKeyMock,
  lookupMock,
  storeMock,
  readFileMock,
  fetchMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  getOpenaiApiKeyMock: vi.fn(),
  lookupMock: vi.fn(),
  storeMock: vi.fn(),
  readFileMock: vi.fn(),
  fetchMock: vi.fn(),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  default: {
    readFile: readFileMock,
  },
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/config/env", () => ({
  getOpenaiApiKey: getOpenaiApiKeyMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/adapters/UserFileDataMapper", () => ({
  UserFileDataMapper: class UserFileDataMapper {},
}));

vi.mock("@/lib/user-files", () => ({
  UserFileSystem: class UserFileSystem {
    lookup = lookupMock;
    store = storeMock;
  },
}));

vi.mock("@/lib/observability/logger", () => ({
  createRequestId: vi.fn(() => "req_tts_test"),
  logEvent: vi.fn(),
  logFailure: vi.fn(),
}));

vi.mock("@/lib/observability/metrics", () => ({
  recordRouteMetric: vi.fn(),
}));

vi.mock("@/lib/observability/reason-codes", () => ({
  REASON_CODES: {
    TTS_PROVIDER_FAILED: "tts_provider_failed",
    TTS_TIMEOUT: "tts_timeout",
    UNKNOWN_ROUTE_ERROR: "unknown_route_error",
  },
}));

import { POST } from "@/app/api/tts/route";

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    getSessionUserMock.mockResolvedValue({ id: "usr_1", roles: ["AUTHENTICATED"] });
    getOpenaiApiKeyMock.mockReturnValue("test-openai-key");
    lookupMock.mockResolvedValue(null);
    storeMock.mockResolvedValue({ id: "uf_generated_1" });
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects anonymous audio generation", async () => {
    getSessionUserMock.mockResolvedValueOnce({ id: "anon", roles: ["ANONYMOUS"] });

    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello world" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves cached audio assets without regenerating them", async () => {
    readFileMock.mockResolvedValueOnce(Buffer.from("cached-audio"));
    lookupMock.mockResolvedValueOnce({
      file: { id: "uf_cached_1" },
      diskPath: "/tmp/cached.mp3",
    });

    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello world" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-User-File-Id")).toBe("uf_cached_1");
    expect(storeMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores generated audio with typed media metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Generate a spoken summary for this article.",
          conversationId: "conv_1",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr_1",
        conversationId: "conv_1",
        fileType: "audio",
        mimeType: "audio/mpeg",
        metadata: expect.objectContaining({
          assetKind: "audio",
          source: "generated",
          retentionClass: "conversation",
          durationSeconds: expect.any(Number),
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-User-File-Id")).toBe("uf_generated_1");
  });
});
