import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const { renderMock, initializeMock, sharpPipeline } = vi.hoisted(() => ({
  renderMock: vi.fn(),
  initializeMock: vi.fn(),
  sharpPipeline: {
    resize: vi.fn(),
    flatten: vi.fn(),
    png: vi.fn(),
    toBuffer: vi.fn(),
  },
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => {
    sharpPipeline.resize.mockReturnValue(sharpPipeline);
    sharpPipeline.flatten.mockReturnValue(sharpPipeline);
    sharpPipeline.png.mockReturnValue(sharpPipeline);
    return sharpPipeline;
  }),
}));

import { materializeServerComposePlan } from "./compose-media-plan-materialization";

function createStoredAsset(options: {
  id: string;
  userId: string;
  conversationId: string;
  fileType: "chart" | "graph" | "image";
  mimeType: string;
  diskPath: string;
  derivativeOfAssetId?: string | null;
  toolInvocationId?: string;
  derivativeOfToolInvocationId?: string | null;
}) {
  return {
    file: {
      id: options.id,
      userId: options.userId,
      conversationId: options.conversationId,
      contentHash: "hash_1",
      fileType: options.fileType,
      fileName: path.basename(options.diskPath),
      mimeType: options.mimeType,
      fileSize: fs.statSync(options.diskPath).size,
      metadata: {
        assetKind: options.fileType,
        source: "derived",
        retentionClass: "conversation",
        ...(options.derivativeOfAssetId !== undefined
          ? { derivativeOfAssetId: options.derivativeOfAssetId }
          : {}),
        ...(options.toolInvocationId ? { toolInvocationId: options.toolInvocationId } : {}),
        ...(options.derivativeOfToolInvocationId !== undefined
          ? { derivativeOfToolInvocationId: options.derivativeOfToolInvocationId }
          : {}),
      },
      createdAt: "2026-04-17T18:00:00.000Z",
    },
    diskPath: options.diskPath,
  };
}

