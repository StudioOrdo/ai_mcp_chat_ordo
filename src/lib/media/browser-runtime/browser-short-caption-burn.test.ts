// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  burnCaptionIntoImageBlob,
  measureCaptionLineTruncation,
} from "./browser-short-caption-burn";

describe("measureCaptionLineTruncation", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      measureText: (value: string) => ({ width: value.length * 18 }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("returns null when the caption fits within the render cap", () => {
    expect(measureCaptionLineTruncation({
      caption: "Short caption fits comfortably.",
      resolution: { width: 720, height: 1280 },
    })).toBeNull();
  });

  it("reports caption line truncation when wrapping exceeds three lines", () => {
    expect(measureCaptionLineTruncation({
      caption: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen.",
      resolution: { width: 720, height: 1280 },
    })).toEqual({
      surface: "caption_lines",
      original: 4,
      rendered: 3,
    });
  });
});

describe("burnCaptionIntoImageBlob", () => {
  const originalCreateElement = document.createElement.bind(document);
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalImage = globalThis.Image;

  let imageShouldFail = false;
  let forceNullContext = false;
  let forceNullBlob = false;
  let operations: string[] = [];

  beforeEach(() => {
    imageShouldFail = false;
    forceNullContext = false;
    forceNullBlob = false;
    operations = [];

    URL.createObjectURL = vi.fn(() => "blob:test-url");
    URL.revokeObjectURL = vi.fn();

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 640;
      height = 360;

      set src(_value: string) {
        queueMicrotask(() => {
          if (imageShouldFail) {
            this.onerror?.();
            return;
          }
          this.onload?.();
        });
      }
    }

    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName !== "canvas") {
        return originalCreateElement(tagName);
      }

      const context = forceNullContext
        ? null
        : {
            fillStyle: "",
            strokeStyle: "",
            font: "",
            lineWidth: 0,
            textBaseline: "alphabetic",
            measureText: (value: string) => ({ width: value.length * 18 }),
            fillRect: () => operations.push("fillRect"),
            drawImage: () => operations.push("drawImage"),
            createLinearGradient: () => ({
              addColorStop: () => operations.push("addColorStop"),
            }),
            strokeText: () => operations.push("strokeText"),
            fillText: () => operations.push("fillText"),
          };

      return {
        width: 0,
        height: 0,
        getContext: () => context,
        toBlob: (callback: (blob: Blob | null) => void) => {
          callback(forceNullBlob ? null : new Blob(["png"], { type: "image/png" }));
        },
      } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.stubGlobal("Image", originalImage);
  });

  it("renders captions with stroke before fill and returns a png blob", async () => {
    const blob = await burnCaptionIntoImageBlob({
      imageBlob: new Blob(["image"], { type: "image/png" }),
      caption: "This caption should wrap onto multiple visible lines for testing.",
      resolution: { width: 720, height: 1280 },
    });

    expect(blob.type).toBe("image/png");
    expect(operations).toContain("drawImage");
    const firstStrokeIndex = operations.indexOf("strokeText");
    const firstFillIndex = operations.indexOf("fillText");
    expect(firstStrokeIndex).toBeGreaterThan(-1);
    expect(firstFillIndex).toBeGreaterThan(firstStrokeIndex);
  });

  it("surfaces a descriptive error when the source image cannot be loaded", async () => {
    imageShouldFail = true;

    await expect(burnCaptionIntoImageBlob({
      imageBlob: new Blob(["image"], { type: "image/png" }),
      caption: "Caption",
    })).rejects.toThrow("Unable to load the source image for caption burn.");
  });

  it("surfaces a descriptive error when the canvas context is unavailable", async () => {
    forceNullContext = true;

    await expect(burnCaptionIntoImageBlob({
      imageBlob: new Blob(["image"], { type: "image/png" }),
      caption: "Caption",
    })).rejects.toThrow("Canvas context unavailable for caption burn.");
  });

  it("surfaces a descriptive error when canvas serialization returns no blob", async () => {
    forceNullBlob = true;

    await expect(burnCaptionIntoImageBlob({
      imageBlob: new Blob(["image"], { type: "image/png" }),
      caption: "Caption",
    })).rejects.toThrow("Caption burn did not produce a PNG blob.");
  });
});

