import React from "react";

import type { GraphSpec } from "@/core/entities/rich-content";

import { GraphSvg } from "./GraphSvg";
import { GRAPH_SVG_HEIGHT, GRAPH_SVG_WIDTH } from "./graph-geometry";

export async function getGraphSvgMarkup(graph: GraphSpec, width = GRAPH_SVG_WIDTH, height = GRAPH_SVG_HEIGHT, testId = "graph-svg"): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");

  return renderToStaticMarkup(
    React.createElement(GraphSvg, { graph, width, height, testId }),
  );
}

export { GRAPH_SVG_WIDTH, GRAPH_SVG_HEIGHT };