const MERMAID_DIAGRAM_PREFIX = /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|xychart-beta|sankey-beta|block-beta|packet-beta)\b/;

type MermaidDirection = "TD" | "TB" | "BT" | "RL" | "LR";
type FlowchartNodeShape = "rect" | "round" | "circle" | "diamond" | "hexagon";
type FlowchartEdgeStyle = "solid" | "dashed" | "thick";
type FlowchartArrowStyle = "arrow" | "none";

export type FlowchartSpec = {
  chartType: "flowchart";
  direction?: MermaidDirection;
  nodes: Array<{
    id: string;
    label: string;
    shape?: FlowchartNodeShape;
    className?: string;
  }>;
  edges?: Array<{
    from: string;
    to: string;
    label?: string;
    lineStyle?: FlowchartEdgeStyle;
    arrowStyle?: FlowchartArrowStyle;
  }>;
  subgraphs?: Array<{
    title: string;
    nodes: string[];
  }>;
  classDefs?: Array<{
    name: string;
    styles: string[];
  }>;
};

export type PieSpec = {
  chartType: "pie";
  title?: string;
  showData?: boolean;
  slices: Array<{
    label: string;
    value: number;
  }>;
};

export type QuadrantSpec = {
  chartType: "quadrant";
  title?: string;
  xAxis: { minLabel: string; maxLabel: string };
  yAxis: { minLabel: string; maxLabel: string };
  quadrants?: {
    topRight?: string;
    topLeft?: string;
    bottomLeft?: string;
    bottomRight?: string;
  };
  points: Array<{
    label: string;
    x: number;
    y: number;
  }>;
};

export type XYChartSpec = {
  chartType: "xychart";
  title?: string;
  xAxis: { label?: string; values: string[] };
  yAxis?: { label?: string; min?: number; max?: number };
  series: Array<{
    type: "bar" | "line";
    label?: string;
    data: number[];
  }>;
};

export type MindmapSpec = {
  chartType: "mindmap";
  root: string;
  branches: Array<{
    label: string;
    children?: Array<{
      label: string;
      children?: unknown[];
    }>;
  }>;
};

export type ChartSpec = FlowchartSpec | PieSpec | QuadrantSpec | XYChartSpec | MindmapSpec;

export type GenerateChartInput = {
  code?: string;
  title?: string;
  caption?: string;
  downloadFileName?: string;
  spec?: ChartSpec;
};

