// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { initializeMock, renderMock, rasterizeMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn(),
  rasterizeMock: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

vi.mock("./svg-rasterization", async () => {
  const actual = await vi.importActual<typeof import("./svg-rasterization")>("./svg-rasterization");
  return {
    ...actual,
    rasterizeSvgMarkupToPngBlob: rasterizeMock,
  };
});

import {
  getMermaidNodeTruncationDiagnostic,
  normalizeSvgForRasterization,
  renderMermaidChartToPngBlob,
  resetMermaidThemeStateForTests,
  truncateMermaidChartCodeForBrowserRender,
} from "./mermaid-image-derivation";

describe("renderMermaidChartToPngBlob", () => {
  beforeEach(() => {
    resetMermaidThemeStateForTests();
    initializeMock.mockReset();
    renderMock.mockReset();
    rasterizeMock.mockReset();
    renderMock.mockResolvedValue({ svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' });
    rasterizeMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    document.documentElement.style.setProperty("--font-base", "Alegreya Sans");
    document.documentElement.style.setProperty("--surface-muted", "#f1f5f9");
    document.documentElement.style.setProperty("--foreground", "#111111");
    document.documentElement.style.setProperty("--border-color", "#e2e8f0");
    document.documentElement.style.setProperty("--surface-hover", "#e2e8f0");
    document.documentElement.style.setProperty("--surface", "#ffffff");
  });

  afterEach(() => {
    resetMermaidThemeStateForTests();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("class");
  });

  it("reads computed styles only once while the cache is warm", async () => {
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle");

    await renderMermaidChartToPngBlob("flowchart TD\nA-->B");
    await renderMermaidChartToPngBlob("flowchart TD\nB-->C");

    expect(getComputedStyleSpy).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it("re-reads theme tokens after a theme change", async () => {
    await renderMermaidChartToPngBlob("flowchart TD\nA-->B");

    document.documentElement.style.setProperty("--surface-muted", "#00ff00");
    document.documentElement.setAttribute("data-theme", "night");
    await Promise.resolve();

    await renderMermaidChartToPngBlob("flowchart TD\nB-->C");

    expect(initializeMock).toHaveBeenCalledTimes(2);
    expect(initializeMock.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      themeVariables: expect.objectContaining({ primaryColor: "#00ff00" }),
    }));
  });

  it("falls back cleanly when a token is missing", async () => {
    document.documentElement.style.removeProperty("--surface-muted");

    await renderMermaidChartToPngBlob("flowchart TD\nA-->B");

    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({
      themeVariables: expect.objectContaining({ primaryColor: "#f1f5f9" }),
    }));
  });

  it("degrades to re-reading tokens per render when MutationObserver is unavailable", async () => {
    const originalMutationObserver = globalThis.MutationObserver;
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle");

    vi.stubGlobal("MutationObserver", undefined);
    resetMermaidThemeStateForTests();

    await renderMermaidChartToPngBlob("flowchart TD\nA-->B");
    await renderMermaidChartToPngBlob("flowchart TD\nB-->C");

    expect(getComputedStyleSpy).toHaveBeenCalledTimes(2);

    if (originalMutationObserver) {
      vi.stubGlobal("MutationObserver", originalMutationObserver);
    } else {
      vi.unstubAllGlobals();
    }
  });

  it("reports and truncates oversized flowchart node sets before browser render", async () => {
    const oversizedCode = [
      "flowchart TD",
      ...Array.from({ length: 45 }, (_, index) => `N${index + 1}[Node ${index + 1}]`),
      ...Array.from({ length: 44 }, (_, index) => `N${index + 1}-->N${index + 2}`),
    ].join("\n");

    expect(getMermaidNodeTruncationDiagnostic(oversizedCode)).toEqual({
      surface: "mermaid_nodes",
      original: 45,
      rendered: 40,
    });

    const truncated = truncateMermaidChartCodeForBrowserRender(oversizedCode);
    expect(truncated).not.toContain("N41[Node 41]");

    await renderMermaidChartToPngBlob(oversizedCode);

    expect(renderMock).toHaveBeenCalledWith(
      expect.stringMatching(/^mermaid-compose-/),
      truncated,
    );
  });
});

describe("normalizeSvgForRasterization", () => {
  it("injects xmlns and xmlns:xlink onto the root <svg> when missing", () => {
    const input = `<svg viewBox="0 0 100 50"><rect/></svg>`;
    const output = normalizeSvgForRasterization(input);
    expect(output).toContain(`xmlns="http://www.w3.org/2000/svg"`);
    expect(output).toContain(`xmlns:xlink="http://www.w3.org/1999/xlink"`);
  });

  it("does not duplicate xmlns declarations when already present", () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"></svg>`;
    const output = normalizeSvgForRasterization(input);
    const xmlnsMatches = output.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) ?? [];
    const xlinkMatches = output.match(/xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/g) ?? [];
    expect(xmlnsMatches).toHaveLength(1);
    expect(xlinkMatches).toHaveLength(1);
  });

  it("flattens <foreignObject> HTML labels into plain <text> so Safari can decode the SVG", () => {
    // Representative of what mermaid emits for non-flowchart diagrams (pie,
    // sequence, timeline, xychart) where `htmlLabels: false` does not apply.
    const input = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <foreignObject x="10" y="20" width="120" height="40">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <span class="label"><b>Revenue</b> 42%</span>
          </div>
        </foreignObject>
      </svg>
    `;
    const output = normalizeSvgForRasterization(input);
    expect(output).not.toContain("<foreignObject");
    expect(output).toContain(`<text x="10" y="20"`);
    // Inner text content is preserved (whitespace-collapsed).
    expect(output).toMatch(/Revenue\s*42%/);
  });

  it("preserves XML-entity-escaped characters when flattening foreignObject text", () => {
    // Real DOM-serialized foreignObject inner HTML already escapes `<`/`&`
    // as entities; our flattener must not double-escape them.
    const input = `<svg><foreignObject x="0" y="0"><div>A &amp; B &lt; C</div></foreignObject></svg>`;
    const output = normalizeSvgForRasterization(input);
    expect(output).toContain("A &amp; B &lt; C");
  });
});
