import pino from "pino";
import type { Logger } from "../core/services/ErrorHandler";

export class PinoLogger implements Logger {
  constructor(private readonly pino: pino.Logger) {}

  info(message: string, context?: Record<string, unknown>): void {
    this.pino.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.pino.warn(context ?? {}, message);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.pino.error(context ?? {}, message);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.pino.debug(context ?? {}, message);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.pino.child(bindings));
  }
}

/**
 * Create the application root logger.
 *
 * - In production: JSON to stdout (no transport overhead).
 * - In development: pretty-printed via pino-pretty.
 */
export function createLogger(options?: { level?: string }): Logger {
  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";

  const instance = pino({
    level: isTest ? "silent" : options?.level ?? "info",
    ...(isProduction || isTest
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        }),
  });

  return new PinoLogger(instance);
}

/**
 * Create a pino.Logger instance for direct use in the observability layer.
 * This is the raw pino instance (not wrapped in PinoLogger) so that
 * logEvent() can call pino methods with the (context, message) convention.
 */
export function createRawPinoInstance(options?: { level?: string }): pino.Logger {
  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";

  return pino({
    level: isTest ? "silent" : options?.level ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(isProduction || isTest
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        }),
  });
}
