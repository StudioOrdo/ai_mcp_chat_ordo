/**
 * Shared SVG-to-PNG rasterization primitives for the browser compose/media
 * runtime. Both the mermaid chart path (`renderMermaidChartToPngBlob`) and the
 * graph path (`renderGraphToPngBlob`) funnel through these helpers so
 * hardening (xmlns normalization, foreignObject flattening, blob/data-URL
 * fallback, diagnostic error context) stays DRY.
 */

import { MAX_SVG_MARKUP_BYTES } from "./rasterization-constants";
import {
  DEFAULT_RASTERIZATION_MIN_HEIGHT,
  DEFAULT_RASTERIZATION_MIN_WIDTH,
  parseSvgDimensions,
} from "@/lib/svg-utilities";
import { uint8ArrayToBase64 } from "@/lib/encoding/uint8-to-base64";

export class SvgInputTooLargeError extends Error {
  constructor(
    public readonly observedBytes: number,
    public readonly maxBytes: number = MAX_SVG_MARKUP_BYTES,
  ) {
    super(`SVG markup is too large to rasterize: ${observedBytes} bytes exceeds ${maxBytes} bytes.`);
    this.name = "SvgInputTooLargeError";
  }
}

export interface RasterizeSvgOptions {
  /** Minimum canvas width. Serialized SVG intrinsic width is used when larger. */
  minWidth?: number;
  /** Minimum canvas height. Serialized SVG intrinsic height is used when larger. */
  minHeight?: number;
  /** Solid background painted before the SVG is drawn. Defaults to white. */
  background?: string;
}

export function getSvgViewportMetrics(svgContent: string): { width: number; height: number } {
  return parseSvgDimensions(svgContent);
}

/**
 * Normalize a serialized SVG so it can be decoded by `HTMLImageElement`
 * across browsers. Two forms of drift consistently break the image path:
 *
 *   1. Missing `xmlns`/`xmlns:xlink` on the root `<svg>`. Without these,
 *      WebKit refuses to decode the SVG even when the payload is otherwise
 *      valid.
 *   2. `<foreignObject>` nodes embedding HTML. Mermaid emits these for
 *      non-flowchart diagram types (pie, sequence, timeline, xychart, …) and
 *      Safari will reject the SVG image wholesale when they are present. We
 *      convert each one to a plain `<text>` node preserving the inner text
 *      content so the chart still rasterizes, just without rich HTML styling.
 */
export function normalizeSvgForRasterization(svgMarkup: string): string {
  const observedBytes = new TextEncoder().encode(svgMarkup).byteLength;
  if (observedBytes > MAX_SVG_MARKUP_BYTES) {
    throw new SvgInputTooLargeError(observedBytes);
  }

  let svg = svgMarkup;

  // Ensure xmlns is present on the opening <svg> tag.
  svg = svg.replace(/<svg\b([^>]*)>/, (_match, attrs: string) => {
    let nextAttrs = attrs;
    if (!/\bxmlns\s*=/.test(nextAttrs)) {
      nextAttrs = ` xmlns="http://www.w3.org/2000/svg"${nextAttrs}`;
    }
    if (!/\bxmlns:xlink\s*=/.test(nextAttrs)) {
      nextAttrs = `${nextAttrs} xmlns:xlink="http://www.w3.org/1999/xlink"`;
    }
    return `<svg${nextAttrs}>`;
  });

  // Neutralize foreignObject/HTML labels by flattening them into <text>.
  // The inner markup is HTML that already escapes `&`, `<`, `>` as entities,
  // so we strip tags but do not re-escape — doing so would produce
  // `&amp;amp;` for a legitimate `&amp;` entity.
  svg = svg.replace(
    /<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/g,
    (_match, attrs: string, inner: string) => {
      const xMatch = /\bx\s*=\s*"([^"]*)"/.exec(attrs);
      const yMatch = /\by\s*=\s*"([^"]*)"/.exec(attrs);
      const widthMatch = /\bwidth\s*=\s*"([^"]*)"/.exec(attrs);
      const heightMatch = /\bheight\s*=\s*"([^"]*)"/.exec(attrs);
      const x = xMatch?.[1] ?? "0";
      const y = yMatch?.[1] ?? "0";
      const text = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const widthAttr = widthMatch ? ` data-foreign-object-width="${widthMatch[1]}"` : "";
      const heightAttr = heightMatch ? ` data-foreign-object-height="${heightMatch[1]}"` : "";
      return `<text x="${x}" y="${y}" dominant-baseline="hanging"${widthAttr}${heightAttr}>${text}</text>`;
    },
  );

  return svg;
}

