import { readFile } from "node:fs/promises";
import process from "node:process";

const checks = [
  {
    file: "src/lib/media/browser-runtime/browser-short-caption-burn.ts",
    forbidden: ["CAPTION_MAX_LINES = 3", "0.06", "0.048"],
  },
  {
    file: "src/lib/media/browser-runtime/graph-image-derivation.tsx",
    forbidden: ["const MAX_SVG_POLL_FRAMES = 16", "const SVG_POLL_INTERVAL_MS = 16"],
  },
  {
    file: "src/lib/media/browser-runtime/ffmpeg.worker.ts",
    forbidden: ["const MAX_LOG_LINES = 40"],
  },
  {
    file: "src/lib/graphs/graph-geometry.ts",
    forbidden: [
      "5 + normalized * 11",
      "?? 5",
      "0.18 + normalized * 0.72",
      "slice(0, 6)",
      "list.length <= 6",
    ],
  },
];

const requiredConstantExports = [
  {
    file: "src/lib/graphs/graph-visual-constants.ts",
    required: [
      "GRAPH_MAX_CATEGORICAL_TICKS",
      "GRAPH_TABLE_MAX_COLUMNS",
      "GRAPH_TABLE_MAX_ROWS",
      "GRAPH_BUBBLE_MIN_RADIUS",
      "GRAPH_BUBBLE_RADIUS_SPAN",
      "GRAPH_HEATMAP_MIN_ALPHA",
      "GRAPH_HEATMAP_ALPHA_SPAN",
    ],
  },
  {
    file: "src/lib/media/browser-runtime/rasterization-constants.ts",
    required: ["MAX_SVG_POLL_FRAMES", "SVG_POLL_INTERVAL_MS"],
  },
  {
    file: "src/lib/media/browser-runtime/ffmpeg-worker-limits.ts",
    required: ["FFMPEG_LOG_HEAD_LINES", "FFMPEG_LOG_TAIL_LINES"],
  },
  {
    file: "src/lib/media/browser-runtime/caption-burn-constants.ts",
    required: ["CAPTION_MAX_LINES", "CAPTION_FONT_SIZE_RATIO", "CAPTION_OVERLAY_HEIGHT_RATIO"],
  },
];

async function main() {
  const failures = [];

  for (const check of checks) {
    const content = await readFile(check.file, "utf8");
    for (const snippet of check.forbidden) {
      if (content.includes(snippet)) {
        failures.push(`${check.file}: found forbidden inline snippet \"${snippet}\"`);
      }
    }
  }

  for (const check of requiredConstantExports) {
    const content = await readFile(check.file, "utf8");
    for (const symbol of check.required) {
      if (!content.includes(symbol)) {
        failures.push(`${check.file}: missing required constant export ${symbol}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("Phase 5 clarity constant guard failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Phase 5 clarity constant guard passed.");
}

await main();