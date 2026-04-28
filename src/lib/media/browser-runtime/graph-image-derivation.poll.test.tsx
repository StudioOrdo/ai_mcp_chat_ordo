// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRootMock } = vi.hoisted(() => ({
  createRootMock: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("./svg-rasterization", () => ({
  rasterizeSvgElementToPngBlob: vi.fn(),
}));

import { renderGraphToPngBlob } from "./graph-image-derivation";
import { MAX_SVG_POLL_FRAMES, SVG_POLL_INTERVAL_MS } from "./rasterization-constants";

describe("renderGraphToPngBlob poll timeout", () => {
  beforeEach(() => {
    createRootMock.mockClear();
    vi.stubGlobal("requestAnimationFrame", ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);
  });

  it("surfaces a descriptive timeout when no SVG is emitted", async () => {
    await expect(renderGraphToPngBlob({
      graph: {
        kind: "bar",
        data: [{ month: "Jan", revenue: 1 }],
        x: { field: "month", type: "nominal" },
        y: { field: "revenue", type: "quantitative" },
      },
    })).rejects.toThrow(
      `Graph rendering failed (kind=bar, rows=1): no SVG element emitted within ${MAX_SVG_POLL_FRAMES} frames (${MAX_SVG_POLL_FRAMES * SVG_POLL_INTERVAL_MS} ms).`,
    );
  });
});