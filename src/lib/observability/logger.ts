import { randomUUID } from "node:crypto";
import {
  emitObservabilityEvent,
  subscribeObservability,
} from "@/lib/observability/events";
import { createRawPinoInstance } from "@/adapters/PinoLogger";
import { redactSecrets } from "@/lib/observability/secret-redaction";

export type LogLevel = "info" | "warn" | "error";

const pinoInstance = createRawPinoInstance();

let loggerObserverRegistered = false;

function ensureLoggerObserverRegistered() {
  if (loggerObserverRegistered) {
    return;
  }

  subscribeObservability((event) => {
    if (event.type !== "log") {
      return;
    }

    const { level, event: eventName, context, timestamp } = event.payload;
    const merged = { timestamp, event: eventName, ...context };

    pinoInstance[level](merged, eventName);
  });

  loggerObserverRegistered = true;
}

export function createRequestId(headers?: Headers): string {
  const existing = headers?.get("x-request-id")?.trim();
  return existing && existing.length > 0 ? existing : randomUUID();
}

export function logEvent(
  level: LogLevel,
  event: string,
  context: Record<string, unknown>,
) {
  ensureLoggerObserverRegistered();
  emitObservabilityEvent({
    type: "log",
    payload: {
      timestamp: new Date().toISOString(),
      level,
      event,
      context: redactSecrets(context).value,
    },
  });
}

/** @deprecated Use `mapErrorToResponse` from `@/core/common/errors` instead. Remove after 2025-10-01. */
export function getErrorCode(message: string, status?: number) {
  if (status === 404) {
    return "NOT_FOUND";
  }

  if (status === 401 || status === 403) {
    return "AUTH_ERROR";
  }

  if (
    message === "messages must be a non-empty array." ||
    message === "No user message found."
  ) {
    return "VALIDATION_ERROR";
  }

  if (message.includes("provider")) {
    return "PROVIDER_ERROR";
  }

  return "INTERNAL_ERROR";
}

function serializeError(err: unknown): Record<string, string> | undefined {
  if (!(err instanceof Error)) {
    return undefined;
  }
  return {
    name: err.name,
    message: err.message,
    ...(err.stack ? { stack: err.stack } : {}),
  };
}

export function logDegradation(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  err?: unknown,
): void {
  logEvent("warn", code, {
    message,
    ...context,
    ...(serializeError(err) ? { error: serializeError(err) } : {}),
  });
}

export function logFailure(
  code: string,
  message: string,
  context?: Record<string, unknown>,
  err?: unknown,
): void {
  logEvent("error", code, {
    message,
    ...context,
    ...(serializeError(err) ? { error: serializeError(err) } : {}),
  });
}
