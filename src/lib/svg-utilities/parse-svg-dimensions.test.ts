import { describe, expect, it } from "vitest";

import {
  parseSvgDimensions,
  SVG_FALLBACK_HEIGHT,
  SVG_FALLBACK_WIDTH,
} from "./index";

describe("parseSvgDimensions", () => {
  it("reads dimensions from viewBox", () => {
    expect(parseSvgDimensions('<svg viewBox="0 0 400 300"></svg>')).toEqual({ width: 400, height: 300 });
  });

  it("reads dimensions from px width and height", () => {
    expect(parseSvgDimensions('<svg width="200px" height="100px"></svg>')).toEqual({ width: 200, height: 100 });
  });

  it("reads dimensions from numeric width and height", () => {
    expect(parseSvgDimensions('<svg width="200" height="100"></svg>')).toEqual({ width: 200, height: 100 });
  });

  it("falls back when dimensions are missing", () => {
    expect(parseSvgDimensions("<svg></svg>")).toEqual({ width: SVG_FALLBACK_WIDTH, height: SVG_FALLBACK_HEIGHT });
  });

  it("falls back on malformed SVG content", () => {
    expect(parseSvgDimensions("not-an-svg")).toEqual({ width: SVG_FALLBACK_WIDTH, height: SVG_FALLBACK_HEIGHT });
  });

  it("falls back on non-numeric viewBox values", () => {
    expect(parseSvgDimensions('<svg viewBox="0 0 nope nah"></svg>')).toEqual({
      width: SVG_FALLBACK_WIDTH,
      height: SVG_FALLBACK_HEIGHT,
    });
  });
});