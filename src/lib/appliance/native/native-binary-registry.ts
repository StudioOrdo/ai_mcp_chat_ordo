import { accessSync, constants, existsSync } from "node:fs";
import path from "node:path";

export type NativeBinaryId = "ordo-backup" | "ordo-runtime";

export interface NativeBinaryDefinition {
  id: NativeBinaryId;
  label: string;
  envPathName: string;
  defaultRelativePath: string;
  disableEnvName?: string;
  required: boolean;
}

export interface NativeBinaryStatus extends NativeBinaryDefinition {
  path: string;
  disabled: boolean;
  configured: boolean;
  available: boolean;
  executable: boolean;
  summary: string;
  remediation: string | null;
}

export const NATIVE_BINARY_DEFINITIONS: readonly NativeBinaryDefinition[] = [
  {
    id: "ordo-backup",
    label: "Backup executor",
    envPathName: "ORDO_BACKUP_EXECUTOR_PATH",
    defaultRelativePath: "bin/ordo-backup",
    disableEnvName: "DISABLE_BACKUP_EXECUTOR",
    required: true,
  },
  {
    id: "ordo-runtime",
    label: "Runtime guard",
    envPathName: "ORDO_RUNTIME_EXECUTOR_PATH",
    defaultRelativePath: "bin/ordo-runtime",
    required: false,
  },
];

export interface NativeBinaryRegistryOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  exists?: (filePath: string) => boolean;
  executable?: (filePath: string) => boolean;
}

export function getNativeBinaryStatus(
  id: NativeBinaryId,
  options: NativeBinaryRegistryOptions = {},
): NativeBinaryStatus {
  const definition = NATIVE_BINARY_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) {
    throw new Error(`Native binary is not registered: ${id}`);
  }

  const env = options.env ?? process.env;
  const configuredPath = env[definition.envPathName]?.trim();
  const binaryPath = configuredPath || path.resolve(options.cwd ?? process.cwd(), definition.defaultRelativePath);
  const disabled = definition.disableEnvName
    ? env[definition.disableEnvName] === "1" || env[definition.disableEnvName] === "true"
    : false;
  const exists = disabled ? false : (options.exists ?? existsSync)(binaryPath);
  const executable = exists ? (options.executable ?? defaultExecutable)(binaryPath) : false;
  const available = exists && executable && !disabled;

  return {
    ...definition,
    path: binaryPath,
    disabled,
    configured: Boolean(configuredPath),
    available,
    executable,
    summary: statusSummary(definition, disabled, exists, executable),
    remediation: statusRemediation(definition, disabled, exists, executable),
  };
}

export function getNativeBinaryRegistry(
  options: NativeBinaryRegistryOptions = {},
): Record<NativeBinaryId, NativeBinaryStatus> {
  return Object.fromEntries(
    NATIVE_BINARY_DEFINITIONS.map((definition) => [
      definition.id,
      getNativeBinaryStatus(definition.id, options),
    ]),
  ) as Record<NativeBinaryId, NativeBinaryStatus>;
}

export function resolveNativeBinaryPath(
  id: NativeBinaryId,
  options: NativeBinaryRegistryOptions = {},
): string {
  return getNativeBinaryStatus(id, options).path;
}

function defaultExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function statusSummary(
  definition: NativeBinaryDefinition,
  disabled: boolean,
  exists: boolean,
  executable: boolean,
): string {
  if (disabled) return `${definition.label} is disabled.`;
  if (!exists) return `${definition.label} binary is unavailable.`;
  if (!executable) return `${definition.label} binary is not executable.`;
  return `${definition.label} binary is available.`;
}

function statusRemediation(
  definition: NativeBinaryDefinition,
  disabled: boolean,
  exists: boolean,
  executable: boolean,
): string | null {
  if (disabled && definition.disableEnvName) {
    return `Unset ${definition.disableEnvName} to enable ${definition.id}.`;
  }
  if (!exists) {
    return `Build or package ${definition.id} and set ${definition.envPathName} if needed.`;
  }
  if (!executable) {
    return `Make the ${definition.id} binary executable.`;
  }
  return null;
}
