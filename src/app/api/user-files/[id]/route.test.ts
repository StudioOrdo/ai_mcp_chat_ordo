import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, HEAD } from "@/app/api/user-files/[id]/route";

const {
  getSessionUserMock,
  deleteIfUnattachedMock,
  findByIdMock,
  readFileSyncMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  deleteIfUnattachedMock: vi.fn(),
  findByIdMock: vi.fn(),
  readFileSyncMock: vi.fn(() => Buffer.from("fake-video-content")),
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("node:fs", () => ({
  default: {
    readFileSync: readFileSyncMock,
    existsSync: vi.fn(() => true),
  },
}));

vi.mock("@/adapters/UserFileDataMapper", () => ({
  UserFileDataMapper: vi.fn(function MockUserFileDataMapper() {
    return {
      findById: findByIdMock,
    };
  }),
}));

vi.mock("@/lib/user-files", () => ({
  UserFileSystem: vi.fn(function MockUserFileSystem() {
    return {
      deleteIfUnattached: deleteIfUnattachedMock,
      getById: findByIdMock,
    };
  }),
}));

vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: vi.fn(async () => ({ userId: "usr_1" })),
}));

describe("GET /api/user-files/[id]", () => {
  beforeEach(() => {
    getSessionUserMock.mockResolvedValue({ id: "usr_1", roles: ["AUTHENTICATED"] });
    deleteIfUnattachedMock.mockReset();
    readFileSyncMock.mockClear();
    readFileSyncMock.mockReturnValue(Buffer.from("fake-video-content"));
  });

  it("returns 404 when the file is not found", async () => {
    findByIdMock.mockResolvedValue(null);

    const req = new Request("http://localhost/api/user-files/not-found");
    const res = await GET(req, { params: Promise.resolve({ id: "not-found" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.errorCode).toBe("NOT_FOUND");
  });

  it("returns 403 when the file belongs to a different user", async () => {
    findByIdMock.mockResolvedValue({
      file: { userId: "other_user", mimeType: "video/mp4", fileSize: 1024 },
      diskPath: "/tmp/video.mp4",
    });

    const req = new Request("http://localhost/api/user-files/asset-owned-by-other");
    const res = await GET(req, { params: Promise.resolve({ id: "asset-owned-by-other" }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.errorCode).toBe("FORBIDDEN");
  });

  it("returns the file with correct Content-Type when the user owns it", async () => {
    findByIdMock.mockResolvedValue({
      file: { userId: "usr_1", mimeType: "video/mp4", fileSize: 18, id: "my-video", fileType: "video", metadata: {}, conversationId: "conv_1" },
      diskPath: "/tmp/video.mp4",
    });

    const req = new Request("http://localhost/api/user-files/my-video");
    const res = await GET(req, { params: Promise.resolve({ id: "my-video" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Cache-Control")).toMatch(/private/);
    expect(res.headers.get("X-Asset-Kind")).toBe("video");
    expect(res.headers.get("X-Conversation-Id")).toBe("conv_1");
  });

  it("returns metadata headers for HEAD when the user owns the file", async () => {
    findByIdMock.mockResolvedValue({
      file: {
        id: "my-audio",
        userId: "usr_1",
        mimeType: "audio/mpeg",
        fileSize: 128,
        fileType: "audio",
        metadata: { derivativeOfAssetId: "source-audio-1" },
        conversationId: "conv_1",
      },
      diskPath: "/tmp/audio.mp3",
    });

    const req = new Request("http://localhost/api/user-files/my-audio", { method: "HEAD" });
    const res = await HEAD(req, { params: Promise.resolve({ id: "my-audio" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Content-Length")).toBe("128");
    expect(res.headers.get("X-Asset-Kind")).toBe("audio");
    expect(res.headers.get("X-Conversation-Id")).toBe("conv_1");
    expect(res.headers.get("X-Derivative-Of-Asset-Id")).toBe("source-audio-1");
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it("returns partial content for valid byte ranges", async () => {
    findByIdMock.mockResolvedValue({
      file: {
        id: "my-video",
        userId: "usr_1",
        mimeType: "video/mp4",
        fileSize: 18,
        fileType: "video",
        metadata: {},
        conversationId: "conv_1",
      },
      diskPath: "/tmp/video.mp4",
    });

    const req = new Request("http://localhost/api/user-files/my-video", {
      headers: { Range: "bytes=5-9" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "my-video" }) });

    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 5-9/18");
    expect(res.headers.get("Content-Length")).toBe("5");
    expect(await res.text()).toBe("video");
  });

  it("returns 416 for invalid byte ranges", async () => {
    findByIdMock.mockResolvedValue({
      file: {
        id: "my-video",
        userId: "usr_1",
        mimeType: "video/mp4",
        fileSize: 18,
        fileType: "video",
        metadata: {},
        conversationId: "conv_1",
      },
      diskPath: "/tmp/video.mp4",
    });

    const req = new Request("http://localhost/api/user-files/my-video", {
      headers: { Range: "bytes=99-120" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "my-video" }) });

    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */18");
  });

  it("deletes an unattached owner file", async () => {
    findByIdMock.mockResolvedValue({
      file: { id: "my-video", userId: "usr_1", mimeType: "video/mp4", fileSize: 18, conversationId: null },
      diskPath: "/tmp/video.mp4",
    });
    deleteIfUnattachedMock.mockResolvedValue(true);

    const req = new Request("http://localhost/api/user-files/my-video", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "my-video" }) });

    expect(res.status).toBe(204);
    expect(deleteIfUnattachedMock).toHaveBeenCalledWith("my-video", "usr_1");
  });

  it("returns 409 when trying to delete an attached file", async () => {
    findByIdMock.mockResolvedValue({
      file: { id: "my-video", userId: "usr_1", mimeType: "video/mp4", fileSize: 18, conversationId: "conv_1" },
      diskPath: "/tmp/video.mp4",
    });

    const req = new Request("http://localhost/api/user-files/my-video", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "my-video" }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errorCode).toBe("NOT_DELETABLE");
    expect(deleteIfUnattachedMock).not.toHaveBeenCalled();
  });
});