export type ResolvedChartPayload = {
  code: string;
  title?: string;
  caption?: string;
  downloadFileName?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function stripMermaidPreamble(code: string): string {
  let remaining = code.trim();

  while (remaining.startsWith("%%{init:")) {
    const endIndex = remaining.indexOf("}%%");
    if (endIndex < 0) break;
    remaining = remaining.slice(endIndex + 3).trimStart();
  }

  return remaining
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"))
    .join("\n");
}

export function isValidMermaidCode(code: string): boolean {
  const normalized = stripMermaidPreamble(code);
  if (!normalized) return false;
  const [firstLine] = normalized.split("\n");
  return MERMAID_DIAGRAM_PREFIX.test(firstLine);
}

function escapeLabel(value: string): string {
  return value.replace(/"/g, '\\"').replace(/\n/g, "<br/>").trim();
}

function escapeQuadrantPointLabel(value: string): string {
  return value
    .replace(/["[\]\n]/g, " ")
    .replace(/:/g, " -")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuadrantCoordinate(value: number): number {
  if (value >= 0 && value <= 1) {
    return value;
  }

  if (value >= 0 && value <= 100) {
    return value / 100;
  }

  throw new Error("Quadrant point coordinates must be between 0 and 1, or between 0 and 100 for percentage-style input.");
}

function formatQuadrantCoordinate(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export function normalizeMermaidCodeForRender(code: string): string {
  const normalized = stripMermaidPreamble(code);
  if (!normalized.startsWith("quadrantChart")) {
    return code;
  }

  return code.split("\n").map((line) => {
    const match = line.match(/^(\s*)"?([^":\[\]\n]+?)"?\s*:\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*$/);
    if (!match) {
      return line;
    }

    const [, indent, rawLabel, rawX, rawY] = match;
    const label = escapeQuadrantPointLabel(rawLabel ?? "");
    const x = normalizeQuadrantCoordinate(Number(rawX));
    const y = normalizeQuadrantCoordinate(Number(rawY));
    return `${indent}${label}: [${formatQuadrantCoordinate(x)}, ${formatQuadrantCoordinate(y)}]`;
  }).join("\n");
}

function normalizeId(rawId: string, fallback: string): string {
  const normalized = rawId.replace(/[^A-Za-z0-9_]/g, "_");
  if (!normalized) return fallback;
  return /^[0-9]/.test(normalized) ? `n_${normalized}` : normalized;
}

function renderFlowchartNode(nodeId: string, label: string, shape: FlowchartNodeShape = "rect"): string {
  const safeLabel = escapeLabel(label);
  switch (shape) {
    case "round":
      return `${nodeId}("${safeLabel}")`;
    case "circle":
      return `${nodeId}(("${safeLabel}"))`;
    case "diamond":
      return `${nodeId}{"${safeLabel}"}`;
    case "hexagon":
      return `${nodeId}{{"${safeLabel}"}}`;
    case "rect":
    default:
      return `${nodeId}["${safeLabel}"]`;
  }
}

function renderEdgeToken(
  lineStyle: FlowchartEdgeStyle = "solid",
  arrowStyle: FlowchartArrowStyle = "arrow",
): string {
  if (lineStyle === "dashed") return arrowStyle === "none" ? "-.-" : "-.->";
  if (lineStyle === "thick") return arrowStyle === "none" ? "===" : "==>";
  return arrowStyle === "none" ? "---" : "-->";
}

function renderMindmapBranch(branch: { label: string; children?: unknown[] }, depth: number): string[] {
  const indent = "  ".repeat(depth);
  const lines = [`${indent}${escapeLabel(branch.label)}`];
  for (const child of Array.isArray(branch.children) ? branch.children.filter(isObject) : []) {
    const label = asString(child.label);
    if (!label) continue;
    lines.push(...renderMindmapBranch({ label, children: child.children as unknown[] | undefined }, depth + 1));
  }
  return lines;
}

function buildFlowchartCode(spec: Record<string, unknown>): string {
  const nodeEntries = Array.isArray(spec.nodes) ? spec.nodes.filter(isObject) : [];
  if (nodeEntries.length === 0) throw new Error("Flowchart specs require at least one node.");

  const direction = asString(spec.direction) ?? "TD";
  const lines = [`flowchart ${direction}`];
  const idMap = new Map<string, string>();
  const nodeLines = new Map<string, string>();

  nodeEntries.forEach((node, index) => {
    const rawId = asString(node.id);
    const label = asString(node.label);
    if (!rawId || !label) {
      throw new Error("Each flowchart node requires id and label.");
    }
    const normalizedId = normalizeId(rawId, `node_${index + 1}`);
    idMap.set(rawId, normalizedId);
    nodeLines.set(
      normalizedId,
      `    ${renderFlowchartNode(normalizedId, label, (asString(node.shape) as FlowchartNodeShape | undefined) ?? "rect")}`,
    );
  });

  const subgraphNodeIds = new Set<string>();
  const subgraphs = Array.isArray(spec.subgraphs) ? spec.subgraphs.filter(isObject) : [];
  for (const subgraph of subgraphs) {
    const title = asString(subgraph.title);
    const nodeRefs = asStringArray(subgraph.nodes)
      .map((nodeId) => idMap.get(nodeId))
      .filter((nodeId): nodeId is string => Boolean(nodeId));
    if (!title || nodeRefs.length === 0) continue;
    lines.push(`    subgraph ["${escapeLabel(title)}"]`);
    for (const nodeId of nodeRefs) {
      subgraphNodeIds.add(nodeId);
      const nodeLine = nodeLines.get(nodeId);
      if (nodeLine) lines.push(nodeLine);
    }
    lines.push("    end");
  }

  for (const [nodeId, nodeLine] of nodeLines.entries()) {
    if (!subgraphNodeIds.has(nodeId)) lines.push(nodeLine);
  }

  const edges = Array.isArray(spec.edges) ? spec.edges.filter(isObject) : [];
  for (const edge of edges) {
    const from = asString(edge.from);
    const to = asString(edge.to);
    if (!from || !to) throw new Error("Each flowchart edge requires from and to.");
    const fromId = idMap.get(from);
    const toId = idMap.get(to);
    if (!fromId || !toId) {
      throw new Error(`Flowchart edge references unknown node: ${from} -> ${to}.`);
    }
    const token = renderEdgeToken(
      (asString(edge.lineStyle) as FlowchartEdgeStyle | undefined) ?? "solid",
      (asString(edge.arrowStyle) as FlowchartArrowStyle | undefined) ?? "arrow",
    );
    const label = asString(edge.label);
    lines.push(label ? `    ${fromId} ${token}|${escapeLabel(label)}| ${toId}` : `    ${fromId} ${token} ${toId}`);
  }

  const classDefs = Array.isArray(spec.classDefs) ? spec.classDefs.filter(isObject) : [];
  for (const classDef of classDefs) {
    const name = asString(classDef.name);
    const styles = asStringArray(classDef.styles);
    if (!name || styles.length === 0) continue;
    lines.push(`    classDef ${name} ${styles.join(",")}`);
  }

  for (const node of nodeEntries) {
    const className = asString(node.className);
    const nodeId = asString(node.id);
    const normalizedId = nodeId ? idMap.get(nodeId) : undefined;
    if (className && normalizedId) lines.push(`    class ${normalizedId} ${className}`);
  }

  return lines.join("\n");
}

function buildPieCode(spec: Record<string, unknown>): string {
  const slices = Array.isArray(spec.slices) ? spec.slices.filter(isObject) : [];
  if (slices.length === 0) throw new Error("Pie specs require at least one slice.");
  const lines = [spec.showData === true ? "pie showData" : "pie"];
  const title = asString(spec.title);
  if (title) lines.push(`    title ${escapeLabel(title)}`);
  for (const slice of slices) {
    const label = asString(slice.label);
    const value = asNumber(slice.value);
    if (!label || value === undefined) throw new Error("Each pie slice requires label and numeric value.");
    lines.push(`    "${escapeLabel(label)}" : ${value}`);
  }
  return lines.join("\n");
}

function buildQuadrantCode(spec: Record<string, unknown>): string {
  const xAxis = isObject(spec.xAxis) ? spec.xAxis : null;
  const yAxis = isObject(spec.yAxis) ? spec.yAxis : null;
  const points = Array.isArray(spec.points) ? spec.points.filter(isObject) : [];
  if (!xAxis || !yAxis || points.length === 0) {
    throw new Error("Quadrant specs require xAxis, yAxis, and at least one point.");
  }
  const xMin = asString(xAxis.minLabel);
  const xMax = asString(xAxis.maxLabel);
  const yMin = asString(yAxis.minLabel);
  const yMax = asString(yAxis.maxLabel);
  if (!xMin || !xMax || !yMin || !yMax) {
    throw new Error("Quadrant axis labels must include minLabel and maxLabel.");
  }

  const lines = ["quadrantChart"];
  const title = asString(spec.title);
  if (title) lines.push(`    title ${escapeLabel(title)}`);
  lines.push(`    x-axis ${escapeLabel(xMin)} --> ${escapeLabel(xMax)}`);
  lines.push(`    y-axis ${escapeLabel(yMin)} --> ${escapeLabel(yMax)}`);

  const quadrants = isObject(spec.quadrants) ? spec.quadrants : null;
  if (quadrants) {
    const topRight = asString(quadrants.topRight);
    const topLeft = asString(quadrants.topLeft);
    const bottomLeft = asString(quadrants.bottomLeft);
    const bottomRight = asString(quadrants.bottomRight);
    if (topRight) lines.push(`    quadrant-1 ${escapeLabel(topRight)}`);
    if (topLeft) lines.push(`    quadrant-2 ${escapeLabel(topLeft)}`);
    if (bottomLeft) lines.push(`    quadrant-3 ${escapeLabel(bottomLeft)}`);
    if (bottomRight) lines.push(`    quadrant-4 ${escapeLabel(bottomRight)}`);
  }

  for (const point of points) {
    const label = asString(point.label);
    const x = asNumber(point.x);
    const y = asNumber(point.y);
    if (!label || x === undefined || y === undefined) {
      throw new Error("Each quadrant point requires label, x, and y.");
    }
    lines.push(
      `    ${escapeQuadrantPointLabel(label)}: [${formatQuadrantCoordinate(normalizeQuadrantCoordinate(x))}, ${formatQuadrantCoordinate(normalizeQuadrantCoordinate(y))}]`,
    );
  }

  return lines.join("\n");
}

function buildXYChartCode(spec: Record<string, unknown>): string {
  const xAxis = isObject(spec.xAxis) ? spec.xAxis : null;
  const series = Array.isArray(spec.series) ? spec.series.filter(isObject) : [];
  if (!xAxis || series.length === 0) {
    throw new Error("XY chart specs require xAxis and at least one series.");
  }
  const xValues = asStringArray(xAxis.values);
  if (xValues.length === 0) throw new Error("XY chart xAxis requires at least one value.");

  const lines = ["xychart-beta"];
  const title = asString(spec.title);
  if (title) lines.push(`    title "${escapeLabel(title)}"`);
  const xLabel = asString(xAxis.label);
  const renderedXValues = xValues.map((value) => `"${escapeLabel(value)}"`).join(", ");
  lines.push(xLabel ? `    x-axis "${escapeLabel(xLabel)}" [${renderedXValues}]` : `    x-axis [${renderedXValues}]`);

  const yAxis = isObject(spec.yAxis) ? spec.yAxis : null;
  if (yAxis) {
    const yLabel = asString(yAxis.label);
    const yMin = asNumber(yAxis.min) ?? 0;
    const yMax = asNumber(yAxis.max);
    if (yMax !== undefined) {
      lines.push(yLabel ? `    y-axis "${escapeLabel(yLabel)}" ${yMin} --> ${yMax}` : `    y-axis ${yMin} --> ${yMax}`);
    }
  }

  for (const item of series) {
    const type = asString(item.type);
    const data = Array.isArray(item.data)
      ? item.data.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
      : [];
    if ((type !== "bar" && type !== "line") || data.length === 0) {
      throw new Error("Each XY chart series requires a type of 'bar' or 'line' and numeric data.");
    }
    const label = asString(item.label);
    if (label) lines.push(`    %% ${escapeLabel(label)}`);
    lines.push(`    ${type} [${data.join(", ")}]`);
  }

  return lines.join("\n");
}

function buildMindmapCode(spec: Record<string, unknown>): string {
  const root = asString(spec.root);
  const branches = Array.isArray(spec.branches) ? spec.branches.filter(isObject) : [];
  if (!root || branches.length === 0) {
    throw new Error("Mindmap specs require a root and at least one branch.");
  }
  const lines = ["mindmap", `  root(("${escapeLabel(root)}"))`];
  for (const branch of branches) {
    const label = asString(branch.label);
    if (!label) throw new Error("Each mindmap branch requires a label.");
    lines.push(...renderMindmapBranch({ label, children: branch.children as unknown[] | undefined }, 2));
  }
  return lines.join("\n");
}

function buildCodeFromSpec(spec: Record<string, unknown>): string {
  switch (asString(spec.chartType)) {
    case "flowchart":
      return buildFlowchartCode(spec);
    case "pie":
      return buildPieCode(spec);
    case "quadrant":
      return buildQuadrantCode(spec);
    case "xychart":
      return buildXYChartCode(spec);
    case "mindmap":
      return buildMindmapCode(spec);
    default:
      throw new Error("generate_chart spec.chartType must be one of: flowchart, pie, quadrant, xychart, or mindmap.");
  }
}

export function resolveGenerateChartPayload(
  input: GenerateChartInput | Record<string, unknown>,
): ResolvedChartPayload {
  const code = asString(input.code);
  const title = asString(input.title);
  const caption = asString(input.caption);
  const downloadFileName = asString(input.downloadFileName);
  const spec = isObject(input.spec) ? input.spec : undefined;
  const resolvedCode = code ? normalizeMermaidCodeForRender(code) : (spec ? buildCodeFromSpec(spec) : undefined);

  if (!resolvedCode) {
    throw new Error("generate_chart requires either a valid Mermaid code string or a structured spec describing the chart.");
  }

  if (!isValidMermaidCode(resolvedCode)) {
    throw new Error("generate_chart requires valid Mermaid code. Start the diagram with a Mermaid type such as 'flowchart TD', 'graph LR', 'pie', 'mindmap', or 'xychart-beta', then retry.");
  }

  return {
    code: resolvedCode,
    title: title ?? (spec ? asString(spec.title) : undefined),
    caption,
    downloadFileName,
  };
}