describe("compose-media plan materialization", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    renderMock.mockReset();
    initializeMock.mockReset();
    sharpPipeline.resize.mockReset();
    sharpPipeline.flatten.mockReset();
    sharpPipeline.png.mockReset();
    sharpPipeline.toBuffer.mockReset();

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("materializes Mermaid chart clips when Mermaid rendering depends on getBBox", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ordo-chart-materialize-"));
    tempDirs.push(tempDir);

    const sourcePath = path.join(tempDir, "signal-stack.mmd");
    fs.writeFileSync(sourcePath, "flowchart TD\nA[Motivation] --> B[Trust]\nB --> C[Opportunity]\n");

    const persistedPngPath = path.join(tempDir, "derived.png");
    const storedSource = createStoredAsset({
      id: "uf_chart_source_1",
      userId: "usr_1",
      conversationId: "conv_1",
      fileType: "chart",
      mimeType: "text/vnd.mermaid",
      diskPath: sourcePath,
      toolInvocationId: "toolu_chart_1",
    });

    sharpPipeline.toBuffer.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const userFiles = {
      async storeBinary(input: { metadata?: Record<string, unknown> }) {
        expect(input.metadata).toMatchObject({
          toolName: "compose_media",
          toolInvocationId: "toolu_compose_1",
          derivativeOfAssetId: "uf_chart_source_1",
          derivativeOfToolInvocationId: "toolu_chart_1",
        });
        fs.writeFileSync(persistedPngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        return {
          id: "uf_chart_png_1",
          fileSize: 4,
        };
      },
      async getById(assetId: string) {
        if (assetId !== "uf_chart_png_1") {
          return null;
        }

        return createStoredAsset({
          id: "uf_chart_png_1",
          userId: "usr_1",
          conversationId: "conv_1",
          fileType: "image",
          mimeType: "image/png",
          diskPath: persistedPngPath,
          derivativeOfAssetId: "uf_chart_source_1",
          toolInvocationId: "toolu_compose_1",
          derivativeOfToolInvocationId: "toolu_chart_1",
        });
      },
    };

    const result = await materializeServerComposePlan({
      plan: {
        id: "plan_1",
        conversationId: "conv_1",
        visualClips: [{ assetId: "uf_chart_source_1", kind: "chart" }],
        audioClips: [],
        subtitlePolicy: "none",
        outputFormat: "mp4",
        resolution: { width: 1080, height: 1920 },
      },
      userId: "usr_1",
      conversationId: "conv_1",
      toolInvocationId: "toolu_compose_1",
      userFiles: userFiles as never,
      storedAssets: new Map([["uf_chart_source_1", storedSource]]) as never,
    });

    expect(result.plan.visualClips).toEqual([
      expect.objectContaining({
        assetId: "uf_chart_png_1",
        kind: "image",
        sourceAssetId: "uf_chart_source_1",
      }),
    ]);
    expect(result.storedAssets.get("uf_chart_png_1")?.file.metadata.derivativeOfAssetId).toBe("uf_chart_source_1");
    expect(result.storedAssets.get("uf_chart_png_1")?.file.metadata.toolInvocationId).toBe("toolu_compose_1");
    expect(result.storedAssets.get("uf_chart_png_1")?.file.metadata.derivativeOfToolInvocationId).toBe("toolu_chart_1");
  }, 15000);

  it("materializes stored graph clips into derived images with preserved lineage metadata", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ordo-graph-materialize-"));
    tempDirs.push(tempDir);

    const sourcePath = path.join(tempDir, "pipeline-mix.json");
    fs.writeFileSync(sourcePath, JSON.stringify({
      graph: {
        kind: "table",
        data: [{ label: "A", value: 1 }],
        columns: ["label", "value"],
      },
      title: "Pipeline Mix",
    }), "utf8");

    const persistedPngPath = path.join(tempDir, "derived-graph.png");
    const storedSource = createStoredAsset({
      id: "uf_graph_source_1",
      userId: "usr_1",
      conversationId: "conv_1",
      fileType: "graph",
      mimeType: "application/vnd.studioordo.graph+json",
      diskPath: sourcePath,
      toolInvocationId: "toolu_graph_1",
    });

    sharpPipeline.toBuffer.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const userFiles = {
      async storeBinary(input: { metadata?: Record<string, unknown> }) {
        expect(input.metadata).toMatchObject({
          toolName: "compose_media",
          toolInvocationId: "toolu_compose_2",
          derivativeOfAssetId: "uf_graph_source_1",
          derivativeOfToolInvocationId: "toolu_graph_1",
        });
        fs.writeFileSync(persistedPngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        return {
          id: "uf_graph_png_1",
          fileSize: 4,
        };
      },
      async getById(assetId: string) {
        if (assetId !== "uf_graph_png_1") {
          return null;
        }

        return createStoredAsset({
          id: "uf_graph_png_1",
          userId: "usr_1",
          conversationId: "conv_1",
          fileType: "image",
          mimeType: "image/png",
          diskPath: persistedPngPath,
          derivativeOfAssetId: "uf_graph_source_1",
          toolInvocationId: "toolu_compose_2",
          derivativeOfToolInvocationId: "toolu_graph_1",
        });
      },
    };

    const result = await materializeServerComposePlan({
      plan: {
        id: "plan_graph_1",
        conversationId: "conv_1",
        visualClips: [{ assetId: "uf_graph_source_1", kind: "graph" }],
        audioClips: [],
        subtitlePolicy: "none",
        outputFormat: "mp4",
        resolution: { width: 1080, height: 1920 },
      },
      userId: "usr_1",
      conversationId: "conv_1",
      toolInvocationId: "toolu_compose_2",
      userFiles: userFiles as never,
      storedAssets: new Map([["uf_graph_source_1", storedSource]]) as never,
    });

    expect(initializeMock).not.toHaveBeenCalled();
    expect(result.plan.visualClips).toEqual([
      expect.objectContaining({
        assetId: "uf_graph_png_1",
        kind: "image",
        sourceAssetId: "uf_graph_source_1",
      }),
    ]);
    expect(result.storedAssets.get("uf_graph_png_1")?.file.metadata.derivativeOfAssetId).toBe("uf_graph_source_1");
    expect(result.storedAssets.get("uf_graph_png_1")?.file.metadata.toolInvocationId).toBe("toolu_compose_2");
    expect(result.storedAssets.get("uf_graph_png_1")?.file.metadata.derivativeOfToolInvocationId).toBe("toolu_graph_1");
  });
});
