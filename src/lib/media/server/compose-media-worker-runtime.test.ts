import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { findByAssetIdMock, getByIdMock, executeDeferredPlanMock, storeBinaryMock } = vi.hoisted(() => ({
  findByAssetIdMock: vi.fn(),
  getByIdMock: vi.fn(),
  executeDeferredPlanMock: vi.fn(),
  storeBinaryMock: vi.fn(),
}));

const { materializeServerComposePlanMock } = vi.hoisted(() => ({
  materializeServerComposePlanMock: vi.fn(),
}));

vi.mock("@/adapters/RepositoryFactory", () => ({
  getAssetCatalogReader: vi.fn(() => ({
    findByAssetId: findByAssetIdMock,
  })),
  getUserFileDataMapper: vi.fn(() => ({})),
}));

vi.mock("@/lib/user-files", () => ({
  UserFileSystem: vi.fn(function MockUserFileSystem() {
    return {
      getById: getByIdMock,
      storeBinary: storeBinaryMock,
    };
  }),
}));

vi.mock("@/lib/media/ffmpeg/server/ffmpeg-server-executor", () => ({
  FfmpegServerExecutor: vi.fn(function MockFfmpegServerExecutor() {
    return {
      executeDeferredPlan: executeDeferredPlanMock,
    };
  }),
}));

vi.mock("@/lib/media/server/compose-media-plan-materialization", () => ({
  materializeServerComposePlan: materializeServerComposePlanMock,
}));

import {
  executeComposeMediaRemotely,
  InvalidComposeMediaAssetReadinessError,
} from "./compose-media-worker-runtime";

function createPlan() {
  return {
    id: "plan_worker_1",
    conversationId: "conv_1",
    visualClips: [{ assetId: "asset_image_1", kind: "image" as const }],
    audioClips: [{ assetId: "asset_audio_1", kind: "audio" as const }],
    subtitlePolicy: "none" as const,
    waveformPolicy: "none" as const,
    outputFormat: "mp4" as const,
    resolution: { width: 1280, height: 720 },
  };
}

function createStoredFile(overrides: Partial<{
  id: string;
  userId: string;
  conversationId: string | null;
  fileType: "audio" | "image" | "video";
  mimeType: string;
}> = {}) {
  return {
    file: {
      id: overrides.id ?? "asset_1",
      userId: overrides.userId ?? "user_1",
      conversationId: overrides.conversationId ?? "conv_1",
      contentHash: "hash_1",
      fileType: overrides.fileType ?? "image",
      fileName: "asset.bin",
      mimeType: overrides.mimeType ?? "image/png",
      fileSize: 12,
      metadata: {},
      createdAt: "2026-04-16T10:00:00.000Z",
    },
    diskPath: "/tmp/asset.bin",
  };
}

