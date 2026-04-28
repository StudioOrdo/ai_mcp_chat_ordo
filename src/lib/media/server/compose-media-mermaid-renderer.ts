import { Worker } from "node:worker_threads";

const MERMAID_RENDER_TIMEOUT_MS = 30_000;

type MermaidRenderWorkerSuccess = {
  ok: true;
  svg: string;
};

type MermaidRenderWorkerFailure = {
  ok: false;
  name?: string;
  message?: string;
  stack?: string[];
};

type MermaidRenderWorkerResult = MermaidRenderWorkerSuccess | MermaidRenderWorkerFailure;

const MERMAID_RENDER_WORKER_SOURCE = `
import { parentPort, workerData } from "node:worker_threads";
import { Buffer } from "node:buffer";
import { JSDOM } from "jsdom";

function installSvgMeasurementPolyfills(prototype) {
  if (!prototype) {
    return;
  }

  if (typeof prototype.getBBox !== "function") {
    prototype.getBBox = function getBBox() {
      const element = this;
      const widthAttr = Number.parseFloat(element.getAttribute("width") ?? "");
      const heightAttr = Number.parseFloat(element.getAttribute("height") ?? "");
      const xAttr = Number.parseFloat(element.getAttribute("x") ?? "0");
      const yAttr = Number.parseFloat(element.getAttribute("y") ?? "0");
      const text = element.textContent?.trim() ?? "";
      const computedWidth = Number.isFinite(widthAttr) && widthAttr > 0
        ? widthAttr
        : Math.max(text.length * 8, 16);
      const computedHeight = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 16;

      return {
        x: Number.isFinite(xAttr) ? xAttr : 0,
        y: Number.isFinite(yAttr) ? yAttr : 0,
        width: computedWidth,
        height: computedHeight,
      };
    };
  }

  if (typeof prototype.getComputedTextLength !== "function") {
    prototype.getComputedTextLength = function getComputedTextLength() {
      const element = this;
      const text = element.textContent?.trim() ?? "";
      return Math.max(text.length * 8, 16);
    };
  }
}

async function withServerDomEnvironment(callback) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });

  installSvgMeasurementPolyfills(dom.window.Element.prototype);
  installSvgMeasurementPolyfills(dom.window.SVGElement?.prototype);
  installSvgMeasurementPolyfills(dom.window.SVGGraphicsElement?.prototype);
  installSvgMeasurementPolyfills(dom.window.SVGTextContentElement?.prototype);
  installSvgMeasurementPolyfills(dom.window.SVGTextPositioningElement?.prototype);
  installSvgMeasurementPolyfills(dom.window.SVGTextElement?.prototype);

  const previousValues = new Map();
  const managedGlobals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    SVGElement: dom.window.SVGElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    DocumentFragment: dom.window.DocumentFragment,
    DOMParser: dom.window.DOMParser,
    XMLSerializer: dom.window.XMLSerializer,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (handle) => clearTimeout(handle),
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  };

  for (const [key, value] of Object.entries(managedGlobals)) {
    previousValues.set(key, Reflect.get(globalThis, key));
    Reflect.set(globalThis, key, value);
  }

  try {
    return await callback();
  } finally {
    for (const [key, previous] of previousValues.entries()) {
      if (previous === undefined) {
        Reflect.deleteProperty(globalThis, key);
      } else {
        Reflect.set(globalThis, key, previous);
      }
    }

    dom.window.close();
  }
}

void withServerDomEnvironment(async () => {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral",
    flowchart: {
      htmlLabels: false,
    },
  });

  const host = document.createElement("div");
  document.body.appendChild(host);

  try {
    const chartCode = typeof workerData?.code === "string" ? workerData.code : "";
    const result = await mermaid.render("compose-chart-worker", chartCode.replace(/\\\\n/g, "\\n"), host);
    parentPort?.postMessage({ ok: true, svg: result.svg });
  } finally {
    host.remove();
  }
}).catch((error) => {
  const workerError = error instanceof Error ? error : new Error(String(error));
  parentPort?.postMessage({
    ok: false,
    name: workerError.name,
    message: workerError.message,
    stack: typeof workerError.stack === "string"
      ? workerError.stack.split("\\n").slice(0, 8)
      : undefined,
  });
});
`;

function createMermaidRenderWorkerError(result: MermaidRenderWorkerFailure): Error {
  const message = result.message ?? "Mermaid render worker failed.";
  const error = new Error(message);
  error.name = result.name ?? "MermaidRenderWorkerError";

  if (result.stack && result.stack.length > 0) {
    error.stack = result.stack.join("\n");
  }

  return error;
}

export async function renderMermaidChartSvg(code: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const worker = new Worker(MERMAID_RENDER_WORKER_SOURCE, {
      eval: true,
      workerData: { code },
    });

    let settled = false;
    const timeoutHandle = setTimeout(() => {
      fail(new Error("Timed out rendering Mermaid chart."));
    }, MERMAID_RENDER_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      void worker.terminate();
    };

    const succeed = (svg: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(svg);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    worker.once("message", (result: MermaidRenderWorkerResult) => {
      if (!result || result.ok !== true) {
        fail(createMermaidRenderWorkerError(result ?? { ok: false }));
        return;
      }

      if (typeof result.svg !== "string" || result.svg.trim().length === 0) {
        fail(new Error("Mermaid renderer returned an empty SVG document."));
        return;
      }

      succeed(result.svg);
    });

    worker.once("error", fail);
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        fail(new Error(`Mermaid render worker exited with code ${code}.`));
      }
    });
  });
}