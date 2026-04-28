import { describe, expect, it } from "vitest";

import { MAX_SVG_MARKUP_BYTES } from "./rasterization-constants";
import {
  normalizeSvgForRasterization,
  rasterizeSvgMarkupToPngBlob,
  SvgInputTooLargeError,
} from "./svg-rasterization";

function sizedSvg(payloadBytes: number): string {
  const prefix = '<svg><text>';
  const suffix = '</text></svg>';
  return `${prefix}${"a".repeat(Math.max(payloadBytes - prefix.length - suffix.length, 0))}${suffix}`;
}

describe("svg-rasterization input limits", () => {
  it("normalizes small SVG markup", () => {
    expect(normalizeSvgForRasterization("<svg><text>Hello</text></svg>")).toContain("xmlns=");
  });

  it("accepts SVG markup below the byte cap", () => {
    const svg = sizedSvg(MAX_SVG_MARKUP_BYTES - 1);
    expect(() => normalizeSvgForRasterization(svg)).not.toThrow();
  });

  it("rejects SVG markup above the byte cap with a stable error", () => {
    const svg = sizedSvg(MAX_SVG_MARKUP_BYTES + 1);

    expect(() => normalizeSvgForRasterization(svg)).toThrow(SvgInputTooLargeError);
    expect(() => normalizeSvgForRasterization(svg)).toThrow(String(MAX_SVG_MARKUP_BYTES + 1));
  });

  it("applies the cap to byte length, not character count", () => {
    const emojiMarkup = `<svg><text>${"🙂".repeat(1_300_000)}</text></svg>`;

    expect(emojiMarkup.length).toBeLessThan(MAX_SVG_MARKUP_BYTES);
    expect(() => normalizeSvgForRasterization(emojiMarkup)).toThrow(SvgInputTooLargeError);
  });

  it("rejects pathological huge SVG markup before regex normalization work", () => {
    const pathologicalMarkup = `<svg>${"<foreignObject>".repeat(350_000)}</svg>`;
    const startedAt = performance.now();

    expect(() => normalizeSvgForRasterization(pathologicalMarkup)).toThrow(SvgInputTooLargeError);
    expect(performance.now() - startedAt).toBeLessThan(50);
  });

  it("rasterizeSvgMarkupToPngBlob propagates the size error before canvas work", async () => {
    await expect(rasterizeSvgMarkupToPngBlob(sizedSvg(MAX_SVG_MARKUP_BYTES + 1)))
      .rejects.toBeInstanceOf(SvgInputTooLargeError);
  });
});
