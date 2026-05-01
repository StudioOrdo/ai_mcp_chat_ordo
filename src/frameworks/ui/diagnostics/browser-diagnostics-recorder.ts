"use client";

import { redactDiagnostics } from "@/lib/diagnostics/redaction";

export interface BrowserDiagnosticRecord {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: "console" | "window_error" | "unhandled_rejection" | "fetch";
  message: string;
  data?: unknown;
  url?: string;
}

export interface BrowserDiagnosticsSnapshot {
  capturedAt: string;
  records: BrowserDiagnosticRecord[];
  droppedCount: number;
}

export interface BrowserDiagnosticsRecorder {
  capture(record: Omit<BrowserDiagnosticRecord, "timestamp">): void;
  snapshot(): BrowserDiagnosticsSnapshot;
  dispose(): void;
}

export interface CreateBrowserDiagnosticsRecorderOptions {
  maxRecords?: number;
  captureInfoAndDebug?: boolean;
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return "Unknown browser error";
}

function serializeArgs(args: unknown[]): { message: string; data?: unknown } {
  const message = args.map((arg) => typeof arg === "string" ? arg : JSON.stringify(redactDiagnostics(arg).value)).join(" ");
  return {
    message,
    data: args.length > 1 ? redactDiagnostics(args.slice(1)).value : undefined,
  };
}

export function createBrowserDiagnosticsRecorder(
  options: CreateBrowserDiagnosticsRecorderOptions = {},
): BrowserDiagnosticsRecorder {
  const maxRecords = Math.max(1, options.maxRecords ?? 100);
  const records: BrowserDiagnosticRecord[] = [];
  let droppedCount = 0;
  const cleanups: Array<() => void> = [];

  const capture: BrowserDiagnosticsRecorder["capture"] = (record) => {
    const redacted = redactDiagnostics(record).value;
    if (records.length >= maxRecords) {
      records.shift();
      droppedCount += 1;
    }
    records.push({
      ...redacted,
      timestamp: new Date().toISOString(),
    });
  };

  if (typeof window !== "undefined") {
    const handleError = (event: ErrorEvent) => {
      capture({
        level: "error",
        source: "window_error",
        message: event.message || errorMessage(event.error),
        data: event.error ? { name: event.error.name, stack: event.error.stack } : undefined,
        url: event.filename || undefined,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      capture({
        level: "error",
        source: "unhandled_rejection",
        message: errorMessage(event.reason),
        data: event.reason,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    cleanups.push(() => window.removeEventListener("error", handleError));
    cleanups.push(() => window.removeEventListener("unhandledrejection", handleUnhandledRejection));
  }

  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.warn = (...args: unknown[]) => {
    capture({ level: "warn", source: "console", ...serializeArgs(args) });
    originalWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    capture({ level: "error", source: "console", ...serializeArgs(args) });
    originalError(...args);
  };

  if (options.captureInfoAndDebug) {
    console.info = (...args: unknown[]) => {
      capture({ level: "info", source: "console", ...serializeArgs(args) });
      originalInfo(...args);
    };
    console.debug = (...args: unknown[]) => {
      capture({ level: "debug", source: "console", ...serializeArgs(args) });
      originalDebug(...args);
    };
  }

  cleanups.push(() => {
    console.warn = originalWarn;
    console.error = originalError;
    console.info = originalInfo;
    console.debug = originalDebug;
  });

  return {
    capture,
    snapshot: () => ({
      capturedAt: new Date().toISOString(),
      records: [...records],
      droppedCount,
    }),
    dispose: () => {
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
    },
  };
}
