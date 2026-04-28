import mermaid from "mermaid";
import {
  normalizeSvgForRasterization as normalizeSvgMarkupForRasterization,
  rasterizeSvgMarkupToPngBlob,
} from "./svg-rasterization";

const MERMAID_MAX_FLOWCHART_NODES = 40;

type MermaidThemeTokens = {
  signature: string;
  fontFamily: string;
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  lineColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  nodeBorder: string;
  clusterBorder: string;
  titleColor: string;
  edgeLabelBackground: string;
};

let cachedThemeTokens: MermaidThemeTokens | null = null;
let themeObserver: MutationObserver | null = null;
let themeDirty = true;
let lastInitializedThemeSignature: string | null = null;

function getThemeSignature(style: CSSStyleDeclaration): string {
  return [
    document.documentElement.getAttribute("data-theme") ?? "",
    document.documentElement.className,
    style.getPropertyValue("--font-base"),
    style.getPropertyValue("--surface-muted"),
    style.getPropertyValue("--foreground"),
    style.getPropertyValue("--border-color"),
    style.getPropertyValue("--surface-hover"),
    style.getPropertyValue("--surface"),
  ].join("|");
}

function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1] ?? "0";
    const g = trimmed[2] ?? "0";
    const b = trimmed[3] ?? "0";
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return fallback;
}

function readThemeTokensFromComputedStyle(): MermaidThemeTokens {
  const style = getComputedStyle(document.documentElement);
  return {
    signature: getThemeSignature(style),
    fontFamily: style.getPropertyValue("--font-base").trim() || "sans-serif",
    primaryColor: normalizeHexColor(style.getPropertyValue("--surface-muted"), "#f1f5f9"),
    primaryTextColor: normalizeHexColor(style.getPropertyValue("--foreground"), "#111111"),
    primaryBorderColor: normalizeHexColor(style.getPropertyValue("--border-color"), "#e2e8f0"),
    lineColor: normalizeHexColor(style.getPropertyValue("--foreground"), "#111111"),
    secondaryColor: normalizeHexColor(style.getPropertyValue("--surface-muted"), "#f1f5f9"),
    tertiaryColor: normalizeHexColor(style.getPropertyValue("--surface-hover"), "#f1f5f9"),
    nodeBorder: normalizeHexColor(style.getPropertyValue("--border-color"), "#e2e8f0"),
    clusterBorder: normalizeHexColor(style.getPropertyValue("--border-color"), "#e2e8f0"),
    titleColor: normalizeHexColor(style.getPropertyValue("--foreground"), "#111111"),
    edgeLabelBackground: normalizeHexColor(style.getPropertyValue("--surface"), "#ffffff"),
  };
}

function ensureThemeObserver(): void {
  if (typeof MutationObserver === "undefined") {
    return;
  }

  if (themeObserver) {
    return;
  }

  themeObserver = new MutationObserver(() => {
    themeDirty = true;
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class", "data-theme"],
  });
}

function getThemeTokens(): MermaidThemeTokens {
  ensureThemeObserver();

  if (typeof MutationObserver === "undefined") {
    return readThemeTokensFromComputedStyle();
  }

  if (!cachedThemeTokens || themeDirty) {
    cachedThemeTokens = readThemeTokensFromComputedStyle();
    themeDirty = false;
  }

  return cachedThemeTokens;
}

function ensureMermaidInitialized(): void {
  const tokens = getThemeTokens();
  if (lastInitializedThemeSignature === tokens.signature) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      fontFamily: tokens.fontFamily,
      primaryColor: tokens.primaryColor,
      primaryTextColor: tokens.primaryTextColor,
      primaryBorderColor: tokens.primaryBorderColor,
      lineColor: tokens.lineColor,
      secondaryColor: tokens.secondaryColor,
      tertiaryColor: tokens.tertiaryColor,
      mainBkg: "transparent",
      nodeBorder: tokens.nodeBorder,
      clusterBkg: "transparent",
      clusterBorder: tokens.clusterBorder,
      titleColor: tokens.titleColor,
      edgeLabelBackground: tokens.edgeLabelBackground,
    },
    flowchart: {
      htmlLabels: true,
      curve: "basis",
    },
  });

  lastInitializedThemeSignature = tokens.signature;
}

function extractMermaidNodeIds(code: string): string[] {
  const nodeLines = code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\w+\[[^\]]+\]$/.test(line));
  return nodeLines.map((line) => line.split("[")[0] ?? "").filter((id) => id.length > 0);
}

export function getMermaidNodeTruncationDiagnostic(code: string): {
  surface: "mermaid_nodes";
  original: number;
  rendered: number;
} | null {
  const nodeIds = extractMermaidNodeIds(code);
  if (nodeIds.length <= MERMAID_MAX_FLOWCHART_NODES) {
    return null;
  }

  return {
    surface: "mermaid_nodes",
    original: nodeIds.length,
    rendered: MERMAID_MAX_FLOWCHART_NODES,
  };
}

export function truncateMermaidChartCodeForBrowserRender(code: string): string {
  const nodeIds = extractMermaidNodeIds(code);
  if (nodeIds.length <= MERMAID_MAX_FLOWCHART_NODES) {
    return code;
  }

  const allowed = new Set(nodeIds.slice(0, MERMAID_MAX_FLOWCHART_NODES));
  const lines = code.split("\n");

  return lines.filter((line) => {
    const trimmed = line.trim();
    const nodeMatch = /^(\w+)\[[^\]]+\]$/.exec(trimmed);
    if (!nodeMatch) {
      return true;
    }
    return allowed.has(nodeMatch[1] ?? "");
  }).join("\n");
}

export function normalizeSvgForRasterization(svgMarkup: string): string {
  return normalizeSvgMarkupForRasterization(svgMarkup);
}

export function resetMermaidThemeStateForTests(): void {
  cachedThemeTokens = null;
  themeDirty = true;
  lastInitializedThemeSignature = null;
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
}

export async function renderMermaidChartToPngBlob(code: string): Promise<Blob> {
  ensureMermaidInitialized();

  const renderId = `mermaid-compose-${Math.random().toString(36).slice(2, 9)}`;
  const processedCode = truncateMermaidChartCodeForBrowserRender(code);
  const { svg } = await mermaid.render(renderId, processedCode);

  return rasterizeSvgMarkupToPngBlob(svg);
}