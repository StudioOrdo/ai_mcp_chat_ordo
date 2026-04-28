import { createRoot } from "react-dom/client";

import { GraphRenderer } from "@/components/GraphRenderer";
import type { ResolvedGraphPayload } from "@/core/use-cases/tools/graph-payload";
import { MAX_SVG_POLL_FRAMES, SVG_POLL_INTERVAL_MS } from "./rasterization-constants";
import { rasterizeSvgElementToPngBlob } from "./svg-rasterization";

const MAX_GRAPH_TABLE_ROWS = 6;

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function rasterizeSvgToPngBlob(svgElement: SVGSVGElement): Promise<Blob> {
  return rasterizeSvgElementToPngBlob(svgElement);
}

function countGraphRows(payload: ResolvedGraphPayload): number {
  return Array.isArray(payload.graph?.data) ? payload.graph.data.length : 0;
}

function getGraphKind(payload: ResolvedGraphPayload): string {
  return typeof payload.graph?.kind === "string" ? payload.graph.kind : "unknown";
}

function describeGraphContext(payload: ResolvedGraphPayload): string {
  return `kind=${getGraphKind(payload)}, rows=${countGraphRows(payload)}`;
}

function withGraphContextError(payload: ResolvedGraphPayload, error: unknown): Error {
  if (error instanceof Error && error.message.startsWith("Graph rendering failed (")) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Graph rendering failed (${describeGraphContext(payload)}): ${message}`);
}

function truncateGraphPayloadForBrowserRender(payload: ResolvedGraphPayload): ResolvedGraphPayload {
  if (payload.graph.kind !== "table" || !Array.isArray(payload.graph.data)) {
    return payload;
  }

  if (payload.graph.data.length <= MAX_GRAPH_TABLE_ROWS) {
    return payload;
  }

  return {
    ...payload,
    graph: {
      ...payload.graph,
      data: payload.graph.data.slice(0, MAX_GRAPH_TABLE_ROWS),
    },
  };
}

async function waitForRenderedGraphSvg(container: HTMLDivElement): Promise<SVGSVGElement> {
  for (let frame = 0; frame < MAX_SVG_POLL_FRAMES; frame += 1) {
    await waitForFrame();
    const svgElement = container.querySelector("svg[data-testid='graph-svg']");
    if (svgElement instanceof SVGSVGElement) {
      return svgElement;
    }
  }

  throw new Error(
    `no SVG element emitted within ${MAX_SVG_POLL_FRAMES} frames (${MAX_SVG_POLL_FRAMES * SVG_POLL_INTERVAL_MS} ms).`,
  );
}

export function getGraphTableTruncationDiagnostic(payload: ResolvedGraphPayload): {
  surface: "graph_table";
  original: number;
  rendered: number;
} | null {
  if (payload.graph.kind !== "table" || !Array.isArray(payload.graph.data)) {
    return null;
  }

  if (payload.graph.data.length <= MAX_GRAPH_TABLE_ROWS) {
    return null;
  }

  return {
    surface: "graph_table",
    original: payload.graph.data.length,
    rendered: MAX_GRAPH_TABLE_ROWS,
  };
}

export async function renderGraphToPngBlob(payload: ResolvedGraphPayload): Promise<Blob> {
  const renderPayload = truncateGraphPayloadForBrowserRender(payload);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "1200px";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(
      <GraphRenderer
        graph={renderPayload.graph}
        title={renderPayload.title}
        caption={renderPayload.caption}
        summary={renderPayload.summary}
        downloadFileName={renderPayload.downloadFileName}
        dataPreview={renderPayload.dataPreview}
      />,
    );

    const svgElement = await waitForRenderedGraphSvg(container);
    return await rasterizeSvgToPngBlob(svgElement);
  } catch (error) {
    throw withGraphContextError(payload, error);
  } finally {
    root.unmount();
    container.remove();
  }
}