describe("compose-media worker runtime", () => {
  beforeEach(() => {
    findByAssetIdMock.mockReset();
    getByIdMock.mockReset();
    executeDeferredPlanMock.mockReset();
    storeBinaryMock.mockReset();
    materializeServerComposePlanMock.mockReset();
    materializeServerComposePlanMock.mockImplementation(async ({ plan, storedAssets }) => ({ plan, storedAssets }));
  });

  it("returns a canonical deferred_remote envelope after persisting the rendered artifact", async () => {
    const plan = createPlan();
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ordo-ffmpeg-"));
    const outputPath = path.join(workDir, "composed.mp4");
    fs.writeFileSync(outputPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

    getByIdMock.mockImplementation(async (assetId: string) => {
      if (assetId === "asset_image_1") {
        return createStoredFile({ id: assetId, fileType: "image", mimeType: "image/png" });
      }

      return createStoredFile({ id: assetId, fileType: "audio", mimeType: "audio/mpeg" });
    });
    findByAssetIdMock.mockImplementation(async ({ assetId }: { assetId: string }) => ({
      assetId,
      kind: assetId === "asset_audio_1" ? "audio" : "image",
      ownerUserId: "user_1",
      sourceType: "user_file",
      status: "ready",
      label: assetId,
      fileName: `${assetId}.bin`,
      mimeType: assetId === "asset_audio_1" ? "audio/mpeg" : "image/png",
      source: "generated",
      retentionClass: "conversation",
      createdAt: "2026-04-16T10:00:00.000Z",
      updatedAt: "2026-04-16T10:00:00.000Z",
      conversationId: "conv_1",
      producedByJobId: null,
      materializationKey: null,
    }));
    executeDeferredPlanMock.mockImplementation(async (_plan, onProgress, options) => {
      expect(options.resolveAssetPath("asset_image_1")).toBe("/tmp/asset.bin");
      expect(options.resolveAssetPath("asset_audio_1")).toBe("/tmp/asset.bin");

      onProgress?.(42, "rendering_media");

      return {
        schemaVersion: 1,
        toolName: "compose_media",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "hybrid",
        inputSnapshot: { planId: plan.id },
        summary: { title: "Media Composition", statusLine: "succeeded" },
        replaySnapshot: { route: "deferred_worker", planId: plan.id },
        progress: { percent: 100, label: "Composition complete" },
        artifacts: [],
        payload: { outputPath },
      };
    });
    storeBinaryMock.mockResolvedValue({ id: "uf_media_worker_1", fileSize: 4 });
    const progressUpdates: Array<{ progressPercent?: number | null; progressLabel?: string | null }> = [];

    const result = await executeComposeMediaRemotely({
      plan,
      userId: "user_1",
      conversationId: "conv_1",
      toolInvocationId: "toolu_compose_1",
      onProgress: (update) => {
        progressUpdates.push(update);
      },
    });

    expect(executeDeferredPlanMock).toHaveBeenCalledTimes(1);
    expect(storeBinaryMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_1",
      conversationId: "conv_1",
      fileType: "video",
      mimeType: "video/mp4",
      metadata: expect.objectContaining({
        assetKind: "video",
        source: "generated",
        retentionClass: "conversation",
        toolName: "compose_media",
        toolInvocationId: "toolu_compose_1",
      }),
    }));
    expect(progressUpdates).toContainEqual(expect.objectContaining({
      activePhaseKey: "rendering_media",
      progressPercent: 42,
    }));
    expect(result).toMatchObject({
      schemaVersion: 1,
      toolName: "compose_media",
      family: "artifact",
      cardKind: "artifact_viewer",
      executionMode: "hybrid",
      summary: expect.objectContaining({
        title: "Media Composition",
        statusLine: "succeeded",
      }),
      replaySnapshot: expect.objectContaining({
        route: "deferred_remote",
        planId: plan.id,
        outputFormat: "mp4",
      }),
      artifacts: [expect.objectContaining({
        kind: "video",
        assetId: "uf_media_worker_1",
        mimeType: "video/mp4",
        retentionClass: "conversation",
        source: "generated",
        toolInvocationId: "toolu_compose_1",
      })],
      payload: expect.objectContaining({
        route: "deferred_remote",
        planId: plan.id,
        primaryAssetId: "uf_media_worker_1",
        outputFormat: "mp4",
        mimeType: "video/mp4",
        toolInvocationId: "toolu_compose_1",
      }),
    });
  });

  it("rejects missing governed assets before deferred execution starts", async () => {
    getByIdMock.mockImplementation(async (assetId: string) => {
      if (assetId === "asset_image_1") {
        return null;
      }

      return createStoredFile({
        id: assetId,
        fileType: "audio",
        mimeType: "audio/mpeg",
      });
    });
    findByAssetIdMock.mockImplementation(async ({ assetId }: { assetId: string }) => assetId === "asset_image_1"
      ? null
      : {
          assetId,
          kind: "audio",
          ownerUserId: "user_1",
          sourceType: "user_file",
          status: "ready",
          label: assetId,
          fileName: `${assetId}.bin`,
          mimeType: "audio/mpeg",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-16T10:00:00.000Z",
          updatedAt: "2026-04-16T10:00:00.000Z",
          conversationId: "conv_1",
          producedByJobId: null,
          materializationKey: null,
        });

    await expect(executeComposeMediaRemotely({
      plan: createPlan(),
      userId: "user_1",
      conversationId: "conv_1",
    })).rejects.toMatchObject({
      name: "InvalidComposeMediaAssetReadinessError",
      failureCode: "asset_not_found",
    });

    expect(executeDeferredPlanMock).not.toHaveBeenCalled();
  });

  it("rejects cross-user governed assets before deferred execution starts", async () => {
    getByIdMock.mockImplementation(async (assetId: string) => {
      if (assetId === "asset_image_1") {
        return createStoredFile({ id: assetId, userId: "other_user" });
      }

      return createStoredFile({
        id: assetId,
        fileType: "audio",
        mimeType: "audio/mpeg",
      });
    });
    findByAssetIdMock.mockImplementation(async ({ assetId }: { assetId: string }) => assetId === "asset_image_1"
      ? null
      : {
          assetId,
          kind: "audio",
          ownerUserId: "user_1",
          sourceType: "user_file",
          status: "ready",
          label: assetId,
          fileName: `${assetId}.bin`,
          mimeType: "audio/mpeg",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-16T10:00:00.000Z",
          updatedAt: "2026-04-16T10:00:00.000Z",
          conversationId: "conv_1",
          producedByJobId: null,
          materializationKey: null,
        });

    const execution = executeComposeMediaRemotely({
      plan: createPlan(),
      userId: "user_1",
      conversationId: "conv_1",
    });

    await expect(execution).rejects.toBeInstanceOf(InvalidComposeMediaAssetReadinessError);
    await expect(execution).rejects.toMatchObject({ failureCode: "asset_forbidden" });

    expect(executeDeferredPlanMock).not.toHaveBeenCalled();
  });

  it("rejects missing generated audio assets before deferred execution starts", async () => {
    getByIdMock.mockImplementation(async (assetId: string) => assetId === "asset_audio_1"
      ? null
      : createStoredFile({ id: assetId, fileType: "image", mimeType: "image/png" }));
    findByAssetIdMock.mockImplementation(async ({ assetId }: { assetId: string }) => assetId === "asset_audio_1"
      ? null
      : {
          assetId,
          kind: "image",
          ownerUserId: "user_1",
          sourceType: "user_file",
          status: "ready",
          label: assetId,
          fileName: `${assetId}.png`,
          mimeType: "image/png",
          source: "generated",
          retentionClass: "conversation",
          createdAt: "2026-04-16T10:00:00.000Z",
          updatedAt: "2026-04-16T10:00:00.000Z",
          conversationId: "conv_1",
          producedByJobId: "job_image_1",
          materializationKey: "generate_image:key_1",
        });

    await expect(executeComposeMediaRemotely({
      plan: createPlan(),
      userId: "user_1",
      conversationId: "conv_1",
    })).rejects.toMatchObject({
      name: "InvalidComposeMediaAssetReadinessError",
      failureCode: "asset_not_found",
    });

    expect(executeDeferredPlanMock).not.toHaveBeenCalled();
  });

  it("rejects non-ready generated audio assets before deferred execution starts", async () => {
    getByIdMock.mockImplementation(async (assetId: string) => assetId === "asset_audio_1"
      ? createStoredFile({ id: assetId, fileType: "audio", mimeType: "audio/mpeg" })
      : createStoredFile({ id: assetId, fileType: "image", mimeType: "image/png" }));
    findByAssetIdMock.mockImplementation(async ({ assetId }: { assetId: string }) => ({
      assetId,
      kind: assetId === "asset_audio_1" ? "audio" : "image",
      ownerUserId: "user_1",
      sourceType: "user_file",
      status: assetId === "asset_audio_1" ? "pending" : "ready",
      label: assetId,
      fileName: `${assetId}.bin`,
      mimeType: assetId === "asset_audio_1" ? "audio/mpeg" : "image/png",
      source: "generated",
      retentionClass: "conversation",
      createdAt: "2026-04-16T10:00:00.000Z",
      updatedAt: "2026-04-16T10:00:00.000Z",
      conversationId: "conv_1",
      producedByJobId: assetId === "asset_audio_1" ? "job_audio_1" : "job_image_1",
      materializationKey: assetId === "asset_audio_1" ? "generate_audio:key_1" : "generate_image:key_1",
    }));

    await expect(executeComposeMediaRemotely({
      plan: createPlan(),
      userId: "user_1",
      conversationId: "conv_1",
    })).rejects.toMatchObject({
      name: "InvalidComposeMediaAssetReadinessError",
      failureCode: "asset_pending",
    });

    expect(executeDeferredPlanMock).not.toHaveBeenCalled();
  });

  it("executes the materialized image plan when a chart clip is derived server-side", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ordo-ffmpeg-"));
    const outputPath = path.join(workDir, "composed-chart.mp4");
    fs.writeFileSync(outputPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

    getByIdMock.mockImplementation(async (assetId: string) => {
      if (assetId === "asset_chart_1") {
        return createStoredFile({ id: assetId, fileType: "image", mimeType: "text/vnd.mermaid" });
      }

      return createStoredFile({ id: assetId, fileType: "audio", mimeType: "audio/mpeg" });
    });
    findByAssetIdMock.mockImplementation(async ({ assetId }: { assetId: string }) => ({
      assetId,
      kind: assetId === "asset_audio_1" ? "audio" : assetId === "asset_chart_1" ? "chart" : "image",
      ownerUserId: "user_1",
      sourceType: "user_file",
      status: "ready",
      label: assetId,
      fileName: `${assetId}.bin`,
      mimeType: assetId === "asset_audio_1"
        ? "audio/mpeg"
        : assetId === "asset_chart_1"
          ? "text/vnd.mermaid"
          : "image/png",
      source: "generated",
      retentionClass: "conversation",
      createdAt: "2026-04-16T10:00:00.000Z",
      updatedAt: "2026-04-16T10:00:00.000Z",
      conversationId: "conv_1",
      producedByJobId: null,
      materializationKey: null,
    }));

    materializeServerComposePlanMock.mockImplementation(async ({ storedAssets }) => {
      storedAssets.set("asset_chart_png_1", createStoredFile({
        id: "asset_chart_png_1",
        fileType: "image",
        mimeType: "image/png",
      }));

      return {
        storedAssets,
        plan: {
          id: "plan_worker_chart_1",
          conversationId: "conv_1",
          visualClips: [{ assetId: "asset_chart_png_1", kind: "image" }],
          audioClips: [{ assetId: "asset_audio_1", kind: "audio" }],
          subtitlePolicy: "none",
          waveformPolicy: "none",
          outputFormat: "mp4",
          resolution: { width: 1280, height: 720 },
        },
      };
    });

    executeDeferredPlanMock.mockImplementation(async (plan, _onProgress, options) => {
      expect(plan.visualClips).toEqual([{ assetId: "asset_chart_png_1", kind: "image" }]);
      expect(options.resolveAssetPath("asset_chart_png_1")).toBe("/tmp/asset.bin");
      return {
        schemaVersion: 1,
        toolName: "compose_media",
        family: "artifact",
        cardKind: "artifact_viewer",
        executionMode: "hybrid",
        inputSnapshot: { planId: plan.id },
        summary: { title: "Media Composition", statusLine: "succeeded" },
        replaySnapshot: { route: "deferred_worker", planId: plan.id },
        progress: { percent: 100, label: "Composition complete" },
        artifacts: [],
        payload: { outputPath },
      };
    });
    storeBinaryMock.mockResolvedValue({ id: "uf_media_worker_chart_1", fileSize: 4 });

    await executeComposeMediaRemotely({
      plan: {
        id: "plan_worker_chart_1",
        conversationId: "conv_1",
        visualClips: [{ assetId: "asset_chart_1", kind: "chart" }],
        audioClips: [{ assetId: "asset_audio_1", kind: "audio" }],
        subtitlePolicy: "none",
        waveformPolicy: "none",
        outputFormat: "mp4",
        resolution: { width: 1280, height: 720 },
      },
      userId: "user_1",
      conversationId: "conv_1",
    });

    expect(materializeServerComposePlanMock).toHaveBeenCalledTimes(1);
    expect(executeDeferredPlanMock).toHaveBeenCalledTimes(1);
  });
});