interface SvgImageLoadAttempt {
  readonly strategy: "blob-url" | "data-url";
  readonly error: unknown;
}

async function loadSvgIntoImage(svgMarkup: string): Promise<HTMLImageElement> {
  const attempts: SvgImageLoadAttempt[] = [];

  try {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImageFromSource(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    attempts.push({ strategy: "blob-url", error });
  }

  // Fallback: some browsers (notably Safari) refuse to decode an SVG image
  // served through a blob URL when it contains complex content, but happily
  // decode the same SVG when inlined as a base64 data URL.
  try {
    const dataUrl = toSvgDataUrl(svgMarkup);
    return await loadImageFromSource(dataUrl);
  } catch (error) {
    attempts.push({ strategy: "data-url", error });
  }

  const byteLength = new Blob([svgMarkup]).size;
  const foreignObjectCount = (svgMarkup.match(/<foreignObject\b/g) ?? []).length;
  throw new Error(
    `Unable to load serialized SVG. Tried ${attempts
      .map((attempt) => attempt.strategy)
      .join(", ")}; byteLength=${byteLength}, foreignObjectCount=${foreignObjectCount}.`,
  );
}

function loadImageFromSource(source: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image element refused SVG source."));
    image.src = source;
  });
}

function toSvgDataUrl(svgMarkup: string): string {
  // Prefer base64 so control characters and non-ASCII content survive the URL.
  const bytes = new TextEncoder().encode(svgMarkup);
  const base64 = uint8ArrayToBase64(bytes);
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Rasterize a serialized SVG string to a PNG `Blob`. Shared between the
 * mermaid chart path and the graph path so all browser-side SVG → PNG
 * conversions benefit from the same hardening.
 */
export async function rasterizeSvgMarkupToPngBlob(
  svgMarkup: string,
  options: RasterizeSvgOptions = {},
): Promise<Blob> {
  const normalized = normalizeSvgForRasterization(svgMarkup);
  const metrics = getSvgViewportMetrics(normalized);
  const minWidth = options.minWidth ?? DEFAULT_RASTERIZATION_MIN_WIDTH;
  const minHeight = options.minHeight ?? DEFAULT_RASTERIZATION_MIN_HEIGHT;
  const background = options.background ?? "#ffffff";
  const width = Math.max(Math.ceil(metrics.width), minWidth);
  const height = Math.max(Math.ceil(metrics.height), minHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable.");
  }

  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const image = await loadSvgIntoImage(normalized);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("PNG conversion failed.");
  }

  return blob;
}

/**
 * Rasterize a live `SVGSVGElement` (already mounted in the DOM) to a PNG
 * `Blob`. Uses `XMLSerializer` + the shared markup rasterizer so element and
 * markup paths share one normalization/fallback pipeline.
 */
export async function rasterizeSvgElementToPngBlob(
  svgElement: SVGSVGElement,
  options: RasterizeSvgOptions = {},
): Promise<Blob> {
  const rect = svgElement.getBoundingClientRect();
  const measuredWidth = Math.ceil(rect.width);
  const measuredHeight = Math.ceil(rect.height);
  const serialized = new XMLSerializer().serializeToString(svgElement);

  return rasterizeSvgMarkupToPngBlob(serialized, {
    minWidth: Math.max(options.minWidth ?? DEFAULT_RASTERIZATION_MIN_WIDTH, measuredWidth || 0),
    minHeight: Math.max(options.minHeight ?? DEFAULT_RASTERIZATION_MIN_HEIGHT, measuredHeight || 0),
    background: options.background,
  });
}
