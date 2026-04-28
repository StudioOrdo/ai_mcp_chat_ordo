export interface SvgDimensions {
  width: number;
  height: number;
}

export const DEFAULT_RASTERIZATION_MIN_WIDTH = 1200;
export const DEFAULT_RASTERIZATION_MIN_HEIGHT = 700;
export const SVG_FALLBACK_WIDTH = 960;
export const SVG_FALLBACK_HEIGHT = 640;

function toPositiveNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(/px$/i, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseSvgDimensions(markup: string): SvgDimensions {
  if (!markup.trim()) {
    return { width: SVG_FALLBACK_WIDTH, height: SVG_FALLBACK_HEIGHT };
  }

  try {
    const viewBoxMatch = markup.match(/viewBox=["']\s*([^"']+)["']/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1]
        ?.trim()
        .split(/\s+/)
        .map((part) => Number(part));
      if (parts?.length === 4 && parts.every((part) => Number.isFinite(part))) {
        return {
          width: Math.max(parts[2] ?? SVG_FALLBACK_WIDTH, 1),
          height: Math.max(parts[3] ?? SVG_FALLBACK_HEIGHT, 1),
        };
      }
    }

    const width = toPositiveNumber(markup.match(/width=["']([^"']+)["']/i)?.[1]);
    const height = toPositiveNumber(markup.match(/height=["']([^"']+)["']/i)?.[1]);
    if (width && height) {
      return { width, height };
    }
  } catch {
    return { width: SVG_FALLBACK_WIDTH, height: SVG_FALLBACK_HEIGHT };
  }

  return { width: SVG_FALLBACK_WIDTH, height: SVG_FALLBACK_HEIGHT };
}