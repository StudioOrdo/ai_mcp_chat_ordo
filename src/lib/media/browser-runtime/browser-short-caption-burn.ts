import type { BrowserRuntimeTruncationDiagnostic } from "./runtime-diagnostics";
import {
  CAPTION_BASELINE_OFFSET_RATIO,
  CAPTION_FONT_SIZE_RATIO,
  CAPTION_HORIZONTAL_PADDING_RATIO,
  CAPTION_LINE_HEIGHT_RATIO,
  CAPTION_MAX_LINES,
  CAPTION_MIN_FONT_SIZE,
  CAPTION_MIN_OVERLAY_HEIGHT,
  CAPTION_MIN_STROKE_WIDTH,
  CAPTION_OVERLAY_HEIGHT_RATIO,
  CAPTION_STROKE_WIDTH_RATIO,
  MIN_CAPTION_RENDER_HEIGHT,
  MIN_CAPTION_RENDER_WIDTH,
} from "./caption-burn-constants";

function wrapCaptionLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function measureCaptionLineTruncation(options: {
  caption: string;
  resolution?: { width: number; height: number } | null;
}): BrowserRuntimeTruncationDiagnostic | null {
  const canvas = document.createElement("canvas");
  const width = Math.max(options.resolution?.width ?? MIN_CAPTION_RENDER_WIDTH, MIN_CAPTION_RENDER_WIDTH);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const paddingX = Math.round(width * CAPTION_HORIZONTAL_PADDING_RATIO);
  const maxTextWidth = width - paddingX * 2;
  const fontSize = Math.max(Math.round(width * CAPTION_FONT_SIZE_RATIO), CAPTION_MIN_FONT_SIZE);
  context.font = `700 ${fontSize}px sans-serif`;
  const lines = wrapCaptionLines(context, options.caption, maxTextWidth);
  const rendered = Math.min(lines.length, CAPTION_MAX_LINES);

  return lines.length > rendered
    ? { surface: "caption_lines", original: lines.length, rendered }
    : null;
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load the source image for caption burn."));
    };
    image.src = objectUrl;
  });
}

export async function burnCaptionIntoImageBlob(options: {
  imageBlob: Blob;
  caption: string;
  resolution?: { width: number; height: number } | null;
}): Promise<Blob> {
  const image = await loadImageFromBlob(options.imageBlob);
  const width = Math.max(options.resolution?.width ?? image.width, image.width, MIN_CAPTION_RENDER_WIDTH);
  const height = Math.max(options.resolution?.height ?? image.height, image.height, MIN_CAPTION_RENDER_HEIGHT);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for caption burn.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const overlayHeight = Math.max(Math.round(height * CAPTION_OVERLAY_HEIGHT_RATIO), CAPTION_MIN_OVERLAY_HEIGHT);
  const gradient = context.createLinearGradient(0, height - overlayHeight, 0, height);
  gradient.addColorStop(0, "rgba(15, 23, 42, 0)");
  gradient.addColorStop(1, "rgba(15, 23, 42, 0.88)");
  context.fillStyle = gradient;
  context.fillRect(0, height - overlayHeight, width, overlayHeight);

  const paddingX = Math.round(width * CAPTION_HORIZONTAL_PADDING_RATIO);
  const baselineY = height - Math.round(height * CAPTION_BASELINE_OFFSET_RATIO);
  const maxTextWidth = width - paddingX * 2;
  const fontSize = Math.max(Math.round(width * CAPTION_FONT_SIZE_RATIO), CAPTION_MIN_FONT_SIZE);
  const lineHeight = Math.round(fontSize * CAPTION_LINE_HEIGHT_RATIO);
  context.font = `700 ${fontSize}px sans-serif`;
  context.textBaseline = "alphabetic";
  const lines = wrapCaptionLines(context, options.caption, maxTextWidth).slice(0, CAPTION_MAX_LINES);

  lines.forEach((line, index) => {
    const y = baselineY - (lines.length - index - 1) * lineHeight;
    context.lineWidth = Math.max(Math.round(fontSize * CAPTION_STROKE_WIDTH_RATIO), CAPTION_MIN_STROKE_WIDTH);
    context.strokeStyle = "rgba(15, 23, 42, 0.95)";
    context.strokeText(line, paddingX, y);
    context.fillStyle = "#ffffff";
    context.fillText(line, paddingX, y);
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("Caption burn did not produce a PNG blob.");
  }

  return blob;
}