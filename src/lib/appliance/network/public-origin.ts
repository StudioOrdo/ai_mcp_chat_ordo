import { getInstanceIdentity } from "@/lib/config/instance";

export type ApplianceNetworkMode = "local" | "reverse_proxy";

export type PublicOriginSource =
  | "ordo_public_origin"
  | "public_site_origin"
  | "next_public_site_origin"
  | "development_localhost"
  | "instance_domain"
  | "missing";

export interface PublicOriginResolution {
  mode: ApplianceNetworkMode;
  origin: string | null;
  source: PublicOriginSource;
  trustProxyHeaders: boolean;
  allowedOrigins: string[];
  errors: string[];
  warnings: string[];
}

export interface PublicOriginResolutionInput {
  env?: Record<string, string | undefined>;
  instanceDomain?: string;
}

interface OriginCandidate {
  key: "ORDO_PUBLIC_ORIGIN" | "PUBLIC_SITE_ORIGIN" | "NEXT_PUBLIC_SITE_ORIGIN";
  source: Extract<PublicOriginSource, "ordo_public_origin" | "public_site_origin" | "next_public_site_origin">;
  value: string;
}

function readEnv(env: Record<string, string | undefined>, key: string): string | null {
  const value = env[key]?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeDomain(value: string): string {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function parseTrustProxyHeaders(env: Record<string, string | undefined>, warnings: string[]): boolean {
  const value = readEnv(env, "TRUST_PROXY_HEADERS");
  if (!value) return false;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  warnings.push("TRUST_PROXY_HEADERS should be 0 or 1.");
  return false;
}

function normalizeOrigin(rawValue: string, key: string, warnings: string[], errors: string[]): string | null {
  try {
    const parsed = new URL(rawValue);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      warnings.push(`${key} included a path, query, or hash and was normalized to ${parsed.origin}.`);
    }
    return parsed.origin;
  } catch {
    errors.push(`${key} is not a valid absolute URL.`);
    return null;
  }
}

function readOriginCandidate(env: Record<string, string | undefined>): OriginCandidate | null {
  const candidates: OriginCandidate[] = [
    { key: "ORDO_PUBLIC_ORIGIN", source: "ordo_public_origin", value: readEnv(env, "ORDO_PUBLIC_ORIGIN") ?? "" },
    { key: "PUBLIC_SITE_ORIGIN", source: "public_site_origin", value: readEnv(env, "PUBLIC_SITE_ORIGIN") ?? "" },
    { key: "NEXT_PUBLIC_SITE_ORIGIN", source: "next_public_site_origin", value: readEnv(env, "NEXT_PUBLIC_SITE_ORIGIN") ?? "" },
  ];

  return candidates.find((candidate) => candidate.value.length > 0) ?? null;
}

function parseAllowedOrigins(env: Record<string, string | undefined>, warnings: string[], errors: string[]): string[] {
  const raw = readEnv(env, "ALLOWED_ORIGINS");
  if (!raw) return [];

  const origins = new Set<string>();
  for (const value of raw.split(",")) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = normalizeOrigin(trimmed, "ALLOWED_ORIGINS", warnings, errors);
    if (normalized) origins.add(normalized);
  }
  return [...origins];
}

function resolveMode(env: Record<string, string | undefined>, errors: string[]): ApplianceNetworkMode {
  const mode = readEnv(env, "ORDO_HOSTED_MODE");
  if (!mode) return "local";
  if (mode === "reverse_proxy") return "reverse_proxy";
  errors.push("ORDO_HOSTED_MODE must be reverse_proxy when set.");
  return "local";
}

export function resolvePublicOrigin(input: PublicOriginResolutionInput = {}): PublicOriginResolution {
  const env = input.env ?? process.env;
  const warnings: string[] = [];
  const errors: string[] = [];
  const mode = resolveMode(env, errors);
  const trustProxyHeaders = parseTrustProxyHeaders(env, warnings);
  const allowedOrigins = parseAllowedOrigins(env, warnings, errors);
  const candidate = readOriginCandidate(env);
  let origin: string | null = null;
  let source: PublicOriginSource = "missing";

  if (candidate) {
    origin = normalizeOrigin(candidate.value, candidate.key, warnings, errors);
    source = candidate.source;
  } else if (mode === "local" && (env.NODE_ENV ?? "development") === "development") {
    const port = readEnv(env, "PORT") ?? "3000";
    origin = `http://localhost:${port}`;
    source = "development_localhost";
  } else if (mode === "local") {
    origin = `https://${normalizeDomain(input.instanceDomain ?? getInstanceIdentity().domain)}`;
    source = "instance_domain";
  }

  if (mode === "reverse_proxy") {
    if (!origin) {
      errors.push("ORDO_PUBLIC_ORIGIN is required when ORDO_HOSTED_MODE=reverse_proxy.");
    } else if (!origin.startsWith("https://")) {
      errors.push("ORDO_PUBLIC_ORIGIN must use https:// when ORDO_HOSTED_MODE=reverse_proxy.");
    }
  }

  return {
    mode,
    origin,
    source,
    trustProxyHeaders,
    allowedOrigins,
    errors,
    warnings,
  };
}

export function getAllowedCsrfOrigins(input: PublicOriginResolutionInput = {}): string[] {
  const resolution = resolvePublicOrigin(input);
  const origins = new Set<string>(resolution.allowedOrigins);
  if (resolution.origin && (resolution.mode === "local" || resolution.origin.startsWith("https://"))) {
    origins.add(resolution.origin);
  }
  return [...origins];
}
