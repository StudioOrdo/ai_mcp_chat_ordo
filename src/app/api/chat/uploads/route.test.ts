import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConversationInteractorMock } from "../../../../../tests/helpers/conversation-interactor-fixture";

const {
  getMediaQuotaPolicyMock,
  resolveUserIdMock,
  getConversationMock,
  reapStaleChatUploadsMock,
  storeBinaryBatchWithinQuotaMock,
  deleteIfUnattachedMock,
  UserFileQuotaExceededErrorMock,
} = vi.hoisted(() => ({
  getMediaQuotaPolicyMock: vi.fn(),
  resolveUserIdMock: vi.fn(),
  getConversationMock: vi.fn(),
  reapStaleChatUploadsMock: vi.fn(),
  storeBinaryBatchWithinQuotaMock: vi.fn(),
  deleteIfUnattachedMock: vi.fn(),
  UserFileQuotaExceededErrorMock: class UserFileQuotaExceededError extends Error {
    readonly errorCode = "QUOTA_EXCEEDED";

    constructor(
      message: string,
      readonly quota: Record<string, unknown>,
      readonly incomingBytes: number,
    ) {
      super(message);
      this.name = "UserFileQuotaExceededError";
    }
  },
}));

// Phase 7 Mock Density Exception: This file tests a complex composition root or integration pipeline and legitimately requires extensive boundary mocking for external services (auth, db, observability, etc.).
vi.mock("@/lib/chat/resolve-user", () => ({
  resolveUserId: resolveUserIdMock,
}));

vi.mock("@/lib/chat/conversation-root", () => ({
  getConversationInteractor: vi.fn(() =>
    createConversationInteractorMock({
      get: getConversationMock,
    }),
  ),
}));

vi.mock("@/lib/chat/upload-reaper", () => ({
  reapStaleChatUploads: reapStaleChatUploadsMock,
}));

vi.mock("@/lib/storage/media-quota-policy", async () => {
  const actual = await vi.importActual("@/lib/storage/media-quota-policy");

  return {
    ...actual,
    getMediaQuotaPolicy: getMediaQuotaPolicyMock,
  };
});

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/adapters/UserFileDataMapper", () => ({
  UserFileDataMapper: class UserFileDataMapper {},
}));

vi.mock("@/lib/user-files", () => ({
  UserFileQuotaExceededError: UserFileQuotaExceededErrorMock,
  UserFileSystem: class UserFileSystem {
    storeBinaryBatchWithinQuota = storeBinaryBatchWithinQuotaMock;
    deleteIfUnattached = deleteIfUnattachedMock;
  },
}));

import { DELETE, POST } from "@/app/api/chat/uploads/route";

