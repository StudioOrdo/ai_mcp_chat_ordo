import { readFileSync } from "node:fs";

export type SecretSource = "env" | "file" | "missing";

export interface ResolvedRuntimeSecret {
  key: string;
  value: string | null;
  source: SecretSource;
  fileKey?: string;
  error?: string;
  configured: boolean;
}

function normalizeSecret(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSecretFile(filePath: string): { value: string | null; error?: string } {
  try {
    return { value: normalizeSecret(readFileSync(filePath, "utf8")) };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : "Secret file could not be read.",
    };
  }
}

export function resolveRuntimeSecret(
  key: string,
  env: Record<string, string | undefined> = process.env,
): ResolvedRuntimeSecret {
  const direct = normalizeSecret(env[key]);
  if (direct) {
    return {
      key,
      value: direct,
      source: "env",
      configured: true,
    };
  }

  const fileKey = `${key}_FILE`;
  const filePath = normalizeSecret(env[fileKey]);
  if (filePath) {
    const file = readSecretFile(filePath);
    return {
      key,
      fileKey,
      value: file.value,
      source: file.value ? "file" : "missing",
      configured: file.value !== null,
      ...(file.error ? { error: `Secret file configured by ${fileKey} could not be read.` } : {}),
    };
  }

  return {
    key,
    value: null,
    source: "missing",
    configured: false,
  };
}

export function resolveFirstConfiguredSecret(
  keys: readonly string[],
  env: Record<string, string | undefined> = process.env,
): ResolvedRuntimeSecret {
  let firstMissing: ResolvedRuntimeSecret | null = null;
  for (const key of keys) {
    const resolved = resolveRuntimeSecret(key, env);
    if (resolved.configured) {
      return resolved;
    }
    firstMissing ??= resolved;
  }
  return firstMissing ?? resolveRuntimeSecret(keys[0] ?? "UNKNOWN_SECRET", env);
}