describe("POST /api/chat/uploads", () => {
  beforeEach(() => {
    getMediaQuotaPolicyMock.mockReturnValue({
      defaultUserQuotaBytes: 10 * 1024 * 1024 * 1024,
      hardBlockUploadsAtQuota: false,
      warnAtPercent: 80,
    });
    resolveUserIdMock.mockResolvedValue({ userId: "usr_test", isAnonymous: true });
    getConversationMock.mockResolvedValue({ id: "conv_1" });
    reapStaleChatUploadsMock.mockResolvedValue({ deletedIds: [], deletedCount: 0 });
    storeBinaryBatchWithinQuotaMock.mockResolvedValue({
      files: [{
        id: "uf_1",
        userId: "usr_test",
        conversationId: null,
        contentHash: "hash-1",
        fileType: "document",
        fileName: "hash-1.txt",
        mimeType: "text/plain",
        fileSize: 5,
        metadata: { source: "uploaded", retentionClass: "ephemeral" },
        createdAt: "2026-04-15T00:00:00.000Z",
      }],
      quota: {
        quotaBytes: 1000,
        usedBytes: 5,
        remainingBytes: 995,
        percentUsed: 0.5,
        warnAtPercent: 80,
        hardBlockUploadsAtQuota: false,
        isWarning: false,
        isOverQuota: false,
        status: "normal",
      },
      incomingBytes: 5,
    });
    deleteIfUnattachedMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stores uploaded files and returns attachment metadata", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["brief"], "brief.txt", { type: "text/plain" }),
    );
    formData.append("conversationId", "conv_1");

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(getConversationMock).toHaveBeenCalledWith("conv_1", "usr_test");
    expect(reapStaleChatUploadsMock).toHaveBeenCalledWith({ userId: "usr_test" });
    expect(storeBinaryBatchWithinQuotaMock).toHaveBeenCalledWith({
      userId: "usr_test",
      conversationId: "conv_1",
      quotaPolicy: {
        defaultUserQuotaBytes: 10 * 1024 * 1024 * 1024,
        hardBlockUploadsAtQuota: false,
        warnAtPercent: 80,
      },
      files: [
        expect.objectContaining({
          fileType: "document",
          mimeType: "text/plain",
          extension: "txt",
          metadata: expect.objectContaining({ source: "uploaded", retentionClass: "conversation" }),
        }),
      ],
    });

    const payload = (await response.json()) as {
      attachments: Array<{ assetId: string; fileName: string }>;
      quota: { status: string; usedBytes: number };
    };
    expect(payload.attachments).toEqual([
      expect.objectContaining({
        assetId: "uf_1",
        fileName: "brief.txt",
      }),
    ]);
    expect(payload.quota).toMatchObject({ status: "normal", usedBytes: 5 });
  });

  it("preserves tool invocation provenance for derived browser-runtime uploads", async () => {
    storeBinaryBatchWithinQuotaMock.mockImplementationOnce(async (input: {
      files: Array<{ metadata?: Record<string, unknown> }>;
    }) => ({
      files: [{
        id: "uf_derived_1",
        userId: "usr_test",
        conversationId: "conv_1",
        contentHash: "hash-1",
        fileType: "image",
        fileName: "hash-1.png",
        mimeType: "image/png",
        fileSize: 5,
        metadata: input.files[0]?.metadata ?? {},
        createdAt: "2026-04-15T00:00:00.000Z",
      }],
      quota: {
        quotaBytes: 1000,
        usedBytes: 5,
        remainingBytes: 995,
        percentUsed: 0.5,
        warnAtPercent: 80,
        hardBlockUploadsAtQuota: false,
        isWarning: false,
        isOverQuota: false,
        status: "normal",
      },
      incomingBytes: 5,
    }));
    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([137, 80, 78, 71])], "chart.png", { type: "image/png" }),
    );
    formData.append("conversationId", "conv_1");
    formData.append("derivativeOfAssetId", "uf_chart_1");
    formData.append("toolInvocationId", "toolu_compose_1");
    formData.append("derivativeOfToolInvocationId", "toolu_chart_1");

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(storeBinaryBatchWithinQuotaMock).toHaveBeenCalledWith(expect.objectContaining({
      files: [expect.objectContaining({
        metadata: expect.objectContaining({
          derivativeOfAssetId: "uf_chart_1",
          toolInvocationId: "toolu_compose_1",
          derivativeOfToolInvocationId: "toolu_chart_1",
        }),
      })],
    }));
    const payload = await response.json() as {
      attachments: Array<{
        assetId: string;
        derivativeOfAssetId?: string;
        toolInvocationId?: string;
        derivativeOfToolInvocationId?: string;
      }>;
    };
    expect(payload.attachments[0]).toMatchObject({
      assetId: "uf_derived_1",
      derivativeOfAssetId: "uf_chart_1",
      toolInvocationId: "toolu_compose_1",
      derivativeOfToolInvocationId: "toolu_chart_1",
    });
  });

  it("rejects empty uploads", async () => {
    const response = await POST(
      {
        formData: async () => new FormData(),
      } as unknown as Request,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ errorCode: "VALIDATION_ERROR" });
  });

  it("continues upload handling when stale-upload reaping fails", async () => {
    reapStaleChatUploadsMock.mockRejectedValueOnce(new Error("reaper down"));

    const formData = new FormData();
    formData.append(
      "files",
      new File(["brief"], "brief.txt", { type: "text/plain" }),
    );

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(response.status).toBe(200);
    expect(storeBinaryBatchWithinQuotaMock).toHaveBeenCalledTimes(1);
  });

  it("classifies audio uploads as typed media attachments", async () => {
    storeBinaryBatchWithinQuotaMock.mockResolvedValueOnce({
      files: [{
        id: "uf_audio_1",
        userId: "usr_test",
        conversationId: null,
        contentHash: "hash-audio-1",
        fileType: "audio",
        fileName: "hash-audio-1.mp3",
        mimeType: "audio/mpeg",
        fileSize: 7,
        metadata: {
          assetKind: "audio",
          source: "uploaded",
          retentionClass: "ephemeral",
        },
        createdAt: "2026-04-15T00:00:00.000Z",
      }],
      quota: {
        quotaBytes: 1000,
        usedBytes: 7,
        remainingBytes: 993,
        percentUsed: 0.7,
        warnAtPercent: 80,
        hardBlockUploadsAtQuota: false,
        isWarning: false,
        isOverQuota: false,
        status: "normal",
      },
      incomingBytes: 7,
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["audio"], "intro.mp3", { type: "audio/mpeg" }),
    );

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(storeBinaryBatchWithinQuotaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({
          fileType: "audio",
          mimeType: "audio/mpeg",
          metadata: expect.objectContaining({ assetKind: "audio", source: "uploaded" }),
        })],
      }),
    );

    const payload = await response.json() as {
      attachments: Array<{ assetKind?: string; source?: string }>;
    };
    expect(payload.attachments).toEqual([
      expect.objectContaining({ assetKind: "audio", source: "uploaded" }),
    ]);
  });

  it("stores derived browser-runtime chart assets through the same governed upload path", async () => {
    storeBinaryBatchWithinQuotaMock.mockResolvedValueOnce({
      files: [{
        id: "uf_chart_1",
        userId: "usr_test",
        conversationId: "conv_1",
        contentHash: "hash-chart-1",
        fileType: "chart",
        fileName: "hash-chart-1.mmd",
        mimeType: "text/vnd.mermaid",
        fileSize: 21,
        metadata: {
          assetKind: "chart",
          source: "derived",
          retentionClass: "conversation",
        },
        createdAt: "2026-04-15T00:00:00.000Z",
      }],
      quota: {
        quotaBytes: 1000,
        usedBytes: 21,
        remainingBytes: 979,
        percentUsed: 2.1,
        warnAtPercent: 80,
        hardBlockUploadsAtQuota: false,
        isWarning: false,
        isOverQuota: false,
        status: "normal",
      },
      incomingBytes: 21,
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["flowchart TD\nA-->B"], "launch_flow.mmd", { type: "text/vnd.mermaid" }),
    );
    formData.append("conversationId", "conv_1");

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(storeBinaryBatchWithinQuotaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({
          fileType: "chart",
          mimeType: "text/vnd.mermaid",
          metadata: expect.objectContaining({ assetKind: "chart", source: "derived", retentionClass: "conversation" }),
        })],
      }),
    );

    const payload = await response.json() as {
      attachments: Array<{ assetKind?: string; source?: string; retentionClass?: string }>;
    };
    expect(payload.attachments).toEqual([
      expect.objectContaining({ assetKind: "chart", source: "derived", retentionClass: "conversation" }),
    ]);
  });

  it("rejects unsupported binary uploads", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["zip"], "archive.zip", { type: "application/zip" }),
    );

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ errorCode: "VALIDATION_ERROR" });
  });

  it("blocks uploads that would exceed quota when hard enforcement is enabled", async () => {
    storeBinaryBatchWithinQuotaMock.mockRejectedValueOnce(
      new UserFileQuotaExceededErrorMock(
        "This upload would exceed your media quota.",
        {
          quotaBytes: 1000,
          usedBytes: 1100,
          remainingBytes: 0,
          percentUsed: 110,
          warnAtPercent: 80,
          hardBlockUploadsAtQuota: true,
          isWarning: false,
          isOverQuota: true,
          status: "over_quota",
        },
        200,
      ),
    );

    const formData = new FormData();
    formData.append(
      "files",
      new File(["x".repeat(200)], "brief.txt", { type: "text/plain" }),
    );

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      errorCode: "QUOTA_EXCEEDED",
      quota: {
        quotaBytes: 1000,
        usedBytes: 1100,
        status: "over_quota",
        hardBlockUploadsAtQuota: true,
      },
      incomingBytes: 200,
    });
  });

  it("returns projected over-quota state without blocking when hard enforcement is disabled", async () => {
    storeBinaryBatchWithinQuotaMock.mockResolvedValueOnce({
      files: [{
        id: "uf_2",
        userId: "usr_test",
        conversationId: null,
        contentHash: "hash-2",
        fileType: "document",
        fileName: "hash-2.txt",
        mimeType: "text/plain",
        fileSize: 200,
        metadata: {
          source: "uploaded",
          retentionClass: "ephemeral",
        },
        createdAt: "2026-04-15T00:00:00.000Z",
      }],
      quota: {
        quotaBytes: 1000,
        usedBytes: 1100,
        remainingBytes: 0,
        percentUsed: 110,
        warnAtPercent: 80,
        hardBlockUploadsAtQuota: false,
        isWarning: false,
        isOverQuota: true,
        status: "over_quota",
      },
      incomingBytes: 200,
    });

    const formData = new FormData();
    formData.append(
      "files",
      new File(["x".repeat(200)], "brief.txt", { type: "text/plain" }),
    );

    const response = await POST(
      {
        formData: async () => formData,
      } as unknown as Request,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      quota: {
        quotaBytes: 1000,
        usedBytes: 1100,
        status: "over_quota",
        hardBlockUploadsAtQuota: false,
      },
    });
  });

  it("cleans up unattached uploads for the current user", async () => {
    deleteIfUnattachedMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await DELETE(
      new Request("http://localhost/api/chat/uploads", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ attachmentIds: ["uf_1", "uf_2"] }),
      }),
    );

    expect(deleteIfUnattachedMock).toHaveBeenNthCalledWith(1, "uf_1", "usr_test");
    expect(deleteIfUnattachedMock).toHaveBeenNthCalledWith(2, "uf_2", "usr_test");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedIds: ["uf_1"],
      skippedIds: ["uf_2"],
      deletedCount: 1,
      skippedCount: 1,
    });
  });
});